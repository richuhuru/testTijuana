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

// --- Webhook de mensajes entrantes (WhatsApp y SMS usan el mismo handler) ---
async function inboundHandler(req, res) {
  const from = req.body.From || "unknown";
  const body = (req.body.Body || "").trim();
  const isWhatsApp = from.startsWith("whatsapp:");        // SMS = numero sin prefijo
  const useInteractive = isWhatsApp && sender.ready();     // botones/listas: solo WhatsApp
  console.log(`[in] From=${from} channel=${isWhatsApp ? "wa" : "sms"} Body=${JSON.stringify(body)}`);
  const restaurant = getRestaurant(process.env.RESTAURANT_ID);
  const session = getSession(from, restaurant.id);

  // Ubicacion compartida por WhatsApp (Adjuntar -> Ubicacion). En SMS no aplica.
  const hasLoc = req.body.Latitude && req.body.Longitude;
  if (hasLoc) {
    session.geo = { lat: req.body.Latitude, lng: req.body.Longitude, address: req.body.Address || "" };
  }
  const inbound = hasLoc ? "__LOCATION__" : body;

  // Boton/frase "Ver menu": responder con el link oficial del menu (deterministico)
  const nb = (body || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!hasLoc && /^(ver\s+(el\s+)?menu|menu|ver\s+(la\s+)?carta|carta|ver\s+todo\s+el\s+menu)$/.test(nb)) {
    const link = "Aquí tienes nuestro menú completo 👉 https://www.tijuanasbarandgrill.com/es/menu/\n\nCuando decidas, dime el nombre del plato y lo agrego. 😊";
    if (useInteractive) {
      res.type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      sender.sendText(from, link).catch(e => console.error("menu link send:", e.message));
    } else {
      res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>${xmlEscape(link)}</Body></Message></Response>`);
    }
    return;
  }

  const reply = await handleTurn(session, restaurant, inbound);
  const media = session.pendingMedia; session.pendingMedia = null;
  const opts = session.pendingOptions; session.pendingOptions = null;

  const sugg = session.pendingSuggestions; session.pendingSuggestions = null;

  // Opciones por defecto (minimo esfuerzo): si el pedido esta vacio y el agente no propuso opciones.
  let eff = opts;
  // Solo en el saludo inicial (primer turno) usamos las categorias fijas; luego Nacho da opciones contextuales.
  if ((!eff || !eff.options || !eff.options.length) && !sugg && session.cart.length === 0 && !session.placed && session.history.length <= 2) {
    eff = { options: ["Ver menú", "Especialidades", "Bebidas"] };
  }

  if (useInteractive) {
    // WhatsApp interactivo: responder vacio y enviar por REST (botones tactiles)
    res.type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    (async () => {
      try {
        if (sugg && sugg.items && sugg.items.length) {
          if (reply && reply.trim()) await sender.sendText(from, reply);
          for (const it of sugg.items) {
            await sender.sendText(from, `${it.name} — $${it.price.toFixed(2)}`, it.image || undefined);
          }
          const names = sugg.items.map(it => it.name).slice(0, 3);
          if (names.length) await sender.sendButtons(from, "¿Cuál te preparo? 😋", names);
        } else if (eff && eff.options && eff.options.length >= 1 && eff.options.length <= 3) {
          await sender.sendButtons(from, reply, eff.options.slice(0, 3));
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

  // SMS (o WhatsApp sin INTERACTIVE): TwiML de texto + MMS. Opciones como texto numerado.
  let text = reply;
  let mmedia = media;
  if (sugg && sugg.items && sugg.items.length) {
    text += "\n" + sugg.items.map((it, i) => `${i + 1}) ${it.name} — $${it.price.toFixed(2)}`).join("\n");
    if (!mmedia) mmedia = sugg.items[0].image || null; // al menos la primera foto como MMS
  } else if (eff && eff.options && eff.options.length) {
    text += "\n" + eff.options.map((o, i) => `${i + 1}) ${o}`).join("   ");
  }
  const mediaTag = mmedia ? `<Media>${xmlEscape(mmedia)}</Media>` : "";
  res.type("text/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>${xmlEscape(text)}</Body>${mediaTag}</Message></Response>`
  );
}

app.post("/whatsapp", inboundHandler);
app.post("/sms", inboundHandler);

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
