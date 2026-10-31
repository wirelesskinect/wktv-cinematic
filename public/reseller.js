// "Become a reseller" form on the homepage → /api/reseller
(function () {
  var form = document.getElementById('reseller-form');
  if (!form) return;
  var errorBox = document.getElementById('reseller-error');
  var button = form.querySelector('button[type=submit]');
  var thanks = document.getElementById('reseller-thanks');

  function showError(text) {
    errorBox.textContent = text;
    errorBox.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorBox.hidden = true;
    if (!form.reportValidity()) return;

    var data = {
      firstName: form.firstName.value,
      lastName: form.lastName.value,
      email: form.email.value,
      phone: form.phone.value,
      company_website: form.company_website.value
    };
    button.disabled = true;
    var label = button.innerHTML;
    button.textContent = 'Sending…';

    fetch('/api/reseller', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (r) {
        if (!r.ok) throw new Error(r.body.error || 'Something went wrong. Please try again.');
        form.hidden = true;
        thanks.hidden = false;
        thanks.querySelector('h3').focus();
      })
      .catch(function (err) {
        showError(err.message || 'Something went wrong. Please try again.');
      })
      .finally(function () {
        button.disabled = false;
        button.innerHTML = label;
      });
  });
})();
