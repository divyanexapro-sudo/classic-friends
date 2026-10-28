/* ============================================================
   Demo transport — runs the real engine + bots inside the browser.
   Same API as socket-client.js: connect(), act(), on(), signal()
   ============================================================ */
(function () {
  class MockClient {
    constructor() {
      this.mode = 'demo'; this.handlers = {}; this.myId = null;
      const Y = window.CF;
      this.engine = new Y.Engine({ catalog: Y.catalog, avatar: Y.avatar, startCoins: 1000 });
      this.bots = new Y.BotDirector(this.engine).hookRequests().seed(window.CF_CONFIG.DEMO_BOTS || 60);
      this.engine.on(ev => this.route(ev));
      this.bots.start();
    }
    route(ev) {
      const s = ev.scope || { all: true }; const me = this.myId; if (!me) return;
      const u = this.engine.user(me); const myRoom = u && u.roomId;
      let deliver = false;
      if (s.all) deliver = true; else if (s.room) deliver = s.room === myRoom; else if (s.user) deliver = s.user === me; else if (s.users) deliver = s.users.includes(me);
      if (!deliver) return;
      setTimeout(() => this.fire(ev.type, ev.payload, ev), 0);
    }
    fire(type, payload, ev) { for (const fn of (this.handlers[type] || []).slice()) { try { fn(payload, ev); } catch (e) { console.error('handler', type, e); } } for (const fn of (this.handlers['*'] || []).slice()) { try { fn(ev); } catch (e) { console.error(e); } } }
    on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); return () => this.off(type, fn); }
    off(type, fn) { this.handlers[type] = (this.handlers[type] || []).filter(f => f !== fn); }
    connect(params) {
      return new Promise((resolve, reject) => {
        const res = this.engine.login(params || {});
        if (!res.ok) return reject(new Error(res.error));
        this.myId = res.user.id; this.bots.onUserLogin(this.myId);
        resolve({ user: res.user, gifts: this.engine.giftCatalog, banners: this.engine.banners, serverTime: Date.now(), mode: 'demo' });
      });
    }
    act(name, params) {
      return new Promise(resolve => {
        setTimeout(() => {
          if (!this.myId) return resolve({ ok: false, error: 'Not signed in' });
          if (typeof this.engine[name] !== 'function') return resolve({ ok: false, error: 'Unknown action ' + name });
          let res; try { res = this.engine[name](this.myId, params || {}); } catch (e) { console.error(name, e); res = { ok: false, error: 'Something went wrong' }; }
          resolve(res);
        }, 30 + Math.random() * 60);
      });
    }
    signal() { /* no peers in demo mode */ }
    disconnect() { this.bots.stop(); }
  }
  window.MockClient = MockClient;
})();
