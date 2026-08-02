# UTS Comunica — Backend del Agente de Ordenes con IA

Agente de IA para restaurantes (Marco's, Tijuana's) sobre **Twilio**: toma pedidos por
**WhatsApp** y **voz** (Conversation Relay), hace upsell, calcula el total, **cobra con Stripe**
y **notifica a la cocina**. Node.js + Express + WebSocket.

> Este repo esta listo para el flujo del runbook *Desplegar UTS Comunica (GitHub → Render → Twilio)*.

## Que trae

| Archivo | Rol |
|---|---|
| `server.js` | Express + WebSocket: `/`, `/whatsapp`, `/twiml/:restaurante`, `/relay`, `/stripe-webhook` |
| `agent.js` | El "cerebro": modo MOCK (sin claves) y modo LLM real (OpenAI/Anthropic con tools) |
| `menus.js` | Menus por local, system prompt y esquema de tools |
| `orders.js` | Estado de pedido/sesion en memoria |
| `payments.js` | Enlace de pago Stripe (Checkout Session) |
| `messaging.js` | Envio WhatsApp/SMS y notificacion a cocina |
| `render.yaml` | Blueprint de Render |
| `.env.example` | Variables de entorno |

## Endpoints

- `GET /` → `UTS Comunica backend OK`
- `GET /twiml/:restaurante` → TwiML con `<ConversationRelay>` (voz). Ej: `/twiml/tijuanas`
- `POST /whatsapp` → webhook de WhatsApp (form-urlencoded `From`, `Body`)
- `WS /relay` → Conversation Relay (voz). Mensajes JSON: `setup`, `prompt` → responde `{type:"text",token,last:true}`
- `POST /stripe-webhook` → recepcion de eventos de pago (opcional)

## Modo de prueba (sin claves)

Con `MOCK_LLM=1` el agente usa una heuristica que detecta items del menu y calcula el total,
para probar el flujo completo **sin** claves de LLM/Stripe/Twilio (los pagos y mensajes se simulan).

## Correr local

```bash
npm install
MOCK_LLM=1 RESTAURANT_ID=tijuanas node server.js
# en otra terminal:
curl -s localhost:3000/
curl -s -X POST localhost:3000/whatsapp \
  --data-urlencode "From=whatsapp:+17875551234" \
  --data-urlencode "Body=dame tres tacos al pastor y una margarita"
```

## Desplegar (resumen; ver runbook de despliegue para el detalle)

1. Sube este repo a GitHub (privado).
2. En Render: **New → Web Service**, conecta el repo; detecta `render.yaml`.
3. Variables: para la primera prueba deja `MOCK_LLM=1` y `RESTAURANT_ID=tijuanas`.
4. Prueba: `curl https://TU-APP.onrender.com/` y el `POST /whatsapp` de arriba.
5. En Twilio, apunta el webhook de WhatsApp (o el Sandbox) a `POST https://TU-APP.onrender.com/whatsapp`.
6. Para voz: apunta el numero a `GET https://TU-APP.onrender.com/twiml/tijuanas`.

## Pasar a produccion

- Render: plan **Starter** (no se duerme).
- Quita `MOCK_LLM`, agrega `LLM_API_KEY`, `LLM_MODEL` (ej. `gpt-4o-mini`), `STRIPE_SECRET_KEY`,
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `KITCHEN_NOTIFY_TO`.
- Para usar Claude: pon `LLM_MODEL=claude-...` (o `LLM_PROVIDER=anthropic`).
- Edita menus/precios en `menus.js`, luego `git commit -am "menu" && git push` → Render redepliega solo.

## Notas

- El `.env` con claves **nunca** se sube (esta en `.gitignore`). Las claves reales viven en Render.
- Sesiones en memoria: para escala/multi-servidor, migrar a Redis.
- Verifica el formato de mensajes de ConversationRelay y las APIs de Stripe/LLM contra la doc vigente.

---
*Uhuru Tech Services · 787-712-2121 · www.uhurucorp.com*
