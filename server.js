import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import pg from 'pg';
import { calculateAvailability, isValidDate, isValidTimeZone } from './src/planner.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const admin = path.join(root, 'admin');
const port = Number(process.env.PORT || 3000);
const password = process.env.ADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;
if (!password || !databaseUrl) {
  console.error('ADMIN_PASSWORD and DATABASE_URL must be set before starting VTime.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 5, idleTimeoutMillis: 30000 });
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  });
  next();
});

const sessions = new Map();
const attempts = new Map();
const SESSION_MS = 8 * 60 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

function digest(value) {
  return createHash('sha256').update(value).digest();
}

function sameSecret(a, b) {
  return timingSafeEqual(digest(a), digest(b));
}

function cookieValue(req, name) {
  const cookie = req.headers.cookie || '';
  return cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

function sessionFor(req) {
  const sid = cookieValue(req, 'vtime_session');
  const session = sessions.get(sid);
  if (!session) return null;
  if (session.expires <= Date.now()) {
    sessions.delete(sid);
    return null;
  }
  return { sid, ...session };
}

function setSessionCookie(res, sid, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `vtime_session=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`);
}

function requireLogin(req, res, next) {
  const session = sessionFor(req);
  if (!session) return res.status(401).json({ error: 'Please sign in.' });
  req.session = session;
  next();
}

function requireCsrf(req, res, next) {
  if (req.get('X-CSRF-Token') !== req.session.csrf) return res.status(403).json({ error: 'Invalid session token.' });
  next();
}

function validateStaff(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const discordId = typeof body?.discordId === 'string' ? body.discordId.trim() : '';
  const timeZone = typeof body?.timeZone === 'string' ? body.timeZone.trim() : '';
  const availableFrom = typeof body?.availableFrom === 'string' ? body.availableFrom : '13:00';
  const availableUntil = typeof body?.availableUntil === 'string' ? body.availableUntil : '21:00';
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!name || name.length > 80) throw new Error('Name must be 1–80 characters.');
  if (!/^\d{17,20}$/.test(discordId)) throw new Error('Discord ID must be 17–20 digits.');
  if (!isValidTimeZone(timeZone)) throw new Error('Choose a valid IANA time zone.');
  if (!timePattern.test(availableFrom) || !timePattern.test(availableUntil) || availableFrom >= availableUntil) {
    throw new Error('Choose a valid availability window within one day.');
  }
  return { name, discordId, timeZone, availableFrom, availableUntil };
}

function sendDatabaseError(error, res) {
  if (error.code === '23505') return res.status(409).json({ error: 'This Discord ID is already in the list.' });
  console.error('Database request failed:', error.message);
  return res.status(503).json({ error: 'Database unavailable. Check the server connection.' });
}

app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.get('/api/me', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = sessionFor(req);
  res.json(session ? { authenticated: true, csrf: session.csrf } : { authenticated: false });
});

app.post('/api/login', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const record = attempts.get(ip);
  if (record && record.until > Date.now() && record.count >= 5) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }
  const candidate = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!sameSecret(candidate, password)) {
    const current = record && record.until > Date.now() ? record : { count: 0, until: Date.now() + LOCK_MS };
    current.count++;
    attempts.set(ip, current);
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  attempts.delete(ip);
  const sid = randomBytes(32).toString('hex');
  const csrf = randomBytes(24).toString('hex');
  sessions.set(sid, { csrf, expires: Date.now() + SESSION_MS });
  setSessionCookie(res, sid, Math.floor(SESSION_MS / 1000));
  res.json({ authenticated: true, csrf });
});

app.post('/api/logout', requireLogin, requireCsrf, (req, res) => {
  sessions.delete(req.session.sid);
  setSessionCookie(res, '', 0);
  res.json({ ok: true });
});

app.get('/api/staff', requireLogin, async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const result = await pool.query('select id, name, discord_id, time_zone, available_from, available_until from vtime.staff_members order by lower(name), id');
    res.json({ staff: result.rows });
  } catch (error) { sendDatabaseError(error, res); }
});

app.post('/api/staff', requireLogin, requireCsrf, async (req, res) => {
  let data;
  try { data = validateStaff(req.body); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    const result = await pool.query(
      'insert into vtime.staff_members (name, discord_id, time_zone, available_from, available_until) values ($1,$2,$3,$4,$5) returning id',
      [data.name, data.discordId, data.timeZone, data.availableFrom, data.availableUntil]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) { sendDatabaseError(error, res); }
});

app.put('/api/staff/:id', requireLogin, requireCsrf, async (req, res) => {
  let data;
  try { data = validateStaff(req.body); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid staff ID.' });
  try {
    const result = await pool.query(
      'update vtime.staff_members set name=$1, discord_id=$2, time_zone=$3, available_from=$4, available_until=$5 where id=$6 returning id',
      [data.name, data.discordId, data.timeZone, data.availableFrom, data.availableUntil, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Staff member not found.' });
    res.json({ id: result.rows[0].id });
  } catch (error) { sendDatabaseError(error, res); }
});

app.delete('/api/staff/:id', requireLogin, requireCsrf, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid staff ID.' });
  try {
    const result = await pool.query('delete from vtime.staff_members where id=$1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Staff member not found.' });
    res.json({ ok: true });
  } catch (error) { sendDatabaseError(error, res); }
});

app.get('/api/availability', requireLogin, async (req, res) => {
  const date = req.query.date;
  const zone = req.query.timeZone;
  if (!isValidDate(date) || !isValidTimeZone(zone)) return res.status(400).json({ error: 'Choose a valid date and time zone.' });
  try {
    const result = await pool.query('select time_zone, available_from, available_until from vtime.staff_members');
    res.set('Cache-Control', 'no-store');
    res.json(calculateAvailability(result.rows, date, zone));
  } catch (error) { sendDatabaseError(error, res); }
});

app.get('/admin', (_req, res) => res.sendFile(path.join(admin, 'index.html')));
app.use('/admin', express.static(admin, { index: false }));
app.use(express.static(dist));
app.use((error, _req, res, _next) => {
  console.error('Request failed:', error.message);
  res.status(error.status || 500).json({ error: error.status === 400 ? 'Invalid request body.' : 'Server error.' });
});

const server = app.listen(port, '0.0.0.0', () => console.log(`VTime listening on port ${port}`));
function shutdown() {
  server.close(() => pool.end().then(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
