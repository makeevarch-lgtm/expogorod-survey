'use strict';
// A test view is explicit in its URL and labels; normal navigation uses real data.
(() => {
  const enabled = new URLSearchParams(window.location.search).get('mode') === 'test';
  window.EXPO_TEST_MODE = enabled;
  if (!enabled) return;
  document.body.classList.add('test-mode');
  const tagline = document.querySelector('.brand > span');
  if (tagline) tagline.textContent = 'Тестовый режим';
  const snapshot = document.querySelector('.snapshot-label');
  if (snapshot) snapshot.textContent = 'Тестовый режим';
  const totalLabel = document.getElementById('metric-total-label');
  if (totalLabel) totalLabel.textContent = 'Тестовых ответов';
  for (const link of document.querySelectorAll('a[href]')) {
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || !/(?:\/(?:index|analytics|territory)\.html|\/)$/u.test(url.pathname)) continue;
    url.searchParams.set('mode', 'test');
    link.href = url.href;
  }
})();
