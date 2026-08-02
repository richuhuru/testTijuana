// messaging.js — Envio de mensajes WhatsApp/SMS via Twilio y notificacion a cocina.
// En modo MOCK (sin credenciales o MOCK_LLM=1) solo hace console.log.

const MOCK = process.env.MOCK_LLM === "1" || !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN;
let client = null;
if (!MOCK) {
  // eslint-disable-next-line global-require
  client = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function sendWhatsApp(to, body) {
  if (MOCK) {
    console.log(`[MOCK WhatsApp] -> ${to}: ${body}`);
    return { ok: true, mock: true };
  }
  const msg = await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
    body
  });
  return { ok: true, sid: msg.sid };
}

// Notifica el pedido a la cocina (WhatsApp al personal). Fase 1 del runbook.
async function notifyKitchen(session, restaurant) {
  const to = process.env.KITCHEN_NOTIFY_TO;
  const lines = session.cart.map(l => `- ${l.qty}x ${l.name}${l.notes ? ` (${l.notes})` : ""}`);
  const total = session.cart.reduce((s, l) => s + l.price * l.qty, 0).toFixed(2);
  const body = [
    `NUEVA ORDEN — ${restaurant.name}`,
    `Cliente: ${session.id}`,
    `Tipo: ${session.fulfillment || "(no indicado)"}`,
    ...lines,
    `Total: $${total}`,
    session.paymentUrl ? `Pago: ${session.paymentUrl}` : "Pago: pendiente"
  ].join("\n");

  if (MOCK || !to) {
    console.log(`[MOCK Cocina]\n${body}`);
    return { ok: true, mock: true };
  }
  return sendWhatsApp(to, body);
}

module.exports = { sendWhatsApp, notifyKitchen };
