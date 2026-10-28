/* ============================================================
   End-to-end voice test: two real Chrome instances (fake mic = test tone) talk through the app.
   Starts its own server on a spare port with a throwaway data file, so real users are never touched.
   Run:  npm run test:voice        (needs Google Chrome or Microsoft Edge installed)
   Env:  CHROME=<path to chrome/edge>   DEBUG=1 (print signaling + long tasks)   KEEP=1 (leave browser profiles)
   ============================================================ */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

const DEBUG = process.env.DEBUG === '1';
const PORT = 3900 + Math.floor(Math.random() * 90);
const URL = `http://localhost:${PORT}/`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-voice-'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const procs = [];

function findChrome() {
  const c = [process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return c.find(p => p && fs.existsSync(p));
}

async function startServer() {
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT), BOTS: '0', DATA_FILE: path.join(TMP, 'users.json'), NODE_ENV: 'test' }), stdio: ['ignore', 'pipe', 'pipe']
  });
  procs.push(p);
  let log = ''; p.stdout.on('data', d => { log += d; }); p.stderr.on('data', d => { log += d; if (DEBUG) process.stderr.write('[server] ' + d); });
  for (let i = 0; i < 50; i++) { if (log.includes('is running')) return () => log; await wait(100); }
  throw new Error('server did not start:\n' + log);
}

async function browser(chrome, name, port) {
  const p = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(TMP, 'chrome-' + name)}`,
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required',
    '--no-first-run', '--no-default-browser-check', URL], { stdio: 'ignore' });
  procs.push(p);
  let target;
  for (let i = 0; i < 50 && !target; i++) { await wait(300); try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); target = list.find(t => t.type === 'page'); } catch (e) { } }
  if (!target) throw new Error(name + ': browser did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.on('open', r));
  let id = 0; const pending = new Map(); const errors = [];
  ws.on('message', m => {
    const d = JSON.parse(m); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(d.params.type)) {
      const text = d.params.args.map(a => a.value || a.description).join(' ');
      if (d.params.type === 'error') errors.push(text);
      if (DEBUG || d.params.type === 'error') console.log(`  [${name} console.${d.params.type}]`, text);
    }
    if (d.method === 'Runtime.exceptionThrown') { const t = d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text; errors.push(t); console.log(`  [${name} exception]`, t); }
  });
  const send = (method, params) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(name + ': ' + (r.result.exceptionDetails.exception ? r.result.exceptionDetails.exception.description : r.result.exceptionDetails.text));
    return r.result.result.value;
  };
  for (let i = 0; i < 40; i++) { if (await ev('return !!(window.Net && window.App && window.Net.connect)')) break; await wait(250); }
  ev.errors = errors; ev.send = send;
  return ev;
}

// logs signaling + long main-thread tasks (DEBUG only)
const HOOK = `const n = Net, ts = () => Math.round((performance.timeOrigin + performance.now()) % 100000);
  const os = n.signal.bind(n); n.signal = (to, d, ch) => { console.warn('SEND', ts(), ch, Object.keys(d).join(','), (d.sdp && d.sdp.type) || ''); os(to, d, ch); };
  const of = n.fire.bind(n); n.fire = (t, p, e) => { if (t === 'rtc:signal') console.warn('RECV', ts(), p.channel, Object.keys(p.data).join(','), (p.data.sdp && p.data.sdp.type) || '');
    if (t.startsWith('room:member') || t === 'room:seats') console.warn('EV  ', ts(), t); return of(t, p, e); };
  window.__lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([Math.round((performance.timeOrigin + e.startTime) % 100000), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); return 1;`;

// stats for every voice connection in this page
const STATS = `
  const out = []; const rows = async (pc, dir, peer) => { const s = await pc.getStats(); let bytes = 0, level = null;
    s.forEach(r => { if (r.kind === 'audio' && r.type === (dir === 'out' ? 'outbound-rtp' : 'inbound-rtp')) bytes += dir === 'out' ? r.bytesSent : r.bytesReceived;
      if (dir === 'in' && r.type === 'inbound-rtp' && r.kind === 'audio' && r.audioLevel != null) level = r.audioLevel; });
    out.push({ dir, peer, state: pc.connectionState, bytes, level }); };
  for (const [id, x] of Voice.out) await rows(x.pc || x, 'out', id);
  for (const [id, x] of Voice.inn) await rows(x.pc, 'in', id);
  return { micActive: Voice.active, mutedTrack: Voice.stream ? !Voice.stream.getAudioTracks()[0].enabled : null, conns: out,
    audioEls: [...document.querySelectorAll('audio[data-peer]')].map(a => ({ hasStream: !!a.srcObject, paused: a.paused })) };`;

// poll until fn(stats) is true or the timeout passes; returns [ok, ms, lastStats]
async function until(page, fn, timeout) {
  const t0 = Date.now(); let s;
  while (Date.now() - t0 < timeout) { s = await page(STATS); if (fn(s)) return [true, Date.now() - t0, s]; await wait(200); }
  return [false, Date.now() - t0, s];
}
const inFrom = (s, id) => s.conns.find(c => c.dir === 'in' && c.peer === id);
const outTo = (s, id) => s.conns.find(c => c.dir === 'out' && c.peer === id);
const hearing = (s, id) => { const c = inFrom(s, id); return !!(c && c.state === 'connected' && c.bytes > 500 && c.level > 0); };

(async () => {
  let failed = 0; const check = (ok, msg) => { console.log((ok ? '  PASS ' : '  FAIL ') + msg); if (!ok) failed++; };
  const CONNECT_MS = 5000; // a listener must hear the speaker within this
  try {
    const chrome = findChrome(); if (!chrome) throw new Error('Chrome/Edge not found — set CHROME=<path>');
    const serverLog = await startServer();
    const A = await browser(chrome, 'alice', PORT + 100), B = await browser(chrome, 'bob', PORT + 101);
    if (DEBUG) { await A(HOOK); await B(HOOK); }

    console.log('\n1. Login both users');
    const ra = await A(`await App.login({ name: 'Alice', gender: 'f', country: 'IN' }); return { id: S.me.id, mode: Net.mode };`);
    const rb = await B(`await App.login({ name: 'Bob', gender: 'm', country: 'IN' }); return { id: S.me.id, mode: Net.mode };`);
    check(ra.mode === 'live' && rb.mode === 'live', `both connected to the server in live mode (A=${ra.mode}, B=${rb.mode})`);
    const saved = await A(`return JSON.parse(localStorage.getItem('classicfriends.session'))`);
    check(saved && saved.id === ra.id && typeof saved.secret === 'string' && saved.secret.length >= 24, 'Alice device stored its account secret');

    console.log('\n1b. Account takeover attempt (Bob knows Alice\'s public id)');
    const takeover = await B(`const tryAuth = p => new Promise(r => { const s = io({ forceNew: true, transports: ['websocket'] }); s.emit('auth', p, res => { s.disconnect(); r(res); }); });
      const noSecret = await tryAuth({ id: ${JSON.stringify(ra.id)}, name: 'Mallory' });
      const wrong = await tryAuth({ id: ${JSON.stringify(ra.id)}, secret: 'x'.repeat(32) });
      const right = await tryAuth({ id: ${JSON.stringify(ra.id)}, secret: ${JSON.stringify(saved && saved.secret)} });
      return { noSecret: noSecret.ok, wrong: wrong.ok, right: right.ok, msg: noSecret.error };`);
    check(takeover.noSecret === false && takeover.wrong === false, `signing in with only the id is refused ("${takeover.msg}")`);
    check(takeover.right === true, 'signing in with the correct secret still works');
    check(await A(`return S.me.name`) === 'Alice', 'Alice name not changed by the attempt');

    console.log('\n2. Alice creates a room (host takes mic seat 1 and turns on the mic)');
    const roomId = await A(`const r = await Net.act('createRoom', { title: 'Voice test' }); if (!r.ok) throw new Error(r.error); RoomCtl.enter(r.room); return r.room.id;`);
    let [ok] = await until(A, s => s.micActive, 4000);
    check(ok, 'Alice microphone captured (getUserMedia ok)');

    console.log('\n3. Bob joins as a listener while Alice is already speaking');
    await B(`await RoomCtl.join(${JSON.stringify(roomId)}); return true;`);
    let [heard, ms, sb] = await until(B, s => hearing(s, ra.id), CONNECT_MS);
    check(heard, `Bob hears Alice (${heard ? ms + ' ms' : 'not within ' + CONNECT_MS + ' ms: ' + JSON.stringify(sb.conns)})`);
    check(sb.audioEls.length === 1 && sb.audioEls[0].hasStream && !sb.audioEls[0].paused, 'Bob has exactly one playing audio element');

    console.log('\n4. Bob takes mic seat 3, so audio goes both ways');
    await B(`await RoomCtl.takeSeat(2); return true;`);
    let sa; [heard, ms, sa] = await until(A, s => hearing(s, rb.id), CONNECT_MS);
    check(heard, `Alice hears Bob (${heard ? ms + ' ms' : 'not within ' + CONNECT_MS + ' ms'})`);
    [heard] = await until(B, s => hearing(s, ra.id), 2000);
    check(heard, 'Bob still hears Alice');

    console.log('\n5. Alice mutes, then unmutes');
    await A(`await RoomCtl.toggleMute(); return true;`);
    [ok, ms, sb] = await until(B, s => { const c = inFrom(s, ra.id); return c && c.level != null && c.level < 0.001; }, 4000);
    check((await A(STATS)).mutedTrack === true, 'Alice mic track disabled');
    check(ok, 'Bob hears silence from Alice');
    await A(`await RoomCtl.toggleMute(); return true;`);
    [ok] = await until(B, s => hearing(s, ra.id), 4000);
    check(ok, 'Bob hears Alice again after unmute');

    console.log('\n6. Bob refreshes the page (session recovery)');
    await B.send('Page.reload', {});
    await wait(1500);
    for (let i = 0; i < 40; i++) { try { if (await B('return !!(window.S && S.me && S.room)')) break; } catch (e) { } await wait(250); }
    if (DEBUG) await B(HOOK);
    const inRoom = await B(`return !!(S.room && S.room.id === ${JSON.stringify(roomId)})`);
    check(inRoom, 'Bob is back in the room after refresh');
    [heard, ms, sb] = await until(B, s => hearing(s, ra.id), 8000);
    check(heard, `Bob hears Alice after refresh (${heard ? ms + ' ms' : 'no: ' + JSON.stringify(sb && sb.conns)})`);

    console.log('\n7. Bob leaves the mic seat, then leaves the room');
    await B(`if (RoomCtl.mySeat < 0) await RoomCtl.takeSeat(2); await RoomCtl.leaveSeat(); return true;`);
    [ok, ms, sa] = await until(A, s => !inFrom(s, rb.id), 4000);
    sb = await B(STATS);
    check(!sb.micActive && !sb.conns.some(c => c.dir === 'out'), 'Bob mic released and his outgoing connection closed');
    check(ok, 'Alice closed her incoming connection from Bob');
    await B(`await RoomCtl.leave(); return true;`);
    [ok] = await until(A, s => !outTo(s, rb.id), 4000);
    sb = await B(STATS);
    check(ok && sb.conns.length === 0 && sb.audioEls.length === 0, 'everything torn down after Bob leaves the room');

    console.log('\n8. Microphone denied');
    const denied = await A(`const orig = navigator.mediaDevices.getUserMedia; await RoomCtl.leaveSeat(); navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }));
      await RoomCtl.takeSeat(0); await new Promise(r => setTimeout(r, 300)); navigator.mediaDevices.getUserMedia = orig;
      return { active: Voice.active, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ') };`);
    check(!denied.active && /microphone/i.test(denied.toast), `denied mic shows a message and stays off (toast: "${denied.toast}")`);

    if (DEBUG) { console.log('\n  Alice long tasks [time,ms]:', JSON.stringify(await A('return window.__lt || []'))); console.log('  Bob long tasks [time,ms]:', JSON.stringify(await B('return window.__lt || []'))); }
    const errs = [...A.errors, ...B.errors];
    check(errs.length === 0, `no console errors in either browser${errs.length ? ': ' + errs.join(' / ') : ''}`);
    const slog = serverLog(); check(!/error/i.test(slog), 'no errors in the server log');
  } catch (e) { console.error('ERROR', e.stack || e); failed++; }
  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll voice checks passed');
  for (const p of procs) { try { p.kill(); } catch (e) { } }
  await wait(800);
  if (!process.env.KEEP) { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { } }
  process.exit(failed ? 1 : 0);
})();
