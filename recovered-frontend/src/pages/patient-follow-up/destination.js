const path = '/patient-follow-up';
const key = 'nu.practice.followup.return';
const allowedOffices = ['staten_island', 'barnegat', 'brick', 'eatontown'];

export function followupDestination(location) {
  const office = new URLSearchParams(location.search).get('office');
  const query = allowedOffices.includes(office) ? '?office=' + office : '';
  const hash = /^#request=[a-f0-9]{32}$/.test(location.hash) ? location.hash : '';
  return path + query + hash;
}

// Preserve an emailed request through password setup and device verification in this tab.
export function followupAfterSignIn(location, gate) {
  try {
    if (location.pathname === path) {
      if (gate === 'ok') sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify({ url: followupDestination(location), at: Date.now() }));
    } else if (gate === 'ok' && !['/otp-challenge', '/change-password', '/login'].includes(location.pathname)) {
      const pending = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (!pending) return;
      sessionStorage.removeItem(key);
      const url = new URL(pending.url, window.location.origin);
      if (Date.now() - pending.at < 30 * 60 * 1000 && url.pathname === path) return followupDestination(url);
    }
  } catch { /* The menu remains available if this browser disables session storage. */ }
}
