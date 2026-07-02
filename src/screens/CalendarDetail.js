// CalendarDetail.js
// -----------------------------------------------------------------------------
// The Calendar tab — a scrollable list of upcoming events grouped by day
// (Today / Tomorrow / weekday) over the sky, styled as a frosted-glass card.
// Reads CalendarSystem (public Google Calendar) and re-renders on
// `calendarupdate`. Registers with the Router as "calendar".
// -----------------------------------------------------------------------------

const CalendarDetail = (() => {
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let root = null;
  let els = {};
  let subscribed = false;

  function _dateKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

  // "Today" / "Tomorrow" / weekday name for a day group.
  function _dayLabel(d) {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (_dateKey(d) === _dateKey(today)) return 'Today';
    if (_dateKey(d) === _dateKey(tomorrow)) return 'Tomorrow';
    return WEEKDAYS[d.getDay()];
  }

  function _esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function eventRowHTML(e) {
    const timeLabel = e.allDay ? 'All Day' : e.time + (e.ampm ? ' ' + e.ampm : '');
    const loc = e.sub ? '<div class="cal-ev-loc">' + _esc(e.sub) + '</div>' : '';
    return (
      '<div class="cal-ev cal-ev--' + e.period + '">' +
        '<div class="cal-ev-time">' + _esc(timeLabel) + '</div>' +
        '<div class="cal-ev-dot"></div>' +
        '<div class="cal-ev-body">' +
          '<div class="cal-ev-title">' + _esc(e.title) + '</div>' + loc +
        '</div>' +
      '</div>'
    );
  }

  // Group the flat event list into ordered day buckets.
  function groupsHTML(events) {
    if (!events.length) {
      const msg = CalendarSystem.isConfigured()
        ? 'Nothing on the calendar for the next two weeks.'
        : 'Add GOOGLE_CALENDAR_ID + GOOGLE_API_KEY to config.js and make the calendar public to see events here.';
      return '<div class="cal-empty">' + _esc(msg) + '</div>';
    }

    const order = [];
    const byKey = new Map();
    events.forEach((e) => {
      const k = e.dateKey;
      if (!byKey.has(k)) { byKey.set(k, []); order.push({ key: k, date: e.start }); }
      byKey.get(k).push(e);
    });

    return order.map((g) => {
      const d = g.date;
      const rows = byKey.get(g.key).map(eventRowHTML).join('');
      return (
        '<section class="cal-day">' +
          '<div class="cal-day-head">' +
            '<span class="cal-day-name">' + _dayLabel(d) + '</span>' +
            '<span class="cal-day-date">' + MONTHS[d.getMonth()] + ' ' + d.getDate() + '</span>' +
          '</div>' +
          '<div class="cal-events">' + rows + '</div>' +
        '</section>'
      );
    }).join('');
  }

  function render() {
    if (!els.scroll) return;
    els.scroll.innerHTML = groupsHTML(CalendarSystem.getEvents());
  }

  function build() {
    root = document.createElement('div');
    root.className = 'calendar-screen';
    root.innerHTML =
      '<div class="cal-inner glass">' +
        '<div class="cal-header">' +
          '<div class="cal-title">Calendar</div>' +
          '<div class="cal-sub">Next two weeks</div>' +
        '</div>' +
        '<div class="cal-scroll" data-cal-scroll></div>' +
      '</div>';
    root.appendChild(NavBar.render('calendar'));
    els = { scroll: root.querySelector('[data-cal-scroll]') };
  }

  function show() {
    if (!root) build();
    const sr = document.getElementById('screen-root');
    if (root.parentNode !== sr) sr.appendChild(root);
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
