-- Home Base — chore definitions (Cloudflare D1 / SQLite).
-- Only DEFINITIONS live here (who has which chores). Daily completion + acorns
-- stay on the wall tablet in localStorage.
--
-- Apply to the remote D1 database:
--   npx wrangler d1 execute homebase --remote --file=db/schema.sql
-- (safe to re-run — CREATE IF NOT EXISTS + INSERT OR IGNORE)

-- Household members (table kept named "kids" for continuity; a member may be a
-- Parent or Kid, and on_chore_board decides whether they appear on the board).
CREATE TABLE IF NOT EXISTS kids (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  initial        TEXT NOT NULL DEFAULT '',
  color          TEXT NOT NULL DEFAULT '#4a7c59',
  avatar_bg      TEXT NOT NULL DEFAULT '#c8e6c9',
  avatar         TEXT,
  role           TEXT NOT NULL DEFAULT 'Kid',
  on_chore_board INTEGER NOT NULL DEFAULT 1,
  sort           INTEGER NOT NULL DEFAULT 0
);

-- Site-wide settings (family name, address, …) as simple key/value rows.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('family_name', 'Our Family'),
  ('address', ''), ('city', ''), ('state', ''), ('zip', '');

CREATE TABLE IF NOT EXISTS chores (
  id          TEXT PRIMARY KEY,
  kid_id      TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  frequency   TEXT NOT NULL DEFAULT 'Daily',
  days        TEXT NOT NULL DEFAULT '',   -- Weekly chores: comma-separated day tokens (e.g. 'Tue' or 'Mon,Thu')
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chores_kid ON chores(kid_id);

-- Seed the current family (no-ops if already present).
INSERT OR IGNORE INTO kids (id, name, initial, color, avatar_bg, sort) VALUES
  ('emma', 'Emma', 'E', '#4a7c59', '#c8e6c9', 0),
  ('jack', 'Jack', 'J', '#3a6ea5', '#bbdefb', 1),
  ('lucy', 'Lucy', 'L', '#7b5ea7', '#e1bee7', 2);

INSERT OR IGNORE INTO chores (id, kid_id, name, description, frequency, sort) VALUES
  ('e1', 'emma', 'Make bed',          'Sheets tucked, pillows straight',   'Daily',  0),
  ('e2', 'emma', 'Water plants',       'Check soil is dry first',           'Daily',  1),
  ('e3', 'emma', 'Clean room',         'Floor clear, toys put away',        'Daily',  2),
  ('e4', 'emma', 'Set table',          'Plates, cups, napkins, silverware', 'Daily',  3),
  ('e5', 'emma', 'Unload dishwasher',  'Put away clean dishes',             'Daily',  4),
  ('j1', 'jack', 'Feed pet',           'Morning and evening feeding',       'Daily',  0),
  ('j2', 'jack', 'Homework',           'All assignments completed',         'Daily',  1),
  ('j3', 'jack', 'Tidy room',          'Bed made, floor clear',             'Daily',  2),
  ('j4', 'jack', 'Take out trash',     'All bins to curb on pickup day',    'Weekly', 3),
  ('l1', 'lucy', 'Brush teeth',        'Morning and night, 2 minutes',      'Daily',  0),
  ('l2', 'lucy', 'Pick up toys',       'Living room and bedroom',           'Daily',  1),
  ('l3', 'lucy', 'Help with laundry',  'Sort colors and whites',            'Weekly', 2),
  ('l4', 'lucy', 'Read for 20 min',    'Any book of your choice',           'Daily',  3);
