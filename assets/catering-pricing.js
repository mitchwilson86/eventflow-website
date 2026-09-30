/* catering-pricing.js -- CATERING_ORDERS_V1 (2026-09-30). The ONE definition of a catering estimate, used by
   /catering (browser) and transcribed into ops-api (TypeScript); patches/sunda/verify_catering_pricing_parity.js runs
   both on the same fixtures so they cannot drift. Venue-neutral: everything comes from the venue's catering_json.

   compute(menu, order) -> { ok, errors[], lines[], food, packing, delivery, tax, tip, total }
     order = { items: [{ id, size, qty }], fulfillment: 'delivery' | 'pickup',
               tip: { mode: 'none' | 'pct' | 'custom', pct, amount } }
   Money is rounded to cents at every step. Food = sum of qty x price; packing = packing_pct x food;
   delivery = delivery_fee (delivery only); tax = tax_rate x (food + packing + delivery); tip = pct x food (tip_base
   'food') or a custom amount; total = food + packing + delivery + tax + tip. */
(function (root) {
  function cents(x) { return Math.round((Number(x) || 0) * 100 + 1e-9) / 100; }
  function index(menu) {
    var map = {};
    ((menu && menu.sections) || []).forEach(function (s) {
      (s.items || []).forEach(function (it) {
        (it.sizes || []).forEach(function (z) { map[it.id + '|' + z.id] = { item: it, size: z, section: s }; });
      });
    });
    return map;
  }
  function compute(menu, order) {
    var r = (menu && menu.rules) || {};
    var o = order || {};
    var errors = [];
    var idx = index(menu);
    var maxQty = Number(r.max_qty_per_line) || 50;
    var merged = {};
    (Array.isArray(o.items) ? o.items : []).forEach(function (x) {
      if (!x) return;
      var key = String(x.id || '') + '|' + String(x.size || '');
      var q = Number(x.qty);
      if (!idx[key]) { errors.push('unknown item: ' + key); return; }
      if (!(q === Math.floor(q)) || q < 0) { errors.push('bad quantity: ' + key); return; }
      if (q === 0) return;
      merged[key] = (merged[key] || 0) + q;
    });
    var lines = [];
    var food = 0;
    Object.keys(merged).sort().forEach(function (key) {
      var q = merged[key];
      if (q > maxQty) { errors.push('quantity over ' + maxQty + ': ' + key); return; }
      var e = idx[key];
      var price = Number(e.size.price) || 0;
      var line = cents(q * price);
      food = cents(food + line);
      lines.push({ id: e.item.id, name: e.item.name, size: e.size.id, size_label: e.size.label, count: e.size.count || '', qty: q, unit_price: price, line_total: line });
    });
    if (!lines.length && !errors.length) errors.push('no items');
    var fulfillment = o.fulfillment === 'pickup' && r.pickup !== false ? 'pickup' : 'delivery';
    var packing = cents(food * (Number(r.packing_pct) || 0));
    var delivery = fulfillment === 'delivery' ? cents(Number(r.delivery_fee) || 0) : 0;
    var tax = cents((food + packing + delivery) * (Number(r.tax_rate) || 0));
    var t = o.tip || {};
    var tip = 0, tipMode = 'none', tipPct = 0;
    if (t.mode === 'pct') {
      tipPct = Number(t.pct) || 0;
      if (tipPct < 0 || tipPct > 100) { errors.push('bad tip percent'); tipPct = 0; }
      tip = cents(food * tipPct / 100); tipMode = tipPct ? 'pct' : 'none';
    } else if (t.mode === 'custom') {
      tip = cents(t.amount);
      if (!(tip >= 0) || tip > 100000) { errors.push('bad tip amount'); tip = 0; }
      tipMode = tip ? 'custom' : 'none';
    }
    var total = cents(food + packing + delivery + tax + tip);
    return { ok: errors.length === 0, errors: errors, lines: lines, fulfillment: fulfillment, food: food, packing: packing, delivery: delivery, tax: tax, tip: tip, tip_mode: tipMode, tip_pct: tipPct, total: total };
  }
  var api = { compute: compute, cents: cents };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EFCateringPricing = api;
})(typeof window !== 'undefined' ? window : this);
