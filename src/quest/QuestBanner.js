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
  // Trail traced over the painted path in the backdrop's pixel space (the art is
  // 3:2, so viewBox 1512x1008). The SVG is drawn with the SAME cover + bottom
  // anchoring as the background image (preserveAspectRatio "xMidYMax slice" ↔
  // background-position "center bottom"), so these coordinates sit on the painted
  // dirt path and the final point lands on the painted treasure chest at lower
  // right. Eyeball-traced — nudge the control points to fine-tune.
  const TRAIL_D =
    'M250 648 C315 668 315 700 365 708 C475 724 545 736 640 748 ' +
    'C880 766 1080 778 1220 800 C1290 812 1330 822 1365 834';

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
        '<div class="qb-photo" data-photo></div>' +
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
        '<svg class="qb-trail" viewBox="0 0 1512 1008" preserveAspectRatio="xMidYMax slice">' +
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
      photo: c.querySelector('[data-photo]'),
      title: c.querySelector('[data-title]'),
      pills: c.querySelector('[data-pills]'),
      pct: c.querySelector('[data-pct]'),
      fill: c.querySelector('[data-fill]'),
      track: c.querySelector('.qb-track'),
      nodes: c.querySelector('[data-nodes]'),
    };
    // Illustrated backdrop. Try the theme-specific banner first, then the shared
    // questbackground, then (if neither file exists) the CSS meadow gradient shows
    // through. The painted scene already has a signpost + path + chest, so we hide
    // the code signposts and lean on the title + % + trail as the overlay.
    const quest = getCurrentQuest();
    const layers = [];
    if (quest.banner) layers.push("url('assets/quest/" + quest.banner + "')");
    layers.push("url('assets/quest/magical_meadow_with_enchanted_chest.webp')");
    els.photo.style.backgroundImage = layers.join(', ');
    els.scene.classList.add('qb-has-photo');
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
      const cls = 'qb-node' + (isTreasure ? ' qb-node--treasure' : '');
      // Treasure node = a highlight ring sitting on the painted chest (we don't
      // draw a chest — the art provides it). Others get a checkmark when reached.
      const inner = isTreasure ? ''
        : '<path class="qb-node-check" d="M-7 1l5 5 10-12" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
      return (
        '<g class="' + cls + '" data-node="' + i + '" transform="translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')">' +
          '<circle class="qb-node-ring" r="' + (isTreasure ? 26 : 17) + '"/>' +
          inner +
        '</g>'
      );
    }).join('');
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
