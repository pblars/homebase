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

    // iPad/iOS Safari support: visible-viewport height (--app-height), pinch-zoom
    // block, safe-area layout, and Screen Wake Lock. No-ops off iOS.
    if (window.IOSSupport) IOSSupport.init();

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

    // Set data-scene=dark|light on <html> so the frosted-glass UI stays readable
    // over both dark (night/dusk/stormy) and light (day/sunny) backgrounds.
    const DARK_SLOTS = new Set(['night', 'predawn', 'dusk', 'evening']);
    const DARK_CONDITIONS = new Set(['rainy', 'stormy']);
    function syncScene() {
      const { slot } = TimeSystem.getNow();
      const condition = WeatherSystem.condition || 'sunny';
      const dark = DARK_SLOTS.has(slot) || DARK_CONDITIONS.has(condition);
      document.documentElement.dataset.scene = dark ? 'dark' : 'light';
    }
    syncScene();
    TimeSystem.onSlotChange(syncScene);
    WeatherSystem.onUpdate(syncScene);

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
    if (window.SettingsScreen) SettingsScreen.init();

    // Load household settings + chore definitions from the D1-backed API (each
    // falls back to cache, then built-in defaults). Fire 'settingsupdated' /
    // 'choresupdated' when they land. Once chore definitions (window.KIDS) are in,
    // pull the SHARED daily progress (completions + acorns + quest) from D1 so
    // every device shows the same board.
    if (window.SettingsData) SettingsData.load();
    if (window.ChoreData) {
      const loaded = ChoreData.load();
      if (window.QuestStore) {
        if (loaded && typeof loaded.then === 'function') loaded.then(() => QuestStore.load());
        else QuestStore.load();
      }
    } else if (window.QuestStore) {
      QuestStore.load();
    }

    // Gentle background sync so an always-awake wall tablet (which may sit on the
    // dashboard for hours) picks up chore taps made on other devices. Only runs
    // while the page is VISIBLE — a backgrounded phone won't poll — and QuestStore
    // itself skips a sync while a local write is still in flight. Also syncs
    // immediately when the tab/tablet regains focus. (Reads are cheap; no polling
    // of the write path.)
    if (window.QuestStore) {
      const SYNC_MS = 60 * 1000;
      setInterval(() => {
        if (document.visibilityState === 'visible') QuestStore.load();
      }, SYNC_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') QuestStore.load();
      });
    }

    // Live family calendar (public Google Calendar via API key). Populates
    // window.EVENTS with today's events for the agenda + feeds CalendarDetail;
    // falls back to the placeholder agenda when unconfigured. Dispatches
    // 'calendarupdate' when events land.
    if (window.CalendarSystem) CalendarSystem.init();

    // Shared meal plan (pushed from The Family Table into /api/mealplan). Feeds
    // window.MEALS for the dashboard dinner bar + the Meals tab; dispatches
    // 'mealsupdated'. Falls back to the placeholder meals.js when empty.
    if (window.MealsData) MealsData.load();

    // Idle timeout: return the wall tablet to the SleepScreen after a period of
    // no interaction (configurable in Settings → Display; 0 = never).
    if (window.IdleTimer) IdleTimer.init();

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
