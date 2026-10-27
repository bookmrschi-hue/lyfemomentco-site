# Editing the magazine page

Almost everything you will want to change is in one file: **`magazine/content.json`**.

## The easiest way (on github.com, no software needed)

1. Open the repository on github.com and go to `magazine/content.json`.
2. Click the pencil icon ("Edit this file").
3. Change the words between the quote marks. Keep the quote marks, commas and brackets as they are.
4. Click **Commit changes**. A GitHub Action rebuilds the page automatically a minute later.

If the Action shows a red ✗, the message tells you which line has a problem (usually a missing
comma or quote mark). You can also ask Claude to make the change for you.

## What to change, and where in `content.json`

| I want to change... | Look for |
| --- | --- |
| Contact emails | `site.emailGeneral`, `site.emailPublishing` |
| Hero headline and buttons | `hero` |
| A product's name or description | `products` → find the product → `name`, `shortDescription`, `longDescription` |
| Which occasions a product shows up for | that product's `occasions` list (use the ids in `occasions.items`) |
| Hide a product completely | set its `publicationStatus` to `"hidden"` |
| Mark a product as approved and live | set `publicationStatus` to `"published"` and `ownerReview` to `"approved"` |
| Add approved specifications | that product's `specs` (format, dimensions, pageCount, materials, price, turnaround, fulfillment) |
| FAQ answers | `faq.items`. A question appears only when `published` is `true` and it has an answer |
| Occasion ideas | `occasions.items` |
| Footer links | `footer.links` |
| Privacy and ordering text | `policies.sections` |

### Prices and specifications

- Leave a field as `null` until it is confirmed. Empty fields are simply not shown.
- Prices are numbers without a dollar sign, e.g. `"price": 48`. Never use `0` to mean "unknown".
- When at least one spec is filled in, the product page shows a Details table instead of the
  "details will be shared" sentence.

### Images

1. Export the image from Canva as JPG or WebP, about 1600 px wide, under 300 KB.
2. Put it in `magazine/assets/img/` (upload on github.com with **Add file → Upload files**).
3. On the product, replace `"image": null` with:

```json
"image": { "src": "assets/img/custom-magazine.webp", "width": 1600, "height": 1200, "alt": "Open personalized birthday magazine on a linen tablecloth" }
```

Use the real width and height of the file, and describe what the photo shows in `alt`.
Only use photos of your own work or photos you have permission to use.

### The logo

`magazine/assets/brand/bread-of-lyfe-publishing-logo.webp` and `.png`. Replace both files with a
higher-resolution export of the same artwork and keep the same file names.

## Colors and fonts

At the top of `magazine/assets/css/magazine.css`. The brand colors are fixed:
butter yellow `#FBE29D`, powder blue `#A9CBE8`, white, copper `#775537`, turquoise `#1BA3A8`.
`--copper-deep` and `--ink` are darker text colors used so small text stays readable.

## Going live

See the launch checklist in [README.md](README.md). The important switch is `site.indexing`:
keep it `"staging"` until the page is approved, then change it to `"production"`.

## Rebuilding on your own computer (optional)

```bash
npm run build:magazine      # regenerate pages after editing content.json
npm test                    # run checks
```
