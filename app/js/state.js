/* Classic Friends state store — tiny observable key/value store */
(function () {
  const data = {
    me: null, mode: 'demo', connected: false,
    room: null,                 // the room I'm currently in (full room object, kept fresh by RoomCtl)
    rooms: [], banners: [], gifts: [],
    notifications: [], unreadNotif: 0,
    conversations: [], unreadDm: 0,
    speaking: {},               // userId → level (0..1)
    theme: 'dark', country: 'ALL'
  };
  const subs = {};
  const S = {
    get: k => data[k],
    set(k, v) { data[k] = v; (subs[k] || []).forEach(fn => { try { fn(v); } catch (e) { console.error(e); } }); return v; },
    patch(k, partial) { return S.set(k, Object.assign({}, data[k] || {}, partial)); },
    on(k, fn) { (subs[k] = subs[k] || []).push(fn); return () => { subs[k] = (subs[k] || []).filter(f => f !== fn); }; },
    get me() { return data.me; }, get room() { return data.room; }, get gifts() { return data.gifts; },
    all: () => data
  };
  window.S = S;
  window.Screens = window.Screens || {};
  // storage that never throws (private mode, embedded previews)
  window.LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } },
    sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } }
  };
})();
