require('dotenv').config();
const express = require('express');
const { SquareClient, SquareEnvironment } = require('square');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static('.'));

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
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    console.warn('SQUARE_ACCESS_TOKEN not set; Square card checkout is off.');
    return;
  }
  try {
    const result = await client.locations.list();
    const locations = (result && result.locations) || [];
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
// Only create the Stripe client when a key is set, so the site still runs without one.
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

app.post('/api/create-payment-intent', async (req, res) => {
  const { amount, productName, treats } = req.body;
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Invalid amount.' });
  }
  if (!stripe) return res.status(503).json({ error: 'Card payments are not configured yet.' });
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

// ── Private Edition consultation requests (site/ pages) ─────────────────────
// Saves each request to inquiries.jsonl (git-ignored) and logs it.
// Before launch: also forward to email or a CRM so nothing waits on server logs.
const fs = require('fs');
const path = require('path');

// The new magazine site lives at /magazines (landing page: /magazines/private/).
// The old shop at / is untouched until Barbie decides to switch the homepage.
app.use('/magazines', express.static(path.join(__dirname, 'site')));

app.post('/api/inquiry', (req, res) => {
  const b = req.body || {};
  if (b.company_website) return res.json({ ok: true }); // honeypot: quietly drop bots
  const name = String(b.name || '').trim().slice(0, 200);
  const email = String(b.email || '').trim().slice(0, 200);
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Name and a valid email are required.' });
  }
  const pick = (k) => String(b[k] || '').slice(0, 4000);
  const entry = {
    at: new Date().toISOString(),
    name, email,
    phone: pick('phone'), role: pick('role'), edition: pick('edition'),
    needed_by: pick('needed_by'), copies: pick('copies'), notes: pick('notes'),
    nda: b.nda === 'yes', source: pick('source'),
  };
  fs.appendFile(path.join(__dirname, 'inquiries.jsonl'), JSON.stringify(entry) + '\n', (err) => {
    if (err) {
      console.error('Could not save inquiry:', err.message);
      return res.status(500).json({ ok: false });
    }
    console.log(`New consultation request: ${entry.edition} from ${entry.name}`);
    res.json({ ok: true });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Lyfe Moment Co. server running on http://localhost:${PORT}`);
  await resolveLocationId();
});
