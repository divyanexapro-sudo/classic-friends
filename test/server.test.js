/* Server tests: auth secrets, signaling relay, payments gate, admin lock, rate limit, bots.
   Run:  npm test        (each test starts its own server on a spare port with a throwaway data file) */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const io = require(path.join(__dirname, '..', 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));

const wait = ms => new Promise(r => setTimeout(r, ms));
let nextPort = 4100 + Math.floor(Math.random() * 500);

async function startServer(env = {}, users) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-test-')); const dataFile = path.join(dir, 'users.json');
  if (users) fs.writeFileSync(dataFile, JSON.stringify({ savedAt: Date.now(), users }));
  const port = nextPort++;
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: Object.assign({}, process.env, { PORT: String(port), BOTS: '0', DATA_FILE: dataFile, NODE_ENV: 'test', ADMIN_TOKEN: '', FREE_RECHARGE: '' }, env), stdio: ['ignore', 'pipe', 'pipe']
  });
  const srv = { port, url: `http://localhost:${port}`, log: '', sockets: [], proc: p };
  p.stdout.on('data', d => { srv.log += d; }); p.stderr.on('data', d => { srv.log += d; });
  for (let i = 0; i < 60 && !srv.log.includes('is running'); i++) await wait(100);
  if (!srv.log.includes('is running')) throw new Error('server did not start:\n' + srv.log);
  srv.stop = async () => { srv.sockets.forEach(s => s.disconnect()); p.kill(); await wait(200); fs.rmSync(dir, { recursive: true, force: true }); };
  return srv;
}
function client(srv) {
  const s = io(srv.url, { transports: ['websocket'], forceNew: true, reconnection: false }); srv.sockets.push(s);
  s.call = (ev, data) => new Promise(r => s.emit(ev, data, r));
  s.act = (name, params) => s.call('act', { name, params });
  return new Promise((res, rej) => { s.once('connect', () => res(s)); s.once('connect_error', rej); });
}
// collect rtc:signal messages a socket receives
const inbox = s => { const got = []; s.on('rtc:signal', m => got.push(m)); return got; };
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

test('new account gets a secret; the id alone cannot sign in; the secret can', async () => {
  const srv = await startServer();
  try {
    const a = await client(srv); const r = await a.call('auth', { name: 'Alice' });
    assert.ok(r.ok); assert.ok(typeof r.secret === 'string' && r.secret.length >= 24, 'secret issued');
    assert.ok(Array.isArray(r.iceServers) && r.iceServers.length > 0, 'ICE servers sent to the client');
    const m = await client(srv);
    assert.strictEqual((await m.call('auth', { id: r.user.id, name: 'Mallory' })).ok, false, 'id only → refused');
    assert.strictEqual((await m.call('auth', { id: r.user.id, secret: 'x'.repeat(32) })).ok, false, 'wrong secret → refused');
    const again = await (await client(srv)).call('auth', { id: r.user.id, secret: r.secret });
    assert.ok(again.ok); assert.strictEqual(again.user.id, r.user.id); assert.strictEqual(again.secret, undefined, 'secret not re-sent');
    assert.strictEqual((await a.call('auth', { id: 'someone-else' })).ok, false, 'a signed-in socket cannot switch accounts');
  } finally { await srv.stop(); }
});

test('saved secrets survive a restart; accounts saved before secrets existed are claimed once', async () => {
  const good = 'g'.repeat(32);
  const srv = await startServer({}, [
    { id: 'u-saved', name: 'Saved', gender: 'f', country: 'IN', coins: 50, secretHash: sha(good) },
    { id: 'u-legacy', name: 'Legacy', gender: 'm', country: 'IN', coins: 70 }
  ]);
  try {
    assert.strictEqual((await (await client(srv)).call('auth', { id: 'u-saved' })).ok, false);
    const ok = await (await client(srv)).call('auth', { id: 'u-saved', secret: good });
    assert.ok(ok.ok); assert.strictEqual(ok.user.coins, 50);
    const claim = await (await client(srv)).call('auth', { id: 'u-legacy' });
    assert.ok(claim.ok && claim.secret, 'legacy account gets a secret on first sign-in');
    assert.strictEqual((await (await client(srv)).call('auth', { id: 'u-legacy' })).ok, false, 'and then needs it');
  } finally { await srv.stop(); }
});

test('bot accounts cannot be signed into and isBot is ignored from clients', async () => {
  const srv = await startServer({ BOTS: '5' });
  try {
    const a = await client(srv); await a.call('auth', { name: 'Real', isBot: true });
    const found = await a.act('searchUsers', { q: 'a' });
    const users = found.users || found.results || [];
    const bot = users.find(u => u.name !== 'Real');
    if (bot) assert.strictEqual((await (await client(srv)).call('auth', { id: bot.id })).ok, false, 'bot id refused');
    const rooms = await a.act('listRooms', {});
    const host = (rooms.rooms || []).map(r => r.host && r.host.id).find(Boolean);
    if (host) assert.strictEqual((await (await client(srv)).call('auth', { id: host })).ok, false, 'bot host id refused');
    assert.ok(bot || host, 'found a bot id to try');
  } finally { await srv.stop(); }
});

test('signaling is relayed only between people in the same room, on their own channel', async () => {
  const srv = await startServer();
  try {
    const a = await client(srv), b = await client(srv), c = await client(srv);
    const ra = await a.call('auth', { name: 'A' }), rb = await b.call('auth', { name: 'B' }), rc = await c.call('auth', { name: 'C' });
    const gotB = inbox(b), gotC = inbox(c);
    const room = await a.act('createRoom', { title: 'r1' }); await b.act('joinRoom', { roomId: room.room.id });
    await c.act('createRoom', { title: 'r2' });
    a.emit('rtc:signal', { to: rb.user.id, channel: ra.user.id + '>' + rb.user.id, data: { want: true } });
    a.emit('rtc:signal', { to: rc.user.id, channel: ra.user.id + '>' + rc.user.id, data: { want: true } });   // other room
    a.emit('rtc:signal', { to: rb.user.id, channel: rc.user.id + '>' + rb.user.id, data: { want: true } });   // forged channel
    a.emit('rtc:signal', { to: rb.user.id, channel: ra.user.id + '>' + rb.user.id, data: { big: 'x'.repeat(30000) } }); // too big
    a.emit('rtc:signal', { to: rb.user.id, channel: ra.user.id + '>' + rb.user.id, data: 'nope' });
    await wait(400);
    assert.strictEqual(gotB.length, 1, 'only the valid same-room message reaches B');
    assert.deepStrictEqual(gotB[0], { from: ra.user.id, channel: ra.user.id + '>' + rb.user.id, data: { want: true } });
    assert.strictEqual(gotC.length, 0, 'nothing reaches someone in another room');
  } finally { await srv.stop(); }
});

test('coin recharge: allowed in development, refused in production unless FREE_RECHARGE=1', async () => {
  const dev = await startServer();
  try { const s = await client(dev); await s.call('auth', { name: 'D' }); const r = await s.act('recharge', { packId: 'p100' }); assert.ok(r.ok, r.error); assert.ok(r.coins > 100); }
  finally { await dev.stop(); }
  const prod = await startServer({ NODE_ENV: 'production', ADMIN_TOKEN: 'a-very-long-admin-token-123' });
  try { const s = await client(prod); await s.call('auth', { name: 'P' }); const r = await s.act('recharge', { packId: 'p100' }); assert.strictEqual(r.ok, false); assert.match(r.error, /Payments are not set up/); }
  finally { await prod.stop(); }
});

test('admin API: default token works in development, is disabled in production, wrong token is refused', async () => {
  const dev = await startServer();
  try {
    assert.strictEqual((await fetch(dev.url + '/api/admin/stats', { headers: { 'x-admin-token': 'classicfriends-admin' } })).status, 200);
    assert.strictEqual((await fetch(dev.url + '/api/admin/stats', { headers: { 'x-admin-token': 'wrong' } })).status, 401);
  } finally { await dev.stop(); }
  const prod = await startServer({ NODE_ENV: 'production' });
  try {
    assert.strictEqual((await fetch(prod.url + '/api/admin/stats', { headers: { 'x-admin-token': 'classicfriends-admin' } })).status, 503);
    assert.doesNotMatch(prod.log, /token: classicfriends-admin/, 'banner does not advertise the token');
  } finally { await prod.stop(); }
  const prodOk = await startServer({ NODE_ENV: 'production', ADMIN_TOKEN: 'a-very-long-admin-token-123' });
  try {
    assert.strictEqual((await fetch(prodOk.url + '/api/admin/stats', { headers: { 'x-admin-token': 'a-very-long-admin-token-123' } })).status, 200);
    assert.doesNotMatch(prodOk.log, /a-very-long-admin-token-123/, 'real token never printed');
  } finally { await prodOk.stop(); }
});

test('actions are rate limited per socket', async () => {
  const srv = await startServer();
  try {
    const s = await client(srv); await s.call('auth', { name: 'R' });
    const res = await Promise.all(Array.from({ length: 80 }, () => s.act('listRooms', {})));
    assert.ok(res.some(r => r.ok), 'normal requests pass');
    assert.ok(res.some(r => r.error && /Too many requests/.test(r.error)), 'a burst is throttled');
  } finally { await srv.stop(); }
});

test('server with BOTS=0 does not throw from bot timers after a login', async () => {
  const srv = await startServer({ BOTS: '0' });
  try {
    const s = await client(srv); await s.call('auth', { name: 'Solo' });
    await wait(10000);   // the friend-request timer fires at 9 s
    assert.doesNotMatch(srv.log, /TypeError|bot timer/);
  } finally { await srv.stop(); }
});
