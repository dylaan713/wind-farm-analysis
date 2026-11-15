// One reactive system for the whole page, wired through data attributes, so every control
// answers the visitor the same way. (The headline's lean lives with the wind, in hero.ts.)
//
//   data-press     scales down while pressed, springs back on release
//   data-magnetic  fine pointers only: leans up to 6px toward a pointer within 80px
//   data-reveal    fades and rises once, when it comes into view
//
// Everything starts visible in CSS. This script only adds the classes that hide or move
// things, so nothing depends on it running.

const ARRIVAL_MS = 1200, MAGNET_RANGE = 80, MAGNET_PULL = 6;

export function startReactive(html: HTMLElement): () => void {
  const off: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
    window.addEventListener(type, fn, opts);
    off.push(() => window.removeEventListener(type, fn, opts));
  };
  const calmQuery = window.matchMedia('(prefers-reduced-motion: reduce)'), calm = calmQuery.matches;

  // The arrival: the class was set before first paint; here it is only ended and remembered.
  if (html.classList.contains('arriving')) {
    const done = window.setTimeout(() => {
      html.classList.replace('arriving', 'arrived');
      try { sessionStorage.setItem('wf-arrived', '1'); } catch { /* private mode: it simply plays again */ }
    }, ARRIVAL_MS);
    off.push(() => window.clearTimeout(done));
  }

  // data-press
  const release = () => document.querySelectorAll('.is-pressed').forEach((el) => el.classList.remove('is-pressed'));
  on('pointerdown', (e) => (e.target as Element | null)?.closest?.('[data-press]')?.classList.add('is-pressed'));
  on('pointerup', release); on('pointercancel', release); on('blur', release);

  if (calm) return () => off.forEach((f) => f());

  // data-reveal
  const revealing = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  if (revealing.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }, { threshold: 0.15 });
    html.classList.add('reactive');
    revealing.forEach((el) => io.observe(el));
    off.push(() => { io.disconnect(); html.classList.remove('reactive'); });
  }

  // data-magnetic
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const magnets = [...document.querySelectorAll<HTMLElement>('[data-magnetic]')].map((el) => ({ el, dx: 0, dy: 0 }));
    const rest = () => magnets.forEach((m) => { m.dx = m.dy = 0; m.el.style.transform = ''; });
    on('blur', rest);
    document.documentElement.addEventListener('mouseleave', rest);
    off.push(() => document.documentElement.removeEventListener('mouseleave', rest));
    on('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (calmQuery.matches) { rest(); return; } // reduced motion can be switched on after the page loads
      for (const m of magnets) {
        const r = m.el.getBoundingClientRect();
        const x = e.clientX - (r.left - m.dx + r.width / 2), y = e.clientY - (r.top - m.dy + r.height / 2), d = Math.hypot(x, y);
        const near = d > 0 && d < MAGNET_RANGE;
        m.dx = near ? (x / MAGNET_RANGE) * MAGNET_PULL : 0;
        m.dy = near ? (y / MAGNET_RANGE) * MAGNET_PULL : 0;
        m.el.style.transform = near ? `translate(${m.dx.toFixed(2)}px, ${m.dy.toFixed(2)}px)` : '';
      }
    }, { passive: true });
    off.push(rest);
  }

  return () => off.forEach((f) => f());
}
