import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PRODUCTION = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const SECRET = process.env.SESSION_SECRET || (PRODUCTION ? '' : 'local-development-change-this-secret');
const ALLOW_DEMO = !PRODUCTION && process.env.ALLOW_DEMO === 'true';
const DB_PATH = path.resolve(process.env.DB_PATH || path.join(ROOT, 'data', 'vuon_sen.sqlite'));
const MAX_AGE = 24 * 60 * 60;
const SESSION_AGE = 12 * 60 * 60;
const USER_CAP = 300;
const COOLDOWNS = { lotus: 1500, incense: 6000, breathe: 20000 };
const REWARDS = { lotus: 1, incense: 3, breathe: 5 };
const ACTION_LABELS = { lotus: 'dâng hoa sen', incense: 'thắp hương', breathe: 'thiền an nhiên' };
const activeClients = new Map();
const online = new Map();
let nextStreamId = 1;

if (!SECRET || (PRODUCTION && !BOT_TOKEN)) {
  console.error('Thieu SESSION_SECRET hoac BOT_TOKEN (bat buoc trong production).');
  process.exit(1);
}
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  lotuses INTEGER NOT NULL DEFAULT 0,
  incenses INTEGER NOT NULL DEFAULT 0,
  breaths INTEGER NOT NULL DEFAULT 0,
  last_lotus INTEGER NOT NULL DEFAULT 0,
  last_incense INTEGER NOT NULL DEFAULT 0,
  last_breathe INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  action TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_time ON activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_points ON players(points DESC);`);

function hmac(text, key) { return crypto.createHmac('sha256', key).update(text).digest(); }
function equalHex(x, y) {
  if (!/^[a-f0-9]{64}$/i.test(x || '')) return false;
  const a = Buffer.from(x, 'hex'); const b = Buffer.from(y, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function verifyTelegramInitData(raw, botToken, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!raw || typeof raw !== 'string' || raw.length > 10000 || !botToken) throw Error('Thiếu thông tin xác thực Telegram');
  const p = new URLSearchParams(raw);
  const fieldNames = [...p.keys()];
  if (new Set(fieldNames).size !== fieldNames.length) throw Error('Dữ liệu Telegram trùng trường');
  const suppliedHash = p.get('hash');
  const checkString = [...p.entries()].filter(([key]) => key !== 'hash' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = hmac(botToken, 'WebAppData');
  const expected = hmac(checkString, secret).toString('hex');
  if (!equalHex(suppliedHash, expected)) throw Error('Chữ ký Telegram không hợp lệ');
  const authDate = Number(p.get('auth_date'));
  if (!Number.isInteger(authDate) || authDate > nowSeconds + 120 || nowSeconds - authDate > MAX_AGE) {
    throw Error('Phiên Telegram đã quá hạn, hãy mở lại Mini App');
  }
  let user;
  try { user = JSON.parse(p.get('user') || 'null'); } catch { throw Error('Dữ liệu Telegram user không hợp lệ'); }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) throw Error('Thiếu Telegram user ID');
  const name = String(user.first_name || user.username || 'Khách an lành').trim().slice(0, 42);
  return { id: `tg:${user.id}`, name: name || 'Khách an lành', mode: 'telegram' };
}
function signSession(info) {
  const body = Buffer.from(JSON.stringify({ ...info, exp: Date.now() + SESSION_AGE * 1000 })).toString('base64url');
  const sig = hmac(body, SECRET).toString('base64url');
  return `${body}.${sig}`;
}
function verifySession(token) {
  if (typeof token !== 'string' || token.length > 2500) throw Error('Phiên không hợp lệ');
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) throw Error('Phiên không hợp lệ');
  const expected = hmac(body, SECRET);
  const provided = Buffer.from(sig, 'base64url');
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) throw Error('Chữ ký phiên không hợp lệ');
  let value;
  try { value = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw Error('Phiên lỗi'); }
  if (!value || !value.id || !value.name || value.exp < Date.now() ||
      (!String(value.id).startsWith('tg:') && !ALLOW_DEMO)) throw Error('Phiên đã hết hạn');
  return value;
}
function bearer(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw Error('Vui lòng đăng nhập lại');
  return verifySession(header.slice(7));
}
function ensurePlayer(p) {
  const now = Date.now();
  db.prepare(`INSERT INTO players(id,name,created_at,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at`)
    .run(p.id, p.name, now, now);
  return db.prepare('SELECT * FROM players WHERE id=?').get(p.id);
}
function publicPlayer(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, points: row.points, lotuses: row.lotuses, incenses: row.incenses, breaths: row.breaths };
}
function presenceList() {
  return [...online.keys()].slice(0, 80).map(id => {
    const p = db.prepare('SELECT id,name,points FROM players WHERE id=?').get(id);
    return p ? { id: p.id, name: p.name, points: p.points } : null;
  }).filter(Boolean);
}
function snapshot(userId) {
  const me = db.prepare('SELECT * FROM players WHERE id=?').get(userId);
  const leaders = db.prepare('SELECT id,name,points,lotuses,incenses,breaths FROM players ORDER BY points DESC, created_at ASC LIMIT 12').all();
  const activity = db.prepare('SELECT name,action,points,created_at FROM activity ORDER BY id DESC LIMIT 12').all();
  const higher = me ? db.prepare('SELECT count(*) AS n FROM players WHERE points>?').get(me.points).n : 0;
  return {
    me: publicPlayer(me),
    cooldowns: me ? { lotus: Math.max(0, COOLDOWNS.lotus - (Date.now()-me.last_lotus)),
      incense: Math.max(0, COOLDOWNS.incense - (Date.now()-me.last_incense)),
      breathe: Math.max(0, COOLDOWNS.breathe - (Date.now()-me.last_breathe)) } : {},
    rank: higher + 1,
    leaders,
    activity,
    online: presenceList(),
    onlineCount: online.size,
    totalPlayers: db.prepare('SELECT count(*) AS n FROM players').get().n,
    updatedAt: Date.now()
  };
}
function sendEvent(res, event, data) {
  if (res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
function publish(event, data) {
  for (const client of activeClients.values()) sendEvent(client.res, event, data);
}
function publishPresence() { publish('presence', { online: presenceList(), onlineCount: online.size }); }
function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''; let size = 0;
    req.on('data', chunk => { size += chunk.length; if (size > 16000) { reject(Error('Dữ liệu gửi quá lớn')); req.destroy(); } else body += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(Error('JSON không hợp lệ')); } });
    req.on('error', reject);
  });
}
const mimetypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
function staticFile(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(PUBLIC, relative);
  if (!file.startsWith(PUBLIC + path.sep) && file !== PUBLIC) { json(res, 403, { error: 'Cấm truy cập' }); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { json(res, 404, { error: 'Không tìm thấy' }); return; }
    res.writeHead(200, { 'Content-Type': mimetypes[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=300' });
    fs.createReadStream(file).pipe(res);
  });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const route = url.pathname;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // Embedded Telegram app uses its own webview. Self-hosted JS and CDN Three.js only.
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://telegram.org https://cdn.jsdelivr.net; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self' https://web.telegram.org https://*.telegram.org");
  if (req.method === 'OPTIONS') return json(res, 405, { error: 'Không hỗ trợ' });
  try {
    if (route === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, version: '2.0.0', mode: ALLOW_DEMO ? 'demo' : 'telegram' });
    if (route === '/api/login' && req.method === 'POST') {
      const body = await readJson(req);
      let person;
      if (typeof body.initData === 'string' && body.initData.length > 0) {
        person = verifyTelegramInitData(body.initData, BOT_TOKEN);
      } else if (ALLOW_DEMO && typeof body.demoId === 'string' && /^[a-f0-9-]{20,60}$/.test(body.demoId)) {
        person = { id: `demo:${body.demoId}`, name: String(body.name || 'Khách thử').trim().slice(0, 32) || 'Khách thử', mode: 'demo' };
      } else throw Error('Vui lòng mở ứng dụng bằng Telegram');
      ensurePlayer(person);
      return json(res, 200, { token: signSession(person), user: person, demo: person.mode === 'demo' });
    }
    if (route === '/api/state' && req.method === 'GET') {
      const user = bearer(req);
      ensurePlayer(user);
      return json(res, 200, snapshot(user.id));
    }
    if (route === '/api/action' && req.method === 'POST') {
      const user = bearer(req);
      const body = await readJson(req);
      const action = body.action;
      if (!Object.hasOwn(REWARDS, action)) return json(res, 400, { error: 'Hành động không hợp lệ' });
      const player = ensurePlayer(user);
      const now = Date.now();
      const key = `last_${action}`;
      const remain = COOLDOWNS[action] - (now - player[key]);
      if (remain > 0) return json(res, 429, { error: 'Bạn vừa thực hiện hành động, hãy thử lại', retryMs: remain });
      // Daily cap on server per user, makes scripted point farming less attractive.
      const actionsToday = db.prepare('SELECT count(*) AS n FROM activity WHERE user_id=? AND created_at>=?')
        .get(user.id, now - 24 * 3600 * 1000).n;
      if (actionsToday >= 200) return json(res, 429, { error: 'Bạn đã đạt giới hạn 200 hoạt động trong 24 giờ' });
      const field = { lotus: 'lotuses', incense: 'incenses', breathe: 'breaths' }[action];
      const statement = db.prepare(`UPDATE players SET points=points+?, ${field}=${field}+1, ${key}=?, updated_at=? WHERE id=?`);
      db.exec('BEGIN IMMEDIATE');
      try {
        statement.run(REWARDS[action], now, now, user.id);
        db.prepare('INSERT INTO activity(user_id,name,action,points,created_at) VALUES(?,?,?,?,?)')
          .run(user.id, user.name, action, REWARDS[action], now);
        db.exec('COMMIT');
      } catch (err) { db.exec('ROLLBACK'); throw err; }
      const entry = { id: user.id, name: user.name, action, label: ACTION_LABELS[action], points: REWARDS[action], timestamp: now };
      publish('activity', entry);
      publish('rankings', { leaders: db.prepare('SELECT id,name,points FROM players ORDER BY points DESC LIMIT 12').all() });
      return json(res, 200, { ok: true, me: publicPlayer(db.prepare('SELECT * FROM players WHERE id=?').get(user.id)), activity: entry, cooldownMs: COOLDOWNS[action] });
    }
    if (route === '/api/events' && req.method === 'GET') {
      const user = bearer(req);
      ensurePlayer(user);
      const count = [...activeClients.values()].filter(c => c.userId === user.id).length;
      if (count >= 3) return json(res, 429, { error: 'Quá nhiều kết nối cho một tài khoản' });
      if (activeClients.size >= USER_CAP) return json(res, 503, { error: 'Phòng đang đầy. Hãy thử lại.' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      const key = nextStreamId++;
      activeClients.set(key, { userId: user.id, res });
      online.set(user.id, (online.get(user.id) || 0) + 1);
      sendEvent(res, 'hello', { ...snapshot(user.id), welcome: 'Chào mừng tới Vườn Sen!' });
      publishPresence();
      const ping = setInterval(() => { if (!res.destroyed) res.write(': ping\n\n'); }, 18000);
      const disconnect = () => {
        if (!activeClients.has(key)) return;
        clearInterval(ping);
        activeClients.delete(key);
        const n = (online.get(user.id) || 1) - 1;
        if (n <= 0) online.delete(user.id); else online.set(user.id, n);
        publishPresence();
      };
      req.on('close', disconnect);
      return;
    }
    if (req.method === 'GET') return staticFile(req, res, route);
    return json(res, 405, { error: 'Phương thức không được hỗ trợ' });
  } catch (err) {
    if (!res.headersSent) json(res, /Phiên|Telegram|xác thực|đăng nhập|Chữ ký|hết hạn|Thiếu/.test(err.message) ? 401 : 400, { error: err.message });
  }
});

if (process.env.VUON_SEN_NO_LISTEN !== '1') server.listen(PORT, '0.0.0.0', () => {
  console.log(`🪷 Vườn Sen An Lành chạy tại http://localhost:${PORT}`);
  console.log(`Đăng nhập: ${ALLOW_DEMO ? 'DEMO local' : 'Telegram signed initData'}`);
  console.log(`Dữ liệu: ${DB_PATH}`);
});

export { server, db, signSession, verifySession };
