// Pages Function: /api/chores/:id  (D1 binding `DB`)
// DELETE /api/chores/:id           -> 204 remove a chore
// PUT    /api/chores/:id {name?,description?,frequency?} -> update fields

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequestDelete({ params, env }) {
  if (!(env.DB || env.D1)) return json({ error: 'D1 binding "DB" not configured' }, 500);
  await (env.DB || env.D1).prepare('DELETE FROM chores WHERE id = ?').bind(params.id).run();
  return new Response(null, { status: 204 });
}

export async function onRequestPut({ params, request, env }) {
  if (!(env.DB || env.D1)) return json({ error: 'D1 binding "DB" not configured' }, 500);
  const b = await request.json().catch(() => ({}));
  const sets = [];
  const vals = [];
  if (b.name != null) { sets.push('name = ?'); vals.push(String(b.name).trim()); }
  if (b.description != null) { sets.push('description = ?'); vals.push(String(b.description).trim()); }
  if (b.frequency != null) { sets.push('frequency = ?'); vals.push(b.frequency === 'Weekly' ? 'Weekly' : 'Daily'); }
  if (!sets.length) return json({ error: 'no updatable fields provided' }, 400);
  vals.push(params.id);
  await (env.DB || env.D1).prepare('UPDATE chores SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals).run();
  return json({ ok: true });
}
