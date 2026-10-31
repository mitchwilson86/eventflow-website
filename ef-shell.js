/**
 * EventFlow shared shell (EF_SHELL, 2026-08-23).
 *
 * ONE place for the app chrome and sign-in plumbing that used to be
 * copy-pasted across the dashboard pages:
 *   - CONFIG: Apps Script URL, Google client id, Supabase URL + anon key
 *   - sidebarHtml()/mountSidebar(): the canonical sidebar for BOTH clusters
 *   - boot(): the whole Google Identity Services sign-in flow for a
 *     dashboard-cluster page (button render, saved-session fast path,
 *     client_list load + re-resolve, venue picker, admin nav)
 *   - signOut(): unified; also ends the Supabase session on bookings pages
 *   - api()/getJson(): Apps Script POST/GET helpers
 *   - setState()/toast(): loading, empty, error states and notifications
 *
 * Load order: after eventflow-admin.js and ef-venue-picker.js (both optional
 * at runtime; every dependency is feature-checked). No other dependencies.
 */
window.EF_SHELL = (function () {

  var CONFIG = {
    DATA_URL: 'https://script.google.com/macros/s/AKfycbxEpfGswzFnPTFLaKWlt332kv6Jy7vdagPcDEDMXbEDwrrFzpoPLc8wrmTW5UEB2xVj8w/exec',
    GOOGLE_CLIENT_ID: '551797277858-ne7qntlo2jgmdp36o2lpcnv8qr6u7ofv.apps.googleusercontent.com',
    SUPABASE_URL: 'https://uzojlcwsrbsqckycjlgm.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable__PO3lrDOGl_AaG4TaznEJA_P4Y5ouPU'
  };

  // Seed venue so the owner and admins can still sign in if client_list is
  // slow or unreachable. loadClients() merges the live registry over this.
  // This is the ONE copy (it used to be pasted into four pages).
  var CLIENTS = {
    sunda: {
      slug: 'sunda-nashville',
      gmail_address: 'sales@eventflowsales.com',
      venue: 'Sunda Nashville'
    }
  };

  var NAV = [
    // GROUP_VIEW_DEMO_V1 (2026-10-29): the group view exists only as a sample for now, so it shows only in sample mode.
    { key: 'locations',    href: '/locations?demo=1', label: 'All Locations', demoOnly: true, icon: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>' },
    { key: 'dashboard',    href: '/dashboard',    label: 'Dashboard',    icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>' },
    { key: 'events',       href: '/events',       label: 'Events',       icon: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
    { key: 'bookings',   href: '/bookings',     label: 'Bookings',     icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
    { key: 'beo',          href: '/booking',      label: 'BEO',          icon: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="14" y2="15"/>' },
    { key: 'venue',        href: '/venue',        label: 'Venue',        icon: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>' },
    { key: 'menus',        href: '/menus',        label: 'Menus',        icon: '<path d="M3 6h18M3 12h18M3 18h18"/>' },
    { key: 'campaigns',    href: '/campaigns',    label: 'Campaigns',    icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
    { key: 'settings',     href: '/settings',     label: 'Settings',     icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
    { key: 'notifications',href: '/notifications',label: 'Notifications',icon: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
    { key: 'admin',        href: '/admin',        label: 'Admin Dashboard', admin: true, icon: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' }
  ];

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = (s == null) ? '' : String(s);
    return d.innerHTML;
  }

  /* ── Email sign-in links (MAGIC_LINK_SHELL_V1, 2026-10-14) ───
   * People without Google sign-in (the events manager is on Microsoft 365) sign in with an
   * emailed link: /<page>?client=<slug>#st=<token> (the daily events recap carries one; the
   * Events page's "email me a link" form sends one). The token is kept per venue in
   * localStorage ef_vf_token_<slug>, the same key /venue has used since July, the #st= part is
   * stripped from the address bar, and api() sends it as session_token whenever there is no
   * Google token. Apps Script verifies the token AND the venue access on every call; the email
   * read from the token here is only used to show who is signed in and to pick the venue.
   * A Google session always wins over a link. */
  function _b64urlJson(s) {
    try {
      s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      return JSON.parse(atob(s));
    } catch (e) { return null; }
  }
  function _urlClient() {
    try { return new URLSearchParams(window.location.search).get('client') || ''; } catch (e) { return ''; }
  }
  function _googleToken() {
    try { return sessionStorage.getItem('ef_id_token') || ''; } catch (e) { return ''; }
  }

  /* ── Staying signed in (SESSION_KEEPALIVE_V1 + SESSION_EXPIRY_SIGNOUT_V1, 2026-10-31) ───
   * A Google sign-in lasts one hour and cannot be stretched, and Apps Script refuses every call after that
   * ("Please sign in again"). So right after a Google sign-in the page asks Apps Script (renew_session) for
   * its own pass, kept in sessionStorage ef_ka_token: the same signed token an emailed link carries, so every
   * action accepts it. A pass lasts an hour. While the person is using the page (mouse, keys, scrolling,
   * taps) it is traded for a fresh one once it is 10 minutes old, so someone active stays signed in, up to 12
   * hours after the Google sign-in (Apps Script enforces both). Someone who walks away is signed out about an
   * hour later: when the pass and the Google sign-in have both run out, the page shows the sign-in screen with
   * a short note (on opening a page, at the moment it runs out, when the tab comes back into view, or when
   * Apps Script refuses the sign-in). Only on pages that run boot(). An emailed sign-in link is left alone (it
   * lasts days), so someone who also has one carries on with it. An Apps Script without renew_session gives
   * no pass, and the page falls back to the one-hour Google sign-in. */
  var EXPIRED_FLAG = 'ef_signin_expired';
  var KA_KEY = 'ef_ka_token';
  var KA_RENEW_AFTER_MS = 10 * 60 * 1000;   // trade a pass in once it is this old and the person was active since
  var KA_CHECK_MS = 15 * 1000;              // look at most this often while they are active
  var _booted = false;
  var _expiring = false;
  var _expiryTimer = null;
  var _lastActivity = Date.now();           // opening a page counts as using it
  var _lastCheck = 0;
  var _renewing = false;
  var _kaStop = false;                      // Apps Script refused a pass: no more tries on this page
  var _kaStartTried = false;
  function _kaPass() {
    try {
      var t = sessionStorage.getItem(KA_KEY) || '';
      var p = t ? _b64urlJson(t.split('.')[0]) : null;
      if (!p || p.k !== 'ka' || !p.x) return null;
      return { token: t, x: Number(p.x), i: Number(p.i) || 0, m: Number(p.m) || 0 };
    } catch (e) { return null; }
  }
  function _kaValid() {
    var k = _kaPass();
    return !!k && Date.now() < k.x;
  }
  function _googleValid() {
    try {
      if (!sessionStorage.getItem('ef_id_token')) return false;
      var exp = Number(sessionStorage.getItem('ef_id_token_exp') || 0);
      return !exp || Date.now() < exp;
    } catch (e) { return false; }
  }
  // There was a Google sign-in on this tab and nothing from it works any more.
  function _timedOut() {
    var had = false;
    try { had = !!(sessionStorage.getItem('ef_id_token') || sessionStorage.getItem(KA_KEY)); } catch (e) {}
    return had && !_googleValid() && !_kaValid();
  }
  // Which note the sign-in screen shows: 'cap' = the pass reached its 12-hour limit, '1' = the pass ran out
  // because nobody used the page, 'google' = there never was a pass (only Google's one-hour sign-in).
  function _expiryReason() {
    var k = _kaPass();
    if (!k) return 'google';
    return (k.m && Date.now() >= k.m - 60000) ? 'cap' : '1';
  }
  function _clearGoogleSession(reason) {
    try {
      sessionStorage.removeItem('ef_user_email');
      sessionStorage.removeItem('ef_id_token');
      sessionStorage.removeItem('ef_id_token_exp');
      sessionStorage.removeItem('ef_admin_email');
      sessionStorage.removeItem(KA_KEY);
      sessionStorage.setItem(EXPIRED_FLAG, reason || '1');
    } catch (e) {}
  }
  // Mid-page: sign out and reload, so the page opens on its sign-in screen (boot() shows the note).
  function sessionExpired() {
    if (_expiring) return;
    _expiring = true;
    _clearGoogleSession(_expiryReason());
    window.location.reload();
  }
  // One timer for whichever runs out last, the Google sign-in or the pass; re-armed after every renewal.
  function watchExpiry() {
    clearTimeout(_expiryTimer);
    var end = 0;
    try {
      if (sessionStorage.getItem('ef_id_token')) end = Number(sessionStorage.getItem('ef_id_token_exp') || 0);
    } catch (e) {}
    var k = _kaPass();
    if (k && k.x > end) end = k.x;
    if (!end) return;
    _expiryTimer = setTimeout(function () {
      if (_timedOut()) sessionExpired();
      else watchExpiry();
    }, Math.min(Math.max(end - Date.now(), 0) + 1000, 2147483000));
  }
  // Ask Apps Script for a pass: from the Google sign-in (a new one) or from the current pass (a renewal).
  // Straight to fetch, not api(): a failed try must never sign anyone out, the timer above decides that.
  function renewPass(fromGoogle) {
    if (_renewing || _kaStop) return;
    var body = { action: 'renew_session' };
    if (fromGoogle) {
      if (!_googleValid()) return;
      body.id_token = _googleToken();
    } else {
      var k = _kaPass();
      if (!k || Date.now() >= k.x) return;
      body.session_token = k.token;
    }
    _renewing = true;
    fetch(CONFIG.DATA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        _renewing = false;
        if (d && d.success && d.session_token) {
          try { sessionStorage.setItem(KA_KEY, d.session_token); } catch (e) {}
          watchExpiry();
        } else {
          _kaStop = true;   // refused (or an Apps Script without renew_session): stop asking
        }
      })
      .catch(function () { _renewing = false; });   // network trouble: the next bit of activity tries again
  }
  function maybeRenew() {
    if (!_booted || _renewing || _kaStop || _expiring) return;
    var k = _kaPass();
    if (!k) {
      if (!_kaStartTried && _googleValid()) { _kaStartTried = true; renewPass(true); }
      return;
    }
    var now = Date.now();
    if (now >= k.x) return;                      // already run out: the timer signs them out
    if (k.m && k.x >= k.m) return;               // at the 12-hour limit: nothing left to renew
    if (now - k.i < KA_RENEW_AFTER_MS) return;   // still fresh
    if (_lastActivity <= k.i) return;            // nobody has used the page since this pass was made
    renewPass(false);
  }
  function noteActivity() {
    _lastActivity = Date.now();
    if (_lastActivity - _lastCheck < KA_CHECK_MS) return;
    _lastCheck = _lastActivity;
    maybeRenew();
  }
  ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, noteActivity, { passive: true, capture: true });
  });
  // A background tab's timer can run late: check again whenever the tab comes back into view.
  document.addEventListener('visibilitychange', function () {
    if (_booted && document.visibilityState === 'visible' && _timedOut()) sessionExpired();
  });
  (function captureLinkToken() {
    try {
      var m = (window.location.hash || '').match(/[#&]st=([^&]+)/);
      if (!m) return;
      var tok = decodeURIComponent(m[1]);
      var p = _b64urlJson(tok.split('.')[0]);
      var slug = _urlClient() || (p && p.c) || '';
      if (slug && p && p.e) localStorage.setItem('ef_vf_token_' + slug, tok);
      if (window.history && history.replaceState) history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) {}
  })();
  // A sign-in link opened in a tab that already shows the same page only changes the #hash (the browser does not
  // reload), so nothing would read it: reload, and the capture above runs on the fresh page.
  window.addEventListener('hashchange', function () {
    if (/[#&]st=/.test(window.location.hash || '')) window.location.reload();
  });
  // The newest usable link session, preferring the venue the page is about. Expired ones are dropped.
  function linkSession(slugHint) {
    try {
      var want = 'ef_vf_token_' + (slugHint || _urlClient() || (window.EF_VENUE_PICKER && EF_VENUE_PICKER.getActive ? EF_VENUE_PICKER.getActive() : '') || '');
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('ef_vf_token_') === 0) keys.push(k);
      }
      keys.sort(function (a, b) { return (b === want ? 1 : 0) - (a === want ? 1 : 0); });
      for (var j = 0; j < keys.length; j++) {
        var tok = localStorage.getItem(keys[j]) || '';
        var p = _b64urlJson(tok.split('.')[0]);
        if (p && p.e && p.x && Date.now() < p.x) return { token: tok, email: String(p.e).toLowerCase(), slug: keys[j].slice(12) };
        if (p && p.x && Date.now() >= p.x) localStorage.removeItem(keys[j]);
      }
    } catch (e) {}
    return null;
  }
  // Ask for a sign-in link by email (Apps Script request_link; it only ever sends one to an address with access).
  function requestLink(slug, email, page) {
    return api({ action: 'request_link', client_slug: slug, email: email, page: page || '' });
  }

  function signedInEmail(fallback) {
    var e = '';
    try { e = sessionStorage.getItem('ef_user_email') || ''; } catch (err) {}
    return (e || fallback || '').toLowerCase();
  }

  function isAdminEmail(email) {
    return !!(window.EF_ADMIN && EF_ADMIN.isAdmin(email));
  }

  /* ── Sidebar ─────────────────────────────────────────────── */

  // LINK_SESSION_NAV_V1 (2026-10-29): these pages accept only a Google sign-in for now, so someone
  // signed in with an emailed link (no Google session, e.g. an events manager on Microsoft 365) is not
  // sent to a sign-in screen they cannot use. The items come back as soon as there is a Google session.
  var GOOGLE_ONLY_NAV = { bookings: 1, beo: 1, menus: 1, campaigns: 1, settings: 1, notifications: 1 };
  function isLinkOnly() { return !_googleToken() && !!linkSession(); }

  function sidebarHtml(activeKey, opts) {
    opts = opts || {};
    var email = signedInEmail(opts.email);
    var admin = isAdminEmail(email);
    var linkOnly = isLinkOnly();
    var items = NAV.map(function (n) {
      // The admin item is always in the markup so EF_ADMIN.showAdminNav()
      // can unhide it after a later sign-in; it renders visible immediately
      // when the caller is already known to be an admin.
      if (linkOnly && GOOGLE_ONLY_NAV[n.key]) return '';
      if (n.demoOnly && !demoActive()) return '';
      var hidden = n.admin && !admin ? ' style="display:none;"' : '';
      var cls = 'nav-item' + (n.admin ? ' admin-nav-link' : '') + (n.key === activeKey ? ' active' : '');
      return '<a href="' + n.href + '" class="' + cls + '"' + hidden + '>' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + n.icon + '</svg>' +
        '<span>' + n.label + '</span></a>';
    }).join('');
    return '' +
      '<aside class="sidebar" id="sidebar">' +
        '<div class="sidebar-brand">' +
          '<span class="brand-logo">EventFlow</span>' +
          '<span class="venue-name" id="venue-name">' + esc(opts.venueName || '') + '</span>' +
        '</div>' +
        '<nav class="sidebar-nav">' + items +
          (linkOnly ? '<div class="nav-note" style="padding:0.75rem 1rem;font-size:0.75rem;line-height:1.4;opacity:0.7;">Bookings, BEO, Menus, Campaigns, Settings and Notifications need a Google sign-in for now.</div>' : '') +
        '</nav>' +
        '<div class="sidebar-footer">' +
          '<span class="user-email" id="user-email-sidebar">' + esc(email) + '</span>' +
          '<button class="logout-btn" onclick="EF_SHELL.signOut()">Sign Out</button>' +
        '</div>' +
      '</aside>' +
      '<div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>';
  }

  function mountSidebar(activeKey, opts) {
    var host = document.getElementById('sidebar-host');
    if (!host) return;
    host.innerHTML = sidebarHtml(activeKey, opts);
  }

  function toggleSidebar() {
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.toggle('open');
    if (ov) ov.classList.toggle('active');
  }
  if (!window.toggleSidebar) window.toggleSidebar = toggleSidebar;

  /* ── Sign-out (both clusters) ────────────────────────────── */

  function signOut() {
    try {
      sessionStorage.removeItem('ef_user_email');
      sessionStorage.removeItem('ef_id_token');
      sessionStorage.removeItem('ef_id_token_exp');
      sessionStorage.removeItem('ef_admin_email');
      sessionStorage.removeItem('ef_auth_kind');
      sessionStorage.removeItem(KA_KEY);
    } catch (e) {}
    try {
      // Magic-link venue sessions (ef_vf_token_<slug>) end on sign-out too.
      var kill = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('ef_vf_token_') === 0) kill.push(k);
      }
      kill.forEach(function (kk) { localStorage.removeItem(kk); });
    } catch (e) {}
    try {
      if (typeof google !== 'undefined' && google.accounts) google.accounts.id.disableAutoSelect();
    } catch (e) {}
    if (typeof window.getSupabase === 'function') {
      // Bookings cluster: end the Supabase session too, then reload.
      window.getSupabase()
        .then(function (s) { return s.auth.signOut(); })
        .catch(function () {})
        .then(function () { window.location.reload(); });
    } else {
      window.location.reload();
    }
  }

  /* ── Clients (registry) ──────────────────────────────────── */

  /* A2_HOME_OVERVIEW_V1 (2026-08-24): client_list is an AUTHENTICATED action now.
   * The server returns only the venues the signed-in caller can access (admins get
   * all), so the old world-readable authorized_emails lists never reach the browser.
   * Because access is already server-filtered, each returned venue is shimmed with
   * authorized_emails = [me] so EF_ADMIN.accessibleVenues / resolveActiveClient keep
   * working unchanged. A load attempted BEFORE sign-in is not memoised: the first
   * call after a token appears re-fetches. */
  var _clientsPromise = null;
  var _clientsAuthed = false;
  function _haveToken() {
    // MAGIC_LINK_SHELL_V1: an emailed sign-in link counts as signed in too.
    return !!_googleToken() || !!linkSession();
  }
  function loadClients() {
    var tok = _haveToken();
    if (_clientsPromise && (_clientsAuthed || !tok)) return _clientsPromise;
    _clientsAuthed = tok;
    _clientsPromise = api({ action: 'client_list' })
      .then(function (data) {
        var me = signedInEmail();
        (data && data.clients || []).forEach(function (c) {
          if (!c || !c.slug) return;
          var authList = me ? [me] : [];
          // CLIENT_MERGE_BY_SLUG_V1 (2026-10-18): merge by slug ONLY. It also matched on the gmail address, so two
          // venues sharing an inbox (Sunda Detroit set up on sales@ as a stand-in, Nashville's legacy gmail_address
          // is sales@ too) collapsed into ONE entry and the venue picker lost a venue. The seed entry has a slug.
          var existing = Object.values(CLIENTS).find(function (cl) {
            return cl.slug === c.slug;
          });
          if (existing) {
            existing.slug = c.slug;
            existing.venue = c.venue || existing.venue;
            existing.authorized_emails = authList;
            return;
          }
          var key = c.slug.replace(/[^a-z0-9]/g, '');
          CLIENTS[key] = {
            slug: c.slug,
            gmail_address: c.gmail || '',
            venue: c.venue || c.slug,
            authorized_emails: authList
          };
        });
        return CLIENTS;
      })
      .catch(function (err) {
        console.warn('EF_SHELL client_list load failed:', err);
        return CLIENTS;
      });
    return _clientsPromise;
  }

  /* ── Google sign-in boot flow (dashboard cluster) ────────── */

  function initGoogleSignIn(onCredential) {
    if (typeof google === 'undefined' || !google.accounts) {
      setTimeout(function () { initGoogleSignIn(onCredential); }, 500);
      return;
    }
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: onCredential,
      auto_select: true
    });
    var btn = document.getElementById('google-signin-btn');
    if (btn) {
      google.accounts.id.renderButton(btn, {
        theme: 'outline', size: 'large', width: 340, text: 'signin_with', shape: 'rectangular'
      });
    }
  }

  /**
   * boot({ onClient }) runs the whole sign-in flow for a GSI page:
   * renders the button, honors a saved session immediately (seed CLIENTS),
   * loads client_list, re-resolves, renders the global venue picker, and
   * unhides the admin nav. onClient(client) fires once per resolved slug.
   */
  function boot(opts) {
    opts = opts || {};
    var firedSlug = '';
    _booted = true;

    // SESSION_EXPIRY_SIGNOUT_V1: a sign-in that has already timed out is signed out before anything loads.
    if (_timedOut()) _clearGoogleSession(_expiryReason());
    var expiredNote = '';
    try {
      expiredNote = sessionStorage.getItem(EXPIRED_FLAG) || '';
      sessionStorage.removeItem(EXPIRED_FLAG);
    } catch (e) {}

    // MAGIC_LINK_SHELL_V1: no Google session but a usable emailed link -> sign in with the link.
    var link = _googleToken() ? null : linkSession();
    if (link) {
      try {
        if (sessionStorage.getItem('ef_auth_kind') === 'link' || !sessionStorage.getItem('ef_user_email')) {
          sessionStorage.setItem('ef_user_email', link.email);
          sessionStorage.setItem('ef_auth_kind', 'link');
        }
      } catch (e) {}
    }
    // Show the sign-in screen even when the page's first-paint check hid it (it saw a session that has since ended).
    function showLoginScreen(message) {
      Array.prototype.forEach.call(document.querySelectorAll('style'), function (s) {
        if (/#login-screen\s*\{\s*display:\s*none/.test(s.textContent || '')) s.remove();
      });
      var ls = document.getElementById('login-screen');
      if (ls) ls.style.display = '';
      var errEl = document.getElementById('login-error');
      if (errEl) {
        errEl.textContent = message;
        errEl.style.display = 'block';
      }
    }
    // The link no longer works (expired, or the address lost access): forget it and show the sign-in screen.
    function linkFailed() {
      try {
        localStorage.removeItem('ef_vf_token_' + link.slug);
        sessionStorage.removeItem('ef_user_email');
        sessionStorage.removeItem('ef_auth_kind');
      } catch (e) {}
      showLoginScreen('Your sign-in link has expired or no longer has access. Ask for a new one below, or sign in with Google.');
    }
    if (expiredNote && !link && !signedInEmail()) {
      showLoginScreen(expiredNote === 'cap'
        ? 'For your security, everyone signs in again every 12 hours. Sign in again to keep going.'
        : expiredNote === 'google'
          ? 'You were signed out because your sign-in timed out. Sign in again to pick up where you left off.'
          : 'You were signed out because the page was not used for about an hour. Sign in again to pick up where you left off.');
    }

    function resolve(email) {
      if (!email) return null;
      if (window.EF_ADMIN && EF_ADMIN.resolveActiveClient) {
        return EF_ADMIN.resolveActiveClient(CLIENTS, email);
      }
      return Object.values(CLIENTS).find(function (c) {
        return (c.gmail_address || '').toLowerCase() === email.toLowerCase();
      }) || null;
    }

    function renderPicker() {
      var email = signedInEmail();
      if (!email || !window.EF_VENUE_PICKER || !window.EF_ADMIN) return;
      EF_VENUE_PICKER.render({
        venues: EF_ADMIN.accessibleVenues(CLIENTS, email).map(function (c) {
          return { slug: c.slug, name: c.venue || c.slug };
        }),
        activeSlug: firedSlug
      });
    }

    function fire(client) {
      if (!client || !client.slug || client.slug === firedSlug) return;
      firedSlug = client.slug;
      if (typeof opts.onClient === 'function') opts.onClient(client);
      renderPicker();
      if (window.EF_ADMIN) EF_ADMIN.showAdminNav();
      pauseBanner(client.slug);
    }

    function handleCredential(response) {
      var idToken, payload, email;
      try {
        idToken = response.credential;
        payload = JSON.parse(atob(idToken.split('.')[1]));
        email = payload.email;
      } catch (e) { return; }
      try {
        sessionStorage.setItem('ef_user_email', email);
        sessionStorage.setItem('ef_id_token', idToken);
        sessionStorage.setItem('ef_id_token_exp', String(payload.exp * 1000));
        sessionStorage.removeItem(KA_KEY);   // a new Google sign-in starts a new pass (and a new 12 hours)
      } catch (e) {}
      _kaStop = false;
      _kaStartTried = true;
      renewPass(true);
      watchExpiry();
      var errEl = document.getElementById('login-error');
      loadClients().then(function () {
        var client = resolve(email);
        if (!client) {
          try {
            sessionStorage.removeItem('ef_user_email');
            sessionStorage.removeItem('ef_id_token');
            sessionStorage.removeItem('ef_id_token_exp');
          } catch (e) {}
          if (errEl) {
            errEl.textContent = 'Access denied. ' + email + ' is not authorized for any venue.';
            errEl.style.display = 'block';
          }
          return;
        }
        if (errEl) errEl.style.display = 'none';
        fire(client);
      });
    }

    initGoogleSignIn(handleCredential);
    watchExpiry();
    // SESSION_KEEPALIVE_V1: a live Google sign-in with no pass yet (signed in before this shipped, or on /admin) gets one.
    if (_googleValid() && !_kaValid()) { _kaStartTried = true; renewPass(true); }

    var saved = signedInEmail();
    // CLIENT_MERGE_BY_SLUG_V1 (2026-10-18): the quick path runs BEFORE client_list arrives, when CLIENTS holds only the
    // seed venue. If the remembered venue (picker key) is not in it yet, resolving now would "repair" the remembered
    // choice back to the seed and the switch to another venue would never stick. Wait for the real list instead.
    var rememberedSlug = (window.EF_VENUE_PICKER && EF_VENUE_PICKER.getActive()) || '';
    var rememberedKnown = !rememberedSlug || Object.values(CLIENTS).some(function (c) { return c.slug === rememberedSlug; });
    if (saved && rememberedKnown) {
      var quick = resolve(saved);
      if (quick) {
        var msg = document.getElementById('session-msg');
        if (msg) msg.style.display = 'block';
        fire(quick);
      }
    }

    loadClients().then(function () {
      var email = signedInEmail();
      if (!email) return;
      var client = resolve(email);
      if (client) fire(client);
      else if (link && !_googleToken()) linkFailed();
      renderPicker();
    });
  }

  /* ── Apps Script helpers ─────────────────────────────────── */

  /* A2 demo mode (?demo=1 → sessionStorage ef_demo): api() short-circuits the home
   * page's read actions to static fixtures in /assets/demo/, so the dashboard can be
   * shown on a prospect call with a fictional venue and NO signed-in session. Only
   * these read actions are served; anything else in demo mode answers with a polite
   * error instead of ever reaching the backend. */
  function demoActive() {
    // Demo mode is a DASHBOARD-PAGE feature. The flag lives in sessionStorage, so
    // without the path guard a ?demo=1 visit would break every other shell page's
    // api() calls for the rest of the browser session (caught live 2026-08-24 on
    // /admin: "Not available while viewing sample data" with no banner in sight).
    try {
      if (sessionStorage.getItem('ef_demo') !== '1') return false;
    } catch (e) { return false; }
    // GROUP_VIEW_DEMO_V1: the sample group view (/locations) is a sample-only page too.
    return /^\/(dashboard|locations)(\.html)?\/?$/.test(window.location.pathname);
  }
  var DEMO_FILES = {
    get_home_overview: '/assets/demo/home_overview.json',
    get_conversations: '/assets/demo/conversations.json',
    get_conversation: '/assets/demo/conversations.json',
    ask_eventflow: '/assets/demo/ask.json',  // ASK_EVENTFLOW_V1: canned answers keyed by question
    get_group_overview: '/assets/demo/group_overview.json'   // GROUP_VIEW_DEMO_V1: the sample group view
  };
  function api(payload) {
    payload = payload || {};
    if (demoActive() && payload.action && DEMO_FILES[payload.action]) {
      return fetch(DEMO_FILES[payload.action])
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (payload.action === 'get_conversation') {
            var turns = (d.threads || {})[payload.thread_id] || [];
            return { success: true, thread_id: payload.thread_id, turns: turns };
          }
          if (payload.action === 'ask_eventflow') {
            // Static fixtures cannot answer free text: the three example chips are pre-answered,
            // anything else gets the fallback that says so.
            var a = (d.answers || {})[String(payload.question || '').trim()] || d.fallback || {};
            return Object.assign({ success: true, ok: true }, a, { question: payload.question });
          }
          return d;
        });
    }
    if (demoActive()) {
      return Promise.resolve({ error: 'Not available while viewing sample data.' });
    }
    // SESSION_KEEPALIVE_V1: the page's own pass first while it works, then the Google sign-in.
    var ka = _kaValid() ? _kaPass() : null;
    if (!payload.id_token && !payload.session_token) {
      if (ka) payload.session_token = ka.token;
      else {
        try {
          var t = sessionStorage.getItem('ef_id_token');
          if (t) payload.id_token = t;
        } catch (e) {}
      }
    }
    // MAGIC_LINK_SHELL_V1: no Google token -> the emailed sign-in link (for this venue when there is one).
    if (!payload.id_token && !payload.session_token) {
      var ls = linkSession(payload.client_slug);
      if (ls) payload.session_token = ls.token;
    }
    // SESSION_EXPIRY_SIGNOUT_V1: on a boot() page, a timed-out sign-in signs the person out rather than
    // sending a call Apps Script will refuse, and so does a refusal. The answer never arrives (the page is
    // reloading), so no error flashes on the way out.
    var sentGoogle = _booted && ((!!payload.id_token && payload.id_token === _googleToken()) ||
      (!!ka && payload.session_token === ka.token));
    if (sentGoogle && _timedOut()) {
      sessionExpired();
      return new Promise(function () {});
    }
    return fetch(CONFIG.DATA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        if (sentGoogle && d && typeof d.error === 'string' && /^Unauthorized\b/.test(d.error)) {
          sessionExpired();
          return new Promise(function () {});
        }
        return d;
      });
  }

  function getJson(type, slug) {
    var url = CONFIG.DATA_URL + '?type=' + encodeURIComponent(type) +
      (slug ? '&client=' + encodeURIComponent(slug) : '');
    return fetch(url).then(function (r) { return r.json(); });
  }

  /* ── UI states + toasts ──────────────────────────────────── */

  function setState(el, state, o) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return;
    o = o || {};
    if (state === 'loading') {
      el.innerHTML = '<div class="ef-state"><div class="ef-skel"></div><div class="ef-skel"></div><div class="ef-skel short"></div></div>';
    } else if (state === 'empty') {
      el.innerHTML = '<div class="ef-state ef-empty">' + esc(o.message || 'Nothing here yet.') + '</div>';
    } else if (state === 'error') {
      el.innerHTML = '<div class="ef-state ef-error"><span>' + esc(o.message || 'Could not load this panel.') + '</span>' +
        (o.retry ? '<button type="button" class="btn sm">Retry</button>' : '') + '</div>';
      if (o.retry) {
        var b = el.querySelector('button');
        if (b) b.onclick = o.retry;
      }
    }
  }

  function toast(message, kind) {
    var wrap = document.getElementById('ef-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'ef-toast-wrap';
      document.body.appendChild(wrap);
    }
    var t = document.createElement('div');
    t.className = 'ef-toast' + (kind ? ' ' + kind : '');
    t.textContent = message;
    wrap.appendChild(t);
    setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 300);
    }, 3800);
  }

  /* GUEST_STOPS_V1 (2026-10-16): a red banner on every shell page while the venue's guest emails are paused (the
     emergency pause on the Events page). One light call per page, cached 2 minutes; nothing at all unless the venue's
     stop buttons are visible to this person. The Events page draws its own bar, so it is skipped there. */
  function pauseBanner(slug) {
    try {
      if (!slug || demoActive() || /\/events(\.html)?$/.test(location.pathname)) return;
      var key = 'ef_gs_state_' + slug, cached = null;
      try { cached = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { cached = null; }
      var draw = function (st) {
        if (!st || st.visible !== true || !st.paused) return;
        var host = document.querySelector('.dash-body') || document.querySelector('.main-content');
        if (!host || document.getElementById('ef-pause-banner')) return;
        var d = document.createElement('div');
        d.id = 'ef-pause-banner';
        d.setAttribute('role', 'alert');
        d.style.cssText = 'margin:0 0 14px;padding:10px 12px;border-radius:8px;background:#fee2e2;border:1px solid #fca5a5;color:#7f1d1d;font-size:0.9rem;line-height:1.45;';
        d.innerHTML = '<b>All guest emails are paused</b> (by ' + esc(st.paused.by) + ': ' + esc(st.paused.reason) + '). ' +
          'Guest emails that arrive go to the events manager. <a href="/events?client=' + encodeURIComponent(slug) + '" style="color:#7f1d1d;font-weight:600;">Open the Events page</a>';
        host.insertBefore(d, host.firstChild);
      };
      if (cached && cached.st && Date.now() - cached.t < 120000) { draw(cached.st); return; }
      api({ action: 'guest_stops_state', client_slug: slug }).then(function (st) {
        try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), st: st })); } catch (e) {}
        draw(st);
      }).catch(function () { /* no banner on a failed read */ });
    } catch (e) { /* never break a page over the banner */ }
  }

  return {
    CONFIG: CONFIG,
    CLIENTS: CLIENTS,
    NAV: NAV,
    esc: esc,
    loadClients: loadClients,
    initGoogleSignIn: initGoogleSignIn,
    boot: boot,
    sidebarHtml: sidebarHtml,
    mountSidebar: mountSidebar,
    toggleSidebar: toggleSidebar,
    signOut: signOut,
    api: api,
    linkSession: linkSession,
    isLinkOnly: isLinkOnly,
    requestLink: requestLink,
    getJson: getJson,
    demoActive: demoActive,
    setState: setState,
    toast: toast
  };
})();
