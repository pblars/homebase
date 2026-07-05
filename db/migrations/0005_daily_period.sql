-- Home Base — migration 0005: per-period chore completion (daily resets daily).
-- Chore completion used to be keyed by ISO week for everything. Now a chore's
-- completion is keyed by a generic `period`: DAILY chores use the calendar date
-- ('2026-07-05') so they reset every day, WEEKLY chores keep using the ISO week
-- number ('27') so they reset every week. Acorns (lifetime) are unaffected.
--
-- Renaming the column preserves existing WEEKLY completion rows (their period is
-- still the week number). Old daily flags stored under a week number are simply
-- ignored going forward (daily chores read from the date bucket, which starts
-- empty — so daily chores show unchecked once after this ships, then reset each
-- day thereafter).
--
-- Apply once (run-once — ALTER RENAME COLUMN has no IF NOT EXISTS):
--   npx wrangler d1 execute homebase --remote --file=db/migrations/0005_daily_period.sql

ALTER TABLE chore_completion RENAME COLUMN week TO period;
