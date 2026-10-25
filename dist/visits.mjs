// Aggregate page-load counter. Never reads editor state, files or account details.
const counter = 'lewdanimelife101.github.io/arcade-bank-workshop-pageviews';
const output = document.getElementById('visit-count');
const live = location.hostname === 'lewdanimelife101.github.io' &&
  (location.pathname === '/arcade-bank-workshop' || location.pathname.startsWith('/arcade-bank-workshop/'));
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
if (output && (live || local)) {
  const operation = live ? 'hit' : 'get';
  fetch(`https://abacus.jasoncameron.dev/${operation}/${counter}`, {
    credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  }).then(async response => {
    if (!response.ok) throw Error('Counter unavailable');
    const data = await response.json();
    if (!Number.isSafeInteger(data.value) || data.value < 0) throw Error('Invalid count');
    output.textContent = 'Total visits: ' + data.value.toLocaleString();
  }).catch(() => { output.textContent = 'Visit count unavailable'; });
} else if (output) {
  output.textContent = 'Visit counter inactive in this preview';
}
