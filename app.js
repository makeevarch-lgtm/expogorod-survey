'use strict';
const start = document.getElementById('start');
const notice = document.getElementById('availability');
const survey = document.getElementById('survey');
const formLink = document.getElementById('form-link');
let formUrl;
const reviewMode = window.EXPO_CONFIG?.review === true && ['127.0.0.1', 'localhost'].includes(window.location.hostname);
try {
  const candidate = new URL(window.EXPO_CONFIG?.formUrl || '');
  if (candidate.protocol === 'https:' && candidate.hostname === 'forms.yandex.ru' && candidate.pathname.startsWith('/u/') && (!candidate.pathname.startsWith('/u/preview/') || reviewMode)) formUrl = candidate;
} catch (_) { /* An unpublished form deliberately has no public URL. */ }
if (formUrl) {
  notice.textContent = reviewMode ? 'Предпросмотр анкеты. Публичный приём ответов ещё не открыт.' : 'Ответы сохраняются в Яндекс Формах. Регистрация для участия не требуется.';
  formLink.href = formUrl.href;
  start.addEventListener('click', () => {
    if (survey.hidden) {
      survey.hidden = false;
      const frame = document.createElement('iframe');
      // Yandex's embed.js reports each page's height through this message.
      // Accept messages only from this form's frame and its exact origin.
      window.addEventListener('message', (event) => {
        if (event.origin !== formUrl.origin || event.source !== frame.contentWindow) return;
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          const height = Number(data?.['iframe-height']);
          if (Number.isFinite(height) && height >= 100 && height <= 30000) frame.style.height = `${Math.ceil(height)}px`;
        } catch (_) { /* Ignore messages that are not the embed height protocol. */ }
      });
      const embedded = new URL(formUrl);
      embedded.searchParams.set('iframe', '1');
      frame.src = embedded.href;
      frame.title = 'Анкета «Экспогород — городской интерес»';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer';
      document.getElementById('form-mount').append(frame);
    }
    survey.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
} else {
  start.disabled = true;
  start.textContent = 'Опрос скоро откроется';
}
