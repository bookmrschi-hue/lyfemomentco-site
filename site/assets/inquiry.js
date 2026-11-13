// Consultation form: posts JSON to /api/inquiry (server.js), then shows the thank-you page.
(function () {
  var form = document.getElementById('inquiry');
  if (!form) return;
  var status = form.querySelector('.form-status');
  var base = form.getAttribute('data-base') || '../';

  // Edition buttons pre-select the matching radio before scrolling to the form.
  document.querySelectorAll('[data-edition]').forEach(function (a) {
    a.addEventListener('click', function () {
      var r = form.querySelector('input[name="edition"][value="' + a.getAttribute('data-edition') + '"]');
      if (r) r.checked = true;
    });
  });
  var pre = new URLSearchParams(location.search).get('edition');
  if (pre) {
    var r = form.querySelector('input[name="edition"][value="' + pre + '"]');
    if (r) r.checked = true;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.className = 'form-status';
    var name = form.elements.name.value.trim();
    var email = form.elements.email.value.trim();
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      status.textContent = 'Please add your name and a valid email.';
      status.className = 'form-status error';
      return;
    }
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    status.textContent = 'Sending…';
    fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (res) { if (!res.ok) throw new Error(); location.href = base + 'thank-you.html'; })
      .catch(function () {
        btn.disabled = false;
        status.textContent = 'Something went wrong. Please email hello@lyfemomentco.com and we will reply personally.';
        status.className = 'form-status error';
      });
  });
})();
