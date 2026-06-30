// rewards.js — weekly quest definitions on a 4-week ISO cycle.
// Classic-script globals (no ES modules): exposes REWARDS, DEFAULT_QUEST,
// getCurrentQuest() and getISOWeek() on window.
//
// getCurrentQuest() maps the real ISO week to one of the 4 cycle entries, so
// the quest rotates automatically week to week and repeats every 4 weeks.

// `banner` is the illustrated backdrop filename in /assets/quest/. It's optional
// art: if the file isn't there yet, QuestBanner falls back to the CSS meadow
// gradient automatically (see .qb-photo in quest.css). Drop the .webp in and it
// shows — no code change.
const REWARDS = [
  { isoWeek: 1, questName: 'The Meadow Quest',   theme: ['Kindness', 'Teamwork', 'Adventure'],  reward: 'Movie night — kids pick the film',  rewardIcon: 'movie',      banner: 'meadow-banner.webp' },
  { isoWeek: 2, questName: 'The Forest Quest',   theme: ['Courage', 'Curiosity', 'Care'],       reward: 'Ice cream outing',                  rewardIcon: 'ice-cream',  banner: 'forest-banner.webp' },
  { isoWeek: 3, questName: 'The River Quest',    theme: ['Patience', 'Perseverance', 'Joy'],    reward: 'Stay up 30 min late Friday',        rewardIcon: 'moon-stars', banner: 'river-banner.webp' },
  { isoWeek: 4, questName: 'The Mountain Quest', theme: ['Strength', 'Grit', 'Together'],       reward: 'Backyard bonfire',                  rewardIcon: 'flame',      banner: 'mountain-banner.webp' },
];

const DEFAULT_QUEST = {
  questName: 'The Adventure Quest',
  theme: ['Kindness', 'Courage', 'Joy'],
  reward: 'Family choice — decide together',
  rewardIcon: 'star',
  banner: 'meadow-banner.webp',
};

// ISO-8601 week number (1–53). Monday-based.
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function getCurrentQuest() {
  const week = getISOWeek(new Date());
  const cycleWeek = ((week - 1) % 4) + 1;
  return REWARDS.find((r) => r.isoWeek === cycleWeek) || DEFAULT_QUEST;
}

window.REWARDS = REWARDS;
window.DEFAULT_QUEST = DEFAULT_QUEST;
window.getISOWeek = getISOWeek;
window.getCurrentQuest = getCurrentQuest;
