/* ============================================================
   Classic Friends server
   Express (static + admin API) + Socket.IO (realtime) + WebRTC signaling.
   Run:  npm start     → http://localhost:3000
   Env:  PORT=3000  ADMIN_TOKEN=classicfriends-admin  BOTS=70  START_COINS=1000
         NODE_ENV=production  DATA_FILE=server/data/users.json  FREE_RECHARGE=1
         STUN_URLS=stun:a,stun:b  TURN_URLS=turn:host:3478  TURN_USERNAME=…  TURN_CREDENTIAL=…
   (see .env.example)
   ============================================================ */
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');

const catalog = require('../shared/catalog');
const avatar = require('../shared/avatar');
const Engine = require('../shared/engine');
const BotDirector = require('../shared/bots');

// load .env from the project root if present (no dependency needed)
try { const envFile = path.join(__dirname, '..', '.env'); if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*(#.*)?$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2]; } } catch (e) { }

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'classicfriends-admin';
const sameSecret = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const BOTS = process.env.BOTS == null ? 70 : Number(process.env.BOTS);
const START_COINS = process.env.START_COINS == null ? 1000 : Number(process.env.START_COINS);
const DATA_FILE = process.env.DATA_FILE ? path.resolve(process.env.DATA_FILE) : path.join(__dirname, 'data', 'users.json');
const PRODUCTION = process.env.NODE_ENV === 'production';
const DEFAULT_ADMIN_TOKEN = 'classicfriends-admin';
// in production the admin API stays locked until a real token is set
const ADMIN_LOCKED = PRODUCTION && (!process.env.ADMIN_TOKEN || ADMIN_TOKEN === DEFAULT_ADMIN_TOKEN || ADMIN_TOKEN.length < 16);
// coin packs are credited without a payment gateway; allowed for development/demo only unless explicitly enabled
const FREE_RECHARGE = process.env.FREE_RECHARGE != null ? process.env.FREE_RECHARGE === '1' : !PRODUCTION;
const list = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
const ICE_SERVERS = [
  ...list(process.env.STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302').map(urls => ({ urls })),
  ...(process.env.TURN_URLS ? [{ urls: list(process.env.TURN_URLS), username: process.env.TURN_USERNAME || '', credential: process.env.TURN_CREDENTIAL || '' }] : [])
];

const ROOT = path.join(__dirname, '..');
const app = express();
app.use(express.json({ limit: '200kb' }));

/* ---------- static sites ---------- */
app.use('/shared', express.static(path.join(ROOT, 'shared')));
app.use('/site', express.static(path.join(ROOT, 'website')));
app.use('/admin', express.static(path.join(ROOT, 'admin')));
app.use('/', express.static(path.join(ROOT, 'app')));
app.get('/room/:id', (req, res) => res.redirect('/#/room/' + encodeURIComponent(req.params.id)));
app.get('/healthz', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

/* ---------- engine + bots ---------- */
const engine = new Engine({ catalog, avatar, startCoins: START_COINS });
const bots = new BotDirector(engine).hookRequests();
if (BOTS > 0) bots.seed(BOTS);
restore();
bots.start();

/* ---------- device secrets ----------
   A user id is public (everyone in a room sees it), so it can't be the login credential on its own.
   Each account gets a random secret on first sign-in; the device keeps it and must present it again.
   Only a SHA-256 hash is kept in memory and in the data file. */
const secretHashes = new Map(); // userId → hex hash
const hashSecret = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const newSecret = () => crypto.randomBytes(24).toString('base64url');

/* ---------- persistence (real users only, every 30s) ---------- */
function snapshot() {
  const users = [];
  for (const u of engine.users.values()) {
    if (u.isBot) continue;
    users.push({
      id: u.id, name: u.name, gender: u.gender, country: u.country, avatar: u.avatar, bio: u.bio, birthday: u.birthday,
      level: u.level, xp: u.xp, charm: u.charm, coins: u.coins, diamonds: u.diamonds, vip: u.vip, vipUntil: u.vipUntil,
      equipped: u.equipped, inventory: u.inventory, badges: u.badges, checkIn: u.checkIn, stats: u.stats, settings: u.settings,
      periods: u.periods, createdAt: u.createdAt, banned: u.banned, following: [...u.following].filter(id => !engine.user(id) || !engine.user(id).isBot),
      friends: [...u.friends].filter(id => !engine.user(id) || !engine.user(id).isBot),
      secretHash: secretHashes.get(u.id) || null
    });
  }
  try { fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify({ savedAt: Date.now(), users }, null, 1)); } catch (e) { console.error('snapshot failed', e.message); }
}
function restore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const s of data.users || []) {
      const res = engine.login({ id: s.id, name: s.name, gender: s.gender, country: s.country, avatarSeed: s.avatar, bio: s.bio });
      if (!res.ok) continue;
      const u = engine.user(s.id);
      Object.assign(u, { bio: s.bio, birthday: s.birthday, level: s.level, xp: s.xp, charm: s.charm, coins: s.coins, diamonds: s.diamonds, vip: s.vip, vipUntil: s.vipUntil, equipped: s.equipped, inventory: s.inventory, badges: s.badges, checkIn: s.checkIn, stats: s.stats, settings: s.settings, periods: s.periods || {}, createdAt: s.createdAt, banned: s.banned, online: false });
      for (const id of s.following || []) if (engine.user(id)) { u.following.add(id); engine.user(id).followers.add(u.id); }
      for (const id of s.friends || []) if (engine.user(id)) { u.friends.add(id); engine.user(id).friends.add(u.id); }
      engine.notifications.set(u.id, []);
      if (s.secretHash) secretHashes.set(u.id, s.secretHash);
    }
    console.log(`restored ${data.users.length} users from ${DATA_FILE}`);
  } catch (e) { console.error('restore failed', e.message); }
}
setInterval(snapshot, 30000);
process.on('SIGINT', () => { snapshot(); process.exit(0); });
process.on('SIGTERM', () => { snapshot(); process.exit(0); });

/* ---------- realtime ---------- */
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, pingInterval: 10000, pingTimeout: 20000 });

// actions a client may call: engine.<name>(userId, params)
const ACTIONS = new Set([
  'updateProfile', 'getUser', 'searchUsers', 'suggestions', 'listRooms', 'createRoom', 'joinRoom', 'leaveRoom', 'closeRoom', 'updateRoom',
  'takeSeat', 'leaveSeat', 'muteSeat', 'lockSeat', 'removeFromSeat', 'inviteToSeat', 'approveMic', 'kickUser', 'setAdmin', 'speaking',
  'sendMessage', 'sendReaction', 'followRoom', 'shareRoom', 'setMusic', 'sendGift', 'startPk', 'spinWheel', 'rollDice', 'sendLuckyBag', 'grabLuckyBag',
  'rankings', 'followUser', 'friendRequest', 'acceptFriend', 'declineFriend', 'removeFriend', 'blockUser', 'reportUser', 'cpRequest', 'cpAccept', 'cpBreak',
  'sendDm', 'listConversations', 'getConversation', 'listNotifications', 'readNotifications',
  'postMoment', 'listMoments', 'likeMoment', 'commentMoment', 'deleteMoment',
  'recharge', 'exchangeDiamonds', 'buyItem', 'equipItem', 'buyVip', 'checkIn', 'claimTask',
  'createFamily', 'joinFamily', 'leaveFamily', 'listFamilies', 'getFamily'
]);

// route engine events to sockets by scope
engine.on(ev => {
  const s = ev.scope || { all: true };
  if (s.all) io.emit('ev', ev);
  else if (s.room) io.to('room:' + s.room).emit('ev', ev);
  else if (s.user) io.to('user:' + s.user).emit('ev', ev);
  else if (s.users) for (const id of s.users) io.to('user:' + id).emit('ev', ev);
});

const socketsByUser = new Map(); // userId → Set(socket)
function syncRoom(socket, userId) {
  const u = engine.user(userId); const want = u && u.roomId ? 'room:' + u.roomId : null;
  for (const r of socket.rooms) if (r.startsWith('room:') && r !== want) socket.leave(r);
  if (want && !socket.rooms.has(want)) socket.join(want);
}

io.on('connection', socket => {
  let userId = null;

  let budget = 30, budgetAt = Date.now(); // ~30 actions/s per socket, then requests are refused
  const allow = () => { const now = Date.now(); budget = Math.min(30, budget + (now - budgetAt) * 0.03); budgetAt = now; if (budget < 1) return false; budget--; return true; };

  socket.on('auth', (params, ack) => {
    if (typeof ack !== 'function') ack = null;
    const p = Object.assign({}, params && typeof params === 'object' ? params : {});
    delete p.isBot;                                     // only the server creates bots
    if (p.id != null) p.id = String(p.id).slice(0, 40);
    const existing = p.id ? engine.user(p.id) : null;
    if (userId && p.id !== userId) return ack && ack({ ok: false, error: 'Already signed in' });
    let secret = null;
    if (existing) {
      if (existing.isBot) return ack && ack({ ok: false, error: 'This account is not available' });
      const known = secretHashes.get(existing.id);
      if (known) { if (!sameSecret(hashSecret(p.secret), known)) return ack && ack({ ok: false, error: 'Your session has expired — please sign in again' }); }
      else { secret = newSecret(); secretHashes.set(existing.id, hashSecret(secret)); }   // account from before secrets existed: this device claims it
    } else {
      // new account (or one lost in a restart before it was saved): keep the device's secret if it sent one
      secret = typeof p.secret === 'string' && p.secret.length >= 24 && p.secret.length <= 64 ? p.secret : newSecret();
    }
    const res = engine.login(p);
    if (!res.ok) return ack && ack(res);
    if (!existing) secretHashes.set(res.user.id, hashSecret(secret));
    userId = res.user.id;
    socket.join('user:' + userId);
    if (!socketsByUser.has(userId)) socketsByUser.set(userId, new Set());
    socketsByUser.get(userId).add(socket);
    bots.onUserLogin(userId);
    syncRoom(socket, userId);
    ack && ack(Object.assign(res, { secret: secret || undefined, iceServers: ICE_SERVERS, serverTime: Date.now(), gifts: engine.giftCatalog, banners: engine.banners }));
  });

  socket.on('act', (msg, ack) => {
    if (typeof ack !== 'function') ack = null;
    if (!userId) return ack && ack({ ok: false, error: 'Not signed in' });
    const name = msg && msg.name;
    if (!ACTIONS.has(name)) return ack && ack({ ok: false, error: 'Unknown action' });
    if (!allow()) return ack && ack({ ok: false, error: 'Too many requests — slow down a little' });
    if (name === 'recharge' && !FREE_RECHARGE) return ack && ack({ ok: false, error: 'Payments are not set up on this server yet' });
    const params = Object.assign({}, msg.params || {});
    if (name === 'takeSeat') delete params.approved;   // only the engine may approve
    if (name === 'closeRoom') delete params.admin;
    let res;
    try { res = engine[name](userId, params); } catch (e) { console.error('action error', name, e); res = { ok: false, error: 'Something went wrong' }; }
    // keep every socket of this user in the right Socket.IO room
    for (const s of socketsByUser.get(userId) || []) syncRoom(s, userId);
    // if the action moved OTHER users (kick, close room) resync them too
    if (['kickUser', 'closeRoom', 'approveMic', 'removeFromSeat'].includes(name)) for (const [uid, set] of socketsByUser) for (const s of set) syncRoom(s, uid);
    ack && ack(res);
  });

  // WebRTC signaling relay (offer / answer / ice)
  // only between two people in the same room, only on their own channel, bounded size
  socket.on('rtc:signal', msg => {
    if (!userId || !msg || typeof msg.to !== 'string' || typeof msg.channel !== 'string' || !msg.data || typeof msg.data !== 'object') return;
    if (msg.channel !== userId + '>' + msg.to && msg.channel !== msg.to + '>' + userId) return;
    const me = engine.user(userId), peer = engine.user(msg.to);
    if (!me || !peer || !me.roomId || me.roomId !== peer.roomId) return;
    if (JSON.stringify(msg.data).length > 20000) return;
    io.to('user:' + msg.to).emit('rtc:signal', { from: userId, data: msg.data, channel: msg.channel });
  });

  socket.on('disconnect', () => {
    if (!userId) return;
    const set = socketsByUser.get(userId); if (set) { set.delete(socket); if (set.size) return; socketsByUser.delete(userId); }
    // grace period: a refresh reconnects within a few seconds
    setTimeout(() => { if (!socketsByUser.has(userId)) engine.logout(userId); }, 6000);
  });
});

// engine events that remove a user from a room should also update their sockets
engine.on(ev => {
  if (ev.type === 'room:kicked' || ev.type === 'room:closed' || ev.type === 'user:banned') {
    for (const [uid, set] of socketsByUser) for (const s of set) syncRoom(s, uid);
  }
});

/* ---------- admin API ---------- */
const admin = express.Router();
admin.use((req, res, next) => {
  if (ADMIN_LOCKED) return res.status(503).json({ ok: false, error: 'Admin API is disabled: set a strong ADMIN_TOKEN (16+ characters) on the server' });
  if (!sameSecret(req.headers['x-admin-token'] || req.query.token, ADMIN_TOKEN)) return res.status(401).json({ ok: false, error: 'Bad admin token' });
  next();
});
admin.get('/stats', (req, res) => res.json(engine.adminStats()));
admin.get('/users', (req, res) => res.json(engine.adminUsers({ q: req.query.q, page: req.query.page })));
admin.post('/users/:id', (req, res) => res.json(engine.adminUpdateUser(Object.assign({ id: req.params.id }, req.body))));
admin.get('/rooms', (req, res) => res.json(engine.adminRooms()));
admin.post('/rooms/:id/close', (req, res) => { const r = engine.room(req.params.id); res.json(r ? engine.closeRoom(r.hostId, { roomId: r.id, admin: true }) : { ok: false, error: 'No room' }); });
admin.get('/reports', (req, res) => res.json(engine.adminReports()));
admin.post('/reports/:id', (req, res) => res.json(engine.adminResolveReport(Object.assign({ id: req.params.id }, req.body))));
admin.get('/banners', (req, res) => res.json(engine.adminBanners()));
admin.post('/banners', (req, res) => res.json(engine.adminBanners({ set: req.body.banners })));
admin.get('/gifts', (req, res) => res.json(engine.adminGifts()));
admin.post('/gifts', (req, res) => res.json(engine.adminGifts({ update: req.body })));
admin.post('/broadcast', (req, res) => res.json(engine.adminBroadcast(req.body)));
app.use('/api/admin', admin);

server.listen(PORT, () => {
  console.log(`
  Classic Friends is running 🎤
  App      → http://localhost:${PORT}
  Website  → http://localhost:${PORT}/site/
  Admin    → http://localhost:${PORT}/admin/   (${ADMIN_LOCKED ? 'DISABLED — set ADMIN_TOKEN' : ADMIN_TOKEN === DEFAULT_ADMIN_TOKEN ? 'token: ' + DEFAULT_ADMIN_TOKEN : 'token from ADMIN_TOKEN'})
  Bots: ${BOTS}  ·  Rooms: ${engine.rooms.size}  ·  Users: ${engine.users.size}
`);
  if (ADMIN_TOKEN === DEFAULT_ADMIN_TOKEN && !PRODUCTION) console.warn('  ! Using the default admin token — set ADMIN_TOKEN before going live.');
  if (FREE_RECHARGE) console.warn('  ! FREE_RECHARGE is on: coin packs are credited without payment (dev/demo only).');
  if (!process.env.TURN_URLS) console.warn('  ! No TURN server (TURN_URLS): voice may fail for users on mobile data or strict networks.');
});
