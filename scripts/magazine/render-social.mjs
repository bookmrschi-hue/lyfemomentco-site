#!/usr/bin/env node
// Renders the Open Graph image and three Pinterest creatives to magazine/assets/social/.
// Needs Playwright with Chromium available (`npm i -D playwright && npx playwright install chromium`).
// Edit the words in PINS below, then run `npm run social:magazine`.

import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { C, coverForSocial, socialStripes } from './art.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'magazine/assets/social');
const FONTS = pathToFileURL(join(ROOT, 'magazine/assets/fonts')).href;

export const PINS = [
  { file: 'pinterest-cover-story.jpg', eyebrow: 'Personalized magazines', title: 'Your memories deserve a cover story.', script: 'made for your moment', footer: 'lyfemoment.store/magazine', kicker: 'The Birthday Issue', bg: 'butter' },
  { file: 'pinterest-birthday.jpg', eyebrow: 'Birthday gift idea', title: 'Put the birthday person on the cover.', script: 'their year, their people', footer: 'lyfemoment.store/magazine', kicker: 'Happy Birthday', bg: 'powder' },
  { file: 'pinterest-every-chapter.jpg', eyebrow: 'Keepsakes for every chapter', title: 'Anniversaries. Graduations. Best friends.', script: 'make the story yours', footer: 'lyfemoment.store/magazine', kicker: 'Our favorite chapters', bg: 'butter' },
];

const css = `
@font-face{font-family:Fraunces;font-weight:800;src:url(${FONTS}/fraunces-latin-800-normal.woff2)}
@font-face{font-family:Jost;font-weight:500;src:url(${FONTS}/jost-latin-500-normal.woff2)}
@font-face{font-family:Jost;font-weight:600;src:url(${FONTS}/jost-latin-600-normal.woff2)}
@font-face{font-family:Damion;src:url(${FONTS}/damion-latin-400-normal.woff2)}
*{margin:0;box-sizing:border-box}body{font-family:Jost;color:#3A2A1C}
.eyebrow{font:600 28px/1.2 Jost;letter-spacing:.14em;text-transform:uppercase;color:#5C3F26}
h1{font:800 76px/1.08 Fraunces;color:#775537;margin:18px 0 8px}
.script{font:64px/1.1 Damion;color:#775537;transform:rotate(-3deg);transform-origin:left}
.foot{font:600 28px/1 Jost;color:#3A2A1C}
.stripes{background:repeating-linear-gradient(90deg,var(--s) 0 28px,#fff 28px 56px)}
`;

function coverSvg(w, h, kicker) {
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-4 ${w / 2} ${h / 2})">${coverForSocial(w * 0.12, h * 0.06, w * 0.76, { kicker })}</g></svg>`;
}

function pinHtml(pin) {
  const bg = pin.bg === 'powder' ? C.powder : C.butter;
  const stripe = pin.bg === 'powder' ? C.butter : C.powder;
  return `<!doctype html><html><head><style>${css}</style></head><body>
  <div style="width:1000px;height:1500px;background:${bg};position:relative;overflow:hidden">
    <div class="stripes" style="--s:${stripe};height:44px"></div>
    <div style="padding:70px 80px 0">
      <p class="eyebrow">${pin.eyebrow}</p>
      <h1>${pin.title}</h1>
      <p class="script">${pin.script}</p>
    </div>
    <div style="position:absolute;left:150px;top:600px">${coverSvg(700, 760, pin.kicker)}</div>
    <div style="position:absolute;left:0;right:0;bottom:0;background:#fff;padding:30px 80px;display:flex;justify-content:space-between;align-items:center">
      <span class="foot">Lyfe Moment Co.</span><span class="foot">${pin.footer}</span>
    </div>
  </div></body></html>`;
}

function ogHtml() {
  return `<!doctype html><html><head><style>${css}</style></head><body>
  <div style="width:1200px;height:630px;background:${C.butter};position:relative;overflow:hidden;display:flex">
    <div class="stripes" style="--s:${C.powder};position:absolute;left:0;right:0;top:0;height:30px"></div>
    <div style="padding:90px 0 0 70px;width:690px">
      <p class="eyebrow" style="font-size:24px">Personalized magazines &amp; keepsakes</p>
      <h1 style="font-size:70px">Your memories deserve a cover story.</h1>
      <p class="foot" style="margin-top:28px">Lyfe Moment Co. · lyfemoment.store</p>
    </div>
    <div style="position:absolute;right:30px;top:40px">${coverSvg(460, 600, 'The Birthday Issue')}</div>
  </div></body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function render(html, file, w, h) {
  const tmp = join(OUT, '.render.html');
  writeFileSync(tmp, html);
  await page.setViewportSize({ width: w, height: h });
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 86 });
  console.log('wrote', file);
}
await render(ogHtml(), 'og-magazine.jpg', 1200, 630);
for (const pin of PINS) await render(pinHtml(pin), pin.file, 1000, 1500);
await browser.close();
(await import('node:fs')).rmSync(join(OUT, '.render.html'), { force: true });
