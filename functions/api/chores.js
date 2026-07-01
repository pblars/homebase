// Pages Function: /api/chores  (Cloudflare D1)
// GET  /api/chores            -> { kids: [ {id,name,initial,color,avatarBg,avatar, chores:[{id,name,description,frequency}]} ] }
// POST /api/chores {kidId,name,description?,frequency?} -> 201 created chore

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

const VALID_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Weekly chores keep their chosen days; anything else stores no days.
function cleanDays(input, frequency) {
  if (frequency !== 'Weekly') return '';
  const arr = Array.isArray(input) ? input : String(input || '').split(',');
  return VALID_DAYS.filter((d) => arr.includes(d)).join(',');
}

export async function onRequestGet({ env }) {
  const DB = pickDB(env);
  if (!DB) return json({ error: 'No D1 binding found on this deployment' }, 500);
  const kids = (await DB.prepare('SELECT * FROM kids ORDER BY sort, name').all()).results || [];
  const chores = (await DB.prepare('SELECT * FROM chores ORDER BY sort, name').all()).results || [];
  const byKid = {};
  for (const c of chores) {
    (byKid[c.kid_id] = byKid[c.kid_id] || []).push({
      id: c.id, name: c.name, description: c.description, frequency: c.frequency, days: c.days || '',
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
  const DB = pickDB(env);
  if (!DB) return json({ error: 'No D1 binding found on this deployment' }, 500);
  const b = await request.json().catch(() => ({}));
  const name = (b.name || '').trim();
  if (!b.kidId || !name) return json({ error: 'kidId and name are required' }, 400);
  const id = crypto.randomUUID();
  const frequency = b.frequency === 'Weekly' ? 'Weekly' : 'Daily';
  const description = (b.description || '').trim();
  const days = cleanDays(b.days, frequency);
  await DB
    .prepare('INSERT INTO chores (id, kid_id, name, description, frequency, days, sort) VALUES (?,?,?,?,?,?,?)')
    .bind(id, b.kidId, name, description, frequency, days, Date.now() % 1000000)
    .run();
  return json({ id, kidId: b.kidId, name, description, frequency, days }, 201);
}
