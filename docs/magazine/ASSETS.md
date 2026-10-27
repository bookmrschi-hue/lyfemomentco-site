# Asset manifest

All artwork below is original placeholder design (typography and empty photo frames). None of it
shows customer work, people, reviews, or competitor material.

| File | Size (px) | Alt text | Source | Canva | Replace with |
| --- | --- | --- | --- | --- | --- |
| `magazine/assets/brand/bread-of-lyfe-publishing-logo.webp` / `.png` | 447 × 447 | Bread of Lyfe Publishing | Canva design "Bread of Life Logo" (`DAFYzgXOOXg`), page 3, unchanged | [Edit](https://www.canva.com/d/ikB7MsAF6Xa1QzW) | A 1000 px export of the same page (see note) |
| Hero cover + spread (inline SVG in page) | 560 × 620 viewBox | "Sample personalized magazine: a cover titled Cover Story..." | `scripts/magazine/art.mjs` → `heroArt` | none | A real cover/spread photo: set as an `<img>` in `build.mjs` `hero()` |
| 12 product thumbnails (inline SVG) | 400 × 300 viewBox | "Illustrated placeholder for {product}" | `art.mjs` → `productArt` | none | Set `image` on the product in `content.json` (EDITING.md) |
| 5 personalization examples (inline SVG) | 600 × 460 viewBox | "{Page} example layout with empty photo frames" | `art.mjs` → `journeyArt` | none | Approved layout images; update `journey()` in `build.mjs` |
| `magazine/assets/social/og-magazine.jpg` | 1200 × 630 | from `seo.ogImageAlt` | `render-social.mjs` | none | Same size JPG; keep the file name |
| `magazine/assets/social/pinterest-cover-story.jpg` | 1000 × 1500 | see PINTEREST.md | `render-social.mjs` | none | Same size; keep name or update PINTEREST.md |
| `magazine/assets/social/pinterest-birthday.jpg` | 1000 × 1500 | see PINTEREST.md | `render-social.mjs` | none | as above |
| `magazine/assets/social/pinterest-every-chapter.jpg` | 1000 × 1500 | see PINTEREST.md | `render-social.mjs` | none | as above |
| `magazine/assets/fonts/*.woff2` | n/a | n/a | Fontsource packages of Fraunces, Jost, Damion (SIL Open Font License, licenses included) | none | n/a |

Inline SVG placeholders have fixed aspect ratios in CSS, so swapping them for images with
`width`/`height` will not cause layout shift. Real images below the hero are lazy-loaded.

## Canva notes

- Canva was searched and read successfully: the "Lyfe Moment Brand Kit" presentation
  (`DAHZKKMZ42I`) and the "Bread of Life Logo" design (`DAFYzgXOOXg`) were found.
- The logo design has five pages: page 3 is the geometric "Bread of Lyfe Publishing" mark, page 4
  is a script "Bread of Lyfe Publishing" mark, and pages 2 and 5 say "Media". **Page 3 is used.
  Please confirm which page is the official publishing logo.**
- Canva's export ran, but downloading the exported file is blocked by this build environment's
  network rules, so the logo in the project is Canva's 447 px preview of page 3, unaltered. It is
  sharp at the 180–220 px display size. For a crisper file, export page 3 from Canva as PNG
  (1000 × 1000) and replace both logo files.
- No new Canva designs were created: files made in Canva could not be downloaded into the
  project from here, and the brief asks for exported files, not temporary Canva links. The
  social images were generated from the same code as the page instead, so they match exactly.
  They can be recreated in Canva from the brand kit if you prefer to edit them there.
- The brand kit's own palette (#A8CBEA, #F2DE87, pearl #F8F5F0) differs slightly from the exact
  hex values in the brief. The page uses the brief's values (#A9CBE8, #FBE29D, white).
