/* ═══════════════════════════════════════════════════════════════
   EventFlow Bookings — shared client (Supabase + auth helpers)
   ═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://uzojlcwsrbsqckycjlgm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__PO3lrDOGl_AaG4TaznEJA_P4Y5ouPU';

/* Status → color map (must stay in sync with bookings.css badges) */
const STATUS_COLORS = {
  lead:       { bg: '#94A3B8', fg: '#ffffff', label: 'Lead' },
  tentative:  { bg: '#EAB308', fg: '#1E293B', label: 'Tentative' },
  definite:   { bg: '#22C55E', fg: '#ffffff', label: 'Definite' },
  completed:  { bg: '#15616D', fg: '#ffffff', label: 'Completed' },
  cancelled:  { bg: '#EF4444', fg: '#ffffff', label: 'Cancelled' }
};

const BEO_CATEGORIES = [
  { value: 'food',      label: 'Food' },
  { value: 'beverage',  label: 'Beverage' },
  { value: 'av',        label: 'A/V' },
  { value: 'staffing',  label: 'Staffing' },
  { value: 'rental',    label: 'Rental' },
  { value: 'fee',       label: 'Fee' },
  { value: 'other',     label: 'Other' }
];

/* ── Supabase client (loaded via CDN ESM in each page) ─────── */
let sb = null;
async function getSupabase() {
  if (sb) return sb;
  const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return sb;
}

/* ── Auth ───────────────────────────────────────────────────── */
async function currentUser() {
  const s = await getSupabase();
  const { data } = await s.auth.getUser();
  return data.user || null;
}

async function signInWithGoogle() {
  const s = await getSupabase();
  await s.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
}

async function signOut() {
  const s = await getSupabase();
  await s.auth.signOut();
  window.location.reload();
}

/* Loads the venues this user is allowed to see.
   Returns { venues: [...], activeVenue: {...} }.
   Active venue is chosen from ?venue=slug, else localStorage, else first. */
async function loadUserVenues() {
  const s = await getSupabase();
  const { data, error } = await s
    .from('venues')
    .select('id, slug, name, timezone, contact_email, default_tax_rate, default_service_charge, default_deposit_pct, cancellation_policy')
    .order('name');
  if (error) throw error;
  if (!data || !data.length) return { venues: [], activeVenue: null };

  const params = new URLSearchParams(window.location.search);
  const wanted = params.get('venue') || localStorage.getItem('ef_active_venue') || data[0].slug;
  const active = data.find(v => v.slug === wanted) || data[0];
  localStorage.setItem('ef_active_venue', active.slug);
  return { venues: data, activeVenue: active };
}

/* ── Common UI helpers ─────────────────────────────────────── */
function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function fmtMoney(n) {
  if (n == null || isNaN(n)) return '$0.00';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateShort(d) {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? 'pm' : 'am';
  const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return `${h12}:${m}${ampm}`;
}
function statusBadge(status) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.lead;
  return `<span class="status-badge" style="background:${c.bg};color:${c.fg}">${c.label}</span>`;
}

/* Compute booking totals from BEO items + rates. Pure — no side effects. */
function computeTotals({ items, taxRate, serviceChargeRate, depositPct }) {
  let subtotal = 0, taxableBase = 0, serviceBase = 0;
  for (const it of items || []) {
    const line = Number(it.quantity || 0) * Number(it.unit_price || 0);
    subtotal += line;
    if (it.taxable) taxableBase += line;
    if (it.service_chargeable) serviceBase += line;
  }
  const tax = +(taxableBase * Number(taxRate || 0)).toFixed(2);
  const service = +(serviceBase * Number(serviceChargeRate || 0)).toFixed(2);
  const total = +(subtotal + tax + service).toFixed(2);
  const deposit = +(total * Number(depositPct || 0)).toFixed(2);
  return { subtotal: +subtotal.toFixed(2), tax, service, total, deposit };
}

/* Sidebar nav — identical structure to dashboard for visual continuity */
function renderSidebar(activeKey, venueName, userEmail) {
  const nav = [
    { key: 'dashboard',    href: '/dashboard',    label: 'Dashboard',    icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>' },
    { key: 'bookings',     href: '/bookings',     label: 'Bookings',     icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
    { key: 'campaigns',    href: '/campaigns',    label: 'Campaigns',    icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
    { key: 'settings',     href: '/settings',     label: 'Settings',     icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
    { key: 'notifications',href: '/notifications',label: 'Notifications',icon: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' }
  ];
  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <span class="brand-logo">EventFlow</span>
        <span class="venue-name" id="venue-name">${esc(venueName || '')}</span>
      </div>
      <nav class="sidebar-nav">
        ${nav.map(n => `
          <a href="${n.href}" class="nav-item${n.key === activeKey ? ' active' : ''}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${n.icon}</svg>
            <span>${n.label}</span>
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <span class="user-email" id="user-email-sidebar">${esc(userEmail || '')}</span>
        <button class="logout-btn" onclick="signOut()">Sign Out</button>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>
  `;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('active');
}

/* Make helpers global so HTML onclick handlers and inline scripts can use them */
window.getSupabase = getSupabase;
window.currentUser = currentUser;
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.loadUserVenues = loadUserVenues;
window.esc = esc;
window.fmtMoney = fmtMoney;
window.fmtDate = fmtDate;
window.fmtDateShort = fmtDateShort;
window.fmtTime = fmtTime;
window.statusBadge = statusBadge;
window.computeTotals = computeTotals;
window.renderSidebar = renderSidebar;
window.toggleSidebar = toggleSidebar;
window.STATUS_COLORS = STATUS_COLORS;
window.BEO_CATEGORIES = BEO_CATEGORIES;
