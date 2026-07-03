// Pages Function: /api/calendar  (Google Calendar — WRITE)
// POST /api/calendar { title, location?, allDay, date, startTime?, endTime?, timeZone? }
//   -> creates the event on the shared Google Calendar and returns Google's event.
//
// Auth is a Google SERVICE ACCOUNT (no per-user OAuth): we sign a JWT with the
// account's private key, exchange it for an access token, then call the Calendar
// API. The tablet never sees credentials — they stay in Pages env vars.
//
// Required env (Cloudflare Pages → Settings → Environment variables):
//   GOOGLE_SERVICE_ACCOUNT  — the full service-account key JSON (paste as-is).
//   GOOGLE_CALENDAR_ID      — the calendar to write to (already set for reads).
// One-time in Google: share that calendar with the service account's client_email
// as "Make changes to events".

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// Same-origin guard. The tablet posts from the site itself, so its Origin (which
// browsers always send on POST) must match this deployment's own host — works on
// any host (pages.dev, preview hashes, a custom domain) with no hardcoding, and
// blocks cross-site browser POSTs + naive header-less bots. It does NOT stop a
// determined attacker forging the Origin header via curl; real auth would mean a
// login (e.g. Cloudflare Access) in front of the site.
function isSameOrigin(request) {
  const self = new URL(request.url).host;
  const src = request.headers.get('Origin') || request.headers.get('Referer');
  if (!src) return false;
  try { return new URL(src).host === self; } catch (_) { return false; }
}

// ---- JWT / token ----------------------------------------------------------

function b64urlFromString(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlFromBytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToPkcs8(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64urlFromString(JSON.stringify(header))}.${b64urlFromString(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64urlFromBytes(new Uint8Array(sig))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

// ---- helpers --------------------------------------------------------------

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_TIME = /^\d{2}:\d{2}$/;

// Add one calendar day to a 'YYYY-MM-DD' (Google all-day end date is exclusive).
function nextDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}
// start time + 1h, clamped to 23:59 so it never spills to the next day.
function plusHour(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  if (h >= 23) return '23:59';
  return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ---- handler --------------------------------------------------------------

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: 'Forbidden.' }, 403);

  const raw = env.GOOGLE_SERVICE_ACCOUNT;
  const calId = env.GOOGLE_CALENDAR_ID;
  if (!raw) return json({ error: 'Server not configured: GOOGLE_SERVICE_ACCOUNT is not set.' }, 500);
  if (!calId) return json({ error: 'Server not configured: GOOGLE_CALENDAR_ID is not set.' }, 500);

  let sa;
  try { sa = JSON.parse(raw); } catch (_) { return json({ error: 'GOOGLE_SERVICE_ACCOUNT is not valid JSON.' }, 500); }
  if (!sa.client_email || !sa.private_key) return json({ error: 'Service account JSON missing client_email / private_key.' }, 500);

  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body.' }, 400);

  const title = String(body.title || '').trim().slice(0, 200);
  const location = String(body.location || '').trim().slice(0, 300);
  const date = String(body.date || '');
  const allDay = !!body.allDay;
  const timeZone = String(body.timeZone || 'America/Chicago').slice(0, 64);

  if (!title) return json({ error: 'Title is required.' }, 400);
  if (!RE_DATE.test(date)) return json({ error: 'A valid date (YYYY-MM-DD) is required.' }, 400);

  const event = { summary: title };
  if (location) event.location = location;

  if (allDay) {
    event.start = { date };
    event.end = { date: nextDay(date) };
  } else {
    const startTime = String(body.startTime || '');
    if (!RE_TIME.test(startTime)) return json({ error: 'A valid start time (HH:MM) is required.' }, 400);
    let endTime = String(body.endTime || '');
    if (!RE_TIME.test(endTime)) endTime = plusHour(startTime);
    event.start = { dateTime: `${date}T${startTime}:00`, timeZone };
    event.end = { dateTime: `${date}T${endTime}:00`, timeZone };
  }

  let token;
  try { token = await getAccessToken(sa); }
  catch (err) { return json({ error: 'Auth failed: ' + err.message }, 502); }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(event),
    }
  );
  const created = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (created && created.error && created.error.message) || `Calendar API HTTP ${res.status}`;
    return json({ error: msg }, res.status === 403 ? 403 : 502);
  }
  return json({ ok: true, event: created });
}
