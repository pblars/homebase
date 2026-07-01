// Pages Function: /api/chores
// Backed by the Cloudflare D1 binding `DB`. Returns chore definitions in the
// exact shape the app already uses (window.KIDS), and accepts new chores.
//
// GET  /api/chores            -> { kids: [ {id,name,initial,color,avatarBg,avatar, chores:[{id,name,description,frequency}]} ] }
// POST /api/chores {kidId,name,description?,frequency?} -> 201 created chore

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: 'D1 binding "DB" not configured' }, 500);
  const kids = (await env.DB.prepare('SELECT * FROM kids ORDER BY sort, name').all()).results || [];
  const chores = (await env.DB.prepare('SELECT * FROM chores ORDER BY sort, name').all()).results || [];
  const byKid = {};
  for (const c of chores) {
    (byKid[c.kid_id] = byKid[c.kid_id] || []).push({
      id: c.id, name: c.name, description: c.description, frequency: c.frequency,
    });
  }
  const out = kids.map((k) => ({
    id: k.id, name: k.name, initial: k.initial, color: k.color,
    avatarBg: k.avatar_bg, avatar: k.avatar || null,
    chores: byKid[k.id] || [],
  }));
  return json({ kids: out });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 binding "DB" not configured' }, 500);
  const b = await request.json().catch(() => ({}));
  const name = (b.name || '').trim();
  if (!b.kidId || !name) return json({ error: 'kidId and name are required' }, 400);
  const id = crypto.randomUUID();
  const frequency = b.frequency === 'Weekly' ? 'Weekly' : 'Daily';
  const description = (b.description || '').trim();
  await env.DB
    .prepare('INSERT INTO chores (id, kid_id, name, description, frequency, sort) VALUES (?,?,?,?,?,?)')
    .bind(id, b.kidId, name, description, frequency, Date.now() % 1000000)
    .run();
  return json({ id, kidId: b.kidId, name, description, frequency }, 201);
}
