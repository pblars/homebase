// QuestBanner.js
// -----------------------------------------------------------------------------
// Renders the family-adventure quest banner into the dashboard slot
// `#quest-banner-card`. Shows the week's quest name, theme pills, signposts, the
// big percentage, and an animated SVG trail with 6 waypoints (start + 4 +
// treasure chest). Classic-script global `QuestBanner`.
//
//   init()  - wire event listeners once (idempotent on data changes)
//   mount() - render into the slot + paint current state (call when the
//             dashboard becomes visible, since the slot only exists then)
// -----------------------------------------------------------------------------

const QuestBanner = (() => {
  const NODE_FRACTIONS = [0, 0.2, 0.4, 0.6, 0.8, 1];
  // A gentle meandering trail path in a 600x80 viewBox.
  const TRAIL_D = 'M22 60 C150 8 235 72 320 42 C402 13 470 8 578 30';

  let els = {};
  let trailLength = 0;
  let nodePoints = [];

  function container() { return document.getElementById('quest-banner-card'); }
  function isMounted() { return !!els.scene && els.scene.isConnected; }

  function init() {
    window.addEventListener('questupdate', (e) => {
      if (isMounted()) update(e.detail || QuestStore.getFamilyProgress(), getCurrentQuest());
    });
    window.addEventListener('weekreset', () => {
      if (isMounted()) { mount(); }
    });
  }

  function template(quest) {
    const pills = (quest.theme || []).map((t) => '<span class="qb-pill">' + t + '</span>').join('');
    const signposts = (quest.theme || []).map((t, i) =>
      '<span class="qb-signpost qb-signpost--' + i + '">' + t + '</span>').join('');
    return (
      '<div class="qb-scene">' +
        '<div class="qb-signposts">' + signposts + '</div>' +
        '<div class="qb-center">' +
          '<div class="qb-kicker">Our Family Adventure</div>' +
          '<div class="qb-title" data-title>' + quest.questName + '</div>' +
          '<div class="qb-pills" data-pills>' + pills + '</div>' +
        '</div>' +
        '<div class="qb-progress">' +
          '<div class="qb-pct" data-pct>0%</div>' +
          '<div class="qb-pct-label">of the way there!</div>' +
        '</div>' +
        '<svg class="qb-trail" viewBox="0 0 600 80" preserveAspectRatio="xMidYMax meet">' +
          '<path class="qb-track" d="' + TRAIL_D + '"/>' +
          '<path class="qb-fill" data-fill d="' + TRAIL_D + '"/>' +
          '<g class="qb-nodes" data-nodes></g>' +
        '</svg>' +
      '</div>'
    );
  }

  function mount() {
    const c = container();
    if (!c) { els = {}; return; }
    c.innerHTML = template(getCurrentQuest());
    els = {
      scene: c.querySelector('.qb-scene'),
      title: c.querySelector('[data-title]'),
      pills: c.querySelector('[data-pills]'),
      pct: c.querySelector('[data-pct]'),
      fill: c.querySelector('[data-fill]'),
      track: c.querySelector('.qb-track'),
      nodes: c.querySelector('[data-nodes]'),
    };
    _buildTrail();
    update(QuestStore.getFamilyProgress(), getCurrentQuest());
  }

  function _buildTrail() {
    trailLength = els.track.getTotalLength();
    els.fill.style.strokeDasharray = trailLength;
    els.fill.style.strokeDashoffset = trailLength; // start empty (no transition yet)
    nodePoints = NODE_FRACTIONS.map((f) => els.track.getPointAtLength(trailLength * f));

    els.nodes.innerHTML = nodePoints.map((p, i) => {
      const isTreasure = i === NODE_FRACTIONS.length - 1;
      const inner = isTreasure
        ? _chestGlyph()
        : '<path class="qb-node-check" d="M-3.6 0l2.6 2.6 4.4-5" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
      return (
        '<g class="qb-node" data-node="' + i + '" transform="translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')">' +
          '<circle class="qb-node-ring" r="' + (isTreasure ? 15 : 11) + '"/>' +
          inner +
        '</g>'
      );
    }).join('');
  }

  // Small treasure-chest glyph drawn around the node origin.
  function _chestGlyph() {
    return (
      '<g class="qb-chest" transform="translate(-9 -8)">' +
        '<rect x="0" y="6" width="18" height="11" rx="1.5" fill="#8B5E3C" stroke="#5C3D1E" stroke-width="1"/>' +
        '<path d="M0 7a9 5 0 0 1 18 0z" fill="#a06a42" stroke="#5C3D1E" stroke-width="1"/>' +
        '<rect x="0" y="9" width="18" height="2.4" fill="#C8902A" stroke="#8B6914" stroke-width="0.5"/>' +
        '<rect x="7.5" y="9.5" width="3" height="4" rx="0.6" fill="#C8902A" stroke="#8B6914" stroke-width="0.5"/>' +
      '</g>'
    );
  }

  function update(progress, quest) {
    if (!isMounted()) return;
    const pct = Math.max(0, Math.min(100, progress.percentage || 0));

    els.pct.textContent = pct + '%';
    if (quest) {
      els.title.textContent = quest.questName;
      els.pills.innerHTML = (quest.theme || []).map((t) => '<span class="qb-pill">' + t + '</span>').join('');
    }

    // Animate the colored fill (CSS transitions stroke-dashoffset).
    els.fill.style.strokeDashoffset = trailLength * (1 - pct / 100);

    // Waypoint states.
    const nodes = els.nodes.querySelectorAll('.qb-node');
    nodes.forEach((n, i) => {
      const nodePct = i * 20;
      const reached = pct >= nodePct;
      const current = i === progress.currentWaypoint && pct < 100;
      n.classList.toggle('is-reached', reached);
      n.classList.toggle('is-current', current);
      n.classList.toggle('is-future', !reached);
    });
  }

  return { init, mount, update };
})();

window.QuestBanner = QuestBanner;
