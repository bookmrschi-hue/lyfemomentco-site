'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { handleInquiry, validate, sheetSafe, _hits } = require('../lib/magazine-inquiry');

const NOW = new Date('2026-10-27T12:00:00Z');
const good = (over = {}) => ({
  name: 'Test Person',
  email: 'test@example.com',
  interest: 'the-birthday-issue',
  occasion: 'birthdays',
  quantity: '',
  eventDate: '2026-12-01',
  notes: '[TEST] Automated test submission',
  privacyAck: true,
  marketingOptIn: false,
  website: '',
  startedAt: String(NOW.getTime() - 20000),
  ...over,
});
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lmc-'));

test.beforeEach(() => _hits.clear());

test('valid input passes validation', () => {
  const { errors } = validate(good(), NOW);
  assert.deepStrictEqual(errors, {});
});

test('required fields and privacy acknowledgment are enforced', () => {
  const { errors } = validate({}, NOW);
  for (const k of ['name', 'email', 'interest', 'occasion', 'notes', 'privacyAck']) assert.ok(errors[k], `expected error for ${k}`);
});

test('rejects unknown products, past dates and bad quantities', () => {
  const { errors } = validate(good({ interest: 'free-iphone', eventDate: '2020-01-01', quantity: '0' }), NOW);
  assert.ok(errors.interest && errors.eventDate && errors.quantity);
});

test('marketing consent defaults to false', () => {
  const { value } = validate(good({ marketingOptIn: undefined }), NOW);
  assert.strictEqual(value.marketingOptIn, false);
});

test('answers 503 and stores nothing when storage is not configured', async () => {
  const r = await handleInquiry(good(), { ip: '1.1.1.1' }, {}, NOW);
  assert.strictEqual(r.status, 503);
  assert.strictEqual(r.body.ok, false);
});

test('dev file store persists and returns a reference', async () => {
  const dir = tmp();
  const r = await handleInquiry(good(), { ip: '1.1.1.2' }, { INQUIRY_DEV_STORE: 'file', INQUIRY_DEV_DIR: dir }, NOW);
  assert.strictEqual(r.status, 200);
  assert.match(r.body.reference, /^LMC-20261027-[0-9A-F]{6}$/);
  const saved = fs.readFileSync(path.join(dir, 'magazine-inquiries.jsonl'), 'utf8');
  assert.ok(saved.includes(r.body.reference));
  assert.ok(saved.includes('"test":true'));
});

test('dev file store is refused on Netlify', async () => {
  const r = await handleInquiry(good(), { ip: '1.1.1.3' }, { INQUIRY_DEV_STORE: 'file', NETLIFY: 'true' }, NOW);
  assert.strictEqual(r.status, 503);
});

test('honeypot and too-fast submissions are silently dropped', async () => {
  const dir = tmp();
  const env = { INQUIRY_DEV_STORE: 'file', INQUIRY_DEV_DIR: dir };
  const a = await handleInquiry(good({ website: 'http://spam' }), { ip: '1.1.1.4' }, env, NOW);
  const b = await handleInquiry(good({ startedAt: String(NOW.getTime() - 500) }), { ip: '1.1.1.5' }, env, NOW);
  assert.strictEqual(a.status, 200);
  assert.strictEqual(b.status, 200);
  assert.ok(!fs.existsSync(path.join(dir, 'magazine-inquiries.jsonl')));
});

test('rate limit kicks in after 5 attempts from one address', async () => {
  let last;
  for (let i = 0; i < 6; i++) last = await handleInquiry(good(), { ip: '9.9.9.9' }, {}, NOW);
  assert.strictEqual(last.status, 429);
});

test('oversized bodies are rejected', async () => {
  const r = await handleInquiry(good(), { ip: '1.1.1.6', rawLength: 50000 }, {}, NOW);
  assert.strictEqual(r.status, 413);
});

test('spreadsheet formulas are neutralised', () => {
  assert.strictEqual(sheetSafe('=HYPERLINK("x")'), '\'=HYPERLINK("x")');
  assert.strictEqual(sheetSafe('hello'), 'hello');
});

test('Sheets success requires the script to confirm the same reference', async () => {
  const realFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({ ok: true, reference: 'SOMETHING-ELSE' }) });
    const env = { INQUIRY_SHEETS_WEBHOOK_URL: 'https://example.invalid', INQUIRY_SHEETS_WEBHOOK_SECRET: 's' };
    const r = await handleInquiry(good(), { ip: '1.1.1.7' }, env, NOW);
    assert.strictEqual(r.status, 502);
    global.fetch = async (_u, opts) => {
      const ref = JSON.parse(opts.body).record.reference;
      return { ok: true, json: async () => ({ ok: true, reference: ref }) };
    };
    const r2 = await handleInquiry(good(), { ip: '1.1.1.8' }, env, NOW);
    assert.strictEqual(r2.status, 200);
  } finally {
    global.fetch = realFetch;
  }
});

test('generated magazine pages are up to date with content.json', () => {
  const { execFileSync } = require('child_process');
  execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts/magazine/build.mjs'), '--check'], { stdio: 'pipe' });
});

test('staging pages carry noindex and no fabricated prices or reviews', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'magazine/index.html'), 'utf8');
  const content = require('../magazine/content.json');
  if (content.site.indexing === 'staging') assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(html, /"@type":"(Product|Offer|Review|AggregateRating)"/);
  // Only owner-approved prices (content.ways, approved 2026-10-27) may appear.
  const approved = new Set((content.ways?.items || []).map((i) => (i.price || '').match(/\$\d[\d,]*/)?.[0]).filter(Boolean));
  for (const m of html.match(/\$\d[\d,]*/g) || []) assert.ok(approved.has(m), `unapproved price ${m}`);
  assert.doesNotMatch(html, /sk_live|sk_test|AIza|BEGIN PRIVATE KEY/);
});
