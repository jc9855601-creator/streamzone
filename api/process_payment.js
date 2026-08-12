const crypto = require("crypto");

const PRICES = {
  "Netflix TV": 75,
  "HBO Max": 70,
  "Disney+": 79,
  "Paramount+": 69,
  "Crunchyroll": 59,
  "Filmora": 50,
  "ViX": 49
};

const COUPONS = {
  "STREAM10": 10,
  "BIENVENIDA": 5
};

function calculateTotal(items, couponCode) {
  if (!Array.isArray(items) || !items.length) throw new Error("Carrito vacío.");
  let subtotal = 0;
  for (const item of items) {
    const price = PRICES[item.name];
    const qty = Number(item.qty);
    if (price == null || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      throw new Error("Producto o cantidad inválida.");
    }
    subtotal += price * qty;
  }
  const discount = COUPONS[String(couponCode || "").toUpperCase()] || 0;
  return Math.round(subtotal * (1 - discount / 100) * 100) / 100;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: "Falta configurar MP_ACCESS_TOKEN en Vercel." });
  }

  try {
    const { cardFormData, order } = req.body || {};
    if (!cardFormData || !order) {
      return res.status(400).json({ error: "Datos incompletos." });
    }

    const total = calculateTotal(order.items, order.coupon);
    const payerEmail = cardFormData.payer?.email || order.email;

    const body = {
      transaction_amount: total,
      token: cardFormData.token,
      description: `StreamZone - Pedido ${order.id}`,
      installments: Number(cardFormData.installments || 1),
      payment_method_id: cardFormData.payment_method_id || cardFormData.paymentMethodId,
      issuer_id: cardFormData.issuer_id || cardFormData.issuerId,
      external_reference: order.id,
      payer: {
        email: payerEmail
      }
    };

    if (cardFormData.payer?.identification) {
      body.payer.identification = cardFormData.payer.identification;
    }

    // Remove optional empty fields.
    if (!body.issuer_id) delete body.issuer_id;

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID()
      },
      body: JSON.stringify(body)
    });

    const result = await mpResponse.json();

    if (!mpResponse.ok) {
      return res.status(mpResponse.status).json({
        error: "Mercado Pago rechazó la solicitud.",
        message: result.message || result.error || "Error de Mercado Pago",
        cause: result.cause || []
      });
    }

    return res.status(200).json({
      id: result.id,
      status: result.status,
      status_detail: result.status_detail,
      transaction_amount: result.transaction_amount,
      payment_method_id: result.payment_method_id,
      payment_type_id: result.payment_type_id,
      external_reference: result.external_reference
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Error procesando el pago." });
  }
};
