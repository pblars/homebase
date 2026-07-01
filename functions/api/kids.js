// Pages Function: /api/kids  (Cloudflare D1)
// POST /api/kids {name, initial?, color?, avatarBg?} -> 201 created kid
// (Kids are also returned by GET /api/chores, so there's no GET here.)

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

// Palette assigned to new kids in order, so each gets a distinct color.
const PALETTE = [
  { color: '#4a7c59', bg: '#c8e6c9' },
  { color: '#3a6ea5', bg: '#bbdefb' },
  { color: '#7b5ea7', bg: '#e1bee7' },
  { color: '#c77d3a', bg: '#ffe0b2' },
  { color: '#3a9d96', bg: '#b2dfdb' },
  { color: '#b0457b', bg: '#f8bbd0' },
];

export async function onRequestPost({ request, env }) {
  const DB = pickDB(env);
  if (!DB) return json({ error: 'No D1 binding found on this deployment' }, 500);
  const b = await request.json().catch(() => ({}));
  const name = (b.name || '').trim();
  if (!name) return json({ error: 'name is required' }, 400);

  const count = ((await DB.prepare('SELECT COUNT(*) AS n FROM kids').first()) || {}).n || 0;
  const pick = PALETTE[count % PALETTE.length];
  const id = crypto.randomUUID();
  const initial = (b.initial || name[0] || '?').toUpperCase().slice(0, 1);
  const color = b.color || pick.color;
  const avatarBg = b.avatarBg || pick.bg;
  const role = b.role === 'Parent' ? 'Parent' : 'Kid';
  const onBoard = b.onBoard === false ? 0 : 1;
  const birthdate = (b.birthdate || '').trim();

  await DB
    .prepare('INSERT INTO kids (id, name, initial, color, avatar_bg, role, on_chore_board, birthdate, sort) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(id, name, initial, color, avatarBg, role, onBoard, birthdate, count)
    .run();
  return json({ id, name, initial, color, avatarBg, role, onBoard: onBoard === 1, birthdate, chores: [] }, 201);
}
