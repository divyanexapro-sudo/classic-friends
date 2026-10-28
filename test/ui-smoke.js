/* ============================================================
   UI smoke test: opens every screen in a phone and a desktop viewport, against a real server with bots,
   and fails on console errors, uncaught exceptions, render failures or horizontal overflow.
   Run:  npm run test:ui        (needs Google Chrome or Microsoft Edge)
   Env:  CHROME=<path>   SHOTS=<dir> (save a screenshot of every screen)
   ============================================================ */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

const PORT = 3800 + Math.floor(Math.random() * 90);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-ui-'));
const SHOTS = process.env.SHOTS;
const wait = ms => new Promise(r => setTimeout(r, ms));
const procs = [];
const ROUTES = ['home', 'search', 'moments', 'messages', 'friends', 'notifications', 'me', 'edit-profile', 'settings', 'level', 'badges', 'visitors',
  'blocklist', 'help', 'about', 'store', 'wallet', 'vip', 'backpack', 'tasks', 'rankings', 'family', 'room', 'profile', 'chat'];
const VIEWPORTS = [{ name: 'phone', width: 390, height: 844, mobile: true }, { name: 'desktop', width: 1366, height: 900, mobile: false }];

function findChrome() {
  return [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && fs.existsSync(p));
}

(async () => {
  let failed = 0; const problems = [];
  try {
    const chrome = findChrome(); if (!chrome) throw new Error('Chrome/Edge not found — set CHROME=<path>');
    const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), BOTS: '30', DATA_FILE: path.join(TMP, 'users.json'), NODE_ENV: 'test' }), stdio: ['ignore', 'pipe', 'pipe'] });
    procs.push(srv); let slog = ''; srv.stdout.on('data', d => { slog += d; }); srv.stderr.on('data', d => { slog += d; });
    for (let i = 0; i < 60 && !slog.includes('is running'); i++) await wait(100);
    const dport = PORT + 100;
    procs.push(spawn(chrome, ['--headless=new', `--remote-debugging-port=${dport}`, `--user-data-dir=${path.join(TMP, 'chrome')}`, '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-first-run', 'about:blank'], { stdio: 'ignore' }));
    let target; for (let i = 0; i < 50 && !target; i++) { await wait(300); try { target = (await (await fetch(`http://127.0.0.1:${dport}/json`)).json()).find(t => t.type === 'page'); } catch (e) { } }
    const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.on('open', r));
    let id = 0; const pending = new Map(); let current = 'boot';
    ws.on('message', m => {
      const d = JSON.parse(m); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
      if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') problems.push(`[${current}] console.error: ${d.params.args.map(a => a.value || a.description).join(' ').slice(0, 300)}`);
      if (d.method === 'Runtime.exceptionThrown') { const x = d.params.exceptionDetails; problems.push(`[${current}] exception: ${(x.exception && x.exception.description || x.text).slice(0, 300)}`); }
    });
    const send = (method, params) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async expr => { const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception.description); return r.result.result.value; };
    await send('Runtime.enable'); await send('Page.enable');

    for (const vp of VIEWPORTS) {
      await send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile });
      await send('Page.navigate', { url: `http://localhost:${PORT}/#/auth` }); await wait(2500);
      current = vp.name + ':auth';
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, `${vp.name}-auth.png`), Buffer.from((await send('Page.captureScreenshot', {})).result.data, 'base64')); }
      if (!(await ev(`return !!S.me`))) await ev(`await App.login({ name: 'Smoke', gender: 'f', country: 'IN' }); return 1;`);
      await wait(800);
      // ids for parameterised routes: a live room, and another user
      const ids = await ev(`const r = await Net.act('listRooms', {}); const room = (r.rooms || [])[0]; return { room: room && room.id, user: room && room.host && room.host.id };`);
      for (const route of ROUTES) {
        current = vp.name + ':' + route;
        const hash = route === 'room' ? 'room/' + ids.room : route === 'profile' ? 'profile/' + ids.user : route === 'chat' ? 'chat/' + ids.user : route;
        if (route === 'room') await ev(`await RoomCtl.join(${JSON.stringify(ids.room)}); return 1;`); else await ev(`Router.go(${JSON.stringify(hash)}); return 1;`);
        await wait(900);
        const st = await ev(`const body = document.querySelector('#app'); const failed = !!document.querySelector('.empty .big') && /went wrong|error/i.test(document.body.innerText);
          const over = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;
          return { route: Router.current, failed, overflowPx: over, text: body ? body.innerText.length : 0 };`);
        if (st.failed) problems.push(`[${current}] screen shows an error state`);
        if (st.overflowPx > 1) problems.push(`[${current}] page scrolls sideways by ${st.overflowPx}px`);
        if (st.text < 10) problems.push(`[${current}] screen is empty`);
        if (SHOTS) fs.writeFileSync(path.join(SHOTS, `${vp.name}-${route}.png`), Buffer.from((await send('Page.captureScreenshot', {})).result.data, 'base64'));
      }
      await ev(`if (S.room) await RoomCtl.leave(true); return 1;`);
    }
    if (/TypeError|ReferenceError|action error|bot (timer|tick)/.test(slog)) problems.push('server log: ' + slog.split('\n').filter(l => /Error|bot (timer|tick)/.test(l)).slice(0, 5).join(' | '));
  } catch (e) { problems.push('ERROR ' + (e.stack || e)); }
  failed = problems.length;
  console.log(failed ? `UI smoke: ${failed} problem(s)\n  ` + problems.join('\n  ') : `UI smoke: ${ROUTES.length} screens × ${VIEWPORTS.length} viewports, no problems`);
  for (const p of procs) { try { p.kill(); } catch (e) { } }
  await wait(800); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { }
  process.exit(failed ? 1 : 0);
})();
