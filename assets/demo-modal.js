// demo-modal.js — EventFlow "Book a Demo" modal.
// Usage: include <script src="/assets/demo-modal.js" defer></script> on any page
// and give any trigger element the attribute  data-demo-trigger  (e.g. an <a> or <button>).
// Submits JSON to the n8n webhook; n8n sends an email to mitchwilson@eventflowsales.com
// and posts to #eventflow-ops Slack.

(function () {
  'use strict';

  var WEBHOOK_URL = 'https://tibbling.app.n8n.cloud/webhook/demo-request';

  var STYLES = [
    '.ef-demo-backdrop{position:fixed;inset:0;background:rgba(0,10,20,0.72);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px;}',
    '.ef-demo-backdrop.open{display:flex;animation:efFadeIn .18s ease-out;}',
    '@keyframes efFadeIn{from{opacity:0}to{opacity:1}}',
    '.ef-demo-modal{background:#001e30;color:#ffecd1;border:1px solid #1a3d54;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.6);width:100%;max-width:520px;max-height:92vh;overflow-y:auto;padding:32px;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;}',
    '.ef-demo-modal h2{font-size:1.5rem;font-weight:700;margin:0 0 6px;color:#ffecd1;}',
    '.ef-demo-modal p.sub{font-size:.95rem;color:#c5d8e2;margin-bottom:22px;}',
    '.ef-demo-modal label{display:block;font-size:.82rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#8faab8;margin:14px 0 6px;}',
    '.ef-demo-modal input,.ef-demo-modal select,.ef-demo-modal textarea{width:100%;padding:11px 13px;border-radius:8px;border:1px solid #1a3d54;background:#001524;color:#ffecd1;font-size:.95rem;font-family:inherit;}',
    '.ef-demo-modal input:focus,.ef-demo-modal select:focus,.ef-demo-modal textarea:focus{outline:none;border-color:#ff7d00;box-shadow:0 0 0 3px rgba(255,125,0,.18);}',
    '.ef-demo-modal textarea{resize:vertical;min-height:80px;}',
    '.ef-demo-modal .row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}',
    '@media (max-width:480px){.ef-demo-modal .row{grid-template-columns:1fr;}.ef-demo-modal{padding:22px;}}',
    '.ef-demo-modal .actions{margin-top:22px;display:flex;gap:10px;justify-content:flex-end;}',
    '.ef-demo-btn{padding:12px 22px;border-radius:10px;border:0;font-weight:600;font-size:.95rem;cursor:pointer;font-family:inherit;transition:transform .08s ease,box-shadow .12s ease;}',
    '.ef-demo-btn:active{transform:translateY(1px);}',
    '.ef-demo-btn.primary{background:#ff7d00;color:#001524;}',
    '.ef-demo-btn.primary:hover{background:#ff9b3d;box-shadow:0 6px 18px rgba(255,125,0,.3);}',
    '.ef-demo-btn.primary[disabled]{opacity:.6;cursor:wait;}',
    '.ef-demo-btn.ghost{background:transparent;color:#c5d8e2;border:1px solid #1a3d54;}',
    '.ef-demo-btn.ghost:hover{color:#ffecd1;border-color:#3a6070;}',
    '.ef-demo-close{position:absolute;top:14px;right:14px;background:none;border:0;color:#8faab8;font-size:1.5rem;cursor:pointer;line-height:1;padding:6px 10px;}',
    '.ef-demo-close:hover{color:#ffecd1;}',
    '.ef-demo-wrap{position:relative;}',
    '.ef-demo-error{background:rgba(120,41,15,.35);border:1px solid #78290f;color:#ffecd1;padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:.9rem;display:none;}',
    '.ef-demo-error.show{display:block;}',
    '.ef-demo-success{text-align:center;padding:18px 4px;}',
    '.ef-demo-success h3{color:#ff9b3d;margin-bottom:10px;font-size:1.25rem;}',
    '.ef-demo-success p{color:#c5d8e2;font-size:.95rem;}'
  ].join('');

  var FORM_HTML =
    '<div class="ef-demo-wrap">' +
      '<button class="ef-demo-close" aria-label="Close">&times;</button>' +
      '<div class="ef-demo-body">' +
        '<h2>Book a demo</h2>' +
        '<p class="sub">Tell us a bit about your venue and we\'ll be in touch within one business day.</p>' +
        '<div class="ef-demo-error" role="alert"></div>' +
        '<form novalidate>' +
          '<div class="row">' +
            '<div><label for="efd-name">Your name *</label>' +
              '<input id="efd-name" name="name" required autocomplete="name"></div>' +
            '<div><label for="efd-email">Work email *</label>' +
              '<input id="efd-email" name="email" type="email" required autocomplete="email"></div>' +
          '</div>' +
          '<div class="row">' +
            '<div><label for="efd-company">Venue / company</label>' +
              '<input id="efd-company" name="company" autocomplete="organization"></div>' +
            '<div><label for="efd-venue-type">Venue type</label>' +
              '<select id="efd-venue-type" name="venue_type">' +
                '<option value="">Select…</option>' +
                '<option>Restaurant</option>' +
                '<option>Hotel</option>' +
                '<option>Event space</option>' +
                '<option>Winery / brewery</option>' +
                '<option>Other</option>' +
              '</select></div>' +
          '</div>' +
          '<label for="efd-notes">Anything we should know? (optional)</label>' +
          '<textarea id="efd-notes" name="notes" placeholder="Tell us about your private-events volume, current tools, etc."></textarea>' +
          '<div class="actions">' +
            '<button type="button" class="ef-demo-btn ghost" data-demo-cancel>Cancel</button>' +
            '<button type="submit" class="ef-demo-btn primary">Request demo</button>' +
          '</div>' +
        '</form>' +
      '</div>' +
      '<div class="ef-demo-success" style="display:none">' +
        '<h3>Thanks — we\'ll be in touch soon.</h3>' +
        '<p>We\'ve got your request and will follow up within one business day.</p>' +
        '<div class="actions" style="justify-content:center">' +
          '<button type="button" class="ef-demo-btn primary" data-demo-close-success>Close</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  var backdrop, modal, form, errorBox, bodyEl, successEl;

  function injectStyles() {
    if (document.getElementById('ef-demo-styles')) return;
    var style = document.createElement('style');
    style.id = 'ef-demo-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function buildModal() {
    if (backdrop) return;
    injectStyles();
    backdrop = document.createElement('div');
    backdrop.className = 'ef-demo-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Book a demo');

    modal = document.createElement('div');
    modal.className = 'ef-demo-modal';
    modal.innerHTML = FORM_HTML;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    form = modal.querySelector('form');
    errorBox = modal.querySelector('.ef-demo-error');
    bodyEl = modal.querySelector('.ef-demo-body');
    successEl = modal.querySelector('.ef-demo-success');

    modal.querySelector('.ef-demo-close').addEventListener('click', close);
    modal.querySelector('[data-demo-cancel]').addEventListener('click', close);
    modal.querySelector('[data-demo-close-success]').addEventListener('click', close);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && backdrop.classList.contains('open')) close();
    });

    form.addEventListener('submit', onSubmit);
  }

  function open() {
    buildModal();
    errorBox.classList.remove('show');
    bodyEl.style.display = '';
    successEl.style.display = 'none';
    form.reset();
    backdrop.classList.add('open');
    setTimeout(function () {
      var nameField = modal.querySelector('#efd-name');
      if (nameField) nameField.focus();
    }, 50);
  }

  function close() {
    if (backdrop) backdrop.classList.remove('open');
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add('show');
  }

  function onSubmit(e) {
    e.preventDefault();
    errorBox.classList.remove('show');

    var data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      company: form.company.value.trim(),
      venue_type: form.venue_type.value,
      notes: form.notes.value.trim(),
      source_page: location.pathname + location.search
    };

    if (!data.name) { showError('Please enter your name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { showError('Please enter a valid email.'); return; }

    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) {
      if (!res.ok) throw new Error('Request failed (' + res.status + ')');
      bodyEl.style.display = 'none';
      successEl.style.display = '';
    }).catch(function (err) {
      showError('Something went wrong — please email sales@eventflowsales.com directly. (' + err.message + ')');
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = 'Request demo';
    });
  }

  // Delegate clicks on any element (or its descendants) with data-demo-trigger.
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-demo-trigger]');
    if (!t) return;
    e.preventDefault();
    open();
  });

  // Expose a tiny global for ad-hoc buttons too.
  window.EventFlowDemo = { open: open, close: close };
})();
