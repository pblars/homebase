// Pages Function: /api/mealplan  (Cloudflare D1)
// Shared meal plan. The Family Table (familytable.pages.dev) POSTs its weekly
// dinners here (cross-origin, hence CORS); the Home Base dashboard + Meals tab
// GET them (same-origin) to show tonight's dinner + the week.
//
// GET  /api/mealplan?from=YYYY-MM-DD&days=8
//   -> { meals: [ {date, meal, name} ] }  (name non-empty, date in [from, from+days))
// POST /api/mealplan { meals: [ {date:'YYYY-MM-DD', meal:'Dinner', name} ] }
//   -> upserts each (name '' clears that day). 200 { ok, count }.

const CORS = {
  'Access-Control-Allow-Origin': 'https://familytable.pages.dev',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS },
  });
}

function pickDB(env) {
  for (const k of ['DB', 'D1', 'db', 'd1']) {
    if (env[k] && typeof env[k].prepare === 'function') return env[k];
  }
  for (const k in env) {
    if (env[k] && typeof env[k].prepare === 'function') return env[k];
  }
  return null;
}

// Add n days to a 'YYYY-MM-DD' string, returning 'YYYY-MM-DD' (UTC-safe).
function addDays(s, n) {
  const [y, m, d] = String(s).split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const DB = pickDB(env);
  if (!DB) return json({ error: 'No D1 binding found on this deployment' }, 500);
  const url = new URL(request.url);
  const from = url.searchParams.get('from') || '';
  const days = Math.min(31, Math.max(1, parseInt(url.searchParams.get('days') || '8', 10) || 8));
  let rows;
  if (from) {
    const to = addDays(from, days);
    rows = (await DB.prepare(
      "SELECT date, meal, name FROM meal_plan WHERE date >= ? AND date < ? AND name <> '' ORDER BY date"
    ).bind(from, to).all()).results || [];
  } else {
    rows = (await DB.prepare("SELECT date, meal, name FROM meal_plan WHERE name <> '' ORDER BY date").all()).results || [];
  }
  return json({ meals: rows });
}

export async function onRequestPost({ request, env }) {
  const DB = pickDB(env);
  if (!DB) return json({ error: 'No D1 binding found on this deployment' }, 500);
  const b = await request.json().catch(() => ({}));
  const meals = Array.isArray(b.meals) ? b.meals : [];
  const stmts = meals
    .filter((m) => m && m.date && m.meal)
    .map((m) => DB.prepare(
      `INSERT INTO meal_plan (date, meal, name) VALUES (?, ?, ?)
       ON CONFLICT(date, meal) DO UPDATE SET name = excluded.name`
    ).bind(String(m.date), String(m.meal), String(m.name || '')));
  if (stmts.length) await DB.batch(stmts);
  return json({ ok: true, count: stmts.length });
}
