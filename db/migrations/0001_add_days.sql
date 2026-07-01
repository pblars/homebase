-- Migration: add the `days` column to chores (weekly chores can name their day).
-- Run once on the existing D1 database (dashboard D1 → Console, or wrangler):
--   npx wrangler d1 execute homebase --remote --file=db/migrations/0001_add_days.sql
ALTER TABLE chores ADD COLUMN days TEXT NOT NULL DEFAULT '';
