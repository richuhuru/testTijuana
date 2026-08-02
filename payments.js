// payments.js — Crea un enlace de pago Stripe (Checkout Session) por el total del pedido.
// Si no hay STRIPE_SECRET_KEY o MOCK_LLM=1, devuelve un enlace simulado para pruebas.

const { cartTotal } = require("./orders");

const MOCK = process.env.MOCK_LLM === "1" || !process.env.STRIPE_SECRET_KEY;
let stripe = null;
if (!MOCK) {
  // eslint-disable-next-line global-require
  stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
}

async function createPaymentLink(session, restaurant) {
  const total = cartTotal(session.cart);
  if (total <= 0) return { ok: false, error: "El pedido esta vacio." };

  if (MOCK) {
    const url = `https://pay.example.test/checkout/${session.id}?amt=${total.toFixed(2)}`;
    session.paymentUrl = url;
    return { ok: true, url, mock: true, total };
  }

  const line_items = session.cart.map(l => ({
    quantity: l.qty,
    price_data: {
      currency: restaurant.currency || "usd",
      unit_amount: Math.round(l.price * 100),
      product_data: { name: l.name + (l.size ? ` (${l.size})` : "") }
    }
  }));

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    success_url: process.env.SUCCESS_URL || "https://www.uhurucorp.com/gracias",
    cancel_url: process.env.CANCEL_URL || process.env.SUCCESS_URL || "https://www.uhurucorp.com",
    metadata: { session_id: session.id, restaurant: restaurant.id }
  });

  session.paymentUrl = checkout.url;
  return { ok: true, url: checkout.url, id: checkout.id, total };
}

module.exports = { createPaymentLink };
