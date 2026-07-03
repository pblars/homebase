// CalendarSystem.js
// -----------------------------------------------------------------------------
// Singleton that fetches events from a PUBLIC Google Calendar using an API key
// (no OAuth), normalizes them to the app's internal event shape, caches the
// result, and notifies listeners — mirroring WeatherSystem's design.
//
// Fetch window is MONTH-AWARE so the Calendar tab can show a full month grid and
// navigate forward/backward: the loaded range grows as you page through months
// (it never shrinks, so today's data stays available for the agenda + Upcoming
// list). `ensureMonth(year, month)` loads a month's grid (plus the next month for
// Upcoming continuity), fetching only when the requested span isn't covered yet.
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
  const AGENDA_MAX = 6;              // max rows when the agenda rolls forward to upcoming

  const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const state = {
    events: [],          // normalized events across the loaded range (sorted by start)
    configured: false,
    fetchedAt: 0,
    loadedMin: null,     // Date — inclusive start of the loaded window
    loadedMax: null,     // Date — exclusive end of the loaded window
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
      if (parsed.loadedMin) parsed.loadedMin = new Date(parsed.loadedMin);
      if (parsed.loadedMax) parsed.loadedMax = new Date(parsed.loadedMax);
      return parsed;
    } catch (_) { return null; }
  }
  function _cacheSet() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        events: state.events,
        fetchedAt: state.fetchedAt,
        loadedMin: state.loadedMin,
        loadedMax: state.loadedMax,
      }));
    } catch (_) { /* ignore quota / private-mode errors */ }
  }

  // ---- date helpers ---------------------------------------------------------

  function _dateKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
  function _startOfToday() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

  // The month grid always starts on the Sunday on/before the 1st and spans 6
  // weeks (42 days), so it lines up with the calendar UI's leading/trailing days.
  function _gridStart(year, month) {
    const first = new Date(year, month, 1);
    return new Date(year, month, 1 - first.getDay());
  }
  function _gridEnd(year, month) {
    const s = _gridStart(year, month);
    return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 42); // exclusive
  }

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

  async function _fetchRange(timeMin, timeMax) {
    const params = new URLSearchParams({
      key: _key(),
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',       // expand recurring events into instances
      orderBy: 'startTime',       // requires singleEvents=true
      maxResults: '2500',
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

  // Ensure [from, to) is loaded. The loaded window only ever grows: we refetch
  // the union so a single events array covers everything the UI has viewed.
  async function _ensureRange(from, to) {
    const covered = state.loadedMin && state.loadedMax && state.loadedMin <= from && state.loadedMax >= to;
    if (covered) return;
    const min = state.loadedMin && state.loadedMin < from ? state.loadedMin : from;
    const max = state.loadedMax && state.loadedMax > to ? state.loadedMax : to;
    try {
      const events = await _fetchRange(min, max);
      state.events = events;
      state.loadedMin = min;
      state.loadedMax = max;
      state.fetchedAt = Date.now();
      _cacheSet();
      console.log(`[CalendarSystem] loaded ${events.length} event(s) for ${min.toDateString()} → ${max.toDateString()}`);
      _publish();
    } catch (err) {
      console.error('[CalendarSystem] fetch failed, keeping cache/placeholder:', err.message);
      _publish(); // still emit so screens can render cache (or their empty state)
    }
  }

  // ---- state / listeners ----------------------------------------------------

  function _todaysEvents() {
    const key = _dateKey(new Date());
    return state.events.filter((e) => e.dateKey === key);
  }

  // Events from the start of today forward (sorted). Used by the Upcoming list
  // and the dashboard's roll-forward agenda.
  function _upcomingEvents(max) {
    const s = _startOfToday();
    const list = state.events.filter((e) => e.start >= s);
    return max ? list.slice(0, max) : list;
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
    return { mode: 'upcoming', list: _upcomingEvents(AGENDA_MAX).map((e) => _toAgendaShape(e, true)) };
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

  // Refetch the currently-loaded range (or the current month if nothing loaded).
  async function _refresh() {
    state.configured = _isConfigured();
    if (!state.configured) {
      console.warn('[CalendarSystem] GOOGLE_CALENDAR_ID / GOOGLE_API_KEY not set — using placeholder agenda. Add them to config.js and make the calendar public.');
      _publish();
      return;
    }
    const now = new Date();
    const from = state.loadedMin || _gridStart(now.getFullYear(), now.getMonth());
    const to = state.loadedMax || _gridEnd(now.getFullYear(), now.getMonth() + 1);
    try {
      const events = await _fetchRange(from, to);
      state.events = events;
      state.loadedMin = from;
      state.loadedMax = to;
      state.fetchedAt = Date.now();
      _cacheSet();
      console.log(`[CalendarSystem] refresh — ${events.length} event(s) in view`);
      _publish();
    } catch (err) {
      console.error('[CalendarSystem] refresh failed, keeping cache/placeholder:', err.message);
      _publish();
    }
  }

  // ---- public API -----------------------------------------------------------

  function getState() {
    return { events: state.events.slice(), configured: state.configured, fetchedAt: state.fetchedAt };
  }
  function getEvents() { return state.events.slice(); }
  function getToday() { return _todaysEvents(); }
  function getUpcoming(max) { return _upcomingEvents(max || 40); }
  function isConfigured() { return state.configured; }

  // Make sure a month's grid (plus the following month, for Upcoming continuity)
  // is loaded, fetching only when it isn't already covered. Safe to call often.
  function ensureMonth(year, month) {
    state.configured = _isConfigured();
    if (!state.configured) { _publish(); return Promise.resolve(); }
    const from = _gridStart(year, month);
    const to = _gridEnd(year, month + 1);
    return _ensureRange(from, to);
  }

  function onUpdate(callback) {
    if (typeof callback === 'function') updateListeners.push(callback);
  }

  function init() {
    const cached = _cacheGet();
    if (cached && cached.events) {
      state.events = cached.events;
      state.fetchedAt = cached.fetchedAt || 0;
      state.loadedMin = cached.loadedMin || null;
      state.loadedMax = cached.loadedMax || null;
    }
    state.configured = _isConfigured();
    if (state.configured && state.events.length) _publish(); // paint cache immediately
    _refresh();                                               // then hit the network
    if (refreshHandle) clearInterval(refreshHandle);
    refreshHandle = setInterval(_refresh, REFRESH_MS);
    console.log('[CalendarSystem] init — refreshing every 10 min');
  }

  return { init, refresh: _refresh, ensureMonth, onUpdate, getState, getEvents, getToday, getUpcoming, isConfigured };
})();

window.CalendarSystem = CalendarSystem;
