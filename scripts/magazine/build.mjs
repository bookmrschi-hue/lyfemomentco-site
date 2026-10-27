#!/usr/bin/env node
// Builds the static magazine pages from magazine/content.json.
//   node scripts/magazine/build.mjs          -> writes magazine/**/index.html and sitemap.xml
//   node scripts/magazine/build.mjs --check  -> fails if the committed HTML is out of date
//
// No dependencies. The output is plain HTML/CSS/JS that any static host can serve
// (Netlify, the existing Express server, or a Webflow embed during migration).

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productArt, journeyArt, heroArt } from './art.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MAG = join(ROOT, 'magazine');
const CHECK = process.argv.includes('--check');

const content = JSON.parse(readFileSync(join(MAG, 'content.json'), 'utf8'));
validate(content);

const S = content.site;
const isProduction = S.indexing === 'production';
const pageUrl = new URL(S.pagePath, S.productionOrigin).href;
const assetVersion = '1';

// ---------- helpers ----------

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Only for owner-authored strings that intentionally contain a link (e.g. privacy label).
const trusted = (s = '') => String(s);
const mailto = (email) => `<a href="mailto:${esc(email)}">${esc(email)}</a>`;

function validate(c) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  need(c.site && c.site.shopName, 'site.shopName is required');
  need(['staging', 'production'].includes(c.site?.indexing), 'site.indexing must be "staging" or "production"');
  const cats = new Set((c.categories || []).map((x) => x.id));
  const occ = new Set((c.occasions?.items || []).map((x) => x.id));
  const slugs = new Set();
  for (const p of c.products || []) {
    need(p.id && p.slug && p.name, `product is missing id/slug/name: ${JSON.stringify(p).slice(0, 80)}`);
    need(/^[a-z0-9-]+$/.test(p.slug || ''), `product "${p.name}" slug must be lowercase letters, numbers and dashes`);
    need(!slugs.has(p.slug), `duplicate product slug "${p.slug}"`);
    slugs.add(p.slug);
    need(cats.has(p.category), `product "${p.name}" has unknown category "${p.category}"`);
    for (const o of p.occasions || []) need(occ.has(o), `product "${p.name}" has unknown occasion "${o}"`);
    need(['preview', 'published', 'hidden'].includes(p.publicationStatus), `product "${p.name}" publicationStatus must be preview, published or hidden`);
    if (p.specs?.price != null) need(typeof p.specs.price === 'number' && p.specs.price > 0, `product "${p.name}" price must be a positive number or null (never 0 for unknown)`);
    if (p.image) need(p.image.src && p.image.width && p.image.height && typeof p.image.alt === 'string', `product "${p.name}" image needs src, width, height and alt`);
  }
  for (const f of c.faq?.items || []) {
    if (f.published) need(f.answer && f.answer.trim(), `FAQ "${f.question}" is published but has no answer`);
  }
  if (errors.length) {
    console.error('content.json has problems:\n - ' + errors.join('\n - '));
    process.exit(1);
  }
}

const visibleProducts = content.products.filter((p) => p.publicationStatus !== 'hidden');
const occasionLabel = Object.fromEntries(content.occasions.items.map((o) => [o.id, o.label]));
const categoryLabel = Object.fromEntries(content.categories.map((c) => [c.id, c.label]));
const visibleCategories = content.categories.filter((c) => !c.hidden && visibleProducts.some((p) => p.category === c.id));
const show = (key) => content.landingSections?.[key] !== false;

// Background and section photos. A missing file falls back to a soft gradient panel,
// so the page still renders before the owner adds the images.
function photo(key, base, { eager = false, cls = '', sizes = '100vw' } = {}) {
  const ph = content.photos?.[key];
  if (!ph) return '';
  if (existsSync(join(MAG, ph.src))) {
    return `<img class="${cls}" src="${esc(base + ph.src)}" width="${ph.width}" height="${ph.height}" alt="${esc(ph.alt)}" sizes="${esc(sizes)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  }
  return `<div class="${cls} photo-fallback photo-fallback--${esc(key)}" role="img" aria-label="${esc(ph.alt)}"></div>`;
}
const sparkle = '<span class="rhinestones" aria-hidden="true"></span>';

function robotsMeta(indexable) {
  return indexable ? '<meta name="robots" content="index, follow">' : '<meta name="robots" content="noindex, nofollow">';
}

function fontPreloads(base) {
  return ['fraunces-latin-800-normal.woff2', 'jost-latin-400-normal.woff2']
    .map((f) => `<link rel="preload" href="${base}assets/fonts/${f}" as="font" type="font/woff2" crossorigin>`)
    .join('\n  ');
}

function analyticsTags() {
  const a = S.analytics || {};
  const out = [];
  if (a.googleSiteVerification) out.push(`<meta name="google-site-verification" content="${esc(a.googleSiteVerification)}">`);
  if (a.pinterestDomainVerification) out.push(`<meta name="p:domain_verify" content="${esc(a.pinterestDomainVerification)}">`);
  if (a.ga4MeasurementId && /^G-[A-Z0-9]+$/.test(a.ga4MeasurementId)) {
    // Analytics only, no advertising features. Loaded once.
    out.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(a.ga4MeasurementId)}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${esc(a.ga4MeasurementId)}',{allow_google_signals:false,allow_ad_personalization_signals:false});</script>`);
  }
  return out.join('\n  ');
}

function head({ base, title, description, canonical, indexable, ogImage = true, jsonLd }) {
  const og = new URL(content.seo.ogImage, pageUrl).href;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <script>document.documentElement.className+=' js'</script>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${robotsMeta(indexable)}
  <link rel="canonical" href="${esc(canonical)}">
  <meta name="theme-color" content="#A9CBE8">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(S.shopName)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  ${ogImage ? `<meta property="og:image" content="${esc(og)}">
  <meta property="og:image:width" content="${content.seo.ogImageWidth}">
  <meta property="og:image:height" content="${content.seo.ogImageHeight}">
  <meta property="og:image:alt" content="${esc(content.seo.ogImageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${esc(og)}">` : ''}
  ${fontPreloads(base)}
  <link rel="stylesheet" href="${base}assets/css/magazine.css?v=${assetVersion}">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23FBE29D'/%3E%3Ctext x='16' y='23' text-anchor='middle' font-family='Georgia' font-weight='700' font-size='18' fill='%23775537'%3EL%3C/text%3E%3C/svg%3E">
  ${analyticsTags()}
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>`;
}

function brandStrip() {
  return `<div class="brand-strip"><p>${esc(content.brandStrip.text)}</p></div>`;
}

function header(base, { onLanding }) {
  const link = (href) => (onLanding ? href : `${base}${href}`);
  const items = content.nav.links.map((l) => `<li><a href="${esc(link(l.href))}">${esc(l.label)}</a></li>`).join('');
  return `<header class="site-header" data-header>
  <div class="site-header__inner">
    <a class="wordmark" href="${esc(onLanding ? '#top' : base)}" aria-label="${esc(S.shopName)} magazines home"><span class="wordmark__name">Lyfe Moment</span> <span class="wordmark__co">Co.</span></a>
    <nav class="site-nav" aria-label="Magazine page">
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu" data-menu-toggle>
        <span class="menu-toggle__bars" aria-hidden="true"></span><span>Menu</span>
      </button>
      <div class="site-menu" id="site-menu" data-menu>
        <ul class="site-menu__links">${items}</ul>
        <a class="btn btn--primary btn--nav" href="${esc(link(content.nav.cta.href))}">${esc(content.nav.cta.label)}</a>
      </div>
    </nav>
  </div>
</header>`;
}

function footer(base) {
  const P = content.publisher.logo;
  const links = content.footer.links
    .map((l) => `<li><a href="${esc(l.href.startsWith('/') ? l.href : base + l.href)}">${esc(l.label)}</a></li>`)
    .join('');
  return `<footer class="site-footer">
  <div class="stripe-band stripe-band--blue" aria-hidden="true"></div>
  <div class="site-footer__inner">
    <div class="site-footer__brand">
      <p class="site-footer__name">${esc(S.shopName)}</p>
      <p class="site-footer__tagline">${esc(S.tagline)}</p>
      <p>${esc(content.footer.publisherLine)}</p>
      <ul class="site-footer__contact">
        <li>${mailto(S.emailGeneral)}</li>
        <li>Publishing: ${mailto(S.emailPublishing)}</li>
      </ul>
    </div>
    <div class="site-footer__logo">
      <picture>
        <source srcset="${base}${P.src}" type="image/webp">
        <img src="${base}${P.fallbackSrc}" width="${P.width}" height="${P.height}" alt="${esc(P.alt)}" loading="lazy" decoding="async">
      </picture>
    </div>
    <nav class="site-footer__nav" aria-label="Footer">
      <ul>${links}</ul>
    </nav>
  </div>
  <p class="site-footer__legal">&copy; <span data-year>${new Date().getFullYear()}</span> ${esc(S.shopName.replace(/\.$/, ''))}. Based in ${esc(S.basedIn.city)}, California.</p>
</footer>`;
}

function productImage(p, base, { eager = false } = {}) {
  if (p.image) {
    const i = p.image;
    const srcset = i.srcset ? ` srcset="${esc(i.srcset.split(',').map((s) => base + s.trim()).join(', '))}" sizes="${esc(i.sizes || '(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw')}"` : '';
    return `<img src="${esc(base + i.src)}"${srcset} width="${i.width}" height="${i.height}" alt="${esc(i.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  }
  return productArt(p.motif, `Illustrated placeholder for ${p.name}`);
}

// A product card styled as a magazine cover: photo, masthead and the issue name as a cover line.
function issueCover(p, base) {
  if (p.image) return productImage(p, base);
  if (!p.coverPhoto) return productImage(p, base);
  return `<div class="issue-cover">
    ${photo(p.coverPhoto, base, { cls: 'issue-cover__photo', sizes: '(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw' })}
    <span class="issue-cover__masthead" aria-hidden="true">Lyfe Moment</span>
    <span class="issue-cover__line" aria-hidden="true">${esc(p.name)}</span>
    <span class="issue-cover__tag">Sample cover</span>
  </div>`;
}

// ---------- landing page sections ----------

// Inline so the crest text uses the page's web fonts.
function crestSvg() {
  const svg = readFileSync(join(MAG, 'assets/brand/club-crest.svg'), 'utf8')
    .replace('<svg ', '<svg class="hero__crest" width="240" height="300" ');
  return svg;
}

function hero() {
  const h = content.hero;
  return `<section class="hero hero--photo" id="top" aria-labelledby="hero-title">
  ${photo('hero', '', { eager: true, cls: 'hero__photo' })}
  <div class="hero__veil" aria-hidden="true"></div>
  <div class="wrap hero__cover">
    ${h.crest ? crestSvg() : ''}
    <p class="hero__issue">${esc(h.eyebrow)}</p>
    <h1 id="hero-title">${h.headline.split(/(?<=\.)\s+/).map(esc).join('<br>')}</h1>
    <p class="hero__sub">${esc(h.copy)}</p>
    <div class="actions">
      <a class="btn btn--primary" href="${esc(h.primaryCta.href)}">${esc(h.primaryCta.label)}</a>
      <a class="btn btn--glass" href="${esc(h.secondaryCta.href)}">${esc(h.secondaryCta.label)}</a>
    </div>
  </div>
</section>`;
}

function manifesto() {
  const m = content.manifesto;
  if (!m) return '';
  return `<section class="manifesto" aria-labelledby="manifesto-title">
  <div class="wrap wrap--text">
    <p class="eyebrow">${esc(m.eyebrow)}</p>
    <h2 id="manifesto-title">${esc(m.heading)}</h2>
    ${m.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n    ')}
  </div>
</section>`;
}

function need() {
  const n = content.need;
  if (!n) return '';
  const rows = n.items.map((it) => `<li class="need__item"><p class="need__before">${esc(it.before)}</p><p class="need__after">${esc(it.after)}</p></li>`).join('');
  return `<section class="need" aria-labelledby="need-title">
  <div class="wrap">
    <div class="section-head section-head--center">
      <p class="eyebrow">${esc(n.eyebrow)}</p>
      <h2 id="need-title">${esc(n.heading)}</h2>
      <p>${esc(n.copy)}</p>
    </div>
    <ul class="need__list">${rows}</ul>
  </div>
</section>`;
}

function journeyStory() {
  const j = content.journeyStory;
  if (!j) return '';
  return `<section class="story" aria-labelledby="story-title">
  <div class="wrap">
    <div class="section-head section-head--center">
      <p class="eyebrow">${esc(j.eyebrow)}</p>
      <h2 id="story-title">${esc(j.heading)}</h2>
      <p>${esc(j.copy)}</p>
    </div>
    <ol class="story__steps">
      <li class="story__step">
        <div class="phone" aria-hidden="true">
          <div class="phone__bar"><span class="phone__avatar"></span><span class="phone__handle">${esc(j.before.handle)}</span></div>
          <img class="phone__post" src="assets/img/hero-pool.jpg" width="1510" height="1142" alt="" loading="lazy" decoding="async">
          <p class="phone__caption">${esc(j.before.caption)}</p>
          <p class="phone__meta">${esc(j.before.meta)}</p>
        </div>
        <h3>${esc(j.before.title)}</h3>
        <p>${esc(j.before.copy)}</p>
      </li>
      <li class="story__step">
        <div class="spread" aria-hidden="true">
          <div class="spread__page spread__page--photo"><img src="assets/img/hero-pool.jpg" width="1510" height="1142" alt="" loading="lazy" decoding="async"><span class="spread__folio">Lyfe Moment · 2026</span></div>
          <div class="spread__page spread__page--text">
            <p class="spread__kicker">${esc(j.after.kicker)}</p>
            <p class="spread__headline">${esc(j.after.headline)}</p>
            <p class="spread__quote">${esc(j.after.quote)}</p>
            <span class="spread__lines"></span>
          </div>
        </div>
        <h3>${esc(j.after.title)}</h3>
        <p>${esc(j.after.copy)}</p>
      </li>
    </ol>
    <p class="story__note">${esc(j.note)}</p>
  </div>
</section>`;
}

function team() {
  const t = content.team;
  if (!t) return '';
  const items = t.items.map((it) => `<li class="team__item"><h3>${esc(it.q)}</h3><p>${esc(it.a)}</p></li>`).join('');
  return `<section class="team" id="discretion" aria-labelledby="team-title">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">${esc(t.eyebrow)}</p>
      <h2 id="team-title">${esc(t.heading)}</h2>
      <p>${esc(t.copy)}</p>
    </div>
    <ul class="team__list">${items}</ul>
  </div>
</section>`;
}

function ways() {
  const w = content.ways;
  if (!w) return '';
  const items = w.items.map((it) => `<li class="tier"><h3>${esc(it.title)}</h3>${it.price ? `<p class="tier__price">${esc(it.price)}</p>` : ''}<p>${esc(it.copy)}</p></li>`).join('');
  return `<section class="ways" id="commission" aria-labelledby="ways-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="ways-title">${esc(w.heading)}</h2>
      ${w.copy ? `<p>${esc(w.copy)}</p>` : ''}
    </div>
    <ul class="tiers">${items}</ul>
    ${w.cta ? `<p class="tiers__cta"><a class="btn btn--primary" href="${esc(w.cta.href)}">${esc(w.cta.label)}</a></p>` : ''}
  </div>
</section>`;
}

function feature() {
  const f = content.feature;
  if (!f) return '';
  return `<section class="feature" id="yearbook" aria-labelledby="feature-title">
  ${photo('editorial', '', { cls: 'feature__photo', sizes: '100vw' })}
  <div class="feature__veil" aria-hidden="true"></div>
  <div class="wrap feature__inner">
    <div class="feature__panel">
      ${sparkle}
      <p class="eyebrow">${esc(f.eyebrow)}</p>
      <h2 id="feature-title">${esc(f.heading)}</h2>
      <p class="feature__script" aria-hidden="true">${esc(f.script)}</p>
      <p>${esc(f.copy)}</p>
      ${f.inside ? `<ul class="ticks">${f.inside.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <p class="feature__note">${esc(f.note)}</p>
      <a class="btn btn--primary" href="${esc(f.cta.href)}">${esc(f.cta.label)}</a>
    </div>
  </div>
</section>`;
}

function intro() {
  return `<section class="intro" aria-labelledby="intro-title">
  <div class="wrap">
    <div class="awning-card">
      <div class="awning" aria-hidden="true"></div>
      <div class="awning-card__body">
        <h2 id="intro-title">${esc(content.intro.heading)}</h2>
        <p>${esc(content.intro.copy)}</p>
      </div>
    </div>
  </div>
</section>`;
}

function directory() {
  const d = content.directory;
  const filters = [{ id: 'all', label: d.allLabel }, ...visibleCategories]
    .map((c, i) => `<li><button type="button" class="chip" data-filter-category="${esc(c.id)}" aria-pressed="${i === 0}">${esc(c.label)}</button></li>`)
    .join('');
  const cards = visibleProducts
    .map((p) => `<li class="product-card" data-category="${esc(p.category)}" data-occasions="${esc((p.occasions || []).join(' '))}" data-product="${esc(p.slug)}">
        <a class="product-card__link" href="products/${esc(p.slug)}/">
          <div class="product-card__art">${issueCover(p, '')}</div>
          <div class="product-card__body">
            <h3 class="product-card__title">${esc(p.name)}</h3>
            <p class="product-card__desc">${esc(p.shortDescription)}</p>
          </div>
        </a>
      </li>`)
    .join('\n      ');
  return `<section class="directory" id="magazines" aria-labelledby="directory-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="directory-title">${esc(d.heading)}</h2>
      <p>${esc(d.copy)}</p>
    </div>
    ${visibleCategories.length > 1 ? `<div class="filters" data-filters hidden>
      <p class="visually-hidden" id="filter-label">Filter keepsakes by category</p>
      <ul class="chips" aria-labelledby="filter-label">${filters}</ul>
      <p class="filter-occasion" data-occasion-active hidden>
        <span data-occasion-text></span>
        <button type="button" class="link-button" data-clear-occasion>Show all occasions</button>
      </p>
    </div>` : ''}
    <p class="visually-hidden" role="status" aria-live="polite" data-filter-status></p>
    <ul class="product-grid" data-product-grid>
      ${cards}
    </ul>
    <p class="empty-state" data-empty hidden>${esc(d.noResults)}</p>
  </div>
</section>`;
}

function journey() {
  const j = content.journey;
  const thumbs = j.pages
    .map((pg, i) => `<li>
        <button type="button" class="page-thumb" data-viewer-open="${i}" aria-haspopup="dialog">
          <span class="page-thumb__art">${journeyArt(pg.motif)}</span>
          <span class="page-thumb__label">${esc(pg.label)}</span>
        </button>
      </li>`)
    .join('\n      ');
  const slides = j.pages
    .map((pg, i) => `<figure class="viewer__slide" data-viewer-slide="${i}" ${i ? 'hidden' : ''}>
          ${journeyArt(pg.motif, `${pg.label} example layout with empty photo frames`)}
          <figcaption><strong>${esc(pg.label)}.</strong> ${esc(pg.description)}</figcaption>
        </figure>`)
    .join('\n        ');
  return `<section class="journey" id="personalize" aria-labelledby="journey-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="journey-title">${esc(j.heading)}</h2>
      <p>${esc(j.copy)}</p>
    </div>
    <ol class="page-thumbs">
      ${thumbs}
    </ol>
    <p class="note">${esc(j.note)}</p>
  </div>
  <dialog class="viewer" data-viewer aria-labelledby="viewer-title">
    <div class="viewer__inner">
      <div class="viewer__top">
        <h3 id="viewer-title" class="viewer__title" data-viewer-title>${esc(j.pages[0].label)}</h3>
        <button type="button" class="icon-button" data-viewer-close><span aria-hidden="true">&times;</span><span class="visually-hidden">${esc(j.viewerClose)}</span></button>
      </div>
      <div class="viewer__stage">
        ${slides}
      </div>
      <div class="viewer__controls">
        <button type="button" class="btn btn--secondary" data-viewer-prev>${esc(j.viewerPrev)}</button>
        <p class="viewer__count" data-viewer-count aria-live="polite">1 of ${j.pages.length}</p>
        <button type="button" class="btn btn--primary" data-viewer-next>${esc(j.viewerNext)}</button>
      </div>
    </div>
  </dialog>
</section>`;
}

function howItWorks() {
  const h = content.howItWorks;
  const steps = h.steps
    .map((s, i) => `<li class="step-card"><span class="step-card__num" aria-hidden="true">${i + 1}</span><h3>${esc(s.title)}</h3><p>${esc(s.copy)}</p></li>`)
    .join('');
  return `<section class="how" id="how-it-works" aria-labelledby="how-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="how-title">${esc(h.heading)}</h2>
    </div>
    <ol class="steps">${steps}</ol>
  </div>
</section>`;
}

function occasions() {
  const o = content.occasions;
  const items = o.items
    .map((it) => `<li class="occasion" id="occasion-${esc(it.id)}">
        <h3>${esc(it.label)}</h3>
        <p>${esc(it.idea)}</p>
        <button type="button" class="link-button occasion__action" data-occasion="${esc(it.id)}" data-occasion-label="${esc(it.label)}" hidden>${esc(o.showIdeasLabel)}<span class="visually-hidden">: ${esc(it.label)}</span></button>
      </li>`)
    .join('\n      ');
  return `<section class="occasions" id="occasions" aria-labelledby="occasions-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="occasions-title">${esc(o.heading)}</h2>
      <p>${esc(o.copy)}</p>
    </div>
    <ul class="occasion-grid">
      ${items}
    </ul>
  </div>
</section>`;
}

function publisher() {
  const p = content.publisher;
  return `<section class="publisher" id="publisher" aria-labelledby="publisher-title">
  <div class="wrap">
    <div class="publisher__panel">
      <div class="publisher__logo">
        <picture>
          <source srcset="${p.logo.src}" type="image/webp">
          <img src="${p.logo.fallbackSrc}" width="${p.logo.width}" height="${p.logo.height}" alt="${esc(p.logo.alt)}" loading="lazy" decoding="async">
        </picture>
      </div>
      <div class="publisher__text">
        <h2 id="publisher-title">${esc(p.heading)}</h2>
        <p>${esc(p.copy)}</p>
        <p class="publisher__credit">${esc(p.credit)}</p>
      </div>
    </div>
  </div>
</section>`;
}

function inquiry() {
  const s = content.schools;
  const f = content.inquiryForm;
  const L = f.labels;
  const productOptions = visibleProducts.map((p) => `<option value="${esc(p.slug)}">${esc(p.name)}</option>`).join('');
  const occasionOptions = content.occasions.items.map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join('');
  const booking = S.booking?.verified && S.booking?.calendlyUrl
    ? `<p class="booking">Prefer to talk it through? <a href="${esc(S.booking.calendlyUrl)}" rel="noopener">Book a call</a>.</p>`
    : '';
  const intro = show('schools')
    ? `<div class="schools__intro">
      <h2 id="schools-title">${esc(s.heading)}</h2>
      <p>${esc(s.copy)}</p>
      <a class="btn btn--light" href="${esc(s.cta.href)}" data-focus-form>${esc(s.cta.label)}</a>
      ${booking}
    </div>`
    : '';
  return `<section class="schools${intro ? '' : ' schools--form-only'}" id="schools" aria-label="${esc(f.heading)}">
  <div class="wrap schools__grid">
    ${intro}
    <div class="form-panel" id="${esc(f.id)}" tabindex="-1">
      <h2 class="form-panel__title">${esc(f.heading)}</h2>
      <p>${esc(f.copy)}</p>
      ${f.connected ? '' : `<p class="notice" data-preview-notice>${esc(f.previewNotice)} ${mailto(S.emailPublishing)}.</p>`}
      <form class="inquiry-form" data-inquiry-form data-connected="${f.connected ? 'true' : 'false'}" action="${esc(f.endpoint)}" method="post" novalidate>
        <div class="form-error-summary" data-error-summary tabindex="-1" hidden></div>
        <div class="field">
          <label for="f-name">${esc(L.name)} <span class="req" aria-hidden="true">*</span></label>
          <input id="f-name" name="name" type="text" autocomplete="name" required maxlength="100" aria-describedby="f-name-error">
          <p class="field__error" id="f-name-error" data-error-for="name"></p>
        </div>
        <div class="field">
          <label for="f-email">${esc(L.email)} <span class="req" aria-hidden="true">*</span></label>
          <input id="f-email" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254" aria-describedby="f-email-error">
          <p class="field__error" id="f-email-error" data-error-for="email"></p>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="f-interest">${esc(L.interest)} <span class="req" aria-hidden="true">*</span></label>
            <select id="f-interest" name="interest" required aria-describedby="f-interest-error">
              <option value="">Choose one</option>${productOptions}<option value="not-sure">${esc(L.interestNotSure)}</option>
            </select>
            <p class="field__error" id="f-interest-error" data-error-for="interest"></p>
          </div>
          <div class="field">
            <label for="f-occasion">${esc(L.occasion)} <span class="req" aria-hidden="true">*</span></label>
            <select id="f-occasion" name="occasion" required aria-describedby="f-occasion-error">
              <option value="">Choose one</option>${occasionOptions}<option value="other">${esc(L.occasionOther)}</option>
            </select>
            <p class="field__error" id="f-occasion-error" data-error-for="occasion"></p>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="f-quantity">${esc(L.quantity)}</label>
            <input id="f-quantity" name="quantity" type="number" inputmode="numeric" min="1" max="5000" step="1" aria-describedby="f-quantity-hint f-quantity-error">
            <p class="field__hint" id="f-quantity-hint">${esc(L.quantityHint)}</p>
            <p class="field__error" id="f-quantity-error" data-error-for="quantity"></p>
          </div>
          <div class="field">
            <label for="f-date">${esc(L.eventDate)}</label>
            <input id="f-date" name="eventDate" type="date" aria-describedby="f-date-hint f-date-error">
            <p class="field__hint" id="f-date-hint">${esc(L.eventDateHint)}</p>
            <p class="field__error" id="f-date-error" data-error-for="eventDate"></p>
          </div>
        </div>
        <div class="field">
          <label for="f-notes">${esc(L.notes)} <span class="req" aria-hidden="true">*</span></label>
          <textarea id="f-notes" name="notes" rows="5" required maxlength="2000" aria-describedby="f-notes-hint f-notes-error"></textarea>
          <p class="field__hint" id="f-notes-hint">${esc(L.notesHint)}</p>
          <p class="field__error" id="f-notes-error" data-error-for="notes"></p>
        </div>
        <div class="hp" aria-hidden="true">
          <label for="f-website">Leave this field empty</label>
          <input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off">
        </div>
        <input type="hidden" name="startedAt" value="">
        <div class="check">
          <input id="f-privacy" name="privacyAck" type="checkbox" value="yes" required aria-describedby="f-privacy-error">
          <label for="f-privacy">${trusted(L.privacy)} <span class="req" aria-hidden="true">*</span></label>
          <p class="field__error" id="f-privacy-error" data-error-for="privacyAck"></p>
        </div>
        <div class="check">
          <input id="f-marketing" name="marketingOptIn" type="checkbox" value="yes">
          <label for="f-marketing">${esc(L.marketing)}</label>
        </div>
        <p class="req-note"><span aria-hidden="true">*</span> Required</p>
        <button class="btn btn--primary btn--submit" type="submit" data-submit>${esc(L.submit)}</button>
        <div class="form-status" data-form-status role="status" aria-live="polite" tabindex="-1"></div>
      </form>
    </div>
  </div>
  <script type="application/json" id="form-messages">${JSON.stringify({ ...f.messages, sending: L.sending, submit: L.submit, emailGeneral: S.emailGeneral, emailPublishing: S.emailPublishing }).replace(/</g, '\\u003c')}</script>
</section>`;
}

function faq() {
  const items = content.faq.items
    .filter((q) => q.published)
    .map((q) => `<details class="faq__item"><summary><h3>${esc(q.question)}</h3></summary><div class="faq__answer"><p>${esc(q.answer)}</p></div></details>`)
    .join('\n      ');
  return `<section class="faq" id="faq" aria-labelledby="faq-title">
  <div class="wrap wrap--narrow">
    <div class="faq__panel">
      <h2 id="faq-title">${esc(content.faq.heading)}</h2>
      ${items}
      <p class="faq__more">Have a question we have not answered yet? Email ${mailto(S.emailPublishing)} or use the <a href="#inquiry">publishing inquiry form</a>.</p>
    </div>
  </div>
</section>`;
}

function finalCta() {
  const f = content.finalCta;
  return `<section class="final" aria-labelledby="final-title">
  <div class="wrap">
    <div class="final__panel">
      <h2 id="final-title">${esc(f.heading)}</h2>
      <p>${esc(f.copy)}</p>
      <div class="actions actions--center">
        <a class="btn btn--primary" href="${esc(f.primaryCta.href)}">${esc(f.primaryCta.label)}</a>
        <a class="btn btn--secondary" href="${esc(f.secondaryCta.href)}">${esc(f.secondaryCta.label)}</a>
      </div>
    </div>
  </div>
</section>`;
}

function landingJsonLd() {
  const orgId = `${S.productionOrigin}/#organization`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: S.shopName,
        url: S.productionOrigin + '/',
        email: S.emailGeneral,
        slogan: S.tagline.replace(/\.$/, ''),
        address: { '@type': 'PostalAddress', addressLocality: S.basedIn.city, addressRegion: S.basedIn.region, addressCountry: S.basedIn.country },
      },
      {
        '@type': 'Organization',
        '@id': `${S.productionOrigin}/#publisher`,
        name: S.publisherName,
        email: S.emailPublishing,
      },
      { '@type': 'WebSite', '@id': `${S.productionOrigin}/#website`, url: S.productionOrigin + '/', name: S.shopName, publisher: { '@id': orgId } },
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: content.seo.title,
        description: content.seo.description,
        isPartOf: { '@id': `${S.productionOrigin}/#website` },
        about: { '@id': orgId },
        publisher: { '@id': `${S.productionOrigin}/#publisher` },
        breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: S.productionOrigin + '/' },
          { '@type': 'ListItem', position: 2, name: 'Magazines', item: pageUrl },
        ],
      },
    ],
  };
}

function landingPage() {
  return `${head({ base: '', title: content.seo.title, description: content.seo.description, canonical: pageUrl, indexable: isProduction, jsonLd: landingJsonLd() })}
<body>
<a class="skip-link" href="#main">Skip to main content</a>
${brandStrip()}
${header('', { onLanding: true })}
<main id="main">
${hero()}
${need()}
${journeyStory()}
${manifesto()}
${feature()}
${ways()}
${directory()}
${team()}
${show('journey') ? journey() : ''}
${show('howItWorks') ? howItWorks() : ''}
${show('occasions') ? occasions() : ''}
${show('publisher') ? publisher() : ''}
${faq()}
${inquiry()}
${show('finalCta') ? finalCta() : ''}
</main>
${footer('')}
<script src="assets/js/magazine.js?v=${assetVersion}" defer></script>
</body>
</html>
`;
}

// ---------- product detail pages ----------

// DIY Template and Made for You side by side. A buy button appears only when a real
// Stripe Payment Link is filled in (checkoutUrl) and a price is set.
function offers(p, P) {
  if (!p.offers) return '';
  const card = (o) => {
    const price = typeof o.price === 'number' && o.price > 0
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: p.specs?.currency || 'USD' }).format(o.price) : '';
    const buy = price && /^https:\/\/(buy\.stripe\.com|square\.link|checkout\.square\.site)\//.test(o.checkoutUrl || '')
      ? `<a class="btn btn--primary" href="${esc(o.checkoutUrl)}" rel="noopener">Buy ${esc(o.label)}${price ? ` · ${price}` : ''}</a>`
      : `<p class="offer__soon">${esc(P.comingSoon)}</p>`;
    return `<li class="offer">${sparkle}<h3>${esc(o.label)}</h3><p>${esc(o.summary)}</p><ol class="offer__steps">${o.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>${buy}</li>`;
  };
  return `<h2>${esc(P.offersHeading)}</h2><ul class="offers">${card(p.offers.diy)}${card(p.offers.made)}</ul>`;
}

function productPage(p) {
  const base = '../../';
  const P = content.productPage;
  const url = new URL(`products/${p.slug}/`, pageUrl).href;
  const indexable = isProduction && p.publicationStatus === 'published';
  const specRows = Object.entries(P.specLabels)
    .filter(([k]) => p.specs && p.specs[k] != null && p.specs[k] !== '')
    .map(([k, label]) => {
      let v = p.specs[k];
      if (k === 'price') v = new Intl.NumberFormat('en-US', { style: 'currency', currency: p.specs.currency || 'USD' }).format(v);
      return `<div><dt>${esc(label)}</dt><dd>${esc(v)}</dd></div>`;
    })
    .join('');
  const occ = (p.occasions || []).map((o) => `<li>${esc(occasionLabel[o])}</li>`).join('');
  const pers = (p.personalization || []).map((x) => `<li>${esc(x)}</li>`).join('');
  const others = visibleProducts.filter((x) => x.slug !== p.slug && x.category === p.category).slice(0, 3);
  const related = others.length
    ? `<section class="related" aria-labelledby="related-title"><h2 id="related-title">More ${esc(categoryLabel[p.category].toLowerCase())}</h2><ul>${others.map((o) => `<li><a href="../${esc(o.slug)}/">${esc(o.name)}</a></li>`).join('')}</ul></section>`
    : '';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: S.productionOrigin + '/' },
      { '@type': 'ListItem', position: 2, name: 'Magazines', item: pageUrl },
      { '@type': 'ListItem', position: 3, name: p.name, item: url },
    ],
  };
  return `${head({ base, title: `${p.name} | ${S.shopName}`, description: p.shortDescription, canonical: url, indexable, jsonLd })}
<body class="page-product">
<a class="skip-link" href="#main">Skip to main content</a>
${brandStrip()}
${header(base, { onLanding: false })}
<main id="main" class="product">
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="${esc(S.homePath)}">Home</a></li><li><a href="${base}#magazines">The Issues</a></li><li aria-current="page">${esc(p.name)}</li></ol></nav>
    <div class="product__grid">
      <div class="product__art">${issueCover(p, base)}</div>
      <div class="product__panel">
        <p class="eyebrow">${esc(p.formats ? `${P.formatsLabel || 'Comes as'}: ${p.formats.join(' or ')}` : categoryLabel[p.category])}</p>
        <h1>${esc(p.name)}</h1>
        <p class="lede">${esc(p.shortDescription)}</p>
        <p>${esc(p.longDescription)}</p>
        ${offers(p, P)}
        <h2>${esc(P.useHeading)}</h2>
        ${p.perfectFor ? `<ul class="ticks">${p.perfectFor.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p>${esc(p.intendedUse)}</p>`}
        <h2>${esc(P.personalizeHeading)}</h2>
        <ul class="ticks">${pers}</ul>
        <h2>${esc(P.occasionsHeading)}</h2>
        <ul class="tags">${occ}</ul>
        <h2>${esc(P.detailsHeading)}</h2>
        ${specRows ? `<dl class="specs">${specRows}</dl>` : `<p>${esc(P.detailsPending)}</p>`}
        <div class="actions">
          <a class="btn btn--primary" href="${base}?interest=${esc(p.slug)}#inquiry">${esc(P.inquiryCta)}</a>
          <a class="btn btn--secondary" href="${base}#magazines">${esc(P.backLabel)}</a>
        </div>
      </div>
    </div>
    ${related}
  </div>
</main>
${footer(base)}
<script src="${base}assets/js/magazine.js?v=${assetVersion}" defer></script>
</body>
</html>
`;
}

// ---------- policies page ----------

function policiesPage() {
  const base = '../';
  const P = content.policies;
  const url = new URL('policies/', pageUrl).href;
  const sections = P.sections
    .map((s) => `<section id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title"><h2 id="${esc(s.id)}-title">${esc(s.heading)}</h2>${s.paragraphs.map((x) => `<p>${esc(x)}</p>`).join('')}</section>`)
    .join('');
  return `${head({ base, title: P.title, description: 'How Lyfe Moment Co. handles magazine inquiries, and when ordering details will be published.', canonical: url, indexable: false, ogImage: false })}
<body class="page-policies">
<a class="skip-link" href="#main">Skip to main content</a>
${brandStrip()}
${header(base, { onLanding: false })}
<main id="main" class="policies">
  <div class="wrap wrap--narrow">
    <div class="policies__panel">
      <h1>${esc(P.heading)}</h1>
      ${sections}
    </div>
  </div>
</main>
${footer(base)}
<script src="${base}assets/js/magazine.js?v=${assetVersion}" defer></script>
</body>
</html>
`;
}

// ---------- sitemap ----------

function sitemap() {
  const urls = [S.productionOrigin + '/'];
  if (isProduction) {
    urls.push(pageUrl);
    for (const p of content.products) if (p.publicationStatus === 'published') urls.push(new URL(`products/${p.slug}/`, pageUrl).href);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/magazine/build.mjs. Magazine URLs are added only when site.indexing is "production". -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}
</urlset>
`;
}

// ---------- write ----------

const outputs = new Map();
outputs.set(join(MAG, 'index.html'), landingPage());
outputs.set(join(MAG, 'policies', 'index.html'), policiesPage());
for (const p of visibleProducts) outputs.set(join(MAG, 'products', p.slug, 'index.html'), productPage(p));
outputs.set(join(ROOT, 'sitemap.xml'), sitemap());

// The year in the footer changes on 1 January; ignore it when checking freshness.
const normalize = (s) => s.replace(/<span data-year>\d{4}<\/span>/g, '<span data-year></span>');

if (CHECK) {
  const stale = [];
  for (const [file, html] of outputs) {
    if (!existsSync(file) || normalize(readFileSync(file, 'utf8')) !== normalize(html)) stale.push(file.replace(ROOT + '/', ''));
  }
  if (stale.length) {
    console.error('Generated magazine files are out of date. Run `npm run build:magazine`.\n - ' + stale.join('\n - '));
    process.exit(1);
  }
  console.log('Magazine pages are up to date.');
} else {
  // Remove product pages whose product was deleted or hidden.
  const productsDir = join(MAG, 'products');
  if (existsSync(productsDir)) {
    const keep = new Set(visibleProducts.map((p) => p.slug));
    for (const d of readdirSync(productsDir)) if (!keep.has(d)) rmSync(join(productsDir, d), { recursive: true, force: true });
  }
  for (const [file, html] of outputs) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
  }
  console.log(`Built ${outputs.size} files (${isProduction ? 'PRODUCTION: indexable' : 'staging: noindex'}).`);
}
