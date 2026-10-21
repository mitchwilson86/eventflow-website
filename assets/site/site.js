// EventFlow marketing pages: the phone menu and the motion layer (the home page has its own, in
// assets/home/home.js).
//
// Motion only adds arrival. Every page is complete without it: with no script, a failed CDN or reduced
// motion, each section shows its finished state. Hidden starting states are set lazily, just before a
// section scrolls into view, so nothing far down a page is ever hidden waiting for a scroll.
//
// Needs, loaded before this file: gsap, ScrollTrigger, SplitText (gsap@3.15.0). The menu works without them.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ----- phone menu -----
  const toggle = $('#menuToggle');
  const sheet = $('#menuSheet');
  if (toggle && sheet) {
    const close = () => { sheet.setAttribute('hidden', ''); toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = 'Menu'; };
    toggle.addEventListener('click', () => {
      const open = sheet.hasAttribute('hidden');
      if (open) sheet.removeAttribute('hidden'); else sheet.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
    });
    sheet.addEventListener('click', (e) => { if (e.target.tagName === 'A') close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hasAttribute('hidden')) { close(); toggle.focus(); } });
  }

  if (!window.gsap || !window.ScrollTrigger) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);

  // ---------- helpers (the same recipe as the home page) ----------
  // prepare() sets a section's hidden starting state only when it comes within 40% of a screen, and its
  // entrance plays when it is 86% of the way up; a jump straight to a section plays it at once.
  let splits = [];
  const reveal = (trigger, build, start = 'top 86%') => {
    if (!trigger) return;
    let tl = null, played = false, playST = null, undo = null;
    const play = () => { if (!tl || played) return; played = true; tl.play(); };
    const prepare = () => {
      if (tl || played) return;
      splits = [];
      tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out', duration: 0.9 } });
      build(tl);
      const mine = splits;
      const giveBack = () => mine.forEach((s) => s.revert());
      tl.eventCallback('onComplete', giveBack);
      undo = () => { tl.revert(); giveBack(); tl = null; };
      playST = ScrollTrigger.create({ trigger, start, once: true, onEnter: play });
      if (window.scrollY >= playST.start) play();
    };
    ScrollTrigger.create({
      trigger, start: 'top bottom+=40%',
      onEnter: prepare,
      // scrolled away above it: an entrance not yet played is undone, one still playing is finished
      onLeaveBack: () => {
        if (tl && !played) { if (playST) playST.kill(); undo(); }
        else if (tl && played && tl.progress() < 1) tl.progress(1);
      },
    });
  };
  const lines = (el) => {
    if (!el) return [];
    if (!window.SplitText) return [el];
    const s = SplitText.create(el, { type: 'lines', mask: 'lines', aria: 'auto' });
    splits.push(s);
    return s.lines;
  };
  const rise = (tl, targets, at = 0, extra = {}) => tl.from(targets, Object.assign({ yPercent: 110, stagger: 0.09 }, extra), at);

  document.fonts.ready.then(() => {
    const mm = gsap.matchMedia();
    mm.add({ wide: '(min-width: 861px)' }, (ctx) => {
      const wide = ctx.conditions.wide;

      // ----- the page head: as it scrolls away the title drifts up and the picture eases the other way -----
      const head = $('.phead');
      if (head && wide) {
        const out = gsap.timeline({ scrollTrigger: { trigger: head, start: 'top top', end: 'bottom top', scrub: true } });
        out.to('.phead-title h1', { yPercent: -12, ease: 'none' }, 0);
        if ($('.phead-pic img')) out.fromTo('.phead-pic img', { yPercent: -4, scale: 1.08 }, { yPercent: 4, scale: 1.08, ease: 'none' }, 0);
      }

      // ----- bands: the heading rises line by line, the words follow it in -----
      $$('.band').forEach((band) => reveal(band, (tl) => {
        const h = $(':scope > h2, :scope > h3', band);
        if (h) rise(tl, lines(h), 0, { stagger: 0.07, duration: 0.9 });
        tl.from($$(':scope > .prose > *, :scope > h3 + p', band), { y: 18, autoAlpha: 0, stagger: 0.05, duration: 0.8 }, 0.12);
      }, 'top 88%'));

      // ----- section headings on their own coloured band -----
      $$('.qhead').forEach((q) => reveal(q, (tl) => rise(tl, lines($('h2', q)), 0, { stagger: 0.08, duration: 1 })));

      // ----- boards: the tiles deal on from the bottom, their words arrive after -----
      $$('.board, .plans, .addon').forEach((board) => reveal(board, (tl) => {
        const tiles = $$(':scope > .tile', board);
        tl.fromTo(tiles, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, stagger: 0.07, ease: 'power3.inOut' }, 0);
        const pics = $$(':scope > .photo img', board);
        if (pics.length) tl.fromTo(pics, { scale: 1.2 }, { scale: 1, duration: 1.6, ease: 'power2.out' }, 0.25);
        tl.from($$(':scope > .tile:not(.photo) > *', board), { y: 18, autoAlpha: 0, stagger: 0.03, duration: 0.7 }, 0.4);
      }, 'top 82%'));

      // ----- the close: the action tile opens from its centre, its neighbours slide in -----
      const cta = $('.cta');
      reveal(cta, (tl) => {
        tl.fromTo('.cta-c', { clipPath: 'inset(45% 45% 45% 45%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut' }, 0)
          .from('.cta-l', { xPercent: -100, duration: 1.1, ease: 'power3.out' }, 0.15)
          .from('.cta-r', { xPercent: 100, duration: 1.1, ease: 'power3.out' }, 0.15);
        rise(tl, lines($('.cta-c h2')), 0.55);
        tl.from($$('.cta-c > p, .cta-c > .btn'), { y: 18, autoAlpha: 0, stagger: 0.08, duration: 0.7 }, 0.8);
      }, 'top 78%');

      // ----- footer: the wordmark is a sales chart; its bars grow left to right as you arrive -----
      const blocks = $('.blocks');
      if (blocks) {
        let build = null;
        ScrollTrigger.create({
          trigger: blocks, start: 'top bottom+=40%',
          onEnter: () => {
            if (build) return;
            build = gsap.fromTo($$('.blocks span'), { clipPath: 'inset(100% 0% 0% 0%)' }, {
              clipPath: 'inset(0% 0% 0% 0%)', stagger: 0.08, ease: 'none',
              scrollTrigger: { trigger: blocks, start: 'top 98%', end: 'bottom 70%', scrub: 0.6 },
            });
          },
          onLeaveBack: () => { if (build) { build.scrollTrigger.kill(); build.revert(); build = null; } },
        });
      }
      return () => {};
    });
  });
})();
