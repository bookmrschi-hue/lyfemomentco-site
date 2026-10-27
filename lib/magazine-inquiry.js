'use strict';
// Server-side handling for the magazine publishing inquiry form.
// Shared by the Express server (server.js) and the Netlify Function
// (netlify/functions/magazine-inquiry.js) so both validate the same way.
//
// Storage, in order of preference:
//   1. INQUIRY_SHEETS_WEBHOOK_URL + INQUIRY_SHEETS_WEBHOOK_SECRET
//      A Google Apps Script web app bound to a PRIVATE Google Sheet
//      (script in docs/magazine/FORMS-AND-STORAGE.md). Credentials stay server-side.
//   2. INQUIRY_DEV_STORE=file  (local development only)
//      Appends to .data/magazine-inquiries.jsonl. Refused on Netlify.
// If neither is configured the endpoint answers 503 and nothing is stored.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const content = require('../magazine/content.json');

const PRODUCT_SLUGS = new Set(content.products.filter((p) => p.publicationStatus !== 'hidden').map((p) => p.slug).concat('not-sure'));
const OCCASIONS = new Set(content.occasions.items.map((o) => o.id).concat('other'));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_FILL_MS = 3000;          // faster than this looks automated
const MAX_BODY_BYTES = 10 * 1024;
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 5 };

// Best-effort, per-instance rate limiting. Serverless instances do not share
// memory, so this slows down bursts but is not a hard guarantee.
const hits = new Map();
function rateLimited(key, now = Date.now()) {
  const list = (hits.get(key) || []).filter((t) => now - t < RATE_LIMIT.windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE_LIMIT.max;
}

const clean = (v, max) =>
  String(v == null ? '' : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);

// Stop spreadsheet formula injection when values land in Google Sheets.
const sheetSafe = (s) => (/^[=+\-@\t\r]/.test(s) ? "'" + s : s);

function validate(body, now = new Date()) {
  const errors = {};
  const b = body && typeof body === 'object' ? body : {};
  const out = {
    name: clean(b.name, 101),
    email: clean(b.email, 255).toLowerCase(),
    interest: clean(b.interest, 80),
    occasion: clean(b.occasion, 80),
    quantity: clean(b.quantity, 6),
    eventDate: clean(b.eventDate, 10),
    notes: clean(b.notes, 2001),
    privacyAck: b.privacyAck === true || b.privacyAck === 'yes' || b.privacyAck === 'true',
    marketingOptIn: b.marketingOptIn === true || b.marketingOptIn === 'yes' || b.marketingOptIn === 'true',
  };
  if (!out.name) errors.name = 'Please enter your name.';
  else if (out.name.length > 100) errors.name = 'Please keep your name under 100 characters.';
  if (!out.email || !EMAIL_RE.test(out.email) || out.email.length > 254) errors.email = 'Please enter a valid email address.';
  if (!PRODUCT_SLUGS.has(out.interest)) errors.interest = 'Please choose what you are interested in.';
  if (!OCCASIONS.has(out.occasion)) errors.occasion = 'Please choose an occasion.';
  if (out.quantity) {
    if (!/^\d+$/.test(out.quantity) || +out.quantity < 1 || +out.quantity > 5000) errors.quantity = 'Please enter a whole number from 1 to 5000, or leave it blank.';
  }
  if (out.eventDate) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(out.eventDate) ? new Date(out.eventDate + 'T00:00:00Z') : null;
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    // One day of slack for time zones.
    if (!d || isNaN(d.getTime())) errors.eventDate = 'Please enter a valid date.';
    else if (d.getTime() < today.getTime() - 86400000) errors.eventDate = 'Please choose a date that has not passed yet.';
  }
  if (!out.notes) errors.notes = 'Please tell us a little about your project.';
  else if (out.notes.length > 2000) errors.notes = 'Please keep your notes under 2000 characters.';
  if (!out.privacyAck) errors.privacyAck = 'Please confirm you have read the privacy notice.';
  return { errors, value: out };
}

function makeReference(now = new Date()) {
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `LMC-${d}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function storageMode(env) {
  if (env.INQUIRY_SHEETS_WEBHOOK_URL && env.INQUIRY_SHEETS_WEBHOOK_SECRET) return 'sheets';
  if (env.INQUIRY_DEV_STORE === 'file' && !env.NETLIFY && env.NODE_ENV !== 'production') return 'file';
  return null;
}

async function storeSheets(record, env) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const row = {};
    for (const [k, v] of Object.entries(record)) row[k] = typeof v === 'string' ? sheetSafe(v) : v;
    const res = await fetch(env.INQUIRY_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.INQUIRY_SHEETS_WEBHOOK_SECRET, record: row }),
      signal: ctrl.signal,
      redirect: 'follow',
    });
    const body = await res.json().catch(() => ({}));
    // Success only when the script confirms it wrote this exact reference.
    return res.ok && body && body.ok === true && body.reference === record.reference;
  } finally {
    clearTimeout(t);
  }
}

function storeFile(record, env) {
  const dir = path.resolve(env.INQUIRY_DEV_DIR || path.join(__dirname, '..', '.data'));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'magazine-inquiries.jsonl');
  fs.appendFileSync(file, JSON.stringify(record) + '\n', { mode: 0o600 });
  // Read back to confirm persistence before reporting success.
  return fs.readFileSync(file, 'utf8').includes(`"reference":"${record.reference}"`);
}

/**
 * Process one inquiry. Returns { status, body } for the caller to send.
 * `meta` = { ip, rawLength, userAgent }
 */
async function handleInquiry(body, meta = {}, env = process.env, now = new Date()) {
  if (meta.rawLength && meta.rawLength > MAX_BODY_BYTES) return { status: 413, body: { ok: false, error: 'too_large' } };
  if (!body || typeof body !== 'object') return { status: 400, body: { ok: false, error: 'bad_request' } };

  const ipKey = crypto.createHash('sha256').update(String(meta.ip || 'unknown')).digest('hex').slice(0, 16);
  if (rateLimited(ipKey, now.getTime())) return { status: 429, body: { ok: false, error: 'rate_limited' } };

  // Spam traps: hidden field filled, or submitted impossibly fast. Answer like
  // a success so bots learn nothing, but store nothing.
  const started = Number(body.startedAt);
  const tooFast = !started || now.getTime() - started < MIN_FILL_MS;
  if (clean(body.website, 200) || tooFast) {
    return { status: 200, body: { ok: true, reference: makeReference(now) } };
  }

  const { errors, value } = validate(body, now);
  if (Object.keys(errors).length) return { status: 400, body: { ok: false, error: 'invalid', errors } };

  const mode = storageMode(env);
  if (!mode) return { status: 503, body: { ok: false, error: 'not_configured' } };

  const record = {
    reference: makeReference(now),
    receivedAt: now.toISOString(),
    name: value.name,
    email: value.email,
    interest: value.interest,
    occasion: value.occasion,
    quantity: value.quantity ? Number(value.quantity) : '',
    eventDate: value.eventDate,
    notes: value.notes,
    privacyAck: true,
    privacyNoticeVersion: '2026-10-draft',
    marketingOptIn: value.marketingOptIn,
    source: 'magazine-landing',
    test: /\[test\]/i.test(value.notes),
  };

  try {
    const ok = mode === 'sheets' ? await storeSheets(record, env) : storeFile(record, env);
    if (!ok) return { status: 502, body: { ok: false, error: 'storage_failed' } };
  } catch (err) {
    console.error('magazine inquiry storage error:', err && err.message);
    return { status: 502, body: { ok: false, error: 'storage_failed' } };
  }
  return { status: 200, body: { ok: true, reference: record.reference } };
}

// Express adapter
function expressHandler(req, res) {
  const raw = req.headers['content-length'] ? Number(req.headers['content-length']) : 0;
  handleInquiry(req.body, { ip: req.ip, rawLength: raw })
    .then(({ status, body }) => res.status(status).set('Cache-Control', 'no-store').json(body))
    .catch(() => res.status(500).json({ ok: false, error: 'server_error' }));
}

module.exports = { handleInquiry, validate, expressHandler, makeReference, sheetSafe, _hits: hits };
