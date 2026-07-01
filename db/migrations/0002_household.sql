-- Migration: household settings + member roles + the chores.days column.
-- This supersedes 0001 (it includes the days column), so if you never ran 0001
-- just run this one. Apply once on the existing D1 database (dashboard D1 →
-- Console, or wrangler):
--   npx wrangler d1 execute homebase --remote --file=db/migrations/0002_household.sql
--
-- Note: SQLite has no "ADD COLUMN IF NOT EXISTS". If a column already exists the
-- statement errors — just delete that line and re-run.

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('family_name', 'Our Family'),
  ('address', ''), ('city', ''), ('state', ''), ('zip', '');

ALTER TABLE kids ADD COLUMN role TEXT NOT NULL DEFAULT 'Kid';
ALTER TABLE kids ADD COLUMN on_chore_board INTEGER NOT NULL DEFAULT 1;
ALTER TABLE chores ADD COLUMN days TEXT NOT NULL DEFAULT '';
