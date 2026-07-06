-- Home Base — migration 0006: shared meal plan (from The Family Table).
-- The Family Table app (familytable.pages.dev) pushes its weekly dinners here so
-- the Home Base dashboard + Meals tab can show tonight's dinner and the week.
-- Keyed by calendar date + meal type; `name` empty means "no meal that day".
--
-- Apply once:
--   npx wrangler d1 execute homebase --remote --file=db/migrations/0006_meals.sql

CREATE TABLE IF NOT EXISTS meal_plan (
  date TEXT NOT NULL,          -- 'YYYY-MM-DD' (local date of the meal)
  meal TEXT NOT NULL,          -- meal type, e.g. 'Dinner'
  name TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (date, meal)
);
