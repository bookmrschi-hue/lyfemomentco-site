'use strict';
// Netlify Function for the magazine inquiry form.
// Reached at /api/magazine-inquiry through the redirect in netlify.toml.
// Set INQUIRY_SHEETS_WEBHOOK_URL and INQUIRY_SHEETS_WEBHOOK_SECRET in
// Netlify > Site configuration > Environment variables (never in code).

const { handleInquiry } = require('../../lib/magazine-inquiry');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
  if (Buffer.byteLength(raw) > 10 * 1024) return json(413, { ok: false, error: 'too_large' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: 'bad_request' }); }
  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
  const { status, body: out } = await handleInquiry(body, { ip, rawLength: Buffer.byteLength(raw) });
  return json(status, out);
};
