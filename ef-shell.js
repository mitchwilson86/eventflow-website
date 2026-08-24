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
    { key: 'dashboard',    href: '/dashboard',    label: 'Dashboard',    icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>' },
    { key: 'bookings',     href: '/bookings',     label: 'Bookings',     icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
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

  function signedInEmail(fallback) {
    var e = '';
    try { e = sessionStorage.getItem('ef_user_email') || ''; } catch (err) {}
    return (e || fallback || '').toLowerCase();
  }

  function isAdminEmail(email) {
    return !!(window.EF_ADMIN && EF_ADMIN.isAdmin(email));
  }

  /* ── Sidebar ─────────────────────────────────────────────── */

  function sidebarHtml(activeKey, opts) {
    opts = opts || {};
    var email = signedInEmail(opts.email);
    var admin = isAdminEmail(email);
    var items = NAV.map(function (n) {
      // The admin item is always in the markup so EF_ADMIN.showAdminNav()
      // can unhide it after a later sign-in; it renders visible immediately
      // when the caller is already known to be an admin.
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
        '<nav class="sidebar-nav">' + items + '</nav>' +
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

  var _clientsPromise = null;
  function loadClients() {
    if (_clientsPromise) return _clientsPromise;
    _clientsPromise = fetch(CONFIG.DATA_URL + '?type=client_list')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        (data.clients || []).forEach(function (c) {
          if (!c || !c.slug) return;
          var authList = [];
          try { authList = JSON.parse(c.authorized_emails || '[]') || []; } catch (e) { authList = []; }
          var existing = Object.values(CLIENTS).find(function (cl) {
            return cl.slug === c.slug || (c.gmail && cl.gmail_address === c.gmail);
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
      } catch (e) {}
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

    var saved = signedInEmail();
    if (saved) {
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
      renderPicker();
    });
  }

  /* ── Apps Script helpers ─────────────────────────────────── */

  function api(payload) {
    payload = payload || {};
    if (!payload.id_token && !payload.session_token) {
      try {
        var t = sessionStorage.getItem('ef_id_token');
        if (t) payload.id_token = t;
      } catch (e) {}
    }
    return fetch(CONFIG.DATA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
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
    getJson: getJson,
    setState: setState,
    toast: toast
  };
})();
