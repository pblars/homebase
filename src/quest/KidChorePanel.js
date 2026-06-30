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

  function kids() { return window.KIDS || []; }
  function kid(id) { return kids().find((k) => k.id === id) || null; }

  function progressOf(k) {
    const st = QuestStore.getChoreState(k.id);
    const total = k.chores.length;
    const done = k.chores.filter((c) => st[c.id]).length;
    return { st, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
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
    const p = progressOf(k);
    const items = k.chores.map((c) =>
      '<button type="button" class="kcp-chip' + (p.st[c.id] ? ' is-done' : '') + '" data-kid="' + k.id + '" data-chore="' + c.id + '">' +
        '<span class="kcp-dot">' + (p.st[c.id] ? ICONS.check : '') + '</span>' + c.name +
      '</button>').join('');
    return (
      '<div class="kcp-kid" data-kid="' + k.id + '">' +
        '<div class="kcp-head">' +
          '<span class="kcp-avatar" style="background:' + k.avatarBg + ';color:' + k.color + '">' + avatarInner(k) + '</span>' +
          '<span class="kcp-name">' + k.name + '</span>' +
          acornChip(k.id) +
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
      '<div class="card-head">' +
        '<span class="card-title"><span class="leaf-mini">' + ICONS.deco.sprig + '</span>Chores</span>' +
        '<button type="button" class="view-all" data-nav="chores">View All</button>' +
      '</div>' +
      '<div class="kcp-list">' + kids().map(kidSummaryHTML).join('') + '</div>';
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

  function kidSectionHTML(k) {
    const p = progressOf(k);
    const rows = k.chores.map((c) =>
      '<button type="button" class="cs-row' + (p.st[c.id] ? ' is-done' : '') + '" data-kid="' + k.id + '" data-chore="' + c.id + '">' +
        '<span class="cs-check">' + (p.st[c.id] ? ICONS.check : '') + '</span>' +
        '<span class="cs-row-body">' +
          '<span class="cs-row-name">' + c.name + '</span>' +
          '<span class="cs-row-desc">' + c.description + '</span>' +
        '</span>' +
        '<span class="cs-freq cs-freq--' + c.frequency.toLowerCase() + '">' + c.frequency + '</span>' +
      '</button>').join('');
    return (
      '<section class="cs-kid" data-kid="' + k.id + '">' +
        '<div class="cs-kid-head">' +
          '<span class="cs-avatar" style="background:' + k.avatarBg + ';color:' + k.color + '">' + avatarInner(k) + '</span>' +
          '<div class="cs-kid-meta">' +
            '<div class="cs-kid-name">' + k.name + '</div>' +
            '<div class="cs-kid-acorns">' + acornChip(k.id) + '<span class="cs-acorn-word">acorns</span></div>' +
          '</div>' +
          '<div class="cs-kid-frac">' + p.done + '/' + p.total + '</div>' +
        '</div>' +
        '<div class="cs-bar"><div class="cs-bar-fill" style="width:' + p.pct + '%;background:' + k.color + '"></div></div>' +
        '<div class="cs-list">' + rows + '</div>' +
      '</section>'
    );
  }

  function renderDetail() {
    if (!detailRoot) return;
    const grid = detailRoot.querySelector('[data-cs-grid]');
    if (grid) grid.innerHTML = kids().map(kidSectionHTML).join('');
  }

  function buildDetail() {
    detailRoot = document.createElement('div');
    detailRoot.className = 'chores-screen';
    detailRoot.innerHTML =
      '<div class="cs-inner">' +
        '<div class="cs-header"><span class="leaf-mini">' + ICONS.deco.leaf + '</span>' +
          '<h1 class="cs-heading">Chores</h1>' +
          '<span class="cs-sub">Tap to check off — earn an acorn each time</span>' +
        '</div>' +
        '<div class="cs-grid" data-cs-grid></div>' +
      '</div>';
    detailRoot.appendChild(NavBar.render('chores'));
    renderDetail();

    detailRoot.addEventListener('click', (e) => {
      const row = e.target.closest('[data-chore]');
      if (row) { QuestStore.toggleChore(row.dataset.kid, row.dataset.chore); }
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

  function refresh() {
    if (document.getElementById('chores-card')) renderSummary();
    if (detailMounted) renderDetail();
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
    if (typeof Router !== 'undefined') Router.register('chores', detailScreen);
  }

  return { init, mountSummary };
})();

window.KidChorePanel = KidChorePanel;
