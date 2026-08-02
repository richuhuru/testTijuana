// orders.js — Estado de pedido y conversacion en memoria, por sesion (telefono o callSid).
// NOTA: en memoria = se pierde al reiniciar. Para escala/multi-servidor migrar a Redis.

const sessions = new Map();

function getSession(sessionId, restaurantId) {
  let s = sessions.get(sessionId);
  if (!s) {
    s = {
      id: sessionId,
      restaurantId,
      cart: [],          // { item_id, name, qty, price, size, notes }
      history: [],       // historial para el LLM
      upsold: false,
      paymentUrl: null,
      placed: false,
      createdAt: Date.now()
    };
    sessions.set(sessionId, s);
  }
  if (restaurantId) s.restaurantId = restaurantId;
  return s;
}

function resetSession(sessionId) {
  sessions.delete(sessionId);
}

function cartTotal(cart) {
  return cart.reduce((sum, l) => sum + l.price * l.qty, 0);
}

function cartSummary(cart) {
  if (!cart.length) return "El pedido esta vacio.";
  const lines = cart.map(l => `${l.qty}x ${l.name} — $${(l.price * l.qty).toFixed(2)}`);
  lines.push(`Total: $${cartTotal(cart).toFixed(2)}`);
  return lines.join("\n");
}

module.exports = { getSession, resetSession, cartTotal, cartSummary, sessions };
