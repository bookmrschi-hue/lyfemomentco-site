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

## Before launch

Text marked with the `tbc` class (highlighted in brass) still needs a decision:
- Holiday order cutoff date
- The Headlines add-on price
- Deposit or pay-in-full policy
- Page counts per edition
- Contact email (hello@lyfemomentco.com is a placeholder)
- About page paragraph in Barbie's voice
- File retention period on the privacy page; have privacy and terms reviewed

Then remove the `tbc` class. Consultation requests are saved to `inquiries.jsonl` on the server; forward them to email or a CRM before launch. Payment is by invoice/payment link after consultation; no payment links are wired in yet.
