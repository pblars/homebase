// FamilyGlowJarsCard.js
// -----------------------------------------------------------------------------
// Renders the dashboard "Family Glow Jars" panel into #glowjars-card. Each child
// on the chore board gets a small glass jar of glowing lightning bugs, their
// avatar/initial + name in their accent color, a bug count, and +/- controls.
// Four kids lay out in a 2x2 grid. State lives in GlowJarStore (week-keyed, resets
// on the same 'weekreset' cadence as chores). Classic-script global.
//
// Component breakdown (all pure HTML builders here — one card, one file):
//   FamilyGlowJarsCard.mount() - render the panel + wire controls (idempotent)
//   jarHTML(k)                 - one child's GlowJar (avatar, name, jar, controls)
//   jarIllustrationHTML(count) - the JarIllustration + FireflyCluster inside it
// -----------------------------------------------------------------------------

const FamilyGlowJarsCard = (() => {
  let wired = false;

  function kids() { return window.KIDS || []; }
  // Only members flagged for the chore board (same rule as the chores panel).
  function boardKids() { return kids().filter((k) => k.onBoard !== false); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  // Reuse the chores-panel avatar pattern: initial circle + optional art on top.
  function avatarInner(k) {
    return k.initial + (k.avatar
      ? '<img class="avatar-img" src="assets/avatars/' + esc(k.avatar) + '" alt="" onerror="this.remove()">'
      : '');
  }

  // FireflyCluster — up to 10 glowing bugs shown inside the jar (the count can go
  // higher; the numeric badge carries the true total). Fixed positions + per-bug
  // pulse delay keep it lively but cheap (no per-frame JS, no randomness).
  // Positions (%, within the jar box) tuned to the glass body of bugjar.png —
  // below the neck, above the base — so bugs float inside the jar, not on the
  // lid or outside the glass.
  const FIREFLY_SLOTS = [
    [40, 80], [60, 82], [50, 66], [32, 60], [68, 58],
    [44, 50], [56, 49], [36, 72], [64, 72], [50, 43],
  ];
  function fireflyClusterHTML(count) {
    const shown = Math.min(count, FIREFLY_SLOTS.length);
    let bugs = '';
    for (let i = 0; i < shown; i++) {
      const [x, y] = FIREFLY_SLOTS[i];
      bugs += '<span class="gj-bug" style="left:' + x + '%;top:' + y + '%;animation-delay:' +
        (i * 0.37).toFixed(2) + 's"></span>';
    }
    return '<span class="gj-swarm">' + bugs + '</span>';
  }

  // JarIllustration — the photoreal mason jar asset (assets/rewards/bugjar.png)
  // over a warm glow + the firefly cluster, so the bugs glow THROUGH the
  // translucent glass and the painted highlights/lid sit on top. The glow
  // strengthens as the jar fills.
  function jarIllustrationHTML(count, accent) {
    const glow = Math.min(0.14 + count * 0.05, 0.6);
    return (
      '<span class="gj-jar' + (count > 0 ? ' is-lit' : '') + '" style="--gj-accent:' + accent + '">' +
        '<span class="gj-jar-glow" style="opacity:' + glow.toFixed(2) + '"></span>' +
        fireflyClusterHTML(count) +
        '<img class="gj-jar-img" src="assets/rewards/bugjar.webp" alt="" aria-hidden="true">' +
      '</span>'
    );
  }

  // GlowJar — one child's tile: avatar + name, the jar, count, and +/- controls.
  function jarHTML(k) {
    const count = GlowJarStore.getCount(k.id);
    return (
      '<div class="gj-child" style="--gj-accent:' + k.color + '" data-child="' + esc(k.id) + '">' +
        '<div class="gj-child-head">' +
          '<span class="gj-avatar" style="background:' + k.color + '">' + avatarInner(k) + '</span>' +
          '<span class="gj-name">' + esc(k.name) + '</span>' +
        '</div>' +
        jarIllustrationHTML(count, k.color) +
        '<div class="gj-controls">' +
          '<button type="button" class="gj-btn gj-minus" data-glow="remove" data-child="' + esc(k.id) + '"' +
            (count === 0 ? ' disabled' : '') + ' aria-label="Remove a firefly from ' + esc(k.name) + '\'s jar">&minus;</button>' +
          '<span class="gj-count" data-count="' + esc(k.id) + '">' + count + '</span>' +
          '<button type="button" class="gj-btn gj-plus" data-glow="add" data-child="' + esc(k.id) + '"' +
            ' aria-label="Add a firefly to ' + esc(k.name) + '\'s jar">+</button>' +
        '</div>' +
      '</div>'
    );
  }

  function render() {
    const c = document.getElementById('glowjars-card');
    if (!c) return;
    c.innerHTML =
      '<div class="gj-head-row"><span class="eyebrow">Family Glow Jars</span>' +
        '<span class="gj-hint">catch a bug for a kind deed</span></div>' +
      '<div class="gj-grid">' + boardKids().map(jarHTML).join('') + '</div>';
  }

  function wire() {
    const c = document.getElementById('glowjars-card');
    if (!c || wired) return;
    wired = true;
    c.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-glow]');
      if (!btn || btn.disabled) return;
      if (btn.dataset.glow === 'add') GlowJarStore.addGlowBug(btn.dataset.child);
      else GlowJarStore.removeGlowBug(btn.dataset.child);
    });
    // Repaint on any state change (own taps, or the weekly reset cadence).
    window.addEventListener('glowjarupdate', () => { if (document.getElementById('glowjars-card')) render(); });
    window.addEventListener('weekreset', () => GlowJarStore.resetGlowJarsForWeek());
    window.addEventListener('choresupdated', () => { if (document.getElementById('glowjars-card')) render(); });
  }

  function mount() { wire(); render(); }

  return { mount };
})();

window.FamilyGlowJarsCard = FamilyGlowJarsCard;
