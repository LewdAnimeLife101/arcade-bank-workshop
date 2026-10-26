// Approximate unique browsers. No identity, bank data or editor state is sent.
const counter = 'lewdanimelife101.github.io/arcade-bank-workshop-unique-browsers';
const marker = 'arcade-bank-workshop:unique-visitor:v1';
const output = document.getElementById('visit-count');
const live = location.hostname === 'lewdanimelife101.github.io' &&
  (location.pathname === '/arcade-bank-workshop' || location.pathname.startsWith('/arcade-bank-workshop/'));
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
async function updateCounter() {
  let operation = 'get';
  if (live) {
    try {
      if (localStorage.getItem(marker) !== 'counted') {
        // Record the attempt BEFORE sending. An interrupted/ambiguous response
        // must not cause a refresh to send the increment again.
        localStorage.setItem(marker, 'counted');
        if (localStorage.getItem(marker) === 'counted') operation = 'hit';
      }
    } catch { /* Without durable storage, display only rather than overcount. */ }
  }
  try {
    const response = await fetch(`https://abacus.jasoncameron.dev/${operation}/${counter}`, {
      credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Error('Counter unavailable');
    const data = await response.json();
    if (!Number.isSafeInteger(data.value) || data.value < 0) throw Error('Invalid count');
    output.textContent = 'Unique visitors: ' + data.value.toLocaleString();
  } catch { output.textContent = 'Visitor count unavailable'; }
}
if (output && (live || local)) {
  // Serialize the first visit across tabs on browsers supporting Web Locks.
  if (live && navigator.locks?.request) {
    navigator.locks.request(marker, updateCounter).catch(() => {
      output.textContent = 'Visitor count unavailable';
    });
  } else {
    updateCounter();
  }
} else if (output) {
  output.textContent = 'Visitor counter inactive in this preview';
}
