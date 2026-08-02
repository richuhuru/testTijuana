// agent.js — El "cerebro": ejecuta un turno del agente.
// Modo MOCK_LLM=1: heuristica sin claves (para la primera prueba en Render).
// Modo real: OpenAI o Anthropic con function calling (tools).

const { systemPrompt, TOOLS } = require("./menus");
const { cartTotal, cartSummary } = require("./orders");
const { createPaymentLink } = require("./payments");
const { notifyKitchen } = require("./messaging");

function normalize(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ---------- Ejecucion de tools (compartida por mock y LLM real) ----------
async function executeTool(session, restaurant, name, args) {
  args = args || {};
  switch (name) {
    case "add_item": {
      const item = restaurant.menu.find(m => m.id === args.item_id);
      if (!item) return { ok: false, error: `item_id desconocido: ${args.item_id}` };
      const qty = Math.max(1, parseInt(args.qty, 10) || 1);
      const existing = session.cart.find(l => l.item_id === item.id && (l.size || "") === (args.size || ""));
      if (existing) existing.qty += qty;
      else session.cart.push({ item_id: item.id, name: item.name, qty, price: item.price, size: args.size || item.size, notes: args.notes });
      return { ok: true, added: `${qty}x ${item.name}`, order: session.cart, total: cartTotal(session.cart) };
    }
    case "remove_item": {
      const before = session.cart.length;
      session.cart = session.cart.filter(l => l.item_id !== args.item_id);
      return { ok: session.cart.length < before, order: session.cart, total: cartTotal(session.cart) };
    }
    case "get_order":
      return { ok: true, order: session.cart, total: cartTotal(session.cart), summary: cartSummary(session.cart) };
    case "create_payment":
      return createPaymentLink(session, restaurant);
    case "place_order": {
      if (!session.cart.length) return { ok: false, error: "El pedido esta vacio." };
      await notifyKitchen(session, restaurant);
      session.placed = true;
      return { ok: true, placed: true, total: cartTotal(session.cart) };
    }
    case "set_fulfillment": {
      const ft = (args.type || "").toLowerCase();
      session.fulfillment = ft.includes("recog") ? "para recoger" : "para llevar";
      return { ok: true, fulfillment: session.fulfillment };
    }
    case "send_photo": {
      const it = restaurant.menu.find(m => m.id === args.item_id);
      if (!it || !it.image) return { ok: false, error: "Ese plato no tiene foto." };
      session.pendingMedia = it.image;
      return { ok: true, sent: it.name };
    }
    case "set_address": {
      session.address = (args.address || "").trim();
      session.awaitingAddress = false;
      return { ok: true, address: session.address };
    }
    default:
      return { ok: false, error: `tool desconocida: ${name}` };
  }
}

// ---------- MODO MOCK ----------
const NUM_WORDS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };

function parseQtyBefore(tokens, idx) {
  for (let j = idx - 1; j >= Math.max(0, idx - 3); j--) {
    const t = tokens[j];
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    if (NUM_WORDS[t] != null) return NUM_WORDS[t];
  }
  return 1;
}

function mockDetectItems(text, restaurant) {
  const norm = " " + normalize(text).replace(/[.,!?]/g, " ").replace(/\s+/g, " ") + " ";
  const tokens = norm.trim().split(/\s+/);
  const found = [];
  const used = new Set();
  // ordenar keywords de mas larga a mas corta para preferir el match mas especifico
  const candidates = [];
  for (const item of restaurant.menu) {
    for (const kw of item.keywords) candidates.push({ item, kw: normalize(kw) });
  }
  candidates.sort((a, b) => b.kw.length - a.kw.length);
  for (const { item, kw } of candidates) {
    if (used.has(item.id)) continue;
    if (norm.indexOf(" " + kw + " ") >= 0 || norm.indexOf(" " + kw) >= 0) {
      const firstWord = kw.split(" ")[0];
      const idx = tokens.indexOf(firstWord);
      const qty = idx >= 0 ? parseQtyBefore(tokens, idx) : 1;
      found.push({ item_id: item.id, qty });
      used.add(item.id);
    }
  }
  return found;
}

function wantsConfirm(text) {
  return /(confirm|pagar|paga|listo|eso es todo|es todo|nada mas|ya esta|checkout|cobrar)/i.test(normalize(text));
}

function detectFulfillment(text) {
  const n = normalize(text);
  if (/recog|pick ?up|recojo|paso a buscar/.test(n)) return "para recoger";
  if (/para llevar|llevar|to ?go|para ir|delivery|entrega|a domicilio/.test(n)) return "para llevar";
  return null;
}

function upsellSatisfied(session, restaurant) {
  const cats = (restaurant.upsell && restaurant.upsell.categories) || [];
  if (!cats.length) return true;
  return session.cart.some(l => {
    const it = restaurant.menu.find(m => m.id === l.item_id);
    return it && cats.includes(it.category);
  });
}

async function mockAgent(session, restaurant, userText) {
  if (session.awaitingAddress && userText.trim() && !wantsConfirm(userText) && !detectFulfillment(userText)) {
    session.address = userText.trim();
    session.awaitingAddress = false;
    return `Anotado. Entregaremos en: ${session.address}.\n\n${cartSummary(session.cart)}\n\n¿Confirmo tu pedido?`;
  }

  const items = mockDetectItems(userText, restaurant);
  const addedNames = [];
  for (const it of items) {
    const r = await executeTool(session, restaurant, "add_item", it);
    if (r.ok) addedNames.push(r.added);
  }

  const ff = detectFulfillment(userText);
  if (ff) session.fulfillment = ff;

  if (wantsConfirm(userText) && session.cart.length) {
    if (!session.fulfillment) {
      return `Antes de confirmar: ¿la orden es para llevar o para recoger?`;
    }
    if (session.fulfillment === "para llevar" && !session.address) {
      session.awaitingAddress = true;
      return `¿A qué dirección la enviamos?`;
    }
    const pay = await executeTool(session, restaurant, "create_payment", {});
    await executeTool(session, restaurant, "place_order", {});
    const total = cartTotal(session.cart).toFixed(2);
    return `¡Perfecto! Tu total es $${total} (${session.fulfillment}${session.address ? " a " + session.address : ""}).\nPaga aqui: ${pay.url}\nYa enviamos tu orden a la cocina de ${restaurant.name}. ¡Gracias!`;
  }

  const parts = [];
  if (addedNames.length) parts.push(`Agregue: ${addedNames.join(", ")}.`);
  else if (!session.cart.length) return `${restaurant.greeting}`;

  parts.push(`\n${cartSummary(session.cart)}`);

  const upsellPrompt = (restaurant.upsell && restaurant.upsell.prompt) || "¿Te agrego una bebida o un postre?";
  if (!session.upsold && session.cart.length && !upsellSatisfied(session, restaurant)) {
    session.upsold = true;
    parts.push(`\n${upsellPrompt}`);
  } else if (session.cart.length && !session.fulfillment) {
    parts.push(`\n¿La orden es para llevar o para recoger?`);
  } else if (session.cart.length && session.fulfillment === "para llevar" && !session.address) {
    session.awaitingAddress = true;
    parts.push(`\n¿A qué dirección la enviamos?`);
  } else {
    parts.push(`\n¿Deseas algo mas o confirmo tu pedido?`);
  }
  return parts.join("\n");
}

// ---------- MODO LLM REAL ----------
function pickProvider() {
  if (process.env.LLM_PROVIDER) return process.env.LLM_PROVIDER.toLowerCase();
  const m = (process.env.LLM_MODEL || "").toLowerCase();
  if (m.startsWith("claude")) return "anthropic";
  return "openai";
}

async function runOpenAI(sys, messages, restaurant, session) {
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const tools = TOOLS.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const work = [{ role: "system", content: sys }, ...messages];
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LLM_API_KEY}` },
      body: JSON.stringify({ model, messages: work, tools, tool_choice: "auto" })
    });
    const data = await res.json();
    if (data.error) throw new Error("OpenAI: " + JSON.stringify(data.error));
    const msg = data.choices[0].message;
    work.push(msg);
    if (msg.tool_calls && msg.tool_calls.length) {
      for (const tc of msg.tool_calls) {
        let a = {};
        try { a = JSON.parse(tc.function.arguments || "{}"); } catch (e) { /* ignore */ }
        const result = await executeTool(session, restaurant, tc.function.name, a);
        work.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      continue;
    }
    return msg.content || "";
  }
  return "Disculpa, tuve un problema procesando tu pedido. ¿Puedes repetirlo?";
}

async function runAnthropic(sys, messages, restaurant, session) {
  const model = process.env.LLM_MODEL || "claude-sonnet-5";
  const tools = TOOLS.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  const work = messages.map(m => ({ role: m.role, content: m.content }));
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.LLM_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 1024, system: sys, messages: work, tools })
    });
    const data = await res.json();
    if (data.error) throw new Error("Anthropic: " + JSON.stringify(data.error));
    work.push({ role: "assistant", content: data.content });
    const toolUses = (data.content || []).filter(b => b.type === "tool_use");
    if (toolUses.length) {
      const results = [];
      for (const tu of toolUses) {
        const result = await executeTool(session, restaurant, tu.name, tu.input || {});
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
      }
      work.push({ role: "user", content: results });
      continue;
    }
    return (data.content || []).filter(b => b.type === "text").map(b => b.text).join(" ").trim();
  }
  return "Disculpa, tuve un problema procesando tu pedido. ¿Puedes repetirlo?";
}

async function llmAgent(session, restaurant, userText) {
  const sys = systemPrompt(restaurant);
  const messages = [...session.history, { role: "user", content: userText }];
  const provider = pickProvider();
  return provider === "anthropic"
    ? runAnthropic(sys, messages, restaurant, session)
    : runOpenAI(sys, messages, restaurant, session);
}

// ---------- Entrada publica ----------
async function handleTurn(session, restaurant, userText) {
  const useMock = process.env.MOCK_LLM === "1" || !process.env.LLM_API_KEY;
  let reply;
  try {
    reply = useMock ? await mockAgent(session, restaurant, userText) : await llmAgent(session, restaurant, userText);
  } catch (err) {
    console.error("handleTurn error:", err.message);
    reply = "Disculpa, tuve un inconveniente. ¿Puedes repetir tu pedido, por favor?";
  }
  session.history.push({ role: "user", content: userText });
  session.history.push({ role: "assistant", content: reply });
  if (session.history.length > 20) session.history = session.history.slice(-20);
  return reply;
}

module.exports = { handleTurn, executeTool };
