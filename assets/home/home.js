// EventFlow home: the motion layer (tasteskill, step 9).
//
// Everything here only adds arrival. The page is complete without it: with no script, a failed CDN or
// reduced motion every section shows its finished state. Hidden starting states are set lazily, just
// before a section scrolls into view, so nothing far down the page is ever hidden waiting for a scroll.
//
// Needs, loaded before this file: gsap, ScrollTrigger, SplitText (gsap@3.15.0) and assets/home/stage.js.
(() => {
  if (!window.gsap || !window.ScrollTrigger || !window.Stage) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

  // ---------- Scene: one inquiry, start to signed ----------
  // Four fields, one card. Each new stage slides up over the last like a sheet, so the card looks like
  // it changes state in place: held, then the menu ticked off, then the figure that books it.
  Scenes.journey = (root, opts = {}) => {
    const big = $('.card-big', root);
    return Stage.scene(root, {
      hold: opts.hold ?? 3,
      scrub: 0.6,
      beats: 4,
      rest: () => { if (big) big.textContent = '$2,040'; },
      build(tl, { q }) {
        const [, f2, f3, f4] = q('.field');
        const wipe = (f, at) => tl.fromTo(f, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.16, ease: 'power2.inOut' }, at);
        const clause = (f, at) => tl.from($('.clause', f), { y: 36, autoAlpha: 0, duration: 0.08, ease: 'power2.out' }, at);

        const [f1] = q('.field');
        const leave = (f, at) => tl.to($('.clause', f), { y: -24, autoAlpha: 0, duration: 0.05, ease: 'power1.in' }, at);
        leave(f1, 0.1); wipe(f2, 0.15); clause(f2, 0.27);
        tl.from($$('.card-rows > div:nth-child(n+3)', f2), { autoAlpha: 0, x: -14, stagger: 0.025, duration: 0.05 }, 0.3);
        tl.from($('.card-foot .tag', f2), { scale: 0.8, autoAlpha: 0, duration: 0.05 }, 0.36);

        leave(f2, 0.37); wipe(f3, 0.42); clause(f3, 0.54);
        $$('.box--on', f3).forEach((b, i) => tl.from(b, { backgroundColor: '#ffffff', borderColor: '#9a9391', scale: 0.8, duration: 0.04 }, 0.57 + i * 0.04));

        leave(f3, 0.63); wipe(f4, 0.68); clause(f4, 0.8);
        if (big) {
          const v = { n: 0 };
          tl.fromTo(v, { n: 0 }, { n: 2040, duration: 0.13, ease: 'power1.out', onUpdate: () => { big.textContent = money(v.n); } }, 0.8);
        }
        tl.from($$('.card-rows > div:nth-child(n+2)', f4), { autoAlpha: 0, y: 8, stagger: 0.02, duration: 0.05 }, 0.9);
      },
    });
  };

  Stage.init();
  if (reduced) return;

  // ---------- helpers ----------
  // prepare() sets a section's hidden starting state only when it comes within half a screen, and its
  // entrance plays when it is 86% of the way up; a jump straight to a section plays it at once.
  let splits = [], undos = [];
  const reveal = (trigger, build, start = 'top 86%') => {
    if (!trigger) return;
    let tl = null, played = false, playST = null, undo = null;
    const play = () => { if (!tl || played) return; played = true; tl.play(); };
    const prepare = () => {
      if (tl || played) return;
      splits = []; undos = [];
      tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out', duration: 0.9 } });
      build(tl);
      const mine = splits, theirs = undos;
      const giveBack = () => { mine.forEach((s) => s.revert()); theirs.forEach((f) => f()); };
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
  // a figure that counts up, and is set back to its own text afterwards (or if the entrance is undone)
  const countUp = (tl, el, target, format, at, duration = 1.4) => {
    if (!el) return;
    const text = el.textContent;
    const v = { n: 0 };
    tl.fromTo(v, { n: 0 }, { n: target, duration, ease: 'power2.out', onUpdate: () => { el.textContent = format(v.n); } }, at);
    undos.push(() => { el.textContent = text; });
  };
  const splitBy = (el, type) => {
    if (!el) return [];
    if (!window.SplitText) return [el];
    const s = SplitText.create(el, { type: type === 'chars' ? 'lines,words,chars' : 'lines', mask: 'lines', aria: 'auto' });
    splits.push(s);
    return type === 'chars' ? s.chars : s.lines;
  };
  const lines = (el) => splitBy(el, 'lines');
  const chars = (el) => splitBy(el, 'chars');
  const rise = (tl, targets, at = 0, extra = {}) => tl.from(targets, Object.assign({ yPercent: 110, stagger: 0.09 }, extra), at);

  // Rolling digits for a short figure such as "7:42" (the recipe in references/motion.md).
  const roll = (el) => {
    const value = el.textContent.trim();
    const said = Object.assign(document.createElement('span'), { className: 'sr-only', textContent: value });
    const shown = Object.assign(document.createElement('span'), { className: 'roll__digits' });
    shown.setAttribute('aria-hidden', 'true');
    const strips = [];
    for (const ch of value) {
      if (!/\d/.test(ch)) { shown.append(ch); continue; }
      const col = Object.assign(document.createElement('span'), { className: 'roll__col' });
      const strip = Object.assign(document.createElement('span'), { className: 'roll__strip' });
      for (let n = 0; n <= 9; n++) strip.append(Object.assign(document.createElement('span'), { textContent: n }));
      strip.dataset.d = ch;
      col.append(strip);
      shown.append(col);
      strips.push(strip);
    }
    el.replaceChildren(said, shown);
    undos.push(() => { el.textContent = value; });
    return strips;
  };

  document.fonts.ready.then(() => {
    const mm = gsap.matchMedia();
    mm.add({ wide: '(min-width: 861px)' }, (ctx) => {
      const wide = ctx.conditions.wide;


      // ----- hero: as the first screen scrolls away, the name, the inbox and the room drift apart -----
      const hero = $('#home');
      if (hero && wide) {
        const out = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
        out.to('.hero-name h1', { yPercent: -14, scale: 1.05, transformOrigin: '0% 100%', ease: 'none' }, 0)
           .to('.hero-inbox .inbox', { y: -36, ease: 'none' }, 0)
           .fromTo('.hero-photo .drift-wrap', { yPercent: -4 }, { yPercent: 4, ease: 'none' }, 0);
      }

      // ----- intro: the rush -----
      reveal($('#intro'), (tl) => {
        rise(tl, chars($('#intro-title')), 0, { stagger: 0.035, duration: 1 });
        const strips = roll($('.intro-b p'));
        strips.forEach((s, i) => tl.fromTo(s, { y: 0 }, { y: () => -s.dataset.d * s.firstChild.offsetHeight, duration: 1.3, ease: 'expo.inOut' }, 0.15 + i * 0.12));
        tl.fromTo('.intro-c', { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut' }, 0.1)
          .fromTo('.intro-c img', { scale: 1.32 }, { scale: 1.14, duration: 1.6, ease: 'power2.out' }, 0.1)
          .from('.intro-aside', { y: 24, autoAlpha: 0, duration: 0.8 }, 0.5);
        rise(tl, lines($('.intro-text .lead')), 0.55, { stagger: 0.07, duration: 1 });
      }, 'top 80%');
      gsap.set('.intro-c img', { scale: 1.14 });
      gsap.fromTo('.intro-c img', { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: '.intro-c', start: 'top bottom', end: 'bottom top', scrub: true } });

      // ----- section headings rise line by line -----
      ['#demo-title', '#features-title', '#proof-title', '#cta-title'].forEach((sel) => {
        const el = $(sel);
        reveal(el, (tl) => rise(tl, lines(el)));
      });

      // ----- the demo panel wipes open, then its parts arrive in reading order -----
      reveal($('.panel'), (tl) => {
        tl.from('.showcase-head p', { y: 20, autoAlpha: 0, duration: 0.8 }, 0)
          .fromTo('.panel', { clipPath: wide ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut' }, 0.05)
          .from('#demoMail', { y: 40, autoAlpha: 0, duration: 0.9 }, 0.45)
          .from('.panel-side .ctl', { x: 24, autoAlpha: 0, stagger: 0.06, duration: 0.6, ease: 'power3.out' }, 0.55)
          .from('#demoNext li', { y: 10, autoAlpha: 0, stagger: 0.07, duration: 0.5 }, 0.9);
      }, 'top 78%');

      // ----- features: each fragment arrives the way that piece of the product works -----
      $$('.cell').forEach((cell, i) => {
        const fromTop = cell.classList.contains('cell--frag-top') && wide;
        reveal(cell, (tl) => {
          tl.from($$('.cell-text > *', cell), { y: 22, autoAlpha: 0, stagger: 0.08, duration: 0.8 }, (i % 3) * 0.08)
            .from($('.cell-frag', cell), { y: fromTop ? -60 : 60, autoAlpha: 0, duration: 1, ease: 'expo.out' }, (i % 3) * 0.08 + 0.1);
          const at = (i % 3) * 0.08 + 0.45;
          const frag = $('.frag', cell);
          const kind = i;
          if (kind === 0 || kind === 1) tl.from($$('.kv dt, .kv dd', frag), { autoAlpha: 0, x: -8, stagger: 0.03, duration: 0.4, ease: 'power2.out' }, at);
          if (kind === 1) tl.from($('.frag-head .tag', frag), { scale: 0.7, autoAlpha: 0, duration: 0.4, ease: 'expo.out' }, at + 0.35);
          if (kind === 2) tl.from($$('.step', frag), { autoAlpha: 0, y: 10, stagger: 0.14, duration: 0.5, ease: 'power2.out' }, at);
          if (kind === 3) {
            $$('.box--on', frag).forEach((b, k) => tl.from(b, { backgroundColor: '#ffffff', borderColor: '#9a9391', scale: 0.7, duration: 0.3, ease: 'power2.out' }, at + k * 0.2));
            countUp(tl, $('.total b', frag), 2040, money, at + 0.2, 1.2);
          }
          if (kind === 4) {
            tl.from($('.note-own', frag), { autoAlpha: 0, y: 8, duration: 0.5 }, at)
              .from($$('.progress span', frag), { autoAlpha: 0, scale: 0.85, stagger: 0.12, duration: 0.4, ease: 'power2.out' }, at + 0.15);
          }
          if (kind === 5) {
            tl.from($('.quote', frag), { autoAlpha: 0, x: -20, duration: 0.6 }, at)
              .from($('.fbtn', frag), { autoAlpha: 0, scale: 0.85, duration: 0.45, ease: 'expo.out' }, at + 0.3);
          }
        });
      });

      // ----- promises: the tiles deal onto the board, the figures roll up -----
      reveal($('#promises'), (tl) => {
        tl.fromTo($$('#promises .ptile'), { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, stagger: 0.09, ease: 'power3.inOut' }, 0)
          .fromTo('#promises .ptile.photo img', { scale: 1.2 }, { scale: 1, duration: 1.6, ease: 'power2.out' }, 0.3)
          .from($$('#promises .ptile:not(.photo) > *:not(h2)'), { y: 18, autoAlpha: 0, stagger: 0.05, duration: 0.7 }, 0.45);
        $$('#promises .mark').forEach((m) => {
          const match = m.textContent.match(/^([\d,]+)(.*)$/);
          if (!match) return;
          const tail = match[2];
          countUp(tl, m, Number(match[1].replace(/,/g, '')), (n) => Math.round(n).toLocaleString('en-US') + tail, 0.5, 1.6);
        });
      }, 'top 80%');

      // ----- pricing: rows arrive top to bottom, the recommended column fills down -----
      reveal($('#pricing'), (tl) => {
        if (wide) {
          rise(tl, lines($('#pricing-title')), 0);
          tl.from($$('.plans thead th:not(:first-child) > span'), { y: 24, autoAlpha: 0, stagger: 0.06, duration: 0.8 }, 0.1);
          $$('.plans tbody tr').forEach((tr, r) => tl.from($$('th, td:not(.rec)', tr), { y: 14, autoAlpha: 0, duration: 0.6, stagger: 0.04 }, 0.25 + r * 0.05));
          tl.fromTo($$('.plans .rec'), { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.35, stagger: 0.045, ease: 'power2.out' }, 0.05)
            .from($$('.plans tfoot .btn'), { y: 12, autoAlpha: 0, stagger: 0.08, duration: 0.6 }, 0.9);
        } else {
          tl.from($$('.plan-stack > *'), { y: 30, autoAlpha: 0, stagger: 0.1, duration: 0.8 }, 0);
        }
      }, 'top 80%');

      // ----- questions -----
      reveal($('.faq-head'), (tl) => rise(tl, chars($('#faq-title')), 0, { stagger: 0.03, duration: 1 }));
      $$('.faq-band').forEach((band) => reveal(band, (tl) => {
        tl.from($('h3', band), { y: 26, autoAlpha: 0, duration: 0.8 }, 0)
          .from($('p', band), { y: 14, autoAlpha: 0, duration: 0.8 }, 0.12);
      }, 'top 88%'));

      // ----- the close: the action tile opens from its centre, its neighbours slide in -----
      reveal($('#contact'), (tl) => {
        tl.fromTo('.cta-c', { clipPath: 'inset(45% 45% 45% 45%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power3.inOut' }, 0)
          .from('.cta-l', { xPercent: -100, duration: 1.1, ease: 'power3.out' }, 0.15)
          .from('.cta-r', { xPercent: 100, duration: 1.1, ease: 'power3.out' }, 0.15)
          .from($$('.cta-c > p, .cta-c > .btn'), { y: 18, autoAlpha: 0, stagger: 0.08, duration: 0.7 }, 0.8);
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
    });

    // ----- the demo: every change re-sets the reply, paragraph by paragraph -----
    window.efDemoAnimate = () => {
      gsap.fromTo('#demoBody > *', { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.04, duration: 0.4, ease: 'power2.out', overwrite: true });
      gsap.fromTo('#demoNext li', { x: 10, autoAlpha: 0 }, { x: 0, autoAlpha: 1, stagger: 0.05, duration: 0.35, ease: 'power2.out', overwrite: true });
      gsap.fromTo('#demoTag', { scale: 0.85 }, { scale: 1, duration: 0.35, ease: 'expo.out', overwrite: true });
    };
    const out = $('#dGuestsOut');
    if (out) $('#dGuests').addEventListener('input', () => gsap.fromTo(out, { scale: 1.2 }, { scale: 1, duration: 0.3, ease: 'power2.out', overwrite: true }));
  });
})();
