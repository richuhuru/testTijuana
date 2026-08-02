// server.js — UTS Comunica: backend del agente de ordenes con IA (Twilio WhatsApp + Voz).
// Endpoints:
//   GET  /                    -> health check
//   GET  /twiml/:restaurant   -> TwiML <ConversationRelay> para voz
//   POST /whatsapp            -> webhook de WhatsApp (Twilio)
//   POST /stripe-webhook      -> confirmacion de pago (opcional)
//   WS   /relay               -> Conversation Relay (voz)

const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");

const { getRestaurant } = require("./menus");
const { getSession } = require("./orders");
const { handleTurn } = require("./agent");
const sender = require("./whatsappSender");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use("/stripe-webhook", express.raw({ type: "*/*" })); // raw para firma Stripe
app.use(express.json());

const PORT = process.env.PORT || 3000;

function xmlEscape(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}

// --- Health ---
app.get("/", (req, res) => res.type("text/plain").send("UTS Comunica backend OK"));

// --- TwiML para voz (Conversation Relay) ---
app.get("/twiml/:restaurant", (req, res) => {
  const restaurant = getRestaurant(req.params.restaurant);
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const wss = `wss://${host}/relay?restaurant=${restaurant.id}`;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay url="${xmlEscape(wss)}" welcomeGreeting="${xmlEscape(restaurant.greeting)}" language="es-MX" ttsProvider="Google" />
  </Connect>
</Response>`;
  res.type("text/xml").send(twiml);
});

// --- WhatsApp webhook ---
app.post("/whatsapp", async (req, res) => {
  const from = req.body.From || "unknown";
  const body = (req.body.Body || "").trim();
  const restaurant = getRestaurant(process.env.RESTAURANT_ID);
  const session = getSession(from, restaurant.id);

  // Ubicacion compartida por WhatsApp (Adjuntar -> Ubicacion)
  const hasLoc = req.body.Latitude && req.body.Longitude;
  if (hasLoc) {
    session.geo = { lat: req.body.Latitude, lng: req.body.Longitude, address: req.body.Address || "" };
  }
  const inbound = hasLoc ? "__LOCATION__" : body;

  const reply = await handleTurn(session, restaurant, inbound);

  const media = session.pendingMedia; session.pendingMedia = null;
  const opts = session.pendingOptions; session.pendingOptions = null;

  if (sender.ready()) {
    // Modo interactivo: responder vacio y enviar por REST (permite botones tactiles)
    res.type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    (async () => {
      try {
        if (opts && opts.options && opts.options.length && opts.options.length <= 3) {
          await sender.sendButtons(from, reply, opts.options);
        } else {
          await sender.sendText(from, reply, media);
        }
      } catch (e) {
        console.error("interactive send error:", e.message);
        try { await sender.sendText(from, reply, media); } catch (_) {}
      }
    })();
    return;
  }

  const mediaTag = media ? `<Media>${xmlEscape(media)}</Media>` : "";
  res.type("text/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>${xmlEscape(reply)}</Body>${mediaTag}</Message></Response>`
  );
});

// --- Stripe webhook (opcional) ---
app.post("/stripe-webhook", (req, res) => {
  // Para produccion: verificar firma con STRIPE_WEBHOOK_SECRET y stripe.webhooks.constructEvent.
  // Aqui solo confirmamos recepcion; place_order ya ocurre al confirmar el pedido.
  console.log("[stripe-webhook] evento recibido");
  res.json({ received: true });
});

// --- HTTP + WebSocket (voz) ---
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);
  if (pathname === "/relay") {
    wss.handleUpgrade(request, socket, head, ws => wss.emit("connection", ws, request));
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws, request) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const restaurant = getRestaurant(url.searchParams.get("restaurant") || process.env.RESTAURANT_ID);
  let sessionId = "call-" + Date.now();

  ws.on("message", async raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }

    if (msg.type === "setup") {
      sessionId = msg.callSid || msg.sessionId || sessionId;
      getSession(sessionId, restaurant.id);
      return; // el saludo lo da welcomeGreeting en el TwiML
    }

    if (msg.type === "prompt") {
      const userText = msg.voicePrompt || msg.text || "";
      const session = getSession(sessionId, restaurant.id);
      const reply = await handleTurn(session, restaurant, userText);
      ws.send(JSON.stringify({ type: "text", token: reply, last: true }));
      return;
    }
    // 'interrupt' u otros: ignorar en esta version.
  });

  ws.on("close", () => { /* limpieza opcional */ });
});

server.listen(PORT, () => console.log(`UTS Comunica escuchando en :${PORT}  (MOCK_LLM=${process.env.MOCK_LLM || "0"})`));

module.exports = app;
