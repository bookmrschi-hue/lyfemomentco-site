require('dotenv').config();
const express = require('express');
const { SquareClient, SquareEnvironment } = require('square');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static('.'));

// Magazine publishing inquiry form (see lib/magazine-inquiry.js).
app.post('/api/magazine-inquiry', require('./lib/magazine-inquiry').expressHandler);

const client = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENV === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox,
});

// Location ID — set in .env or auto-resolved from your Square account at startup
let locationId = process.env.SQUARE_LOCATION_ID || null;

async function resolveLocationId() {
  if (locationId && locationId !== 'YOUR_LOCATION_ID') return;
  try {
    const locations = [];
    for await (const loc of client.locations.list()) locations.push(loc);
    const active = locations.find(l => l.status === 'ACTIVE') || locations[0];
    if (active) {
      locationId = active.id;
      console.log(`Square location resolved: ${active.name} (${locationId})`);
    } else {
      console.error('No Square locations found. Check your access token.');
    }
  } catch (err) {
    console.error('Could not resolve Square location:', err.message || err);
  }
}

app.post('/api/create-payment', async (req, res) => {
  const { sourceId, amount, orderDetails } = req.body;

  if (!sourceId || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid payment data.' });
  }

  if (!locationId) {
    return res.status(500).json({ success: false, error: 'Payment location not configured. Please restart the server.' });
  }

  try {
    const response = await client.payments.create({
      sourceId,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: BigInt(Math.round(parseFloat(amount) * 100)),
        currency: 'USD',
      },
      locationId,
      note: `Lyfe Moment Co. — ${orderDetails.name} — ${(orderDetails.products || []).join(', ')}`,
    });

    res.json({ success: true, paymentId: response.payment.id });
  } catch (error) {
    console.error('Square payment error:', error);
    const msg =
      (error.errors && error.errors[0] && error.errors[0].detail) ||
      error.message ||
      'Payment failed.';
    res.status(400).json({ success: false, error: msg });
  }
});

// ── Stripe PaymentIntent endpoint ───────────────────────────────────────────
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/create-payment-intent', async (req, res) => {
  const { amount, productName, treats } = req.body;
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Invalid amount.' });
  }
  try {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(amount) * 100),
      currency: 'usd',
      metadata: {
        product: productName || '',
        treats: (treats || []).join(', '),
      },
      description: `Lyfe Moment Co. — ${productName || 'Order'}`,
    });
    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error('Stripe PaymentIntent error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Lyfe Moment Co. server running on http://localhost:${PORT}`);
  await resolveLocationId();
});
