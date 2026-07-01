// Pages Function: /api/kids/:id  (D1 binding `DB`)
// DELETE /api/kids/:id  -> 204, also removes that kid's chores
// PUT    /api/kids/:id {name?,initial?,color?,avatarBg?,avatar?} -> update

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequestDelete({ params, env }) {
  if (!env.DB) return json({ error: 'D1 binding "DB" not configured' }, 500);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM chores WHERE kid_id = ?').bind(params.id),
    env.DB.prepare('DELETE FROM kids WHERE id = ?').bind(params.id),
  ]);
  return new Response(null, { status: 204 });
}

export async function onRequestPut({ params, request, env }) {
  if (!env.DB) return json({ error: 'D1 binding "DB" not configured' }, 500);
  const b = await request.json().catch(() => ({}));
  const map = { name: 'name', initial: 'initial', color: 'color', avatarBg: 'avatar_bg', avatar: 'avatar' };
  const sets = [];
  const vals = [];
  for (const key of Object.keys(map)) {
    if (b[key] != null) { sets.push(map[key] + ' = ?'); vals.push(String(b[key])); }
  }
  if (!sets.length) return json({ error: 'no updatable fields provided' }, 400);
  vals.push(params.id);
  await env.DB.prepare('UPDATE kids SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals).run();
  return json({ ok: true });
}
