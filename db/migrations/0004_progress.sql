-- Home Base — migration 0004: daily quest/chore PROGRESS in D1.
-- Moves per-week chore completion, lifetime acorns, and weekly quest meta out of
-- the tablet's localStorage and into the shared database, so every device that
-- opens the site sees the same board.
--
-- Apply once (safe to re-run — all CREATE IF NOT EXISTS):
--   npx wrangler d1 execute homebase --remote --file=db/migrations/0004_progress.sql

-- Per-kid, per-week chore completion. `week` is the ISO week number (1–53) as a
-- string, matching getISOWeek() on the client (src/data/rewards.js).
CREATE TABLE IF NOT EXISTS chore_completion (
  week     TEXT NOT NULL,
  kid_id   TEXT NOT NULL,
  chore_id TEXT NOT NULL,
  done     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (week, kid_id, chore_id)
);

-- Lifetime acorn count per kid (never resets on the weekly rollover).
CREATE TABLE IF NOT EXISTS acorns (
  kid_id TEXT PRIMARY KEY,
  count  INTEGER NOT NULL DEFAULT 0
);

-- Per-week family quest meta (completed + whether the chest celebration ran).
CREATE TABLE IF NOT EXISTS quest_meta (
  week              TEXT PRIMARY KEY,
  completed         INTEGER NOT NULL DEFAULT 0,
  celebration_shown INTEGER NOT NULL DEFAULT 0
);
