// IdleTimer.js
// -----------------------------------------------------------------------------
// Returns the wall tablet to the SleepScreen after a period of no interaction.
// The timeout (minutes) is a per-device display preference stored via Store
// (localStorage). 0 = off. Configured in Settings → Display. Classic-script
// global `IdleTimer`.
// -----------------------------------------------------------------------------

const IdleTimer = (() => {
  const KEY = 'idleTimeoutMin';   // Store -> localStorage 'homebase:idleTimeoutMin'
  const DEFAULT_MIN = 10;
  const CHECK_MS = 15000;         // how often to test for idleness

  let lastActivity = Date.now();
  let tickHandle = null;

  function getMinutes() {
    const raw = window.Store ? Store.get(KEY, DEFAULT_MIN) : DEFAULT_MIN;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN;
  }
  function setMinutes(n) {
    const v = Math.max(0, parseInt(n, 10) || 0);
    if (window.Store) Store.set(KEY, v);
    bump();   // restart the countdown from now
    return v;
  }

  function bump() { lastActivity = Date.now(); }

  function check() {
    const mins = getMinutes();
    if (!mins) return;                                            // 0 = disabled
    if (typeof Router === 'undefined' || Router.current === 'sleep') return;
    if (Date.now() - lastActivity >= mins * 60000) Router.show('sleep');
  }

  function init() {
    bump();
    const opts = { passive: true, capture: true };
    ['pointerdown', 'touchstart', 'keydown', 'wheel', 'click'].forEach((ev) =>
      window.addEventListener(ev, bump, opts));
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = setInterval(check, CHECK_MS);
  }

  return { init, getMinutes, setMinutes };
})();

window.IdleTimer = IdleTimer;
