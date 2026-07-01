// Pages Function: /api/kids  (D1 binding `DB`)
// POST /api/kids {name, initial?, color?, avatarBg?} -> 201 created kid
// (Kids are also returned by GET /api/chores, so there's no GET here.)

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
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
  if (!env.DB) return json({ error: 'D1 binding "DB" not configured' }, 500);
  const b = await request.json().catch(() => ({}));
  const name = (b.name || '').trim();
  if (!name) return json({ error: 'name is required' }, 400);

  const count = ((await env.DB.prepare('SELECT COUNT(*) AS n FROM kids').first()) || {}).n || 0;
  const pick = PALETTE[count % PALETTE.length];
  const id = crypto.randomUUID();
  const initial = (b.initial || name[0] || '?').toUpperCase().slice(0, 1);
  const color = b.color || pick.color;
  const avatarBg = b.avatarBg || pick.bg;

  await env.DB
    .prepare('INSERT INTO kids (id, name, initial, color, avatar_bg, sort) VALUES (?,?,?,?,?,?)')
    .bind(id, name, initial, color, avatarBg, count)
    .run();
  return json({ id, name, initial, color, avatarBg, chores: [] }, 201);
}
