/**
 * EventFlow global venue picker (GLOBAL_VENUE_PICKER_V1, 2026-07-25).
 *
 * ONE venue selector, rendered into the sidebar brand block (top-left, under
 * the EventFlow logo) on every sidebar page in BOTH clusters. The chosen slug
 * persists in localStorage 'ef_active_venue' (the key the bookings cluster
 * already used), so the selection follows the user across tabs.
 *
 * Callers pass their own ALREADY access-filtered venue list — this file has
 * no auth logic and no dependencies:
 *
 *   EF_VENUE_PICKER.render({
 *     venues:     [{ slug, name }],      // required
 *     activeSlug: 'sunda-nashville',     // what this page is displaying
 *     onChange:   function (slug) {}     // optional; default = full reload
 *   });
 *
 * Behavior: hides (never removes) span#venue-name so pages can keep writing
 * its textContent harmlessly; appends a <select> as the brand block's last
 * child; idempotent; always renders even with a single venue so the chrome
 * matches on every tab. onchange persists FIRST, then navigates/reloads.
 * Pages that never call render() (e.g. magic-link /venue sessions) keep the
 * plain venue label.
 */
window.EF_VENUE_PICKER = (function () {
  var KEY = 'ef_active_venue';

  function getActive() {
    try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
  }

  function setActive(slug) {
    try { localStorage.setItem(KEY, slug); } catch (e) { /* private mode etc. */ }
  }

  function render(opts) {
    opts = opts || {};
    var venues = (opts.venues || []).filter(function (v) { return v && v.slug; });
    var brand = opts.brandEl || document.querySelector('.sidebar-brand');
    if (!brand || !venues.length) return;

    var label = brand.querySelector('#venue-name');
    if (label) label.style.display = 'none';

    var sel = brand.querySelector('#ef-global-venue-picker');
    if (!sel) {
      sel = document.createElement('select');
      sel.id = 'ef-global-venue-picker';
      sel.className = 'brand-venue-select';
      sel.title = 'Switch venue (applies to every tab)';
      brand.appendChild(sel);
    }

    sel.innerHTML = '';
    venues.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v.slug;
      opt.textContent = v.name || v.slug;
      sel.appendChild(opt);
    });
    var active = venues.some(function (v) { return v.slug === opts.activeSlug; })
      ? opts.activeSlug : venues[0].slug;
    sel.value = active;

    sel.onchange = function () {
      setActive(sel.value);
      if (typeof opts.onChange === 'function') opts.onChange(sel.value);
      else window.location.reload();
    };
  }

  return { KEY: KEY, getActive: getActive, setActive: setActive, render: render };
})();
