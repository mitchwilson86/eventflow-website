/**
 * EventFlow admin helpers — shared across the dashboard-cluster pages.
 *
 * Venue selection is GLOBAL since 2026-07-25: the sidebar picker lives in
 * ef-venue-picker.js (localStorage 'ef_active_venue'), and pages resolve
 * their venue with EF_ADMIN.resolveActiveClient(CLIENTS, email) so the
 * stored choice wins whenever it is accessible. showAdminNav() unhides the
 * Admin Dashboard nav link for ADMIN_EMAILS users.
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
   * Venues the signed-in email can access: all of them for admins, otherwise
   * every venue where the email is the owner (gmail_address) or on the
   * authorized_emails list.
   */
  function accessibleVenues(clients, email) {
    email = normalize(email);
    var all = Object.values(clients || {}).filter(function (c) { return c.slug; });
    if (isAdmin(email)) return all;
    return all.filter(function (c) {
      if (normalize(c.gmail_address) === email) return true;
      return (c.authorized_emails || []).some(function (e) { return normalize(e) === email; });
    });
  }

  /**
   * Resolve the venue a page should display: the globally selected slug
   * (localStorage 'ef_active_venue' via EF_VENUE_PICKER) when the signed-in
   * email can access it, else the classic resolveClient() fallback — and in
   * that case the stored key is repaired so every tab agrees again.
   */
  function resolveActiveClient(clients, email) {
    var venues = accessibleVenues(clients, email);
    var stored = (window.EF_VENUE_PICKER && window.EF_VENUE_PICKER.getActive()) || '';
    var hit = venues.find(function (c) { return c.slug === stored; });
    if (hit) return hit;
    var fb = resolveClient(clients, email);
    if (fb && fb.slug && window.EF_VENUE_PICKER) window.EF_VENUE_PICKER.setActive(fb.slug);
    return fb;
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
    resolveActiveClient: resolveActiveClient,
    accessibleVenues: accessibleVenues,
    showAdminNav: showAdminNav
  };
})();
