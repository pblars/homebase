// ios.js
// -----------------------------------------------------------------------------
// iPad / iOS Safari support for the wall-mounted kiosk. Vanilla classic-script
// global `IOSSupport`. Loaded first among the utils and wired in main.js.
//
// iOS Safari differs from the Surface/Chrome target in ways that break the
// full-bleed kiosk layout. This fixes each one:
//
//   1. Viewport height. A `position:absolute; inset:0` box is sized to the iOS
//      *large* viewport (toolbars retracted), so the bottom nav can end up
//      behind Safari's toolbar. We publish the real VISIBLE height as
//      `--app-height`; base.css sizes <body> from it (the sky + screen layers
//      are anchored to <body>), and we keep it in sync across the dynamic
//      toolbar, rotation, and Split View / Slide Over resizes.
//   2. Pinch-zoom. iOS ignores `user-scalable=no` in a normal Safari tab, so the
//      kiosk can get stuck zoomed by a stray touch. We swallow the `gesture*`
//      events. (Double-tap zoom + the tap delay are killed in base.css via
//      `touch-action: manipulation`.)
//   3. Sleep. A wall display should stay lit, so we hold a Screen Wake Lock when
//      it's supported (iOS 16.4+), re-acquiring whenever the tab becomes visible
//      and on the first tap (iOS only grants it from a user gesture).
//
// Everything here is feature-detected and no-ops on non-iOS browsers, so the
// Surface/Chrome behaviour is unchanged.
// -----------------------------------------------------------------------------

const IOSSupport = (() => {
  let inited = false;

  // 1. Publish the visible viewport height as --app-height (see base.css).
  //    visualViewport tracks the area not covered by the dynamic toolbar; fall
  //    back to innerHeight where it's unavailable.
  function syncHeight() {
    const vv = window.visualViewport;
    const h = Math.round(vv ? vv.height : window.innerHeight);
    if (h > 0) document.documentElement.style.setProperty('--app-height', h + 'px');
  }

  // 2. Block pinch-to-zoom (Safari fires gesture* for a two-finger zoom).
  function blockZoom(e) { e.preventDefault(); }

  // 3. Keep the wall display awake while it's visible + the API is present.
  let wakeLock = null;
  async function acquireWakeLock() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    if (wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (_) {
      // Denied, unsupported, or not from a user gesture — harmless; we retry on
      // the next visibilitychange / tap.
    }
  }

  function init() {
    if (inited) return;
    inited = true;

    syncHeight();
    window.addEventListener('resize', syncHeight, { passive: true });
    window.addEventListener('orientationchange', syncHeight, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncHeight, { passive: true });
      window.visualViewport.addEventListener('scroll', syncHeight, { passive: true });
    }
    // Re-sync once the viewport has settled. Covers the case where innerHeight
    // isn't final at DOMContentLoaded (some iOS launches, Split View hand-off),
    // so the first *valid* height is always captured even if no resize follows.
    window.addEventListener('load', syncHeight, { passive: true });
    requestAnimationFrame(() => requestAnimationFrame(syncHeight));

    ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) =>
      document.addEventListener(ev, blockZoom, { passive: false }));

    acquireWakeLock();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') acquireWakeLock();
    });
    window.addEventListener('pointerdown', acquireWakeLock, { once: true });
  }

  // Set the height var at parse time (scripts load at the end of <body>, so the
  // DOM exists) to avoid a first-paint at the wrong height on iOS.
  syncHeight();

  return { init, syncHeight };
})();

window.IOSSupport = IOSSupport;
