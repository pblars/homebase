// rewards.js — weekly quest definitions on a 4-week ISO cycle.
// Classic-script globals (no ES modules): exposes REWARDS, DEFAULT_QUEST,
// getCurrentQuest() and getISOWeek() on window.
//
// getCurrentQuest() maps the real ISO week to one of the 4 cycle entries, so
// the quest rotates automatically week to week and repeats every 4 weeks.

// `banner` is the illustrated backdrop filename in /assets/quest/; a missing file
// falls back to the CSS meadow gradient (see .qb-photo). `trail` is the SVG path
// (in the art's 1512x1008 space) that QuestBanner draws the progress waypoints
// along, ending on that painting's treasure chest. Each was eyeball-traced to its
// specific art; nudge the numbers to fine-tune.
const REWARDS = [
  {
    isoWeek: 1, questName: 'The Meadow Quest', theme: ['Kindness', 'Teamwork', 'Adventure'],
    reward: 'Movie night — kids pick the film', rewardIcon: 'movie',
    banner: 'magical_meadow_with_enchanted_chest.webp',
    trail: 'M250 648 C315 668 315 700 365 708 C475 724 545 736 640 748 C880 766 1080 778 1220 800 C1290 812 1330 822 1365 834',
  },
  {
    isoWeek: 2, questName: 'The Forest Quest', theme: ['Courage', 'Curiosity', 'Care'],
    reward: 'Ice cream outing', rewardIcon: 'ice-cream',
    banner: 'forest-banner.webp',
    trail: 'M630 665 C720 705 760 735 830 775 C900 815 950 855 1010 858 C1090 862 1180 835 1250 820 C1300 812 1320 812 1335 815',
  },
  {
    isoWeek: 3, questName: 'The River Quest', theme: ['Patience', 'Perseverance', 'Joy'],
    reward: 'Stay up 30 min late Friday', rewardIcon: 'moon-stars',
    banner: 'river-banner.webp',
    trail: 'M1000 600 C1080 645 1130 675 1130 720 C1130 765 1180 795 1240 810 C1295 822 1335 815 1370 808',
  },
  {
    isoWeek: 4, questName: 'The Mountain Quest', theme: ['Strength', 'Grit', 'Together'],
    reward: 'Backyard bonfire', rewardIcon: 'flame',
    banner: 'mountain-banner.webp',
    trail: 'M900 660 C990 705 1050 760 1110 800 C1170 840 1250 850 1310 845 C1355 842 1380 840 1400 838',
  },
];

const DEFAULT_QUEST = {
  questName: 'The Adventure Quest',
  theme: ['Kindness', 'Courage', 'Joy'],
  reward: 'Family choice — decide together',
  rewardIcon: 'star',
  banner: 'magical_meadow_with_enchanted_chest.webp',
  trail: REWARDS[0].trail,
};

// ISO-8601 week number (1–53). Monday-based.
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

// 4-week rotation, anchored so the current week (ISO week 27, 2026) starts on the
// Meadow Quest and advances weekly: Meadow → Forest → River → Mountain → repeat.
// Change the anchor to re-phase which quest a given week lands on.
const CYCLE_ANCHOR_WEEK = 27;

function getCurrentQuest() {
  const wk = getISOWeek(new Date());
  const cycleWeek = ((((wk - CYCLE_ANCHOR_WEEK) % 4) + 4) % 4) + 1;
  return REWARDS.find((r) => r.isoWeek === cycleWeek) || DEFAULT_QUEST;
}

window.REWARDS = REWARDS;
window.DEFAULT_QUEST = DEFAULT_QUEST;
window.getISOWeek = getISOWeek;
window.getCurrentQuest = getCurrentQuest;
