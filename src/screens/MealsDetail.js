// MealsDetail.js
// -----------------------------------------------------------------------------
// The Meals tab. Shows tonight's dinner + the week's dinners (from window.MEALS,
// fed by MealsData ← the shared /api/mealplan that The Family Table pushes to),
// plus a button to open The Family Table to edit the plan. Registers as "meals"
// (replacing the placeholder). Re-renders on 'mealsupdated'.
// -----------------------------------------------------------------------------

const MealsDetail = (() => {
  const FT_URL = 'https://familytable.pages.dev';
  let root = null, els = {}, subscribed = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function rowHTML(r) {
    return '<div class="ml-row' + (r.today ? ' is-today' : '') + '">' +
      '<span class="ml-day">' + esc(r.day) + (r.today ? '<span class="ml-today-tag">Today</span>' : '') + '</span>' +
      '<span class="ml-name">' + esc(r.name) + '</span>' +
    '</div>';
  }

  function weekRowsHTML() {
    const m = window.MEALS || {};
    const week = Array.isArray(m.week) ? m.week : [];
    if (week.length) {
      const today = todayStr();
      return week.map((w) => rowHTML({ day: w.day, name: w.name, today: w.date === today })).join('');
    }
    // Fallback to the placeholder shape (tonight + upcoming).
    const rows = [];
    if (m.tonight && m.tonight.name) rows.push({ day: 'Today', name: m.tonight.name, today: true });
    (m.upcoming || []).forEach((u) => rows.push({ day: u.day, name: u.name }));
    if (!rows.length) return '<div class="ml-empty">No meals planned yet — open The Family Table to plan the week.</div>';
    return rows.map(rowHTML).join('');
  }

  function render() {
    if (!els.body) return;
    const m = window.MEALS || {};
    const tonight = (m.tonight && m.tonight.name) || '';
    els.tonight.textContent = tonight || 'No dinner planned tonight';
    els.tonight.classList.toggle('is-empty', !tonight);
    els.body.innerHTML = weekRowsHTML();
  }

  function build() {
    root = document.createElement('div');
    root.className = 'meals-screen';
    root.innerHTML =
      '<div class="ml-inner">' +
        '<div class="ml-head">' +
          '<h1 class="ml-heading">Meals</h1>' +
          '<button type="button" class="ml-ft-btn glass-util" data-ft>Open The Family Table →</button>' +
        '</div>' +
        '<section class="ml-card glass">' +
          '<div class="ml-eyebrow">Tonight’s Dinner</div>' +
          '<div class="ml-tonight" data-tonight>—</div>' +
        '</section>' +
        '<section class="ml-card glass ml-week-card">' +
          '<div class="ml-eyebrow">This Week</div>' +
          '<div class="ml-week" data-body></div>' +
        '</section>' +
      '</div>';
    root.appendChild(NavBar.render('meals'));
    root.insertBefore(Breadcrumb.render('Meals'), root.firstChild);
    els = { tonight: root.querySelector('[data-tonight]'), body: root.querySelector('[data-body]') };
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-ft]')) window.open(FT_URL, '_blank', 'noopener');
    });
  }

  const api = {
    show() {
      if (!root) build();
      const sr = document.getElementById('screen-root');
      if (root.parentNode !== sr) sr.appendChild(root);
      render();
      if (window.MealsData) MealsData.load();   // refresh from the shared plan
      if (!subscribed) {
        window.addEventListener('mealsupdated', () => { if (root && root.isConnected) render(); });
        subscribed = true;
      }
    },
    hide() { if (root && root.parentNode) root.parentNode.removeChild(root); },
  };

  if (typeof Router !== 'undefined') Router.register('meals', api);
  window.MealsDetail = api;
  return api;
})();
