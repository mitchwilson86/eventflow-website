/**
 * EventFlow admin helpers — shared across dashboard/campaigns/bookings/settings.
 *
 * When signed in as an ADMIN_EMAILS user, pages get:
 *   1. A venue picker (dropdown) at the top of the main content
 *   2. An "Admin Dashboard" nav link in the sidebar
 *
 * Usage in each page (inline script, AFTER CLIENTS is defined):
 *   EF_ADMIN.setupVenuePicker(CLIENTS, function(slug){
 *     // Your page's re-render function given the new slug
 *     currentClient = Object.values(CLIENTS).find(c => c.slug === slug);
 *     renderDashboard(currentClient);
 *   });
 *   EF_ADMIN.showAdminNav();
 *
 * The page's own resolveClient-for-email should use EF_ADMIN.resolveClient()
 * so admin users fall back to the first venue instead of "access denied".
 */
window.EF_ADMIN = (function () {
  var ADMIN_EMAILS = ['mitchwilson@eventflowsales.com'];

  function normalize(e) { return (e || '').toString().trim().toLowerCase(); }

  function isAdmin(email) {
    return ADMIN_EMAILS.indexOf(normalize(email)) !== -1;
  }

  function isAdminCaller() {
    return isAdmin(sessionStorage.getItem('ef_user_email'));
  }

  /**
   * Resolve which venue a signed-in email should land on.
   *   1. gmail_address match (the venue owner)
   *   2. authorized_emails list match (a teammate)
   *   3. admin — default to first venue
   *   4. null — not authorized
   */
  function resolveClient(clients, email) {
    email = normalize(email);
    var all = Object.values(clients || {});
    var byGmail = all.find(function (c) { return normalize(c.gmail_address) === email; });
    if (byGmail) return byGmail;
    var byAuth = all.find(function (c) {
      return (c.authorized_emails || []).some(function (e) { return normalize(e) === email; });
    });
    if (byAuth) return byAuth;
    if (isAdmin(email)) return all[0] || null;
    return null;
  }

  /**
   * Create (if needed) and populate a venue picker at the top of .dash-body.
   * Only renders for admin users. Calls onChange(slug) when the user picks.
   */
  function setupVenuePicker(clients, onChange) {
    if (!isAdminCaller()) return;
    var host = document.querySelector('.dash-body');
    if (!host) return;

    var row = document.getElementById('ef-venue-picker-row');
    if (!row) {
      row = document.createElement('div');
      row.id = 'ef-venue-picker-row';
      row.className = 'venue-picker-row';
      row.innerHTML =
        '<span class="admin-badge">Admin</span>' +
        '<label for="ef-venue-picker">Viewing venue:</label>' +
        '<select id="ef-venue-picker"></select>';
      host.insertBefore(row, host.firstChild);
    }

    var sel = document.getElementById('ef-venue-picker');
    var venues = Object.values(clients || {}).filter(function (c) { return c.slug; });
    if (!venues.length) { row.style.display = 'none'; return; }
    row.style.display = 'flex';

    var currentSlug = sel.value;
    sel.innerHTML = '';
    venues.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.slug;
      opt.textContent = c.venue + ' (' + c.slug + ')';
      if (c.slug === currentSlug) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = function () { onChange(sel.value); };
  }

  /**
   * Unhide the "Admin Dashboard" sidebar nav link for admin users.
   * The link is expected to exist in the DOM with class "admin-nav-link"
   * and style display:none by default.
   */
  function showAdminNav() {
    if (!isAdminCaller()) return;
    document.querySelectorAll('.admin-nav-link').forEach(function (el) {
      el.style.display = '';
    });
  }

  return {
    ADMIN_EMAILS: ADMIN_EMAILS,
    isAdmin: isAdmin,
    isAdminCaller: isAdminCaller,
    resolveClient: resolveClient,
    setupVenuePicker: setupVenuePicker,
    showAdminNav: showAdminNav
  };
})();
