/* Lyfe Moment Co. magazine page: progressive enhancements.
   The page is fully readable without this script; it adds the mobile menu,
   product filters, the example-page viewer and the inquiry form behaviour. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var yearEl = $('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Header height for anchor offsets ---------- */
  var header = $('[data-header]');
  function syncHeaderHeight() {
    if (header) document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
  }
  syncHeaderHeight();
  window.addEventListener('resize', syncHeaderHeight);

  /* ---------- Mobile menu ---------- */
  var toggle = $('[data-menu-toggle]');
  var menu = $('[data-menu]');
  function closeMenu(returnFocus) {
    if (!toggle || toggle.getAttribute('aria-expanded') !== 'true') return;
    toggle.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
    if (returnFocus) toggle.focus();
  }
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      menu.classList.toggle('is-open', !open);
      if (!open) { var first = $('a', menu); if (first) first.focus(); }
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(true); });
    document.addEventListener('click', function (e) { if (!e.target.closest('[data-header]')) closeMenu(false); });
    window.matchMedia('(min-width: 960px)').addEventListener('change', function () { closeMenu(false); });
  }

  /* ---------- Product filters (category + occasion) ---------- */
  var filters = $('[data-filters]');
  var grid = $('[data-product-grid]');
  var state = { category: 'all', occasion: null, occasionLabel: '' };
  function applyFilters(announce) {
    if (!grid) return;
    var cards = $$('.product-card', grid);
    var shown = 0;
    cards.forEach(function (card) {
      var okCat = state.category === 'all' || card.getAttribute('data-category') === state.category;
      var okOcc = !state.occasion || (' ' + card.getAttribute('data-occasions') + ' ').indexOf(' ' + state.occasion + ' ') !== -1;
      card.hidden = !(okCat && okOcc);
      if (!card.hidden) shown++;
    });
    $$('[data-filter-category]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-filter-category') === state.category));
    });
    var occBox = $('[data-occasion-active]');
    if (occBox) {
      occBox.hidden = !state.occasion;
      $('[data-occasion-text]').textContent = state.occasion ? 'Showing keepsakes for ' + state.occasionLabel + '.' : '';
    }
    var empty = $('[data-empty]');
    if (empty) empty.hidden = shown !== 0;
    var status = $('[data-filter-status]');
    if (status && announce) status.textContent = 'Showing ' + shown + (shown === 1 ? ' keepsake' : ' keepsakes') + '.';
  }
  if (filters && grid) {
    filters.hidden = false;
    filters.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter-category]');
      if (btn) { state.category = btn.getAttribute('data-filter-category'); applyFilters(true); }
      if (e.target.closest('[data-clear-occasion]')) { state.occasion = null; applyFilters(true); }
    });
  }

  /* Occasion tiles: filter the directory and preselect the form's occasion. */
  $$('[data-occasion]').forEach(function (btn) {
    btn.hidden = false;
    btn.addEventListener('click', function () {
      state.occasion = btn.getAttribute('data-occasion');
      state.occasionLabel = btn.getAttribute('data-occasion-label');
      state.category = 'all';
      applyFilters(true);
      var occSelect = $('#f-occasion');
      if (occSelect && !occSelect.value) occSelect.value = state.occasion;
      var target = $('#magazines');
      if (target) {
        target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        var heading = $('#directory-title');
        if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
      }
    });
  });

  /* ---------- Example page viewer (native <dialog>) ---------- */
  var viewer = $('[data-viewer]');
  if (viewer && typeof viewer.showModal === 'function') {
    var slides = $$('[data-viewer-slide]', viewer);
    var titleEl = $('[data-viewer-title]', viewer);
    var countEl = $('[data-viewer-count]', viewer);
    var labels = $$('.page-thumb__label').map(function (el) { return el.textContent; });
    var current = 0;
    var opener = null;
    var show = function (i) {
      current = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) { s.hidden = n !== current; });
      titleEl.textContent = labels[current] || '';
      countEl.textContent = (current + 1) + ' of ' + slides.length;
    };
    $$('[data-viewer-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        opener = btn;
        show(Number(btn.getAttribute('data-viewer-open')));
        viewer.showModal();
        $('[data-viewer-close]', viewer).focus();
      });
    });
    $('[data-viewer-prev]', viewer).addEventListener('click', function () { show(current - 1); });
    $('[data-viewer-next]', viewer).addEventListener('click', function () { show(current + 1); });
    $('[data-viewer-close]', viewer).addEventListener('click', function () { viewer.close(); });
    viewer.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
    viewer.addEventListener('click', function (e) { if (e.target === viewer) viewer.close(); });
    viewer.addEventListener('close', function () { if (opener) opener.focus(); });
  } else {
    // Very old browsers: keep thumbnails as plain labelled images.
    $$('[data-viewer-open]').forEach(function (b) { b.disabled = true; b.style.cursor = 'default'; });
  }

  /* ---------- Inquiry form ---------- */
  var form = $('[data-inquiry-form]');
  if (!form) return;

  var messages = {};
  try { messages = JSON.parse($('#form-messages').textContent); } catch (e) { /* defaults below */ }
  var statusEl = $('[data-form-status]', form);
  var summary = $('[data-error-summary]', form);
  var submitBtn = $('[data-submit]', form);
  var connected = form.getAttribute('data-connected') === 'true';
  var startedAt = form.elements.startedAt;
  var busy = false;

  // Preselect interest from ?interest=slug (product page links).
  try {
    var wanted = new URLSearchParams(location.search).get('interest');
    if (wanted && form.elements.interest.querySelector('option[value="' + CSS.escape(wanted) + '"]')) form.elements.interest.value = wanted;
  } catch (e) { /* ignore */ }

  function markStarted() { if (!startedAt.value) startedAt.value = String(Date.now()); }
  form.addEventListener('focusin', markStarted, { once: true });

  $$('[data-focus-form]').forEach(function (a) {
    a.addEventListener('click', function () {
      setTimeout(function () { var f = $('#f-name'); if (f) f.focus({ preventScroll: true }); }, 350);
    });
  });

  function emailLink(addr) { return '<a href="mailto:' + addr + '">' + addr + '</a>'; }
  function setStatus(kind, html) {
    statusEl.className = 'form-status' + (kind ? ' is-' + kind : '');
    statusEl.innerHTML = html;
    if (html) statusEl.focus();
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function validate() {
    var errs = {};
    var v = function (n) { return (form.elements[n].value || '').trim(); };
    if (!v('name')) errs.name = 'Please enter your name.';
    else if (v('name').length > 100) errs.name = 'Please keep your name under 100 characters.';
    if (!v('email')) errs.email = 'Please enter your email address.';
    else if (!EMAIL_RE.test(v('email'))) errs.email = 'Please enter an email address like name@example.com.';
    if (!v('interest')) errs.interest = 'Please choose what you are interested in.';
    if (!v('occasion')) errs.occasion = 'Please choose an occasion.';
    var q = v('quantity');
    if (q && (!/^\d+$/.test(q) || +q < 1 || +q > 5000)) errs.quantity = 'Please enter a whole number from 1 to 5000, or leave it blank.';
    var d = v('eventDate');
    if (d) {
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var picked = new Date(d + 'T00:00:00');
      if (isNaN(picked.getTime())) errs.eventDate = 'Please enter a valid date.';
      else if (picked < today) errs.eventDate = 'Please choose a date that has not passed yet.';
    }
    if (!v('notes')) errs.notes = 'Please tell us a little about your project.';
    else if (v('notes').length > 2000) errs.notes = 'Please keep your notes under 2000 characters.';
    if (!form.elements.privacyAck.checked) errs.privacyAck = 'Please confirm you have read the privacy notice.';
    return errs;
  }

  function showErrors(errs) {
    var names = Object.keys(errs);
    $$('[data-error-for]', form).forEach(function (p) {
      var n = p.getAttribute('data-error-for');
      p.textContent = errs[n] || '';
      var field = form.elements[n];
      if (field) {
        if (errs[n]) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
      }
    });
    if (names.length) {
      summary.hidden = false;
      summary.textContent = (messages.fixErrors || 'Please check the highlighted fields.') + ' (' + names.length + ')';
      var first = form.elements[names[0]];
      if (first && first.focus) first.focus();
    } else {
      summary.hidden = true;
      summary.textContent = '';
    }
  }

  form.addEventListener('input', function (e) {
    var n = e.target.name;
    if (e.target.getAttribute('aria-invalid') === 'true') {
      var errs = validate();
      if (!errs[n]) {
        e.target.removeAttribute('aria-invalid');
        var p = $('[data-error-for="' + n + '"]', form);
        if (p) p.textContent = '';
      }
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    markStarted();
    setStatus('', '');
    var errs = validate();
    showErrors(errs);
    if (Object.keys(errs).length) return;

    if (!connected) {
      // Preview mode: nothing leaves the browser.
      setStatus('', (messages.previewSuccess || 'Preview only: nothing was sent.') + ' ' + emailLink(messages.emailPublishing) + '.');
      return;
    }

    busy = true;
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-disabled', 'true');
    submitBtn.textContent = messages.sending || 'Sending...';

    var data = {};
    ['name', 'email', 'interest', 'occasion', 'quantity', 'eventDate', 'notes', 'website', 'startedAt'].forEach(function (n) {
      data[n] = (form.elements[n].value || '').trim();
    });
    data.privacyAck = form.elements.privacyAck.checked;
    data.marketingOptIn = form.elements.marketingOptIn.checked;

    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : null;

    fetch(form.getAttribute('action'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
      signal: ctrl ? ctrl.signal : undefined,
      credentials: 'same-origin',
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) { return { res: res, body: body }; });
      })
      .then(function (r) {
        if (r.res.ok && r.body && r.body.ok && r.body.reference) {
          form.reset();
          startedAt.value = '';
          setStatus('success', (messages.success || 'Received. Reference') + ' <strong>' + String(r.body.reference).replace(/[^A-Z0-9-]/g, '') + '</strong>.');
          return;
        }
        if (r.res.status === 400 && r.body && r.body.errors) { showErrors(r.body.errors); return; }
        var msg = messages.error;
        if (r.res.status === 503) msg = messages.notConfigured;
        if (r.res.status === 429) msg = messages.rateLimited;
        setStatus('error', msg + ' ' + emailLink(messages.emailPublishing) + '.');
      })
      .catch(function () {
        setStatus('error', messages.error + ' ' + emailLink(messages.emailPublishing) + '.');
      })
      .then(function () {
        if (timer) clearTimeout(timer);
        busy = false;
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-disabled');
        submitBtn.textContent = messages.submit || 'Send inquiry';
      });
  });
})();
