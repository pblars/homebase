// Pages Function: /api/chores/:id  (Cloudflare D1)
// DELETE /api/chores/:id           -> 204 remove a chore
// PUT    /api/chores/:id {name?,description?,frequency?} -> update fields

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
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

export async function onRequestDelete({ params, env }) {
  const DB = pickDB(env);
  if (!DB) return json({ error: 'No D1 binding found on this deployment' }, 500);
  await DB.prepare('DELETE FROM chores WHERE id = ?').bind(params.id).run();
  return new Response(null, { status: 204 });
}

export async function onRequestPut({ params, request, env }) {
  const DB = pickDB(env);
  if (!DB) return json({ error: 'No D1 binding found on this deployment' }, 500);
  const b = await request.json().catch(() => ({}));
  const VALID_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const sets = [];
  const vals = [];
  if (b.name != null) { sets.push('name = ?'); vals.push(String(b.name).trim()); }
  if (b.description != null) { sets.push('description = ?'); vals.push(String(b.description).trim()); }
  if (b.frequency != null) { sets.push('frequency = ?'); vals.push(b.frequency === 'Weekly' ? 'Weekly' : 'Daily'); }
  if (b.days != null || b.frequency === 'Daily') {
    const arr = Array.isArray(b.days) ? b.days : String(b.days || '').split(',');
    sets.push('days = ?');
    vals.push(b.frequency === 'Daily' ? '' : VALID_DAYS.filter((d) => arr.includes(d)).join(','));
  }
  if (!sets.length) return json({ error: 'no updatable fields provided' }, 400);
  vals.push(params.id);
  await DB.prepare('UPDATE chores SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals).run();
  return json({ ok: true });
}
