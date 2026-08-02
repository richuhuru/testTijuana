// whatsappSender.js — Envio por REST (Twilio) para mensajes interactivos (botones).
// Se usa solo cuando INTERACTIVE=1 y hay credenciales de Twilio.
// Botones: quick-reply (hasta 3) via Content API, sin aprobacion (mensajes en sesion).

const SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM; // sandbox: whatsapp:+14155238886
const authHeader = "Basic " + Buffer.from(`${SID}:${AUTH}`).toString("base64");

function ready() {
  return process.env.INTERACTIVE === "1" && SID && AUTH && FROM;
}

async function sendText(to, body, mediaUrl) {
  const p = { From: FROM, To: to, Body: body || "" };
  if (mediaUrl) p.MediaUrl = mediaUrl;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(p)
  });
  const j = await res.json();
  if (res.status >= 300) throw new Error("sendText: " + JSON.stringify(j));
  return j;
}

// Cache de ContentSid por numero de botones (1..3)
const tplCache = {};
async function ensureTemplate(n) {
  if (tplCache[n]) return tplCache[n];
  const actions = [];
  for (let i = 0; i < n; i++) actions.push({ title: `{{${i + 2}}}`, id: `o${i + 1}` });
  const payload = {
    friendly_name: `uts_qr_${n}`,
    language: "es",
    variables: {},
    types: { "twilio/quick-reply": { body: "{{1}}", actions } }
  };
  const res = await fetch("https://content.twilio.com/v1/Content", {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const j = await res.json();
  if (res.status >= 300) throw new Error("ensureTemplate: " + JSON.stringify(j));
  tplCache[n] = j.sid;
  return j.sid;
}

async function sendButtons(to, body, options) {
  const opts = options.slice(0, 3);
  const n = opts.length;
  const sid = await ensureTemplate(n);
  const vars = { "1": body || "Elige una opción:" };
  opts.forEach((o, i) => { vars[String(i + 2)] = String(o).slice(0, 20); });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: FROM, To: to, ContentSid: sid, ContentVariables: JSON.stringify(vars) })
  });
  const j = await res.json();
  if (res.status >= 300) throw new Error("sendButtons: " + JSON.stringify(j));
  return j;
}

// Lista tocable (list-picker), hasta 10 items en sesion
const listTplCache = {};
async function ensureListTemplate(n) {
  if (listTplCache[n]) return listTplCache[n];
  const items = [];
  for (let i = 0; i < n; i++) items.push({ item: `{{${i + 2}}}`, id: `i${i + 1}`, description: "" });
  const payload = {
    friendly_name: `uts_list_${n}`,
    language: "es",
    variables: {},
    types: { "twilio/list-picker": { body: "{{1}}", button: "Ver opciones", items } }
  };
  const res = await fetch("https://content.twilio.com/v1/Content", {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const j = await res.json();
  if (res.status >= 300) throw new Error("ensureListTemplate: " + JSON.stringify(j));
  listTplCache[n] = j.sid;
  return j.sid;
}

async function sendList(to, body, options) {
  const opts = options.slice(0, 10);
  const n = opts.length;
  const sid = await ensureListTemplate(n);
  const vars = { "1": body || "Elige una opción:" };
  opts.forEach((o, i) => { vars[String(i + 2)] = String(o).slice(0, 24); });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: FROM, To: to, ContentSid: sid, ContentVariables: JSON.stringify(vars) })
  });
  const j = await res.json();
  if (res.status >= 300) throw new Error("sendList: " + JSON.stringify(j));
  return j;
}

module.exports = { ready, sendText, sendButtons, sendList };
