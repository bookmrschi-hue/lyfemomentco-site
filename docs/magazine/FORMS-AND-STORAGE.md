# Publishing inquiry form: how it works and what is left to connect

## Current state

- The form is built and validated in the browser **and** on the server.
- On the staging page `inquiryForm.connected` is `false`, so the form shows a
  "Preview only" notice and **sends nothing**.
- The server endpoint (`/api/magazine-inquiry`) is built and tested. With no storage connected
  it answers "not configured" (HTTP 503) and stores nothing.
- Verified locally: with the development file store on, a clearly labelled `[TEST]` submission
  was saved and returned a reference like `LMC-20261027-44DB73`.

Protection in place: required privacy acknowledgment, unchecked marketing opt-in, hidden honeypot
field, minimum fill time, per-address rate limit (best effort on serverless), 10 KB body limit,
product and occasion values checked against `content.json`, spreadsheet formula neutralising,
duplicate-click protection, accessible error messages, and success shown only after storage
confirms the record.

Fields collected: name, email, interest, occasion, optional quantity, optional celebration date,
notes, privacy acknowledgment, marketing opt-in. No card details, uploads, or children's data.

## Connect a private Google Sheet (recommended, about 10 minutes)

No Google keys go into the website. The website talks to a small Google Apps Script that only
you can edit, using a shared secret stored in Netlify.

1. Create a new Google Sheet in your own Drive named **Magazine inquiries**. Do not share it.
2. In the sheet: **Extensions → Apps Script**. Replace the code with the script below.
3. **Project Settings → Script properties → Add**: `SECRET` = a long random phrase (30+ characters).
4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**.
   (The secret stops anyone else from writing; the sheet itself stays private.) Copy the URL.
5. In Netlify: **Site configuration → Environment variables**, add
   `INQUIRY_SHEETS_WEBHOOK_URL` (the URL) and `INQUIRY_SHEETS_WEBHOOK_SECRET` (the same phrase).
6. Redeploy, open the deploy preview, set `inquiryForm.connected` to `true` (or ask Claude),
   and send one inquiry with `[TEST]` in the notes. Check that the row appears in the sheet and
   that the page shows the same reference number.

```javascript
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || data.secret !== secret) return out({ ok: false, error: 'unauthorized' });
    var r = data.record;
    var sheet = SpreadsheetApp.getActive().getSheets()[0];
    var cols = ['reference', 'receivedAt', 'name', 'email', 'interest', 'occasion', 'quantity',
                'eventDate', 'notes', 'privacyAck', 'privacyNoticeVersion', 'marketingOptIn', 'source', 'test'];
    if (sheet.getLastRow() === 0) sheet.appendRow(cols);
    sheet.appendRow(cols.map(function (c) { return r[c] === undefined ? '' : r[c]; }));
    return out({ ok: true, reference: r.reference });
  } catch (err) {
    return out({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}
function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
```

Optional: add an email alert with `MailApp.sendEmail('breadoflyfepublishing@gmail.com', 'New magazine inquiry ' + r.reference, r.name + ' – ' + r.interest);`
inside the `try` block.

**Alternative:** Netlify Forms can also store submissions in the Netlify dashboard, but it uses
Netlify's own spam handling and does not run this server-side validation. Google Forms is a last
resort fallback; do not link a Google Form while this form is live, to avoid duplicate inquiries.

## Customer photo uploads (not enabled)

Uploads stay off until all of these are decided and configured:

- Storage: a private Google Drive folder written by a server-side service account, or
  Netlify Blobs read only through a signed, expiring link. Never a public folder or GitHub.
- Limits: JPG, PNG, HEIC only; suggested 20 MB per file and 60 files per project.
- Access: only the owner can view; links are not emailed in plain text.
- Retention: e.g. delete originals 90 days after delivery; say so in the privacy notice.
- Consent: the person uploading confirms they have the right to use the photos, and adult
  permission for any child's photo.

The integration point is the inquiry `reference`: an upload service should attach files to that
reference rather than collecting contact details again.
