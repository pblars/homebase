// Pages Function: /api/progress  (Cloudflare D1)
// Shared quest/chore PROGRESS — completion, acorns, quest meta — so every device
// that opens the site sees the same board. Definitions live in /api/chores.
//
// Completion is keyed by `period`: DAILY chores use the calendar date
// ('2026-07-05') so they reset each day; WEEKLY chores use the ISO week number
// ('27') so they reset each week. The client sends each chore's period.
//
// GET  /api/progress?week=NN&date=YYYY-MM-DD
//   -> { week, date, completion: {period:{kidId:{choreId:bool}}},
//        acorns: {kidId:n}, quest: {completed, celebrationShown} }
//   completion is keyed by PERIOD and covers both the week (weekly chores) and
//   the date (daily chores); the client reads each chore from its own period.
// POST /api/progress { action, ... }
//   action 'toggle' {period, kidId, choreId, done}
//     -> upserts completion for that period; adjusts that kid's acorns +1/-1
//        (clamped >=0), authoritatively, server-side. Returns { done, acorns }.
//   action 'quest'  {week, completed, celebrationShown} -> upserts quest_meta.
//   action 'reset'  {week} -> clears that week's WEEKLY completion + quest_meta
//        (acorns untouched; daily buckets reset on their own each day).
//        Idempotent — safe for concurrent Monday rollovers.

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// Find the D1 binding regardless of what it was named in the dashboard
// (case-insensitive DB/D1, else the first binding that looks like a D1 database).
function pickDB(env) {
  for (const k of ['DB', 'D1', 'db', 'd1']) {
    if (env[k] && typeof env[k].prepare === 'function') return env[k];
  }
  for (const k in env) {
    if (env[k] && typeof env[k].prepare === 'function') return env[k];
  }
  return null;
}

function weekOf(request, body) {
  const fromBody = body && body.week != null ? String(body.week) : null;
  if (fromBody) return fromBody;
  const url = new URL(request.url);
  return url.searchParams.get('week') || '';
}

export async function onRequestGet({ request, env }) {
  const DB = pickDB(env);
  if (!DB) return json({ error: 'No D1 binding found on this deployment' }, 500);
  const week = weekOf(request, null);
  if (!week) return json({ error: 'week is required' }, 400);
  // Daily chores live under today's date; weekly under the week number. Return
  // completion for both so the client can fill each chore's bucket. (date falls
  // back to week when absent — harmless, just matches no daily rows.)
  const date = new URL(request.url).searchParams.get('date') || week;

  const [comp, acorns, quest] = await Promise.all([
    DB.prepare('SELECT period, kid_id, chore_id, done FROM chore_completion WHERE period IN (?, ?)').bind(week, date).all(),
    DB.prepare('SELECT kid_id, count FROM acorns').all(),
    DB.prepare('SELECT completed, celebration_shown FROM quest_meta WHERE week = ?').bind(week).first(),
  ]);

  // Keyed by PERIOD so the client reads each chore from its own bucket (daily →
  // date, weekly → week). Flattening the two periods would let a stale week-keyed
  // daily row (e.g. from before migration 0005) leak into today's view.
  const completion = {};
  for (const r of comp.results || []) {
    const per = (completion[r.period] = completion[r.period] || {});
    (per[r.kid_id] = per[r.kid_id] || {})[r.chore_id] = r.done !== 0;
  }
  const acornMap = {};
  for (const r of acorns.results || []) acornMap[r.kid_id] = r.count || 0;

  return json({
    week,
    date,
    completion,
    acorns: acornMap,
    quest: {
      completed: !!(quest && quest.completed),
      celebrationShown: !!(quest && quest.celebration_shown),
    },
  });
}

export async function onRequestPost({ request, env }) {
  const DB = pickDB(env);
  if (!DB) return json({ error: 'No D1 binding found on this deployment' }, 500);
  const b = await request.json().catch(() => ({}));
  const action = b.action;

  if (action === 'toggle') {
    const period = b.period != null ? String(b.period) : '';
    if (!period || !b.kidId || !b.choreId) return json({ error: 'period, kidId and choreId are required' }, 400);
    const done = b.done ? 1 : 0;
    const delta = done ? 1 : -1;
    // Completion upsert + acorn adjustment run together in one transaction.
    await DB.batch([
      DB.prepare(
        `INSERT INTO chore_completion (period, kid_id, chore_id, done) VALUES (?, ?, ?, ?)
         ON CONFLICT(period, kid_id, chore_id) DO UPDATE SET done = excluded.done`
      ).bind(period, b.kidId, b.choreId, done),
      DB.prepare(
        `INSERT INTO acorns (kid_id, count) VALUES (?, MAX(0, ?))
         ON CONFLICT(kid_id) DO UPDATE SET count = MAX(0, count + ?)`
      ).bind(b.kidId, delta, delta),
    ]);
    const row = await DB.prepare('SELECT count FROM acorns WHERE kid_id = ?').bind(b.kidId).first();
    return json({ done: !!done, acorns: (row && row.count) || 0 });
  }

  const week = weekOf(request, b);
  if (!week) return json({ error: 'week is required' }, 400);

  if (action === 'quest') {
    const completed = b.completed ? 1 : 0;
    const shown = b.celebrationShown ? 1 : 0;
    await DB.prepare(
      `INSERT INTO quest_meta (week, completed, celebration_shown) VALUES (?, ?, ?)
       ON CONFLICT(week) DO UPDATE SET completed = excluded.completed,
                                       celebration_shown = excluded.celebration_shown`
    ).bind(week, completed, shown).run();
    return json({ completed: !!completed, celebrationShown: !!shown });
  }

  if (action === 'reset') {
    // Clears the WEEKLY completion bucket (period = week number) + quest meta.
    // Daily buckets (period = date) reset on their own each day.
    await DB.batch([
      DB.prepare('DELETE FROM chore_completion WHERE period = ?').bind(week),
      DB.prepare(
        `INSERT INTO quest_meta (week, completed, celebration_shown) VALUES (?, 0, 0)
         ON CONFLICT(week) DO UPDATE SET completed = 0, celebration_shown = 0`
      ).bind(week),
    ]);
    return json({ ok: true, week });
  }

  return json({ error: 'unknown action' }, 400);
}
