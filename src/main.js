// main.js
// -----------------------------------------------------------------------------
// Entry point. Wires the three sky systems together:
//   TimeSystem  -> "what slot are we in?"        (slot change -> update sky)
//   WeatherSystem -> "what's the weather?"        (weather update -> update sky)
//   SkyManager  -> resolves art + crossfades.
//
// Phase 1 only touches the sky. Screens are wired in later phases.
// -----------------------------------------------------------------------------

(function bootstrap() {
  function start() {
    console.log('%c[HomeBase] booting Phase 1 — sky system', 'color:#7fd1ae');

    // Order matters: Time + Weather provide the state SkyManager reads on init.
    TimeSystem.init();
    WeatherSystem.init();
    SkyManager.init();

    // Helper: pull the current slot + condition and push them to the sky.
    function syncSky() {
      const { slot } = TimeSystem.getNow();
      const condition = WeatherSystem.condition || 'sunny';
      SkyManager.update(slot, condition);
    }

    // Slot boundary crossed -> re-resolve the sky.
    TimeSystem.onSlotChange(() => syncSky());

    // Weather refreshed -> re-resolve the sky (condition may have changed).
    WeatherSystem.onUpdate(() => syncSky());

    // Quest + reward system: chore tracking, acorns, weekly quest trail,
    // Monday reset, and the chest celebration. Wires its own events + screens.
    if (window.QuestSystem) QuestSystem.init();
    if (window.QuestBanner) QuestBanner.init();
    if (window.KidChorePanel) KidChorePanel.init();
    if (window.ChestCelebration) ChestCelebration.init();

    // Load chore definitions from the D1-backed API (falls back to the cached
    // copy, then the built-in defaults). Fires 'choresupdated' when it lands.
    if (window.ChoreData) ChoreData.load();

    // Mount the resting screen. Screens register themselves with the Router on
    // load. The SleepScreen is the ambient default (time + temp); tapping it
    // wakes to the full Dashboard.
    Router.show('sleep');

    // Clock tick — updates any time-display elements once a second.
    // (No display elements exist yet in Phase 1; the hook is here for later.)
    setInterval(() => {
      const { hour, minute } = TimeSystem.getNow();
      const els = document.querySelectorAll('[data-clock]');
      if (els.length) {
        const hh = ((hour % 12) || 12);
        const mm = String(minute).padStart(2, '0');
        const ampm = hour < 12 ? 'AM' : 'PM';
        els.forEach((el) => { el.textContent = `${hh}:${mm} ${ampm}`; });
      }
    }, 1000);

    // One-time debug snapshot of the initial resolved state.
    const now = TimeSystem.getNow();
    console.log(
      `[HomeBase] initial state — slot: ${now.slot}, ` +
      `condition: ${WeatherSystem.condition}, ` +
      `resolved key: ${SkyManager.resolveKey(now.slot, WeatherSystem.condition)}`
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
