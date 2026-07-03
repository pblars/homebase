// AddEventDialog.js
// -----------------------------------------------------------------------------
// A frosted-glass modal for adding an event to the family Google Calendar.
// Posts through CalendarSystem.createEvent() → /api/calendar (service-account
// write). On success the calendar refetches and re-renders itself, so we just
// close. Exposed as the global `AddEventDialog` with `.open(prefillDateKey?)`.
// -----------------------------------------------------------------------------

const AddEventDialog = (() => {
  let root = null;
  let els = {};

  function _pad(n) { return String(n).padStart(2, '0'); }
  function _todayValue() {
    const n = new Date();
    return `${n.getFullYear()}-${_pad(n.getMonth() + 1)}-${_pad(n.getDate())}`;
  }
  // Sensible default: the next full hour, one-hour block, clamped to end-of-day.
  function _defaultTimes() {
    const n = new Date();
    let h = Math.min(n.getHours() + 1, 23);
    const start = `${_pad(h)}:00`;
    const end = `${_pad(Math.min(h + 1, 23))}:00`;
    return { start, end };
  }

  function _esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function _syncAllDay() {
    const on = els.allday.checked;
    els.timeRow.style.display = on ? 'none' : '';
  }

  function _showError(msg) {
    els.err.textContent = msg;
    els.err.hidden = !msg;
  }

  function _setBusy(busy) {
    els.save.disabled = busy;
    els.cancel.disabled = busy;
    els.save.textContent = busy ? 'Adding…' : 'Add Event';
  }

  async function _submit(e) {
    e.preventDefault();
    _showError('');
    const title = els.title.value.trim();
    const date = els.date.value;
    const allDay = els.allday.checked;
    if (!title) { _showError('Please enter a title.'); els.title.focus(); return; }
    if (!date) { _showError('Please pick a date.'); els.date.focus(); return; }

    const payload = { title, location: els.loc.value.trim(), allDay, date };
    if (!allDay) {
      if (!els.start.value) { _showError('Please pick a start time (or choose All day).'); els.start.focus(); return; }
      payload.startTime = els.start.value;
      if (els.end.value) payload.endTime = els.end.value;
    }

    _setBusy(true);
    try {
      await CalendarSystem.createEvent(payload);
      close();
    } catch (err) {
      _showError(err.message || 'Something went wrong adding the event.');
    } finally {
      _setBusy(false);
    }
  }

  function build() {
    root = document.createElement('div');
    root.className = 'aed-backdrop';
    root.setAttribute('hidden', '');
    root.innerHTML =
      '<div class="aed-card glass" role="dialog" aria-modal="true" aria-label="Add event">' +
        '<div class="aed-head">' +
          '<div class="aed-title">Add Event</div>' +
          '<button type="button" class="aed-close" data-close aria-label="Close">&times;</button>' +
        '</div>' +
        '<form class="aed-form" data-form novalidate>' +
          '<label class="aed-field">' +
            '<span class="aed-flabel">Title</span>' +
            '<input class="aed-input" data-title type="text" maxlength="200" placeholder="e.g. Soccer Practice" />' +
          '</label>' +
          '<label class="aed-field">' +
            '<span class="aed-flabel">Location <span class="aed-opt">optional</span></span>' +
            '<input class="aed-input" data-loc type="text" maxlength="300" placeholder="e.g. City Park" />' +
          '</label>' +
          '<label class="aed-check"><input type="checkbox" data-allday /><span>All day</span></label>' +
          '<div class="aed-row">' +
            '<label class="aed-field aed-grow">' +
              '<span class="aed-flabel">Date</span>' +
              '<input class="aed-input" data-date type="date" />' +
            '</label>' +
            '<div class="aed-row aed-timerow" data-timerow>' +
              '<label class="aed-field">' +
                '<span class="aed-flabel">Start</span>' +
                '<input class="aed-input" data-start type="time" />' +
              '</label>' +
              '<label class="aed-field">' +
                '<span class="aed-flabel">End</span>' +
                '<input class="aed-input" data-end type="time" />' +
              '</label>' +
            '</div>' +
          '</div>' +
          '<div class="aed-err" data-err hidden></div>' +
          '<div class="aed-actions">' +
            '<button type="button" class="aed-btn aed-btn--ghost" data-cancel>Cancel</button>' +
            '<button type="submit" class="aed-btn aed-btn--primary" data-save>Add Event</button>' +
          '</div>' +
        '</form>' +
      '</div>';

    els = {
      card: root.querySelector('.aed-card'),
      form: root.querySelector('[data-form]'),
      title: root.querySelector('[data-title]'),
      loc: root.querySelector('[data-loc]'),
      allday: root.querySelector('[data-allday]'),
      date: root.querySelector('[data-date]'),
      start: root.querySelector('[data-start]'),
      end: root.querySelector('[data-end]'),
      timeRow: root.querySelector('[data-timerow]'),
      err: root.querySelector('[data-err]'),
      save: root.querySelector('[data-save]'),
      cancel: root.querySelector('[data-cancel]'),
    };

    els.form.addEventListener('submit', _submit);
    els.allday.addEventListener('change', _syncAllDay);
    els.cancel.addEventListener('click', close);
    root.querySelector('[data-close]').addEventListener('click', close);
    // Click the dim backdrop (but not the card) to dismiss.
    root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hasAttribute('hidden')) close(); });

    document.body.appendChild(root);
  }

  function open(prefillDateKey) {
    if (!root) build();
    _showError('');
    _setBusy(false);
    els.title.value = '';
    els.loc.value = '';
    els.allday.checked = false;
    els.date.value = prefillDateKey || _todayValue();
    const t = _defaultTimes();
    els.start.value = t.start;
    els.end.value = t.end;
    _syncAllDay();
    root.removeAttribute('hidden');
    setTimeout(() => els.title.focus(), 0);
  }

  function close() {
    if (root) root.setAttribute('hidden', '');
  }

  const api = { open, close };
  window.AddEventDialog = api;
  return api;
})();
