/* ============================================================
   Classic Friends app bootstrap + router
   ============================================================ */
(function () {
  const { $, el, I, toast, esc } = UI;
  const SESSION_KEY = 'classicfriends.session';
  window.Screens = window.Screens || {};
  const MAIN_TABS = ['home', 'moments', 'messages', 'friends', 'me'];

  /* ---------- router ---------- */
  const Router = {
    stack: [], current: null, cleanup: null, scroll: {},
    parse() { const h = location.hash.replace(/^#\/?/, '') || 'home'; const [path, qs] = h.split('?'); const parts = path.split('/'); const params = Object.fromEntries(new URLSearchParams(qs || '')); return { name: parts[0], id: parts[1] ? decodeURIComponent(parts[1]) : null, params }; },
    go(path, opts) { opts = opts || {}; const hash = '#/' + path.replace(/^\/?/, ''); if (opts.replace) { history.replaceState(null, '', hash); Router.handle(); } else if (location.hash === hash) Router.handle(); else location.hash = hash; },
    back(fallback) { if (Router.stack.length > 1) history.back(); else Router.go(fallback || 'home', { replace: true }); },
    handle() {
      const r = Router.parse(); const screen = Screens[r.name] || Screens.home;
      if (!S.me && r.name !== 'auth') { Router.go('auth', { replace: true }); return; }
      const app = $('#app'); const prev = $('.screen', app);
      if (prev) { Router.scroll[Router.current] = ($('.screen-body', prev) || {}).scrollTop || 0; }
      if (Router.cleanup) { try { Router.cleanup(); } catch (e) { console.error(e); } Router.cleanup = null; }
      Router.stack.push(r.name); if (Router.stack.length > 40) Router.stack.shift();
      const node = el(`<section class="screen ${screen.nav ? 'with-nav' : ''}" data-screen="${r.name}"></section>`);
      if (prev) prev.replaceWith(node); else app.appendChild(node);
      Router.current = r.name;
      try { const c = screen.render(node, r); if (typeof c === 'function') Router.cleanup = c; } catch (e) { console.error('render', r.name, e); node.innerHTML = `<div class="empty"><div class="big">😵</div><h3>Something broke</h3><p>${esc(e.message)}</p><button class="btn mt-4" onclick="Router.go('home')">Go home</button></div>`; }
      if (screen.nav) { renderNav(r.name); if (Router.scroll[r.name]) { const b = $('.screen-body', node); if (b) b.scrollTop = Router.scroll[r.name]; } }
      else { const nav = $('.bottom-nav', app); if (nav) nav.remove(); }
      if (window.RoomCtl) RoomCtl.renderMini();
      window.scrollTo(0, 0);
    }
  };
  window.addEventListener('hashchange', () => Router.handle());
  window.Router = Router;

  function renderNav(active) {
    const app = $('#app'); let nav = $('.bottom-nav', app);
    if (!Screens[active] || !Screens[active].nav) { if (nav) nav.remove(); return; }
    const unread = (S.get('unreadDm') || 0);
    const html = `
      <button data-go="home" class="${active === 'home' ? 'active' : ''}">${I.home}<span>Rooms</span></button>
      <button data-go="moments" class="${active === 'moments' ? 'active' : ''}">${I.sparkles}<span>Moments</span></button>
      <button class="nav-create" data-create aria-label="Create a room"><span class="ring">${I.mic}</span></button>
      <button data-go="messages" class="${active === 'messages' ? 'active' : ''}">${I.chat}<span>Chats</span>${unread ? `<i class="dot">${unread > 99 ? '99+' : unread}</i>` : ''}</button>
      <button data-go="me" class="${active === 'me' ? 'active' : ''}">${I.user}<span>Me</span></button>`;
    if (!nav) { nav = el('<nav class="bottom-nav"></nav>'); app.appendChild(nav); nav.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; UI.haptic(); if (b.hasAttribute('data-create')) Screens.home.createRoomSheet(); else Router.go(b.dataset.go); }); }
    nav.innerHTML = html;
  }
  window.renderNav = () => renderNav(Router.current);

  /* ---------- transport ---------- */
  function loadScript(src, ms) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load failed')); document.head.appendChild(s); setTimeout(() => rej(new Error('timeout')), ms || 5000); }); }
  async function pickTransport() {
    const cfg = window.CF_CONFIG;
    if (cfg.MODE === 'demo') return new MockClient();
    if (cfg.MODE === 'live' || location.protocol.startsWith('http')) {
      try { if (!window.io) await loadScript((cfg.SERVER_URL || '') + '/socket.io/socket.io.js', 4000); return new SocketClient(cfg.SERVER_URL); }
      catch (e) { if (cfg.MODE === 'live') throw new Error('Cannot reach the Classic Friends server. Start it with "npm start".'); }
    }
    return new MockClient();
  }

  /* ---------- app ---------- */
  const App = {
    async init() {
      const theme = LS.get('classicfriends.theme') || 'dark'; document.documentElement.dataset.theme = theme; S.set('theme', theme);
      const splash = $('#splash');
      try { window.Net = await pickTransport(); } catch (e) { splash.remove(); $('#app').innerHTML = `<div class="empty" style="padding-top:120px"><div class="big">📡</div><h3>Server not reachable</h3><p>${esc(e.message)}</p></div>`; return; }
      S.set('mode', Net.mode);
      if (Net.mode === 'live') Voice.warmup();
      const saved = JSON.parse(LS.get(SESSION_KEY) || 'null');
      setTimeout(async () => {
        if (saved && saved.name) {
          try { await App.login(saved); } catch (e) { console.warn('auto-login failed', e.message); LS.del(SESSION_KEY); Router.go('auth', { replace: true }); }
        } else Router.go('auth', { replace: true });
        splash.classList.add('closing'); setTimeout(() => splash.remove(), 400);
      }, 900);
    },
    async login(params) {
      const res = await Net.connect(params);
      S.set('me', res.user); S.set('gifts', res.gifts || CF.catalog.GIFTS); S.set('banners', res.banners || []); S.set('freeRecharge', res.freeRecharge !== false);
      // `secret` is this device's proof of owning the account (live server only); without it the id alone can't sign in
      LS.set(SESSION_KEY, JSON.stringify({ id: res.user.id, secret: res.secret || params.secret, name: res.user.name, gender: res.user.gender, country: res.user.country, avatarSeed: res.user.avatar }));
      App.bindGlobal();
      const r = Router.parse();
      if (r.name === 'room' && r.id) { Router.go('home', { replace: true }); RoomCtl.join(r.id); }
      else if (r.name === 'auth' || !r.name) Router.go('home', { replace: true });
      else Router.handle();
      App.refreshBadges();
      if (Net.mode === 'demo' && !LS.sget('classicfriends.demo-note')) { LS.sset('classicfriends.demo-note', '1'); setTimeout(() => toast('Demo mode — rooms are simulated. Run the server for real voice.', '', 3200), 1500); }
    },
    logout() {
      try { RoomCtl.leave(true); } catch (e) { }
      LS.del(SESSION_KEY); S.set('me', null);
      Net.act('logout'); location.hash = '#/auth'; location.reload();
    },
    bound: false,
    bindGlobal() {
      if (App.bound) return; App.bound = true;
      Net.on('user:update', u => { S.set('me', u); });
      Net.on('user:notification', n => {
        const list = S.get('notifications'); list.unshift(n); S.set('notifications', list.slice(0, 60)); S.set('unreadNotif', (S.get('unreadNotif') || 0) + 1);
        if (n.silent) return; if (Router.current === 'notifications') return;
        const kinds = { gift: 'gold', levelup: 'gold', 'friend-request': '', 'friend-accepted': 'ok', cp: 'ok' };
        if (n.type === 'dm') return; toast(esc(n.text), kinds[n.type] || '', 2600);
      });
      Net.on('dm:message', p => { if (p.message.to === S.me.id && Router.current !== 'chat') { S.set('unreadDm', (S.get('unreadDm') || 0) + 1); renderNav(Router.current); toast(`💬 ${esc(p.from.name)}: ${esc(p.message.text || p.message.gift.emoji)}`, '', 2400); } });
      Net.on('friend:request', p => { /* notification covers the toast */ });
      Net.on('user:banned', p => { toast('Your account was suspended: ' + esc(p.reason), 'err', 5000); setTimeout(App.logout, 1500); });
      Net.on('net:disconnected', () => toast('Connection lost — reconnecting…', 'err'));
      Net.on('net:reconnected', () => { toast('Back online', 'ok'); RoomCtl.resync(); App.refreshBadges(); });
      Net.on('net:auth-failed', res => { toast(esc(res.error || 'Please sign in again'), 'err', 4000); setTimeout(App.logout, 1500); });
      Net.on('rtc:signal', msg => Voice.handleSignal(msg));
      Net.on('moments:new', () => { });
      document.addEventListener('click', () => Voice.resumeAudio(), { once: true });
      RoomCtl.bind();
    },
    async refreshBadges() {
      const n = await Net.act('listNotifications'); if (n.ok) { S.set('notifications', n.notifications); S.set('unreadNotif', n.unread); }
      const c = await Net.act('listConversations'); if (c.ok) { S.set('conversations', c.conversations); S.set('unreadDm', c.conversations.reduce((a, x) => a + x.unread, 0)); renderNav(Router.current); }
    }
  };
  window.App = App;

  // close sheets with Escape / Android back
  document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.closeTop(); });
  document.addEventListener('DOMContentLoaded', () => App.init());
})();
