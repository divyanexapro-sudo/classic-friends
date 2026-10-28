/* ============================================================
   Live transport — Socket.IO connection to server/index.js
   Same API as mock-client.js: connect(), act(), on(), signal()
   ============================================================ */
(function () {
  class SocketClient {
    constructor(url) { this.mode = 'live'; this.url = url || ''; this.handlers = {}; this.myId = null; this.secret = null; this.iceServers = null; this.socket = null; this.authParams = null; }
    on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); return () => this.off(type, fn); }
    off(type, fn) { this.handlers[type] = (this.handlers[type] || []).filter(f => f !== fn); }
    fire(type, payload, ev) { for (const fn of (this.handlers[type] || []).slice()) { try { fn(payload, ev); } catch (e) { console.error('handler', type, e); } } for (const fn of (this.handlers['*'] || []).slice()) { try { fn(ev); } catch (e) { console.error(e); } } }
    connect(params) {
      this.authParams = params;
      return new Promise((resolve, reject) => {
        if (!window.io) return reject(new Error('Socket.IO client not loaded'));
        if (!this.socket) {
          this.socket = window.io(this.url || undefined, { transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
          this.socket.on('ev', ev => this.fire(ev.type, ev.payload, ev));
          this.socket.on('rtc:signal', msg => this.fire('rtc:signal', msg));
          this.socket.on('disconnect', () => this.fire('net:disconnected', {}));
          this.socket.on('connect', () => { if (this.myId) this.socket.emit('auth', Object.assign({}, this.authParams, { id: this.myId, secret: this.secret }), res => { if (res && res.ok) this.fire('net:reconnected', res); else this.fire('net:auth-failed', res || {}); }); });
          this.socket.on('connect_error', e => this.fire('net:error', e));
        }
        const timer = setTimeout(() => reject(new Error('Server not responding')), 8000);
        const doAuth = () => this.socket.emit('auth', params || {}, res => { clearTimeout(timer); if (!res || !res.ok) return reject(new Error(res ? res.error : 'Auth failed')); this.myId = res.user.id; this.secret = res.secret || null; this.iceServers = res.iceServers || null; resolve(Object.assign(res, { mode: 'live' })); });
        if (this.socket.connected) doAuth(); else this.socket.once('connect', doAuth);
      });
    }
    act(name, params) {
      return new Promise(resolve => {
        if (!this.socket || !this.socket.connected) return resolve({ ok: false, error: 'You are offline. Reconnecting…' });
        const timer = setTimeout(() => resolve({ ok: false, error: 'Server timeout' }), 10000);
        this.socket.emit('act', { name, params: params || {} }, res => { clearTimeout(timer); resolve(res || { ok: false, error: 'No response' }); });
      });
    }
    signal(to, data, channel) { if (this.socket) this.socket.emit('rtc:signal', { to, data, channel }); }
    disconnect() { if (this.socket) this.socket.disconnect(); }
  }
  window.SocketClient = SocketClient;
})();
