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
    const { order } = req.body || {};
    if (!order || !order.id || !order.email) {
      return res.status(400).json({ error: "Datos incompletos del pedido." });
    }

    const total = calculateTotal(order.items, order.coupon);

    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const baseUrl = `${proto}://${host}/`;

    const preferenceBody = {
      items: [
        {
          id: order.id,
          title: `StreamZone - Pedido ${order.id}`,
          quantity: 1,
          currency_id: "MXN",
          unit_price: total
        }
      ],
      payer: {
        email: order.email
      },
      external_reference: order.id,
      back_urls: {
        success: baseUrl,
        failure: baseUrl,
        pending: baseUrl
      },
      auto_return: "approved",
      statement_descriptor: "STREAMZONE"
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preferenceBody)
    });

    const result = await mpResponse.json();

    if (!mpResponse.ok) {
      return res.status(mpResponse.status).json({
        error: "Mercado Pago rechazó la creación del checkout.",
        message: result.message || result.error || "Error de Mercado Pago",
        cause: result.cause || []
      });
    }

    const isTest = String(accessToken).startsWith("TEST-");
    const checkoutUrl = isTest
      ? (result.sandbox_init_point || result.init_point)
      : result.init_point;

    return res.status(200).json({
      id: result.id,
      checkoutUrl
    });
  } catch (error) {
    return res.status(500).json({
      error: "No se pudo crear el checkout de Mercado Pago.",
      message: error.message
    });
  }
};
