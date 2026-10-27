#!/usr/bin/env node
// Browser checks for the magazine page. Start the site first, e.g.
//   STRIPE_SECRET_KEY=sk_test_placeholder SQUARE_LOCATION_ID=preview INQUIRY_DEV_STORE=file PORT=4321 npm start
// then: BASE_URL=http://localhost:4321 npm run test:browser
// Uses Chromium, and WebKit (Safari engine) when it is installed.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require('playwright');

const BASE = (process.env.BASE_URL || 'http://localhost:4321').replace(/\/$/, '');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };

async function run(browserType, label) {
  let browser;
  try { browser = await browserType.launch(); } catch (e) { console.log(`SKIP  ${label}: not installed`); return; }
  const widths = [320, 375, 390, 768, 1280];
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 860 } });
    const page = await ctx.newPage();
    const errors = [];
    const failed = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('requestfailed', (r) => failed.push(r.url()));
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${BASE}/magazine/`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${label} ${w}px no horizontal overflow`, overflow <= 0, `${overflow}px`);
    const clipped = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,p,a,button,label')].filter((el) => el.offsetParent && !el.closest('.visually-hidden, .hp') && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible').length);
    check(`${label} ${w}px no clipped text`, clipped === 0, `${clipped}`);
    const bodySize = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.lede')).fontSize));
    check(`${label} ${w}px body copy >= 18px`, bodySize >= 18, `${bodySize}px`);
    const smallTargets = await page.evaluate(() => [...document.querySelectorAll('main a.btn, main button:not(.page-thumb), .site-header a, .site-header button')]
      .filter((el) => el.offsetParent).filter((el) => el.getBoundingClientRect().height < 44).map((el) => el.textContent.trim().slice(0, 30)));
    check(`${label} ${w}px tap targets >= 44px`, smallTargets.length === 0, smallTargets.join(', '));
    const imgsNoSize = await page.evaluate(() => [...document.images].filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length);
    check(`${label} ${w}px images have width/height`, imgsNoSize === 0);

    if (w < 960) {
      const toggle = page.locator('[data-menu-toggle]');
      await toggle.click();
      check(`${label} ${w}px menu opens`, (await toggle.getAttribute('aria-expanded')) === 'true' && (await page.locator('#site-menu').isVisible()));
      await page.keyboard.press('Escape');
      check(`${label} ${w}px menu closes on Escape and returns focus`, (await toggle.getAttribute('aria-expanded')) === 'false' && (await page.evaluate(() => document.activeElement.hasAttribute('data-menu-toggle'))));
      await toggle.click();
      await page.locator('#site-menu a', { hasText: 'FAQs' }).click();
      await page.waitForTimeout(700);
      const faqTop = await page.evaluate(() => document.getElementById('faq').getBoundingClientRect().top);
      const headerH = await page.evaluate(() => document.querySelector('[data-header]').offsetHeight);
      check(`${label} ${w}px anchor not hidden under sticky header`, faqTop >= headerH - 2, `top ${Math.round(faqTop)} header ${headerH}`);
    }

    if (w === 390 || w === 1280) {
      // Only the six magazine & newspaper issues are listed
      const cards = await page.locator('.product-card:visible').count();
      const hiddenShown = await page.locator('[data-product="photo-strips"], [data-product="custom-magazine"]').count();
      check(`${label} ${w}px six issues listed, hidden products absent`, cards === 6 && hiddenShown === 0, `${cards} cards`);

      // FAQ accordion
      const det = page.locator('.faq__item').first();
      await det.locator('summary').focus();
      await page.keyboard.press('Enter');
      check(`${label} ${w}px FAQ opens with keyboard`, await det.evaluate((d) => d.open));

      // Form: empty submit shows errors and focuses first invalid field
      await page.locator('[data-submit]').click();
      const firstInvalid = await page.evaluate(() => document.activeElement.id);
      const errCount = await page.locator('[data-error-for]:not(:empty)').count();
      check(`${label} ${w}px form errors + focus`, firstInvalid === 'f-name' && errCount >= 5, `${errCount} errors, focus ${firstInvalid}`);

      // Preview mode: valid submit sends nothing
      const posts = [];
      page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });
      await page.fill('#f-name', 'QA Preview');
      await page.fill('#f-email', 'qa@example.com');
      await page.selectOption('#f-interest', 'the-love-issue');
      await page.selectOption('#f-occasion', 'birthdays');
      await page.fill('#f-notes', '[TEST] preview mode check');
      await page.check('#f-privacy');
      await page.locator('[data-submit]').click();
      await page.waitForTimeout(300);
      const status = await page.locator('[data-form-status]').textContent();
      check(`${label} ${w}px preview form sends nothing and says so`, posts.length === 0 && /nothing was sent or saved/i.test(status), status.slice(0, 60));
    }

    check(`${label} ${w}px no console errors`, errors.length === 0, errors.join(' | ').slice(0, 200));
    check(`${label} ${w}px no failed requests`, failed.length === 0, failed.join(' | ').slice(0, 200));
    await ctx.close();
  }

  // Connected mode against the real endpoint (dev file store) – exercises server persistence.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/magazine/`, { waitUntil: 'networkidle' });
  // Post exactly what the form posts when connected.
  const resp = await page.evaluate(async () => {
    const r = await fetch('/api/magazine-inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'QA Test', email: 'qa@example.com', interest: 'the-birthday-issue', occasion: 'birthdays', notes: '[TEST] browser QA submission', privacyAck: true, marketingOptIn: false, website: '', startedAt: String(Date.now() - 10000) }) });
    return { status: r.status, body: await r.json() };
  });
  check(`${label} endpoint responds honestly`, (resp.status === 200 && /^LMC-/.test(resp.body.reference)) || resp.status === 503, `${resp.status} ${JSON.stringify(resp.body)}`);
  await ctx.close();

  // Direct loads and refresh of routes
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  for (const route of ['/magazine', '/magazine/', '/magazine/products/the-birthday-issue/', '/magazine/products/the-2026-yearbook/', '/magazine/policies/']) {
    const r = await p2.goto(BASE + route);
    const r2 = await p2.reload();
    check(`${label} direct load + refresh ${route}`, r.ok() && r2.ok(), `${r.status()}/${r2.status()}`);
  }
  const r404 = await p2.goto(BASE + '/magazine/products/does-not-exist/');
  check(`${label} unknown product returns 404`, r404.status() === 404);
  await p2.goto(`${BASE}/magazine/products/the-love-issue/`);
  await p2.locator('a', { hasText: 'Ask about this issue' }).click();
  await p2.waitForLoadState('networkidle');
  check(`${label} product page CTA preselects interest`, (await p2.locator('#f-interest').inputValue()) === 'the-love-issue');
  // Every internal link resolves
  await p2.goto(`${BASE}/magazine/`);
  const links = await p2.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => h.startsWith(location.origin)))]);
  const broken = [];
  for (const l of links) {
    const u = new URL(l);
    const res = await p2.request.get(u.origin + u.pathname + u.search);
    if (!res.ok()) broken.push(`${res.status()} ${l}`);
    if (u.hash && u.pathname === '/magazine/') {
      const exists = await p2.evaluate((id) => !!document.getElementById(id), u.hash.slice(1));
      if (!exists) broken.push(`missing anchor ${u.hash}`);
    }
  }
  check(`${label} internal links and anchors resolve (${links.length})`, broken.length === 0, broken.join(', '));
  await ctx2.close();

  // Reduced motion
  const ctx3 = await browser.newContext({ reducedMotion: 'reduce' });
  const p3 = await ctx3.newPage();
  await p3.goto(`${BASE}/magazine/`);
  const smooth = await p3.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  check(`${label} reduced motion disables smooth scroll`, smooth === 'auto');
  await ctx3.close();
  await browser.close();
}

await run(pw.chromium, 'Chromium');
await run(pw.webkit, 'WebKit');
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
