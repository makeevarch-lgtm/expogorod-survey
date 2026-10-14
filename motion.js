'use strict';
// Progressive enhancement: final values and complete diagrams remain the source of truth.
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const seen = new WeakSet();
  const counterValues = new WeakMap();
  const active = new Set();
  let observer;
  const enabled = () => !reduced.matches && !document.hidden;
  const each = (root, selector, visit) => {
    if (root.matches?.(selector)) visit(root);
    root.querySelectorAll(selector).forEach(visit);
  };
  const finish = () => {
    observer?.disconnect();
    for (const item of [...active]) item.finish();
    document.querySelectorAll('.reveal-pending').forEach(element => element.classList.remove('reveal-pending'));
  };
  const animate = (element, frames, options) => {
    if (!element.animate || !enabled()) return;
    const animation = element.animate(frames, { duration: 900, easing: 'cubic-bezier(.2,.7,.2,1)', ...options });
    active.add(animation);
    // No fill persists: SVG exports and later focus/selection use the original geometry.
    animation.onfinish = () => { active.delete(animation); animation.cancel(); };
    animation.oncancel = () => active.delete(animation);
  };
  const count = element => {
    const original = element.textContent.trim();
    if (!/^\d[\d\s\u00a0\u202f]*(?:,\d+)?%?$/.test(original) || counterValues.get(element) === original) return;
    counterValues.set(element, original);
    const value = Number(original.replace(/[\s\u00a0\u202f%]/g, '').replace(',', '.'));
    const suffix = original.endsWith('%') ? '%' : '';
    const digits = original.includes(',') ? original.split(',')[1].replace('%','').length : 0;
    const formatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    const label = element.getAttribute('aria-label');
    element.setAttribute('aria-label', label || original);
    let frame;
    const start = performance.now();
    const handle = { finish() {
      cancelAnimationFrame(frame);
      element.textContent = original;
      if (label === null) element.removeAttribute('aria-label');
      else element.setAttribute('aria-label', label);
      active.delete(handle);
    } };
    active.add(handle);
    const tick = now => {
      if (!enabled() || !element.isConnected) { handle.finish(); return; }
      const progress = Math.min(1, (now - start) / 850);
      element.textContent = formatter.format(value * (1 - Math.pow(1 - progress, 3))) + suffix;
      if (progress === 1) handle.finish();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };
  const play = element => {
    if (!enabled() || seen.has(element)) return;
    if (element.matches('#metric-total, #metric-interest, #metric-pairs, [data-count]') && !/^\d[\d\s\u00a0\u202f]*(?:,\d+)?%?$/.test(element.textContent.trim())) return;
    seen.add(element);
    if (element.matches('.graph-edge')) {
      const length = element.getTotalLength?.() || Math.hypot(Number(element.getAttribute('x2')) - Number(element.getAttribute('x1')), Number(element.getAttribute('y2')) - Number(element.getAttribute('y1')));
      if (length > 0) animate(element, [{ strokeDasharray: `${length} ${length}`, strokeDashoffset: length }, { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 }], { duration: 1100 });
    } else if (element.matches('.graph-node')) {
      const siblings = [...element.parentNode.querySelectorAll('.graph-node')];
      const opacity = getComputedStyle(element).opacity;
      animate(element, [{ opacity: .08 }, { opacity }], { duration: 650, delay: siblings.indexOf(element) * 60 });
    } else if (element.matches('.interest-bar-track > span')) {
      animate(element, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 950 });
    } else if (element.matches('.chart-donut circle[stroke-dasharray]')) {
      // Animate each actual segment to its stored length, preserving its start angle.
      const values = element.getAttribute('stroke-dasharray').split(/\s+/).map(Number);
      const circumference = values.reduce((sum, value) => sum + value, 0);
      animate(element, [{ strokeDasharray: `0 ${circumference}` }, { strokeDasharray: `${values[0]} ${values[1]}` }], { duration: 1100 });
    } else if (element.matches('#metric-total, #metric-interest, #metric-pairs, [data-count]')) {
      count(element);
    } else {
      animate(element, [{ opacity: .65, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 600 });
    }
  };
  const selector = '[data-reveal], .graph-edge, .graph-node, .interest-bar-track > span, .chart-donut circle[stroke-dasharray], #metric-total, #metric-interest, #metric-pairs, [data-count]';
  const refresh = (root = document) => {
    if (!enabled()) return;
    document.documentElement.classList.add('motion-ready');
    if ('IntersectionObserver' in window) observer ||= new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        play(entry.target);
      });
    }, { rootMargin: '0px 0px -12px 0px', threshold: .06 });
    each(root, selector, element => {
      if (seen.has(element) && element.matches('#metric-total, #metric-interest, #metric-pairs, [data-count]') && !active.size) {
        if (counterValues.get(element) !== element.textContent.trim()) seen.delete(element);
      }
      if (seen.has(element)) return;
      if (observer) observer.observe(element);
      else play(element);
    });
  };
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('motion-paused', document.hidden);
    if (document.hidden) finish();
    else refresh();
  });
  reduced.addEventListener?.('change', () => {
    if (reduced.matches) { finish(); document.documentElement.classList.remove('motion-ready'); }
    else refresh();
  });
  window.EXPO_MOTION = { refresh };
  refresh();
})();
