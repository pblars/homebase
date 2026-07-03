// CalendarDetail.js
// -----------------------------------------------------------------------------
// The Calendar tab — a two-pane month view over the sky, styled as frosted glass:
//   • LEFT  — a full month grid (weekday header + 6-week day cells with event
//             chips; today is circled). Prev/Today/Next navigate months.
//   • RIGHT — an "Upcoming" list from today forward, grouped by day.
// Reads CalendarSystem (public Google Calendar) and re-renders on
// `calendarupdate`. Registers with the Router as "calendar".
// -----------------------------------------------------------------------------

const CalendarDetail = (() => {
  const WEEKDAYS_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const CELLS = 42;          // 6 weeks
  const CHIPS_PER_CELL = 3;  // event chips shown before "+N more"

  let root = null;
  let els = {};
  let subscribed = false;
  let view = null;           // { year, month } currently displayed on the grid

  function _dateKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
  function _esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function _gridStart(year, month) {
    const first = new Date(year, month, 1);
    return new Date(year, month, 1 - first.getDay());
  }

  // Group a flat, start-sorted event list by dateKey → array of events.
  function _byDay(events) {
    const map = new Map();
    events.forEach((e) => {
      if (!map.has(e.dateKey)) map.set(e.dateKey, []);
      map.get(e.dateKey).push(e);
    });
    return map;
  }

  // ---- month grid (left) ----------------------------------------------------

  function chipHTML(e) {
    return (
      '<span class="cal-chip cal-chip--' + e.period + '">' +
        '<span class="cal-chip-dot"></span>' +
        '<span class="cal-chip-txt">' + _esc(e.title) + '</span>' +
      '</span>'
    );
  }

  function cellHTML(d, byDay, todayKey) {
    const inMonth = d.getMonth() === view.month;
    const isToday = _dateKey(d) === todayKey;
    const evs = byDay.get(_dateKey(d)) || [];
    const shown = evs.slice(0, CHIPS_PER_CELL);
    const overflow = evs.length - shown.length;
    const chips = shown.map(chipHTML).join('') +
      (overflow > 0 ? '<span class="cal-chip-more">+' + overflow + ' more</span>' : '');
    return (
      '<div class="cal-cell' + (inMonth ? '' : ' cal-cell--out') + (isToday ? ' cal-cell--today' : '') + '">' +
        '<div class="cal-cell-num">' + d.getDate() + '</div>' +
        '<div class="cal-cell-evs">' + chips + '</div>' +
      '</div>'
    );
  }

  function renderMonth() {
    if (!els.grid) return;
    els.mtitle.textContent = MONTHS_FULL[view.month] + ' ' + view.year;
    const byDay = _byDay(CalendarSystem.getEvents());
    const todayKey = _dateKey(new Date());
    const start = _gridStart(view.year, view.month);
    let html = '';
    for (let i = 0; i < CELLS; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      html += cellHTML(d, byDay, todayKey);
    }
    els.grid.innerHTML = html;
  }

  // ---- upcoming list (right) ------------------------------------------------

  // 'Today' / 'Tomorrow' for the next two days, else '' (weekday+date is used).
  function _relWord(d) {
    const today = new Date();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - t0) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return '';
  }

  function dayHeaderHTML(d) {
    const full = WEEKDAYS_FULL[d.getDay()] + ', ' + MONTHS_FULL[d.getMonth()] + ' ' + d.getDate();
    const rel = _relWord(d);
    if (rel) {
      return '<div class="cal-up-day"><span class="cal-up-rel">' + rel + '</span>' +
             '<span class="cal-up-date">• ' + full + '</span></div>';
    }
    return '<div class="cal-up-day"><span class="cal-up-rel">' + full + '</span></div>';
  }

  function upEventHTML(e) {
    const timeLabel = e.allDay ? 'All Day' : e.time + (e.ampm ? ' ' + e.ampm : '');
    const loc = e.sub ? '<div class="cal-up-loc">' + _esc(e.sub) + '</div>' : '';
    return (
      '<div class="cal-up-ev">' +
        '<div class="cal-up-dot cal-up-dot--' + e.period + '"></div>' +
        '<div class="cal-up-time">' + _esc(timeLabel) + '</div>' +
        '<div class="cal-up-body">' +
          '<div class="cal-up-title">' + _esc(e.title) + '</div>' + loc +
        '</div>' +
      '</div>'
    );
  }

  function renderUpcoming() {
    if (!els.up) return;
    const events = CalendarSystem.getUpcoming(40);
    if (!events.length) {
      const msg = CalendarSystem.isConfigured()
        ? 'Nothing on the calendar for the weeks ahead.'
        : 'Add GOOGLE_CALENDAR_ID + GOOGLE_API_KEY to config.js and make the calendar public to see events here.';
      els.up.innerHTML = '<div class="cal-up-empty">' + _esc(msg) + '</div>';
      return;
    }
    const byDay = _byDay(events);
    let html = '';
    byDay.forEach((list) => {
      html += dayHeaderHTML(list[0].start) + list.map(upEventHTML).join('');
    });
    els.up.innerHTML = html;
  }

  function render() { renderMonth(); renderUpcoming(); }

  // ---- month navigation -----------------------------------------------------

  function _go(deltaMonths) {
    let m = view.month + deltaMonths;
    const y = view.year + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    view = { year: y, month: m };
    CalendarSystem.ensureMonth(view.year, view.month); // async; calendarupdate re-renders on arrival
    render();
  }
  function _goToday() {
    const n = new Date();
    view = { year: n.getFullYear(), month: n.getMonth() };
    CalendarSystem.ensureMonth(view.year, view.month);
    render();
  }

  // ---- build / lifecycle ----------------------------------------------------

  function build() {
    root = document.createElement('div');
    root.className = 'calendar-screen';
    root.innerHTML =
      '<div class="cal-main">' +
        '<section class="cal-month glass">' +
          '<header class="cal-mhead">' +
            '<button class="cal-navbtn" data-prev type="button" aria-label="Previous month">‹</button>' +
            '<div class="cal-mtitle" data-mtitle></div>' +
            '<div class="cal-mhead-right">' +
              '<button class="cal-today" data-today type="button">Today</button>' +
              '<button class="cal-navbtn" data-next type="button" aria-label="Next month">›</button>' +
            '</div>' +
          '</header>' +
          '<div class="cal-weekdays">' +
            WEEKDAYS_ABBR.map((w) => '<span>' + w + '</span>').join('') +
          '</div>' +
          '<div class="cal-grid" data-grid></div>' +
        '</section>' +
        '<aside class="cal-up glass">' +
          '<div class="cal-up-head">Upcoming</div>' +
          '<div class="cal-up-scroll" data-up></div>' +
        '</aside>' +
      '</div>';
    root.appendChild(NavBar.render('calendar'));

    els = {
      mtitle: root.querySelector('[data-mtitle]'),
      grid: root.querySelector('[data-grid]'),
      up: root.querySelector('[data-up]'),
    };
    root.querySelector('[data-prev]').addEventListener('click', () => _go(-1));
    root.querySelector('[data-next]').addEventListener('click', () => _go(1));
    root.querySelector('[data-today]').addEventListener('click', _goToday);
  }

  function show() {
    if (!root) build();
    const n = new Date();
    view = { year: n.getFullYear(), month: n.getMonth() }; // always open on the current month
    const sr = document.getElementById('screen-root');
    if (root.parentNode !== sr) sr.appendChild(root);
    CalendarSystem.ensureMonth(view.year, view.month);
    render();
    if (!subscribed) {
      CalendarSystem.onUpdate(() => { if (root && root.isConnected) render(); });
      subscribed = true;
    }
  }

  function hide() {
    if (root && root.parentNode) root.parentNode.removeChild(root);
  }

  const api = { show, hide };
  if (typeof Router !== 'undefined') Router.register('calendar', api);
  window.CalendarDetail = api;
  return api;
})();
