// KidChorePanel.js
// -----------------------------------------------------------------------------
// Renders BOTH the dashboard Chores summary card (#chores-card) and the full
// Chores detail screen (registered with the Router as 'chores'). Reads/writes
// completion via QuestStore; shows per-kid acorn balances, animates +1 acorns on
// completion, and bursts confetti on a kid's panel when they finish everything.
// Classic-script global `KidChorePanel`.
//
//   init()          - wire global events + register the 'chores' screen
//   mountSummary()  - render the dashboard summary into #chores-card
// -----------------------------------------------------------------------------

const KidChorePanel = (() => {
  let summaryWired = false;
  let detailRoot = null;     // full-screen container (built lazily)
  let detailMounted = false; // is the detail screen currently shown?
  let managing = false;      // Chores screen "Manage" (add/remove) mode

  function kids() { return window.KIDS || []; }
  function kid(id) { return kids().find((k) => k.id === id) || null; }
  // Only members flagged for the chore board show here (managed in Settings).
  function boardKids() { return kids().filter((k) => k.onBoard !== false); }

  const DAYS = [['Sun', 'Su'], ['Mon', 'Mo'], ['Tue', 'Tu'], ['Wed', 'We'], ['Thu', 'Th'], ['Fri', 'Fr'], ['Sat', 'Sa']];
  let nameIndex = {}; // lowercased chore name -> {name, description, frequency, days} for autocomplete

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  // Badge: a Weekly chore with specific days shows the day(s); otherwise the frequency.
  function choreBadge(c) {
    if (c.frequency === 'Weekly' && c.days) return { text: c.days.split(',').join(', '), cls: 'weekly' };
    return { text: c.frequency || 'Daily', cls: c.frequency === 'Weekly' ? 'weekly' : 'daily' };
  }

  function daysChipsHTML(selected) {
    const sel = new Set(String(selected || '').split(',').filter(Boolean));
    return '<div class="cs-days">' + DAYS.map(([v, l]) =>
      '<label class="cs-day"><input type="checkbox" name="day" value="' + v + '"' + (sel.has(v) ? ' checked' : '') + '>' + l + '</label>'
    ).join('') + '</div>';
  }

  function buildNameIndex() {
    nameIndex = {};
    kids().forEach((k) => (k.chores || []).forEach((c) => {
      const key = (c.name || '').trim().toLowerCase();
      if (key && !nameIndex[key]) {
        nameIndex[key] = { name: c.name, description: c.description || '', frequency: c.frequency || 'Daily', days: c.days || '' };
      }
    }));
  }

  function datalistHTML() {
    const opts = Object.values(nameIndex).map((v) => '<option value="' + esc(v.name) + '"></option>').join('');
    return '<datalist id="chore-name-options">' + opts + '</datalist>';
  }

  function syncFreq(form) {
    if (form && form.frequency) form.classList.toggle('freq-weekly', form.frequency.value === 'Weekly');
  }

  // --- day-of-week awareness -------------------------------------------------
  const DAY_TOKENS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const isDaily = (c) => c.frequency !== 'Weekly';
  const choreDays = (c) => String(c.days || '').split(',').filter(Boolean);
  // Earliest scheduled weekday index for a weekly chore, or -1 if none set.
  function earliestDayIdx(c) {
    const idxs = choreDays(c).map((t) => DAY_TOKENS.indexOf(t)).filter((i) => i >= 0);
    return idxs.length ? Math.min.apply(null, idxs) : -1;
  }
  // Is this chore due today? Daily always; weekly only on its scheduled day(s)
  // (a weekly chore with no days set is treated as due any day so it never
  // silently disappears from the board).
  function dueToday(c) {
    if (isDaily(c)) return true;
    const d = choreDays(c);
    return d.length === 0 || d.indexOf(DAY_TOKENS[new Date().getDay()]) !== -1;
  }
  function todaysChores(k) { return (k.chores || []).filter(dueToday); }

  // Group a kid's chores for the full Chores page: Daily first, then each
  // weekday (Sun→Sat) that has a weekly chore, then any dayless weekly chores.
  // A weekly chore appears once, under its earliest scheduled day.
  function groupChores(chores) {
    const groups = [];
    const daily = chores.filter(isDaily);
    if (daily.length) groups.push({ label: 'Daily', today: false, chores: daily });
    const weekly = chores.filter((c) => !isDaily(c));
    const todayIdx = new Date().getDay();
    for (let wd = 0; wd < 7; wd++) {
      const inDay = weekly.filter((c) => earliestDayIdx(c) === wd);
      if (inDay.length) groups.push({ label: DAY_FULL[wd], today: wd === todayIdx, chores: inDay });
    }
    const noDay = weekly.filter((c) => earliestDayIdx(c) === -1);
    if (noDay.length) groups.push({ label: 'Weekly', today: false, chores: noDay });
    return groups;
  }

  // Completion stats over a chore list (defaults to all the kid's chores).
  function progressOf(k, list) {
    const chores = list || k.chores;
    const st = QuestStore.getChoreState(k.id);
    const total = chores.length;
    const done = chores.filter((c) => st[c.id]).length;
    return { st, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  // One chore row for the full Chores screen (used inside the day groups).
  function choreRowHTML(kidId, c, st) {
    const badge = choreBadge(c);
    return '<div class="cs-row' + (st[c.id] ? ' is-done' : '') + '" role="button" tabindex="0" data-kid="' + kidId + '" data-chore="' + c.id + '">' +
      '<span class="cs-check">' + (st[c.id] ? ICONS.check : '') + '</span>' +
      '<span class="cs-row-body">' +
        '<span class="cs-row-name">' + esc(c.name) + '</span>' +
        '<span class="cs-row-desc">' + esc(c.description) + '</span>' +
      '</span>' +
      '<span class="cs-freq cs-freq--' + badge.cls + '">' + esc(badge.text) + '</span>' +
      '<button type="button" class="cs-del" data-del="' + c.id + '" title="Remove chore" aria-label="Remove chore">&times;</button>' +
    '</div>';
  }

  function acornChip(kidId) {
    return '<span class="acorn-chip" data-acorns="' + kidId + '" title="Lifetime acorns">' +
      ICONS.acorn + '<span class="acorn-num">' + QuestStore.getAcorns(kidId) + '</span></span>';
  }

  // Avatar = initial circle, optionally with an illustrated image on top that
  // removes itself (revealing the initial) if the file is missing.
  function avatarInner(k) {
    return k.initial + (k.avatar
      ? '<img class="avatar-img" src="assets/avatars/' + k.avatar + '" alt="" onerror="this.remove()">'
      : '');
  }

  // ---- dashboard summary ----------------------------------------------------

  function kidSummaryHTML(k) {
    // Dashboard shows only what's due TODAY (daily + weekly scheduled today).
    const today = todaysChores(k);
    const p = progressOf(k, today);
    const items = today.length
      ? today.map((c) =>
          '<button type="button" class="kcp-chip' + (p.st[c.id] ? ' is-done' : '') + '" data-kid="' + k.id + '" data-chore="' + c.id + '">' +
            '<span class="kcp-dot">' + (p.st[c.id] ? ICONS.check : '') + '</span>' + esc(c.name) +
          '</button>').join('')
      : '<div class="kcp-empty">No chores today</div>';
    return (
      '<div class="kcp-kid" data-kid="' + k.id + '">' +
        '<div class="kcp-head">' +
          '<span class="kcp-avatar" style="background:' + k.color + '">' + avatarInner(k) + '</span>' +
          '<span class="kcp-name">' + esc(k.name) + '</span>' +
          '<span class="kcp-frac">' + p.done + '/' + p.total + '</span>' +
        '</div>' +
        '<div class="kcp-bar"><div class="kcp-bar-fill" style="width:' + p.pct + '%;background:' + k.color + '"></div></div>' +
        '<div class="kcp-items">' + items + '</div>' +
      '</div>'
    );
  }

  function renderSummary() {
    const c = document.getElementById('chores-card');
    if (!c) return;
    c.innerHTML =
      '<div class="kcp-head-row"><span class="eyebrow">Chores</span>' +
        '<span class="kcp-hint">tap to check off</span></div>' +
      '<div class="kcp-list">' + boardKids().map(kidSummaryHTML).join('') + '</div>';
  }

  function wireSummary() {
    const c = document.getElementById('chores-card');
    if (!c || summaryWired) return;
    summaryWired = true;
    c.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-chore]');
      if (chip) { QuestStore.toggleChore(chip.dataset.kid, chip.dataset.chore); return; }
      const nav = e.target.closest('[data-nav]');
      if (nav && typeof Router !== 'undefined') Router.show(nav.dataset.nav);
    });
  }

  function mountSummary() {
    wireSummary();
    renderSummary();
  }

  // ---- full chores screen ---------------------------------------------------

  function kidSectionHTML(k, idx, count) {
    const p = progressOf(k);
    // Organized by Daily first, then by weekday in week order (today highlighted).
    // cs-row is a div (not a button) so the Manage-mode delete button can nest.
    const groups = groupChores(k.chores);
    const list = groups.map((g) =>
      '<div class="cs-group' + (g.today ? ' is-today' : '') + '">' +
        '<div class="cs-group-label">' + esc(g.label) +
          (g.today ? '<span class="cs-today-tag">Today</span>' : '') +
        '</div>' +
        g.chores.map((c) => choreRowHTML(k.id, c, p.st)).join('') +
      '</div>').join('');
    const addForm =
      '<form class="cs-add" data-add-kid="' + k.id + '">' +
        '<input class="cs-add-name" name="name" list="chore-name-options" autocomplete="off" placeholder="New chore" maxlength="40" required>' +
        '<input class="cs-add-desc" name="description" placeholder="Description (optional)" maxlength="80">' +
        '<select class="cs-add-freq" name="frequency"><option>Daily</option><option>Weekly</option></select>' +
        daysChipsHTML('') +
        '<button type="submit" class="cs-add-btn">Add</button>' +
        '<button type="button" class="cs-add-cancel" data-add-cancel>Cancel</button>' +
      '</form>';
    // Move arrows (shown in Manage mode) to reorder this card left/right.
    const move =
      '<div class="cs-move">' +
        '<button type="button" class="cs-move-btn" data-move="left" data-kid="' + k.id + '"' + (idx === 0 ? ' disabled' : '') + ' title="Move left" aria-label="Move ' + esc(k.name) + ' left">&#9664;</button>' +
        '<button type="button" class="cs-move-btn" data-move="right" data-kid="' + k.id + '"' + (idx === count - 1 ? ' disabled' : '') + ' title="Move right" aria-label="Move ' + esc(k.name) + ' right">&#9654;</button>' +
      '</div>';
    return (
      '<section class="cs-kid" data-kid="' + k.id + '">' +
        '<div class="cs-kid-head">' +
          move +
          '<span class="cs-avatar" style="background:' + k.avatarBg + ';color:' + k.color + '">' + avatarInner(k) + '</span>' +
          '<div class="cs-kid-meta">' +
            '<div class="cs-kid-name">' + esc(k.name) + '</div>' +
            '<div class="cs-kid-acorns">' + acornChip(k.id) + '<span class="cs-acorn-word">acorns</span></div>' +
          '</div>' +
          '<div class="cs-kid-frac">' + p.done + '/' + p.total + '</div>' +
        '</div>' +
        '<div class="cs-bar"><div class="cs-bar-fill" style="width:' + p.pct + '%;background:' + k.color + '"></div></div>' +
        '<div class="cs-list">' + list + '</div>' +
        '<button type="button" class="cs-addchore" data-add-toggle="' + k.id + '"><span class="cs-plus" aria-hidden="true">+</span>Add chore</button>' +
        addForm +
      '</section>'
    );
  }

  function renderDetail() {
    if (!detailRoot) return;
    const grid = detailRoot.querySelector('[data-cs-grid]');
    if (!grid) return;
    buildNameIndex(); // for the "New chore" name autocomplete + auto-fill
    const board = boardKids();
    grid.innerHTML = datalistHTML() + board.map((k, i) => kidSectionHTML(k, i, board.length)).join('');
  }

  function setManaging(on) {
    managing = on;
    if (!detailRoot) return;
    detailRoot.classList.toggle('cs-managing', managing);
    const btn = detailRoot.querySelector('[data-manage]');
    if (btn) btn.textContent = managing ? 'Done' : 'Manage';
    const sub = detailRoot.querySelector('[data-cs-sub]');
    if (sub) sub.textContent = managing ? 'Add or remove chores' : 'Tap to check off — earn an acorn each time';
  }

  async function addFromForm(form) {
    const name = form.name.value.trim();
    if (!name) return;
    const btn = form.querySelector('.cs-add-btn');
    if (btn) btn.disabled = true;
    const frequency = form.frequency.value;
    const days = frequency === 'Weekly'
      ? Array.from(form.querySelectorAll('input[name="day"]:checked')).map((c) => c.value).join(',')
      : '';
    try {
      await ChoreData.addChore(form.dataset.addKid, {
        name, description: form.description.value.trim(), frequency, days,
      });
      // Close this card's add form and repaint so the new chore shows (the
      // isEditing() guard would otherwise skip the refresh while it's open).
      const section = form.closest('.cs-kid');
      if (section) section.classList.remove('is-adding');
      renderDetail();
    } catch (err) {
      console.error('[KidChorePanel] add failed:', err);
      alert('Could not add the chore. Make sure the chore database is set up.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function removeById(id) {
    try { await ChoreData.removeChore(id); }
    catch (err) { console.error('[KidChorePanel] remove failed:', err); alert('Could not remove the chore.'); }
  }

  function buildDetail() {
    detailRoot = document.createElement('div');
    detailRoot.className = 'chores-screen';
    detailRoot.innerHTML =
      '<div class="cs-inner">' +
        '<div class="cs-header"><span class="leaf-mini">' + ICONS.deco.leaf + '</span>' +
          '<h1 class="cs-heading">Chores</h1>' +
          '<span class="cs-sub" data-cs-sub>Tap to check off — earn an acorn each time</span>' +
          '<button type="button" class="cs-manage" data-manage>Manage</button>' +
        '</div>' +
        '<div class="cs-grid" data-cs-grid></div>' +
      '</div>';
    detailRoot.appendChild(NavBar.render('chores'));
    detailRoot.insertBefore(Breadcrumb.render('Chores'), detailRoot.firstChild);
    renderDetail();

    detailRoot.addEventListener('click', (e) => {
      if (e.target.closest('[data-manage]')) { setManaging(!managing); return; }
      // Reorder a kid card (Manage mode arrows).
      const mv = e.target.closest('[data-move]');
      if (mv) { if (!mv.disabled && window.ChoreData) ChoreData.reorderBoardKid(mv.dataset.kid, mv.dataset.move); return; }
      // Quick add-chore: open/close the inline add form for one card (no Manage).
      const addBtn = e.target.closest('[data-add-toggle]');
      if (addBtn) { openAdd(addBtn.closest('.cs-kid')); return; }
      if (e.target.closest('[data-add-cancel]')) { closeAdd(e.target.closest('.cs-kid')); return; }
      const del = e.target.closest('[data-del]');
      if (del) { removeById(del.dataset.del); return; }
      if (managing) return; // rows don't toggle completion while managing
      const row = e.target.closest('[data-chore]');
      if (row) QuestStore.toggleChore(row.dataset.kid, row.dataset.chore);
    });

    detailRoot.addEventListener('submit', (e) => {
      const choreForm = e.target.closest('[data-add-kid]');
      if (choreForm) { e.preventDefault(); addFromForm(choreForm); }
    });

    // Frequency select toggles the day-picker visibility.
    detailRoot.addEventListener('change', (e) => {
      const sel = e.target.closest('.cs-add-freq');
      if (sel) syncFreq(sel.closest('form'));
    });

    // Typing/picking a known chore name auto-fills its description/frequency/days.
    detailRoot.addEventListener('input', (e) => {
      const input = e.target.closest('.cs-add-name');
      if (!input) return;
      const hit = nameIndex[input.value.trim().toLowerCase()];
      if (!hit) return;
      const form = input.closest('form');
      if (form.description && !form.description.value) form.description.value = hit.description;
      if (form.frequency) { form.frequency.value = hit.frequency; syncFreq(form); }
      const set = new Set(String(hit.days || '').split(',').filter(Boolean));
      form.querySelectorAll('input[name="day"]').forEach((cb) => { cb.checked = set.has(cb.value); });
    });
  }

  const detailScreen = {
    show() {
      if (!detailRoot) buildDetail();
      const sr = document.getElementById('screen-root');
      if (detailRoot.parentNode !== sr) sr.appendChild(detailRoot);
      detailMounted = true;
      renderDetail();
    },
    hide() {
      detailMounted = false;
      if (detailRoot && detailRoot.parentNode) detailRoot.parentNode.removeChild(detailRoot);
    },
  };

  // ---- shared update + effects ----------------------------------------------

  // Open/close a single card's inline add-chore form (independent of Manage mode).
  function openAdd(section) {
    if (!section) return;
    section.classList.add('is-adding');
    const input = section.querySelector('.cs-add-name');
    if (input) input.focus();
  }
  function closeAdd(section) {
    if (section) section.classList.remove('is-adding');
  }

  // True while someone is mid-add (form open or an add field focused) — used to
  // avoid rebuilding the grid out from under them on a background refresh.
  function isEditing() {
    if (!detailRoot) return false;
    if (detailRoot.querySelector('.cs-kid.is-adding')) return true;
    const a = document.activeElement;
    return !!(a && detailRoot.contains(a) && a.matches('input, select'));
  }

  function refresh() {
    if (document.getElementById('chores-card')) renderSummary();
    if (detailMounted && !isEditing()) renderDetail();
  }

  function _acornTargets(kidId) {
    const out = [];
    document.querySelectorAll('[data-acorns="' + kidId + '"]').forEach((el) => {
      if (el.isConnected) out.push(el);
    });
    return out;
  }

  function _confetti(kidId) {
    document.querySelectorAll('.kcp-kid[data-kid="' + kidId + '"], .cs-kid[data-kid="' + kidId + '"]').forEach((panel) => {
      if (!panel.isConnected) return;
      panel.classList.add('confetti-host');
      const colors = ['#6bbf73', '#5b9bd5', '#a47fd0', '#f4c430', '#e2745f'];
      for (let i = 0; i < 16; i++) {
        const c = document.createElement('span');
        c.className = 'confetti-bit';
        c.style.left = (10 + Math.random() * 80) + '%';
        c.style.background = colors[i % colors.length];
        c.style.setProperty('--cx', (Math.random() * 80 - 40).toFixed(0) + 'px');
        c.style.animationDelay = (Math.random() * 0.2).toFixed(2) + 's';
        panel.appendChild(c);
        const node = c;
        setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node); }, 1400);
      }
    });
  }

  function _onChoreUpdate(e) {
    const d = (e && e.detail) || {};
    refresh();
    if (d.done && d.kidId) {
      _acornTargets(d.kidId).forEach((el) => AcornAnimation.play(el));
      if (QuestStore.isKidComplete(d.kidId)) _confetti(d.kidId);
    }
  }

  function init() {
    window.addEventListener('choreupdate', _onChoreUpdate);
    window.addEventListener('weekreset', refresh);
    window.addEventListener('choresupdated', refresh); // chore definitions changed (D1)
    if (typeof Router !== 'undefined') Router.register('chores', detailScreen);
  }

  return { init, mountSummary };
})();

window.KidChorePanel = KidChorePanel;
