# QA report (27 Oct 2026, staging build)

Tested on the local Express server (`npm start`) in a cloud sandbox. Not yet tested on a Netlify
deploy preview or a real phone.

## Results

| Check | Result |
| --- | --- |
| Unit tests (`npm test`): validation, spam traps, rate limit, storage confirmation, formula escaping, noindex, no fake prices/reviews/secrets, generated pages up to date | 14 / 14 pass |
| Browser checks (`npm run test:browser`), Chromium at 320, 375, 390, 768, 1280 px | 69 / 69 pass |
| No horizontal overflow or clipped text at any width | pass (one 13 px overflow at 320 px found and fixed) |
| Body text ≥ 18 px; tap targets ≥ 44 px | pass |
| Mobile menu: opens, Escape closes and returns focus, links close it | pass |
| Sticky header does not cover anchored sections | pass |
| Category filters, occasion filter, occasion preselected in form | pass |
| Example-page viewer: opens, arrow keys, Escape, focus returns | pass |
| FAQ opens with keyboard | pass |
| Form: errors shown and first invalid field focused; preview mode sends nothing and says so | pass |
| Form endpoint with dev file store: `[TEST]` record saved, reference returned | pass (`LMC-20261027-44DB73`) |
| Direct load and refresh of `/magazine`, `/magazine/`, product pages, policies | pass; unknown product returns 404 |
| All internal links and in-page anchors resolve | pass |
| Reduced motion turns off smooth scrolling and transitions | pass |
| Console errors / failed requests | none |
| Images have width and height; no layout shift | pass (CLS 0 mobile, 0.003 desktop) |

## Lighthouse (local server, Lighthouse 12)

| | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Mobile | 95 (LCP 2.3 s, TBT 0 ms) | 100 | 100 | 69* |
| Desktop | 100 (LCP 0.5 s) | 100 | 100 | 69* |

\* SEO is 69 only because staging pages are deliberately `noindex`. The local server does not
compress files; Netlify does, which should improve mobile timings further.

## Contrast (measured)

| Text / background | Ratio | Use |
| --- | --- | --- |
| Ink #3A2A1C on butter / powder / white | 10.8 / 8.1 / 13.7 | body text, button labels |
| Copper #775537 on butter / white | 5.25 / 6.69 | headings and links |
| Copper #775537 on powder | 3.95 | large headings only, so small text on blue uses copper-deep |
| Copper-deep #5C3F26 on powder / butter | 5.65 / 7.51 | small text, eyebrows, links on blue |
| Turquoise #1BA3A8 | 1.8–3.1 | decorative dots only, never text |

## Not tested / open

- **Safari / WebKit:** the WebKit engine is not installed in this environment. Test on an iPhone
  once a deploy preview exists.
- **Netlify deploy preview and the Netlify Function:** no Netlify access in this session.
- **Real form storage:** no Google Sheet connected yet, so the live form remains in preview mode.
- **Webflow mobile editor crash:** not reproducible here; see WEBFLOW-HANDOFF.md.
