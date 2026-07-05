// Pages Function: /api/progress  (Cloudflare D1)
// Shared daily quest/chore PROGRESS — completion, acorns, quest meta — so every
// device that opens the site sees the same board. Definitions live in /api/chores.
//
// GET  /api/progress?week=NN
//   -> { week, completion: {kidId:{choreId:bool}}, acorns: {kidId:n},
//        quest: {completed, celebrationShown} }
// POST /api/progress { action, ... }
//   action 'toggle' {week, kidId, choreId, done}
//     -> upserts completion; adjusts that kid's acorns +1/-1 (clamped >=0),
//        authoritatively, server-side. Returns { done, acorns }.
//   action 'quest'  {week, completed, celebrationShown} -> upserts quest_meta.
//   action 'reset'  {week} -> clears the week's completion + quest_meta (acorns
//        untouched). Idempotent — safe for concurrent Monday rollovers.

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

  const [comp, acorns, quest] = await Promise.all([
    DB.prepare('SELECT kid_id, chore_id, done FROM chore_completion WHERE week = ?').bind(week).all(),
    DB.prepare('SELECT kid_id, count FROM acorns').all(),
    DB.prepare('SELECT completed, celebration_shown FROM quest_meta WHERE week = ?').bind(week).first(),
  ]);

  const completion = {};
  for (const r of comp.results || []) {
    (completion[r.kid_id] = completion[r.kid_id] || {})[r.chore_id] = r.done !== 0;
  }
  const acornMap = {};
  for (const r of acorns.results || []) acornMap[r.kid_id] = r.count || 0;

  return json({
    week,
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
  const week = weekOf(request, b);
  if (!week) return json({ error: 'week is required' }, 400);

  if (action === 'toggle') {
    if (!b.kidId || !b.choreId) return json({ error: 'kidId and choreId are required' }, 400);
    const done = b.done ? 1 : 0;
    const delta = done ? 1 : -1;
    // Completion upsert + acorn adjustment run together in one transaction.
    await DB.batch([
      DB.prepare(
        `INSERT INTO chore_completion (week, kid_id, chore_id, done) VALUES (?, ?, ?, ?)
         ON CONFLICT(week, kid_id, chore_id) DO UPDATE SET done = excluded.done`
      ).bind(week, b.kidId, b.choreId, done),
      DB.prepare(
        `INSERT INTO acorns (kid_id, count) VALUES (?, MAX(0, ?))
         ON CONFLICT(kid_id) DO UPDATE SET count = MAX(0, count + ?)`
      ).bind(b.kidId, delta, delta),
    ]);
    const row = await DB.prepare('SELECT count FROM acorns WHERE kid_id = ?').bind(b.kidId).first();
    return json({ done: !!done, acorns: (row && row.count) || 0 });
  }

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
    await DB.batch([
      DB.prepare('DELETE FROM chore_completion WHERE week = ?').bind(week),
      DB.prepare(
        `INSERT INTO quest_meta (week, completed, celebration_shown) VALUES (?, 0, 0)
         ON CONFLICT(week) DO UPDATE SET completed = 0, celebration_shown = 0`
      ).bind(week),
    ]);
    return json({ ok: true, week });
  }

  return json({ error: 'unknown action' }, 400);
}
