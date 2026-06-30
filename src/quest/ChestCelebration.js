// ChestCelebration.js
// -----------------------------------------------------------------------------
// Full-screen celebration when the family quest hits 100%. A treasure chest
// swings open, coins burst out, the quest name + reward are revealed, and the
// theme words float in. Never auto-dismisses — the family dismisses it together,
// which marks it shown so it won't replay on reload. Classic-script global.
// -----------------------------------------------------------------------------

const ChestCelebration = (() => {
  let overlay = null;

  function init() {
    window.addEventListener('chestopen', (e) => show((e && e.detail) || {}));
  }

  function chestSVG() {
    return (
      '<svg class="chest-svg" viewBox="0 0 120 100" aria-hidden="true">' +
        '<g class="chest-body">' +
          '<path d="M20 47 h80 v36 a6 6 0 0 1 -6 6 H26 a6 6 0 0 1 -6 -6 z" fill="#8B5E3C" stroke="#5C3D1E" stroke-width="2"/>' +
          '<rect x="20" y="58" width="80" height="9" fill="#C8902A" stroke="#8B6914" stroke-width="1.5"/>' +
          '<circle cx="26" cy="62.5" r="1.4" fill="#8B6914"/><circle cx="94" cy="62.5" r="1.4" fill="#8B6914"/>' +
          '<rect x="54" y="60" width="12" height="14" rx="2" fill="#C8902A" stroke="#8B6914" stroke-width="1.5"/>' +
          '<circle cx="60" cy="66" r="2" fill="#5C3D1E"/>' +
        '</g>' +
        '<g class="chest-lid">' +
          '<path d="M18 47 a42 26 0 0 1 84 0 z" fill="#a06a42" stroke="#5C3D1E" stroke-width="2"/>' +
          '<rect x="20" y="41" width="80" height="7" fill="#C8902A" stroke="#8B6914" stroke-width="1.2"/>' +
        '</g>' +
      '</svg>'
    );
  }

  function show(detail) {
    if (overlay) return; // already up
    const quest = detail.quest || getCurrentQuest();

    overlay = document.createElement('div');
    overlay.className = 'chest-overlay';
    overlay.innerHTML =
      '<div class="chest-stage">' +
        '<div class="chest-wrap">' +
          '<div class="chest-glow"></div>' +
          chestSVG() +
          '<div class="coin-layer" data-coins></div>' +
        '</div>' +
        '<div class="chest-text">' +
          '<div class="chest-quest">' + quest.questName + ' Complete!</div>' +
          '<div class="chest-reward-kicker">🎉 Your reward:</div>' +
          '<div class="chest-reward">' + quest.reward + '</div>' +
          '<div class="chest-themes" data-themes>' +
            (quest.theme || []).map((t, i) =>
              '<span class="chest-theme" style="animation-delay:' + (1.1 + i * 0.25).toFixed(2) + 's">' + t + '</span>').join('') +
          '</div>' +
        '</div>' +
        '<div class="chest-actions">' +
          '<button type="button" class="chest-btn chest-btn--primary" data-act="celebrate">Celebrate!</button>' +
          '<button type="button" class="chest-btn" data-act="trail">See the Trail</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const goTrail = b.dataset.act === 'trail';
      dismiss();
      if (goTrail && typeof Router !== 'undefined') Router.show('dashboard');
    });

    // Fade in, then swing the lid open + burst coins.
    requestAnimationFrame(() => {
      overlay.classList.add('is-in');
      setTimeout(() => {
        if (!overlay) return;
        overlay.classList.add('is-open');
        _burstCoins(overlay.querySelector('[data-coins]'));
      }, 600);
    });
  }

  function _burstCoins(layer) {
    if (!layer) return;
    for (let i = 0; i < 20; i++) {
      const coin = document.createElement('span');
      coin.className = 'coin';
      coin.style.setProperty('--tx', (Math.random() * 400 - 200).toFixed(0) + 'px');
      coin.style.setProperty('--ty', (-(50 + Math.random() * 250)).toFixed(0) + 'px');
      coin.style.animationDelay = (i * 0.03).toFixed(2) + 's';
      layer.appendChild(coin);
    }
  }

  function dismiss() {
    if (!overlay) return;
    QuestStore.markCelebrationShown();
    const node = overlay;
    overlay = null;
    node.classList.remove('is-in');
    setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node); }, 500);
  }

  return { init, show, dismiss };
})();

window.ChestCelebration = ChestCelebration;
