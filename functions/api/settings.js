// Pages Function: /api/settings  (Cloudflare D1)
// GET /api/settings         -> { family_name, address, city, state, zip, ... }
// PUT /api/settings {k:v,…}  -> upserts the given keys

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

// Only these keys are writable via the API.
const ALLOWED = new Set(['family_name', 'address', 'city', 'state', 'zip']);

export async function onRequestGet({ env }) {
  const DB = pickDB(env);
  if (!DB) return json({ error: 'No D1 binding found on this deployment' }, 500);
  const rows = (await DB.prepare('SELECT key, value FROM settings').all()).results || [];
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return json(out);
}

export async function onRequestPut({ request, env }) {
  const DB = pickDB(env);
  if (!DB) return json({ error: 'No D1 binding found on this deployment' }, 500);
  const b = await request.json().catch(() => ({}));
  const stmts = [];
  for (const [k, v] of Object.entries(b)) {
    if (!ALLOWED.has(k)) continue;
    stmts.push(
      DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .bind(k, String(v == null ? '' : v))
    );
  }
  if (!stmts.length) return json({ error: 'no writable settings provided' }, 400);
  await DB.batch(stmts);
  return json({ ok: true });
}
