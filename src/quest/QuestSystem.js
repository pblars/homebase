// QuestSystem.js
// -----------------------------------------------------------------------------
// Orchestrator for the quest + reward system. Initializes on app start, handles
// the weekly (Monday) reset, fires the chest celebration when the family quest
// completes, and shows the "New Quest Unlocked" toast. Classic-script global.
//
// Events it reacts to / emits:
//   reacts to 'questupdate'  -> if complete & not yet celebrated, emit 'chestopen'
//   emits    'weekreset'     -> on Monday rollover (banner + panels re-render)
//   emits    'chestopen'     -> ChestCelebration listens
// -----------------------------------------------------------------------------

const QuestSystem = (() => {
  let lastDateStr = null;
  let tickHandle = null;

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function init() {
    // 1) Roll the week over if needed (e.g. first load after Monday).
    if (QuestStore.isNewWeek()) QuestStore.resetWeek();
    else QuestStore.ensureWeekMarker();

    lastDateStr = todayStr();

    // 2) Midnight watcher: once the calendar date changes, check for a new week.
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = setInterval(_tick, 60 * 1000);

    // 3/4) React to quest progress for the chest celebration.
    window.addEventListener('questupdate', _onQuestUpdate);

    console.log(`[QuestSystem] init — week ${QuestStore.getWeekKey()}, quest "${getCurrentQuest().questName}"`);
  }

  function _tick() {
    const t = todayStr();
    if (t === lastDateStr) return;
    lastDateStr = t;
    const isMonday = new Date().getDay() === 1;
    if (isMonday || QuestStore.isNewWeek()) {
      QuestStore.resetWeek();
      const quest = getCurrentQuest();
      window.dispatchEvent(new CustomEvent('weekreset', { detail: { quest } }));
      showToast(quest);
      console.log(`[QuestSystem] week reset — new quest "${quest.questName}"`);
    }
  }

  function _onQuestUpdate(e) {
    const p = (e && e.detail) || QuestStore.getFamilyProgress();
    if (p.isComplete && !QuestStore.isCelebrationShown()) {
      window.dispatchEvent(new CustomEvent('chestopen', { detail: { quest: getCurrentQuest(), progress: p } }));
    }
  }

  // "New Quest Unlocked" toast — slides down from the top for 4s.
  function showToast(quest) {
    const el = document.createElement('div');
    el.className = 'quest-toast';
    el.innerHTML =
      '<span class="qt-leaf">' + ICONS.deco.sprig + '</span>' +
      '<div class="qt-body">' +
        '<div class="qt-kicker">New Quest Unlocked</div>' +
        '<div class="qt-quest">' + quest.questName + '</div>' +
        '<div class="qt-theme">' + (quest.theme || []).join('  ·  ') + '</div>' +
        '<div class="qt-reward">Reward: ' + quest.reward + '</div>' +
      '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => {
      el.classList.remove('is-in');
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 600);
    }, 4000);
  }

  return {
    init,
    showToast,
    // convenience getters proxying QuestStore
    getProgress: () => QuestStore.getFamilyProgress(),
    getQuest: () => getCurrentQuest(),
  };
})();

window.QuestSystem = QuestSystem;
