# Lyfe Moment magazine site

Static pages for the luxury magazine line. Served by `server.js` at `/magazines`.

| Page | URL (local) | Purpose |
|---|---|---|
| The Private Edition (landing page) | `/magazines/private/` | High earner landing page; one goal: request a consultation |
| Home | `/magazines/` | Main website home |
| Editions & pricing | `/magazines/editions.html` | Four editions, The Headlines add-on, comparison table |
| How it works | `/magazines/how-it-works.html` | Five-step process and FAQ |
| Commission an issue | `/magazines/inquire.html` | Consultation form |
| About | `/magazines/about.html` | Brand story (needs Barbie's paragraph) |
| Privacy & discretion | `/magazines/privacy.html` | Plain-language privacy summary |
| Thank you | `/magazines/thank-you.html` | After the form is sent |

Run locally: `npm install && npm start`, then open http://localhost:3000/magazines/private/

On Netlify, `netlify.toml` serves the same pages at `/magazines/`. The form is a Netlify Form named `consultation`: turn on form detection in Netlify (Forms > Enable form detection) and add an email notification so requests reach the inbox.

## Before launch

Text marked with the `tbc` class (highlighted in brass) still needs a decision:
- When the Year in Review balance is due
- Page counts per edition
- Contact email (hello@lyfemomentco.com is a placeholder)
- About page paragraph in Barbie's voice
- File retention period on the privacy page; have privacy and terms reviewed

Then remove the `tbc` class. Edition buttons link to the live Stripe payment links created in the launch plan thread (Year in Review $1,750 deposit, Birthday Issue $1,200, Editor's Template $550, The Headlines $395 on its own; $295 add-on offered at checkout).
