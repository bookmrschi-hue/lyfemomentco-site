# Magazine landing page (Lyfe Moment Co. × Bread of Lyfe Publishing)

Staging build of `lyfemoment.store/magazine/`. Phase one of the redesign: the rest of the
site (homepage `index.html`, order `form`, payment endpoints in `server.js`) is untouched
apart from one added form route in `server.js`.

| What | Where |
| --- | --- |
| All words, products, FAQs, contact details | `magazine/content.json` |
| Colors, fonts, spacing | top of `magazine/assets/css/magazine.css` |
| Page generator + placeholder artwork | `scripts/magazine/build.mjs`, `scripts/magazine/art.mjs` |
| Generated pages (do not hand-edit) | `magazine/index.html`, `magazine/products/*/`, `magazine/policies/`, `sitemap.xml` |
| Inquiry form server code | `lib/magazine-inquiry.js` (+ `netlify/functions/magazine-inquiry.js`, route in `server.js`) |
| Social and Pinterest images | `magazine/assets/social/` (made by `scripts/magazine/render-social.mjs`) |
| Tests | `tests/magazine-inquiry.test.js` (`npm test`), `scripts/magazine/browser-qa.mjs` (`npm run test:browser`) |

Guides: [EDITING.md](EDITING.md) · [FORMS-AND-STORAGE.md](FORMS-AND-STORAGE.md) · [ASSETS.md](ASSETS.md) ·
[PINTEREST.md](PINTEREST.md) · [WEBFLOW-HANDOFF.md](WEBFLOW-HANDOFF.md) · [QA-REPORT.md](QA-REPORT.md)

## Run it on a computer

```bash
npm install
npm run build:magazine
SQUARE_LOCATION_ID=preview STRIPE_SECRET_KEY=sk_test_placeholder INQUIRY_DEV_STORE=file PORT=4321 npm start
# open http://localhost:4321/magazine/
```

The placeholder Stripe/Square values are only there because the existing `server.js` stops
on start-up without them (see "Existing issues" below). They are not real keys and nothing
is charged.

## Where this lives: GitHub/Netlify code, not native Webflow

This page is **repository code** (plain HTML, CSS and a little JavaScript). It is not a native
Webflow page and it will not appear in the Webflow Designer or CMS. Webflow cannot import it as
editable Webflow elements automatically. See [WEBFLOW-HANDOFF.md](WEBFLOW-HANDOFF.md) for how to
rebuild it natively if you decide to move to Webflow later.

What was verified on 27 Oct 2026:

- **GitHub:** `bookmrschi-hue/lyfemomentco-site`, branch `main`, one commit ("Create form"). The
  site is a single 25 MB `index.html` (images embedded inside it), an order page `form`, and an
  Express server (`server.js`) with Square and Stripe payment endpoints.
- **Netlify:** confirmed. The Netlify project `lyfemomentco` builds this repository and posted a
  deploy preview for this PR (https://deploy-preview-1--lyfemomentco.netlify.app/magazine/), with
  the redirect and header rules from `netlify.toml` processed successfully. Netlify serves the
  static files but does **not** run `server.js`, so the Square/Stripe endpoints in `server.js` are
  not running on the live site today.
- **Webflow:** one site, "Lyfe Moment Co." (`lyfe-moment-co`), created 26 Oct 2026, never
  published, no custom domain. It is not serving lyfemoment.store.

### Why `/magazine/` (not a subdomain)

The page is a folder in the same repository, so it deploys with the existing site at
`lyfemoment.store/magazine/` with no DNS change. `lyfemoment.store/magazine` (no slash) redirects
to it on both Netlify and the Express server. A Webflow-hosted `magazine.lyfemoment.store` would
need a DNS record and a paid Webflow site plan; it is only worth it if you want to edit natively
in Webflow.

### netlify.toml

Added with **no build command and no publish directory**, so it does not change how the live site
is built. It only registers the form function, sends `/api/magazine-inquiry` to it, and adds a few
safe headers for `/magazine/`. Netlify deploy previews are automatically marked `noindex` by Netlify.

## Payments boundary (not active)

No checkout is wired to the magazine page. Every product has `price: null` and no buy button.
When prices are approved, the plan is a server-side hosted checkout (Stripe Checkout or Square
Payment Links) created from the server's own product records, with the amount never taken from
the browser, plus a signed webhook that confirms payment before an order is marked paid. Compare
real costs first (processing fees, any Webflow plan and transaction fee, function hosting).
Native Webflow Ecommerce supports Stripe and PayPal, not Square.

## Launch checklist

1. Owner approves copy, products, FAQs and draft policies in `content.json`.
2. Connect form storage, submit one `[TEST]` inquiry on the deploy preview, confirm it appears in
   the private sheet, then set `inquiryForm.connected` to `true`.
3. Replace placeholders with approved images (see ASSETS.md).
4. Set `site.indexing` to `"production"`, run `npm run build:magazine`. This removes `noindex`
   from the landing page and adds it to `sitemap.xml`. Products stay `noindex` until each one's
   `publicationStatus` is `"published"`.
5. Merge, confirm `https://lyfemoment.store/magazine/` loads, then submit the sitemap in Search Console.

## Existing issues found (not changed)

- `server.js` crashes at start-up if `STRIPE_SECRET_KEY` is missing, and crashes again if it
  cannot reach Square to look up a location. `.env.example` does not list `STRIPE_SECRET_KEY`.
- `server.js` serves the whole repository folder as static files (`express.static('.')`), so
  `server.js`, `package.json` and docs are downloadable. Secrets in `.env` are not served
  (dotfiles are ignored), but a dedicated `public/` folder would be safer.
- The homepage is 25 MB because photos are embedded as text inside `index.html`. This will make
  the homepage slow on phones; worth fixing in phase two.
