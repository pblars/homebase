// CalendarSystem.js
// -----------------------------------------------------------------------------
// Singleton that fetches upcoming events from a PUBLIC Google Calendar using an
// API key (no OAuth), normalizes them to the app's internal event shape, caches
// the result, and notifies listeners — mirroring WeatherSystem's design.
//
// Internal event shape (matches what the agenda + CalendarDetail render):
//   { id, title, sub, start (Date), allDay, period: 'am'|'pm'|'all',
//     time: '8:15'|'All Day', ampm: 'AM'|'PM'|'', dateKey: 'YYYY-M-D' }
//
// Populates window.EVENTS with TODAY's events so the dashboard agenda goes live.
// If the calendar isn't configured (or a fetch fails) it leaves the existing
// placeholder window.EVENTS untouched, so the design still demos without keys.
//
// Dispatches a `calendarupdate` CustomEvent on window after every update.
// Exposed as the global `CalendarSystem`.
// -----------------------------------------------------------------------------

const CalendarSystem = (() => {
  const REFRESH_MS = 10 * 60 * 1000; // 10 minutes
  const CACHE_KEY = 'homebase_calendar';
  const DAYS_AHEAD = 14;             // how far forward to fetch for the detail view
  const AGENDA_MAX = 6;              // max rows when the agenda rolls forward to upcoming

  const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const state = {
    events: [],       // normalized events across the fetch window (sorted by start)
    configured: false,
    fetchedAt: 0,
  };

  let refreshHandle = null;
  const updateListeners = [];

  // NOTE: config.js declares `const CONFIG`, reachable by bare name across
  // classic <script> tags but NOT a property of window. Reference it directly.
  function _cfg() { return typeof CONFIG !== 'undefined' ? CONFIG : {}; }
  function _calId() { return _cfg().GOOGLE_CALENDAR_ID || ''; }
  function _key() { return _cfg().GOOGLE_API_KEY || ''; }
  function _isConfigured() {
    const id = _calId(); const key = _key();
    return !!id && !!key && id !== 'your_calendar_id' && key !== 'your_key_here';
  }

  // ---- cache ----------------------------------------------------------------

  function _cacheGet() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // revive Date objects (JSON stores them as ISO strings)
      (parsed.events || []).forEach((e) => { e.start = new Date(e.start); });
      return parsed;
    } catch (_) { return null; }
  }
  function _cacheSet() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ events: state.events, fetchedAt: state.fetchedAt })); }
    catch (_) { /* ignore quota / private-mode errors */ }
  }

  // ---- date helpers ---------------------------------------------------------

  function _dateKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
  function _startOfToday() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

  function _fmtTime(d) {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h < 12 ? 'AM' : 'PM';
    h = (h % 12) || 12;
    return { time: `${h}:${String(m).padStart(2, '0')}`, ampm };
  }

  // Parse an all-day 'YYYY-MM-DD' as a LOCAL date (new Date('YYYY-MM-DD') is UTC
  // midnight, which can land on the previous day in western timezones).
  function _parseLocalDate(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // ---- normalization --------------------------------------------------------

  function _normalize(ev) {
    const timed = !!(ev.start && ev.start.dateTime);
    const start = timed ? new Date(ev.start.dateTime) : _parseLocalDate(ev.start.date);
    const title = (ev.summary || '(No title)').trim();
    const sub = (ev.location || '').trim();

    let period, time, ampm;
    if (timed) {
      period = start.getHours() < 12 ? 'am' : 'pm';
      const t = _fmtTime(start);
      time = t.time; ampm = t.ampm;
    } else {
      period = 'all'; time = 'All Day'; ampm = '';
    }

    return { id: ev.id || (title + start.getTime()), title, sub, start, allDay: !timed, period, time, ampm, dateKey: _dateKey(start) };
  }

  // ---- fetch ----------------------------------------------------------------

  async function _fetchEvents() {
    const start = _startOfToday();
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + DAYS_AHEAD);
    const params = new URLSearchParams({
      key: _key(),
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: 'true',       // expand recurring events into instances
      orderBy: 'startTime',       // requires singleEvents=true
      maxResults: '250',
    });
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(_calId())}/events?${params}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = j.error && j.error.message ? ` — ${j.error.message}` : ''; } catch (_) { /* ignore */ }
      throw new Error(`calendar HTTP ${res.status}${detail}`);
    }
    const json = await res.json();
    return (json.items || []).filter((e) => e.status !== 'cancelled' && e.start).map(_normalize);
  }

  // ---- state / listeners ----------------------------------------------------

  // TODAY's events (dateKey matches today).
  function _todaysEvents() {
    const key = _dateKey(new Date());
    return state.events.filter((e) => e.dateKey === key);
  }

  // Relative day label for a future date: 'Tomorrow', a short weekday within a
  // week, else 'Mon 6'. Returns '' for today (no prefix needed).
  function _relDayLabel(d) {
    const n = new Date();
    const t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const days = Math.round((d0 - t0) / 86400000);
    if (days <= 0) return '';
    if (days === 1) return 'Tomorrow';
    if (days < 7) return WEEKDAYS_SHORT[d.getDay()];
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  }

  function _toAgendaShape(e, withDay) {
    const label = withDay ? _relDayLabel(e.start) : '';
    return {
      time: label ? `${label} · ${e.time}` : e.time,
      ampm: e.ampm, period: e.period, title: e.title, sub: e.sub,
    };
  }

  // The dashboard agenda: today's events, or — if today is empty — roll forward
  // to the next upcoming events (labelled with their day).
  function _agendaEvents() {
    const today = _todaysEvents();
    if (today.length) return { mode: 'today', list: today.map((e) => _toAgendaShape(e, false)) };
    // today empty → everything left in the window is future (timeMin = today 00:00)
    return { mode: 'upcoming', list: state.events.slice(0, AGENDA_MAX).map((e) => _toAgendaShape(e, true)) };
  }

  function _publish() {
    // Only take over window.EVENTS when we actually have a configured calendar;
    // otherwise leave the placeholder events (events.js) so the design demos.
    if (state.configured) {
      const agenda = _agendaEvents();
      window.EVENTS = agenda.list;
      window.AGENDA_LABEL = agenda.mode === 'upcoming' ? 'Upcoming' : "Today's Agenda";
    }
    const snapshot = getState();
    updateListeners.forEach((cb) => {
      try { cb(snapshot); } catch (err) { console.error('[CalendarSystem] onUpdate listener error:', err); }
    });
    window.dispatchEvent(new CustomEvent('calendarupdate', { detail: snapshot }));
  }

  async function _refresh() {
    state.configured = _isConfigured();
    if (!state.configured) {
      console.warn('[CalendarSystem] GOOGLE_CALENDAR_ID / GOOGLE_API_KEY not set — using placeholder agenda. Add them to config.js and make the calendar public.');
      _publish();
      return;
    }
    try {
      const events = await _fetchEvents();
      state.events = events;
      state.fetchedAt = Date.now();
      _cacheSet();
      console.log(`[CalendarSystem] update — ${events.length} event(s) over the next ${DAYS_AHEAD} days`);
      _publish();
    } catch (err) {
      console.error('[CalendarSystem] fetch failed, keeping cache/placeholder:', err.message);
      _publish(); // still emit so the detail screen can render cache (or its empty state)
    }
  }

  // ---- public API -----------------------------------------------------------

  function getState() {
    return { events: state.events.slice(), configured: state.configured, fetchedAt: state.fetchedAt };
  }
  function getEvents() { return state.events.slice(); }
  function getToday() { return _todaysEvents(); }
  function isConfigured() { return state.configured; }

  function onUpdate(callback) {
    if (typeof callback === 'function') updateListeners.push(callback);
  }

  function init() {
    const cached = _cacheGet();
    if (cached && cached.events) { state.events = cached.events; state.fetchedAt = cached.fetchedAt || 0; }
    state.configured = _isConfigured();
    if (state.configured && state.events.length) _publish(); // paint cache immediately
    _refresh();                                               // then hit the network
    if (refreshHandle) clearInterval(refreshHandle);
    refreshHandle = setInterval(_refresh, REFRESH_MS);
    console.log('[CalendarSystem] init — refreshing every 10 min');
  }

  return { init, refresh: _refresh, onUpdate, getState, getEvents, getToday, isConfigured };
})();

window.CalendarSystem = CalendarSystem;
