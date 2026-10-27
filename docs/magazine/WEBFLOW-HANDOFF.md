# Webflow: status, the mobile editor crash, and a native rebuild map

## What exists in Webflow today

The connected Webflow account has one site, **Lyfe Moment Co.** (`lyfe-moment-co`, site id
`6adf89c8ca274c7249f07b58`), created 26 Oct 2026, never published, with no custom domain. It does
not serve lyfemoment.store. Nothing was changed in Webflow.

## The mobile editor crash

- The crash is in **Webflow's Designer app** (`lyfe-moment-co.design.webflow.com`), not in your
  published website. The Webflow site has never been published, so there is no published Webflow
  page that could be crashing.
- Webflow's Designer is built for desktop browsers and is not designed to run on phones. It
  could not be reproduced here (no phone or signed-in Designer session was available), so
  this is a likely explanation, not a confirmed diagnosis.
- Nothing in this repository can fix a crash inside Webflow's editor. Practical options: edit on a
  laptop or desktop, or keep editing in this repository (see EDITING.md, which works from a phone
  on github.com).

## Should the magazine page move to Webflow?

Only if you want to edit visually in the Webflow Designer. Trade-offs:

- Webflow hosting needs a paid site plan, plus a CMS or Ecommerce plan for collections/checkout.
- Webflow would need to host `magazine.lyfemoment.store` (a DNS change) or the whole domain.
- Webflow forms store submissions in Webflow; the custom validation here would not carry over.
- Exporting a Webflow site to Netlify drops CMS, forms, search and Ecommerce.

## Native rebuild map (if you choose Webflow)

**Variables (Colors):** butter `#FBE29D`, powder `#A9CBE8`, white `#FFFFFF`, copper `#775537`,
turquoise `#1BA3A8`, copper-deep `#5C3F26` (small text on blue), ink `#3A2A1C` (body text).
**Fonts:** Fraunces 700/800, Jost 400/500/600, Damion (Google Fonts in Webflow).

**CMS collections**

| Collection | Fields |
| --- | --- |
| Products | Name, Slug, Category (ref), Short description, Long description (rich text), Image, Intended use, Occasions (multi-ref), Personalization (rich text list), Format, Dimensions, Page count, Materials, Price (number, empty = hidden), Turnaround, Fulfillment, Publication status (option), Owner review (option), Featured (switch) |
| Categories | Name, Slug, Order |
| Occasions | Name, Slug, Idea (plain text), Order |
| FAQs | Question, Answer (rich text), Published (switch), Order |
| Example pages | Label, Description, Image, Order |

**Pages:** `/magazine` (static page with collection lists: Products filtered by Featured/Category,
Occasions, FAQs where Published = true), `/magazine/products/[slug]` (Products template page),
`/magazine/policies`.

**Sections, in order:** brand strip, sticky powder-blue navbar, hero (yellow), intro card with
striped awning, product directory (powder blue, white cards), personalization examples with
lightbox, how it works (powder blue), occasions grid, publisher block with logo, schools section +
form (powder blue), FAQ (white panel), final CTA, footer (powder blue).
All copy is in `magazine/content.json` and can be pasted field by field.
