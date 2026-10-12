'use strict';
// Progressive enhancement: content stays visible without JS and with reduced motion.
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let observer;
  const release = () => {
    observer?.disconnect();
    document.querySelectorAll('.reveal-pending').forEach(element => element.classList.remove('reveal-pending'));
  };
  const refresh = (root = document) => {
    if (reduced.matches || !('IntersectionObserver' in window)) return;
    observer ||= new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('reveal-pending');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -24px 0px', threshold: 0.08 });
    root.querySelectorAll('[data-reveal]').forEach(element => {
      if (element.getBoundingClientRect().top < window.innerHeight) return;
      element.classList.add('reveal-pending');
      observer.observe(element);
    });
  };
  reduced.addEventListener?.('change', () => { if (reduced.matches) release(); else refresh(); });
  window.EXPO_MOTION = { refresh };
  refresh();
})();
