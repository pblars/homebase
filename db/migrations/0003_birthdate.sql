-- Migration: add member birthdates (for future birthday features).
-- Run once on the existing D1 database (dashboard D1 → Console):
--   ALTER TABLE kids ADD COLUMN birthdate TEXT NOT NULL DEFAULT '';
ALTER TABLE kids ADD COLUMN birthdate TEXT NOT NULL DEFAULT '';
