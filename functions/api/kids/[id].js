// Pages Function: /api/kids/:id  (Cloudflare D1)
// DELETE /api/kids/:id  -> 204, also removes that kid's chores
// PUT    /api/kids/:id {name?,initial?,color?,avatarBg?,avatar?} -> update

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
  await DB.batch([
    DB.prepare('DELETE FROM chores WHERE kid_id = ?').bind(params.id),
    DB.prepare('DELETE FROM kids WHERE id = ?').bind(params.id),
  ]);
  return new Response(null, { status: 204 });
}

export async function onRequestPut({ params, request, env }) {
  const DB = pickDB(env);
  if (!DB) return json({ error: 'No D1 binding found on this deployment' }, 500);
  const b = await request.json().catch(() => ({}));
  const map = { name: 'name', initial: 'initial', color: 'color', avatarBg: 'avatar_bg', avatar: 'avatar' };
  const sets = [];
  const vals = [];
  for (const key of Object.keys(map)) {
    if (b[key] != null) { sets.push(map[key] + ' = ?'); vals.push(String(b[key])); }
  }
  if (!sets.length) return json({ error: 'no updatable fields provided' }, 400);
  vals.push(params.id);
  await DB.prepare('UPDATE kids SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals).run();
  return json({ ok: true });
}
