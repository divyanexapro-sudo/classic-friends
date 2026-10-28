/* ============================================================
   Classic Friends realtime engine
   All product rules live here: users, rooms, mic seats, chat, gifts,
   levels, wallet, store, friends, DMs, moments, families, games, admin.

   The same file runs:
     • on the server  (server/index.js wires it to Socket.IO)
     • in the browser (app/js/net/mock-client.js runs it locally for demo mode)

   Every action: engine.<action>(userId, params) → { ok:true, ...data } | { ok:false, error }
   Every change:  engine.on(({ type, payload, scope }) => ...) where
                  scope = { room:id } | { user:id } | { users:[ids] } | { all:true }
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.CF = root.CF || {}; root.CF.Engine = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BANNED_WORDS = ['fuck', 'bitch', 'bastard', 'madarchod', 'bhenchod', 'randi'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function periodKeys(ts) {
    const d = new Date(ts);
    const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const month = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
    const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getUTCDay() + 1) / 7);
    return { day, week: `${d.getUTCFullYear()}-W${pad(week)}`, month };
  }

  class Engine {
    constructor(opts) {
      opts = opts || {};
      this.catalog = opts.catalog;
      this.avatar = opts.avatar;
      this.now = opts.now || (() => Date.now());
      this.startCoins = opts.startCoins == null ? 1000 : opts.startCoins;
      this.users = new Map();
      this.rooms = new Map();
      this.families = new Map();
      this.moments = [];
      this.dms = new Map();          // pairKey → [messages]
      this.reports = [];
      this.banners = [
        { id: 'b1', title: 'Weekend Gift Carnival', sub: 'Double XP on every gift until Sunday', emoji: '🎁', style: 'linear-gradient(135deg,#8B5CF6,#F043A6)' },
        { id: 'b2', title: 'Karaoke Battle', sub: 'Top 3 singers win 5,000 coins', emoji: '🎤', style: 'linear-gradient(135deg,#F043A6,#FFB547)' },
        { id: 'b3', title: 'Family Week', sub: 'Create a family and earn badges', emoji: '🏠', style: 'linear-gradient(135deg,#2DD4BF,#60A5FA)' }
      ];
      this.giftCatalog = (this.catalog.GIFTS || []).map(g => Object.assign({ active: true }, g));
      this.listeners = [];
      this.notifications = new Map(); // userId → []
      this.luckyBags = new Map();
      this._seq = 1;
      this.stats = { giftsToday: 0, coinsSpentToday: 0, roomsCreated: 0, messages: 0 };
    }

    /* ------------------------------------------------------------ events */
    on(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(f => f !== fn); }; }
    emit(type, payload, scope) { const ev = { type, payload, scope: scope || { all: true }, ts: this.now() }; for (const fn of this.listeners) { try { fn(ev); } catch (e) { console.error('listener error', e); } } }

    /* ------------------------------------------------------------ helpers */
    id(prefix) { const n = Math.floor(100000 + Math.random() * 900000); const s = String(n) + String(this._seq++ % 10); return prefix ? prefix + s : s; }
    err(error) { return { ok: false, error }; }
    user(id) { return this.users.get(id); }
    room(id) { return this.rooms.get(id); }
    clean(text) { return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300); }
    moderate(text) { let t = text; for (const w of BANNED_WORDS) t = t.replace(new RegExp(w, 'gi'), m => m[0] + '*'.repeat(m.length - 1)); return t; }
    pairKey(a, b) { return [a, b].sort().join('|'); }

    pubUser(u) {
      if (!u) return null;
      return {
        id: u.id, name: u.name, avatar: u.avatar, gender: u.gender, country: u.country, bio: u.bio,
        level: u.level, vip: u.vip, frame: u.equipped.frame, bubble: u.equipped.bubble, entry: u.equipped.entry, wave: u.equipped.wave,
        familyId: u.familyId, familyBadge: u.familyId && this.families.get(u.familyId) ? this.families.get(u.familyId).badge : null,
        cp: u.cp ? { userId: u.cp.userId, bond: u.cp.bond } : null,
        online: u.online, roomId: u.roomId, isBot: !!u.isBot, banned: !!u.banned,
        followers: u.followers.size, following: u.following.size, friends: u.friends.size,
        charm: u.charm, wealth: u.xp, createdAt: u.createdAt
      };
    }
    fullUser(u) {
      const p = this.pubUser(u);
      return Object.assign(p, {
        coins: u.coins, diamonds: u.diamonds, xp: u.xp, nextXp: this.catalog.xpForLevel(Math.min(100, u.level + 1)), curXp: u.level <= 1 ? 0 : this.catalog.xpForLevel(u.level),
        birthday: u.birthday, phone: u.phone, email: u.email,
        followingIds: [...u.following], friendIds: [...u.friends], friendRequests: [...u.friendRequests].map(id => this.pubUser(this.user(id))).filter(Boolean),
        followedRooms: [...u.followedRooms], blocked: [...u.blocked],
        inventory: u.inventory, equipped: u.equipped, badges: u.badges, checkIn: u.checkIn,
        tasks: this.taskProgress(u), stats: u.stats, settings: u.settings, vipUntil: u.vipUntil,
        cpRequestFrom: u.cpRequestFrom || null, visitors: (u.visitors || []).slice(0, 20).map(v => ({ ts: v.ts, user: this.pubUser(this.user(v.userId)) })).filter(v => v.user)
      });
    }
    pubRoom(r) {
      const host = this.pubUser(this.user(r.hostId));
      return {
        id: r.id, title: r.title, tag: r.tag, lang: r.lang, country: r.country, hostId: r.hostId, host,
        cover: r.cover, theme: r.theme, locked: r.locked, seatCount: r.seatCount, micMode: r.micMode,
        memberCount: r.members.size, followers: r.followers.size, totalGifts: r.totalGifts, createdAt: r.createdAt,
        seats: r.seats.map(s => ({ index: s.index, muted: s.muted, locked: s.locked, user: this.pubUser(this.user(s.userId)) })),
        pk: r.pk, music: r.music, announcement: r.announcement, hot: r.hot || 0
      };
    }
    fullRoom(r, forUserId) {
      const p = this.pubRoom(r);
      const contributions = [...r.contributions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([uid, coins]) => ({ user: this.pubUser(this.user(uid)), coins })).filter(c => c.user);
      return Object.assign(p, {
        messages: r.messages.slice(-60), admins: [...r.admins], banned: [...r.banned], applicants: [...r.applicants],
        members: [...r.members].map(id => this.pubUser(this.user(id))).filter(Boolean),
        contributions, welcome: r.welcome, password: forUserId === r.hostId ? r.password : undefined,
        luckyBags: [...this.luckyBags.values()].filter(b => b.roomId === r.id && b.remaining > 0).map(b => this.pubBag(b)),
        isFollowing: forUserId ? r.followers.has(forUserId) : false
      });
    }
    pubBag(b) { return { id: b.id, roomId: b.roomId, from: this.pubUser(this.user(b.from)), coins: b.coins, count: b.count, remaining: b.remaining, message: b.message, createdAt: b.createdAt, grabs: b.grabs.map(g => ({ user: this.pubUser(this.user(g.userId)), coins: g.coins })) }; }

    notify(userId, n) {
      const u = this.user(userId); if (!u || u.isBot) return;
      const list = this.notifications.get(userId) || [];
      const item = Object.assign({ id: this.id('n'), ts: this.now(), read: false }, n);
      list.unshift(item); if (list.length > 60) list.length = 60;
      this.notifications.set(userId, list);
      this.emit('user:notification', item, { user: userId });
    }
    pushUser(u) { if (!u.isBot) this.emit('user:update', this.fullUser(u), { user: u.id }); }
    addXp(u, amount) {
      u.xp += amount;
      const k = periodKeys(this.now());
      for (const key of [k.day, k.week, k.month]) { const s = u.periods[key] || (u.periods[key] = { xp: 0, charm: 0 }); s.xp += amount; }
      const lv = this.catalog.levelFromXp(u.xp);
      if (lv > u.level) { u.level = lv; this.notify(u.id, { type: 'levelup', text: `You reached Level ${lv}! 🎉`, data: { level: lv } }); if (u.roomId) this.emit('room:levelup', { user: this.pubUser(u), level: lv }, { room: u.roomId }); }
    }
    addCharm(u, amount) {
      u.charm += amount;
      const k = periodKeys(this.now());
      for (const key of [k.day, k.week, k.month]) { const s = u.periods[key] || (u.periods[key] = { xp: 0, charm: 0 }); s.charm += amount; }
    }
    sysMessage(r, text, extra) {
      const m = Object.assign({ id: this.id('m'), type: 'system', text, ts: this.now() }, extra || {});
      r.messages.push(m); if (r.messages.length > 200) r.messages.splice(0, r.messages.length - 200);
      this.emit('room:message', { roomId: r.id, message: m }, { room: r.id });
      return m;
    }
    progressTask(u, taskId, n) {
      if (!u || u.isBot) return;
      const k = periodKeys(this.now()).day;
      if (u.tasks.day !== k) u.tasks = { day: k, progress: {}, claimed: {} };
      u.tasks.progress[taskId] = (u.tasks.progress[taskId] || 0) + (n || 1);
    }
    taskProgress(u) {
      const k = periodKeys(this.now()).day;
      if (u.tasks.day !== k) u.tasks = { day: k, progress: {}, claimed: {} };
      return this.catalog.DAILY_TASKS.map(t => ({ id: t.id, label: t.label, reward: t.reward, target: t.target, progress: Math.min(t.target, u.tasks.progress[t.id] || 0), claimed: !!u.tasks.claimed[t.id] }));
    }

    /* ------------------------------------------------------------ auth & profile */
    login(params) {
      params = params || {};
      let u = params.id ? this.user(params.id) : null;
      if (!u) {
        const id = params.id || this.id();
        u = {
          id, name: this.clean(params.name) || 'Friend ' + id.slice(-3), gender: params.gender === 'm' ? 'm' : 'f',
          country: params.country || 'IN', avatar: params.avatarSeed || ('u' + id), bio: this.clean(params.bio) || 'Hey there, I am using Classic Friends!',
          birthday: params.birthday || null, phone: params.phone || null, email: params.email || null,
          level: 1, xp: 0, charm: 0, coins: this.startCoins, diamonds: 0, vip: 0, vipUntil: 0,
          equipped: { frame: null, bubble: null, entry: null, theme: 'th-lounge', wave: 'mw-classic' }, inventory: [],
          following: new Set(), followers: new Set(), friends: new Set(), friendRequests: new Set(), blocked: new Set(), followedRooms: new Set(),
          familyId: null, cp: null, cpRequestFrom: null, visitors: [], badges: ['early'], checkIn: { last: null, streak: 0 },
          tasks: { day: null, progress: {}, claimed: {} }, periods: {}, stats: { giftsSent: 0, giftsReceived: 0, roomsHosted: 0, micMinutes: 0 },
          settings: { theme: 'dark', notifications: true, privacy: { hideVisits: false, allowDm: 'everyone' }, language: 'en' },
          createdAt: this.now(), online: true, roomId: null, isBot: !!params.isBot, banned: false, lastSeen: this.now()
        };
        this.users.set(id, u);
        if (!u.isBot) this.notify(id, { type: 'system', text: `Welcome to Classic Friends, ${u.name}! You got ${this.startCoins} coins to start 🎉` });
      } else {
        if (u.banned) return this.err('This account is suspended. Contact support.');
        u.online = true; u.lastSeen = this.now();
        if (params.name) u.name = this.clean(params.name);
      }
      return { ok: true, user: this.fullUser(u) };
    }
    logout(userId) { const u = this.user(userId); if (!u) return this.err('No user'); this.leaveRoom(userId); u.online = false; u.lastSeen = this.now(); return { ok: true }; }
    updateProfile(userId, p) {
      const u = this.user(userId); if (!u) return this.err('No user');
      if (p.name) u.name = this.clean(p.name).slice(0, 24);
      if (p.bio != null) u.bio = this.clean(p.bio).slice(0, 120);
      if (p.gender) u.gender = p.gender === 'm' ? 'm' : 'f';
      if (p.country) u.country = p.country;
      if (p.avatarSeed) u.avatar = p.avatarSeed;
      if (p.birthday !== undefined) u.birthday = p.birthday;
      if (p.settings) Object.assign(u.settings, p.settings);
      this.pushUser(u);
      if (u.roomId) this.emit('room:member-updated', { user: this.pubUser(u) }, { room: u.roomId });
      return { ok: true, user: this.fullUser(u) };
    }
    getUser(userId, p) {
      const t = this.user(p && p.id); if (!t) return this.err('User not found');
      const viewer = this.user(userId);
      if (viewer && viewer.id !== t.id && !viewer.isBot && !(viewer.settings.privacy.hideVisits && viewer.vip >= 4)) {
        t.visitors = (t.visitors || []).filter(v => v.userId !== viewer.id); t.visitors.unshift({ userId: viewer.id, ts: this.now() }); t.visitors.length = Math.min(t.visitors.length, 30);
        if (!t.isBot) this.notify(t.id, { type: 'visit', text: `${viewer.name} visited your profile`, from: this.pubUser(viewer) });
      }
      const p2 = this.pubUser(t);
      p2.isFriend = viewer ? viewer.friends.has(t.id) : false;
      p2.isFollowing = viewer ? viewer.following.has(t.id) : false;
      p2.requestSent = t.friendRequests.has(userId);
      p2.badges = t.badges; p2.stats = t.stats; p2.family = t.familyId ? this.pubFamily(this.families.get(t.familyId)) : null;
      p2.room = t.roomId && this.room(t.roomId) ? this.pubRoom(this.room(t.roomId)) : null;
      p2.moments = this.moments.filter(m => m.userId === t.id).slice(0, 10).map(m => this.pubMoment(m, userId));
      return { ok: true, user: p2 };
    }
    searchUsers(userId, p) {
      const q = this.clean(p && p.q).toLowerCase(); if (!q) return { ok: true, users: [] };
      const out = []; for (const u of this.users.values()) { if (u.id === userId) continue; if (u.id.includes(q) || u.name.toLowerCase().includes(q)) out.push(this.pubUser(u)); if (out.length >= 30) break; }
      return { ok: true, users: out };
    }
    suggestions(userId) {
      const me = this.user(userId); const out = [];
      for (const u of this.users.values()) { if (u.id === userId || (me && me.friends.has(u.id))) continue; out.push(this.pubUser(u)); }
      out.sort((a, b) => (b.online - a.online) || (b.level - a.level));
      return { ok: true, users: out.slice(0, 20) };
    }

    /* ------------------------------------------------------------ rooms */
    listRooms(userId, p) {
      p = p || {}; const me = this.user(userId);
      let list = [...this.rooms.values()].filter(r => !r.closed);
      if (p.country) list = list.filter(r => r.country === p.country);
      if (p.tag) list = list.filter(r => r.tag === p.tag);
      if (p.q) { const q = p.q.toLowerCase(); list = list.filter(r => r.title.toLowerCase().includes(q) || r.id.includes(q) || (this.user(r.hostId) && this.user(r.hostId).name.toLowerCase().includes(q))); }
      if (p.tab === 'following' && me) list = list.filter(r => r.followers.has(userId) || me.following.has(r.hostId) || me.friends.has(r.hostId));
      if (p.tab === 'new') list.sort((a, b) => b.createdAt - a.createdAt);
      else if (p.tab === 'games') list = list.filter(r => ['gaming', 'ludo', 'cricket'].includes(r.tag));
      else list.sort((a, b) => (b.members.size * 10 + b.totalGifts / 100) - (a.members.size * 10 + a.totalGifts / 100));
      return { ok: true, rooms: list.map(r => this.pubRoom(r)), banners: this.banners };
    }
    createRoom(userId, p) {
      const u = this.user(userId); if (!u) return this.err('No user');
      p = p || {};
      if (u.roomId) this.leaveRoom(userId);
      const seatCount = p.seatCount === 12 ? 12 : 8;
      const id = this.id();
      const r = {
        id, title: this.clean(p.title).slice(0, 40) || `${u.name}'s room`, tag: p.tag || 'chat', lang: p.lang || 'Hindi', country: u.country,
        hostId: userId, cover: p.cover || ('c' + id), theme: p.theme || u.equipped.theme || 'th-lounge', locked: !!p.locked, password: p.locked ? String(p.password || '').slice(0, 8) : '',
        seatCount, micMode: p.micMode === 'apply' ? 'apply' : 'free', announcement: this.clean(p.announcement).slice(0, 140), welcome: this.clean(p.welcome).slice(0, 80) || 'Welcome! Be kind and have fun 🎉',
        seats: Array.from({ length: seatCount }, (_, i) => ({ index: i, userId: null, muted: false, locked: false })),
        members: new Set(), admins: new Set(), banned: new Set(), applicants: new Set(), invited: new Set(), followers: new Set(),
        messages: [], contributions: new Map(), totalGifts: 0, createdAt: this.now(), music: null, pk: null, hot: 0, closed: false, persistent: !!p.persistent
      };
      this.rooms.set(id, r); this.stats.roomsCreated++;
      u.stats.roomsHosted++;
      if (u.stats.roomsHosted >= 10 && !u.badges.includes('host10')) u.badges.push('host10');
      const join = this.joinRoom(userId, { roomId: id, password: r.password });
      this.emit('rooms:changed', { roomId: id }, { all: true });
      return join;
    }
    joinRoom(userId, p) {
      const u = this.user(userId); if (!u) return this.err('No user');
      const r = this.room(p && p.roomId); if (!r || r.closed) return this.err('This room has ended');
      if (r.banned.has(userId)) return this.err('You are blocked from this room');
      if (r.locked && userId !== r.hostId && !r.admins.has(userId) && String(p.password || '') !== r.password) return this.err('Wrong room password');
      if (u.roomId && u.roomId !== r.id) this.leaveRoom(userId);
      const already = r.members.has(userId);
      r.members.add(userId); u.roomId = r.id;
      if (!already) {
        if (userId === r.hostId && !r.seats[0].userId) { r.seats[0].userId = userId; r.seats[0].muted = false; }
        const entry = u.equipped.entry ? this.catalog.storeById(u.equipped.entry) : null;
        this.emit('room:member-joined', { roomId: r.id, user: this.pubUser(u), memberCount: r.members.size, entry: entry ? { name: entry.name, emoji: entry.emoji } : null, seats: r.seats.map(s => ({ index: s.index, muted: s.muted, locked: s.locked, user: this.pubUser(this.user(s.userId)) })) }, { room: r.id });
        this.sysMessage(r, `${u.name} joined the room`, { type: 'join', user: this.pubUser(u) });
        this.progressTask(u, 'rooms', 1);
        this.emit('rooms:changed', { roomId: r.id }, { all: true });
      }
      return { ok: true, room: this.fullRoom(r, userId) };
    }
    leaveRoom(userId) {
      const u = this.user(userId); if (!u || !u.roomId) return { ok: true };
      const r = this.room(u.roomId); u.roomId = null; if (!r) return { ok: true };
      r.members.delete(userId); r.applicants.delete(userId);
      for (const s of r.seats) if (s.userId === userId) { s.userId = null; s.muted = false; }
      this.emit('room:member-left', { roomId: r.id, userId, memberCount: r.members.size, seats: r.seats.map(s => ({ index: s.index, muted: s.muted, locked: s.locked, user: this.pubUser(this.user(s.userId)) })) }, { room: r.id });
      if (r.members.size === 0 && !r.persistent) { r.closed = true; this.rooms.delete(r.id); }
      this.emit('rooms:changed', { roomId: r.id }, { all: true });
      return { ok: true };
    }
    closeRoom(userId, p) {
      const r = this.room(p && p.roomId); if (!r) return this.err('No room');
      if (r.hostId !== userId && !(p && p.admin)) return this.err('Only the host can end the room');
      r.closed = true;
      this.emit('room:closed', { roomId: r.id }, { room: r.id });
      for (const id of [...r.members]) { const m = this.user(id); if (m) m.roomId = null; }
      r.members.clear(); this.rooms.delete(r.id);
      this.emit('rooms:changed', { roomId: r.id }, { all: true });
      return { ok: true };
    }
    canManage(r, userId) { return r.hostId === userId || r.admins.has(userId); }
    updateRoom(userId, p) {
      const r = this.room(p && p.roomId); if (!r) return this.err('No room');
      if (!this.canManage(r, userId)) return this.err('Only host or admins can change room settings');
      if (p.title) r.title = this.clean(p.title).slice(0, 40);
      if (p.announcement != null) r.announcement = this.clean(p.announcement).slice(0, 140);
      if (p.welcome != null) r.welcome = this.clean(p.welcome).slice(0, 80);
      if (p.theme) r.theme = p.theme;
      if (p.tag) r.tag = p.tag;
      if (p.lang) r.lang = p.lang;
      if (p.cover) r.cover = p.cover;
      if (p.micMode) r.micMode = p.micMode === 'apply' ? 'apply' : 'free';
      if (p.locked != null) { r.locked = !!p.locked; r.password = r.locked ? String(p.password || r.password || '').slice(0, 8) : ''; }
      if (p.seatCount && [8, 12].includes(p.seatCount) && p.seatCount !== r.seatCount) {
        if (p.seatCount < r.seatCount) { for (const s of r.seats.slice(p.seatCount)) if (s.userId) { s.userId = null; } r.seats.length = p.seatCount; }
        else for (let i = r.seats.length; i < p.seatCount; i++) r.seats.push({ index: i, userId: null, muted: false, locked: false });
        r.seatCount = p.seatCount;
      }
      this.emit('room:updated', this.pubRoom(r), { room: r.id });
      if (p.announcement != null) this.sysMessage(r, `📢 ${r.announcement}`, { type: 'announcement' });
      this.emit('rooms:changed', { roomId: r.id }, { all: true });
      return { ok: true, room: this.fullRoom(r, userId) };
    }
    seatsOf(r) { return r.seats.map(s => ({ index: s.index, muted: s.muted, locked: s.locked, user: this.pubUser(this.user(s.userId)) })); }
    broadcastSeats(r) { this.emit('room:seats', { roomId: r.id, seats: this.seatsOf(r) }, { room: r.id }); }
    takeSeat(userId, p) {
      const u = this.user(userId); if (!u || !u.roomId) return this.err('Join a room first');
      const r = this.room(u.roomId); const idx = Number(p && p.index);
      const seat = r.seats[idx]; if (!seat) return this.err('No such seat');
      if (idx === 0 && userId !== r.hostId) return this.err('Seat 1 is the host seat');
      if (seat.userId && seat.userId !== userId) return this.err('Seat is taken');
      if (seat.locked && !this.canManage(r, userId)) return this.err('Seat is locked');
      if (r.micMode === 'apply' && !this.canManage(r, userId) && !(p && p.approved) && !r.invited.has(userId)) { r.applicants.add(userId); this.emit('room:applicants', { roomId: r.id, applicants: [...r.applicants].map(id => this.pubUser(this.user(id))) }, { room: r.id }); return { ok: true, applied: true }; }
      for (const s of r.seats) if (s.userId === userId) { s.userId = null; }
      seat.userId = userId; seat.muted = false; r.applicants.delete(userId); r.invited.delete(userId);
      u.micSince = this.now();
      this.broadcastSeats(r);
      return { ok: true, index: idx };
    }
    leaveSeat(userId) {
      const u = this.user(userId); if (!u || !u.roomId) return this.err('Not in a room');
      const r = this.room(u.roomId);
      for (const s of r.seats) if (s.userId === userId) { s.userId = null; s.muted = false; }
      if (u.micSince) { const mins = (this.now() - u.micSince) / 60000; u.stats.micMinutes += mins; this.progressTask(u, 'mic', Math.round(mins)); u.micSince = null; }
      this.broadcastSeats(r);
      return { ok: true };
    }
    muteSeat(userId, p) {
      const u = this.user(userId); if (!u || !u.roomId) return this.err('Not in a room');
      const r = this.room(u.roomId); const seat = r.seats[Number(p && p.index)]; if (!seat) return this.err('No seat');
      if (seat.userId !== userId && !this.canManage(r, userId)) return this.err('Only host or admins can mute others');
      seat.muted = p.muted == null ? !seat.muted : !!p.muted;
      this.broadcastSeats(r);
      if (seat.userId !== userId) this.emit('room:force-mute', { muted: seat.muted, by: this.pubUser(u) }, { user: seat.userId });
      return { ok: true, muted: seat.muted };
    }
    lockSeat(userId, p) {
      const u = this.user(userId); if (!u || !u.roomId) return this.err('Not in a room');
      const r = this.room(u.roomId); if (!this.canManage(r, userId)) return this.err('Only host or admins can lock seats');
      const seat = r.seats[Number(p && p.index)]; if (!seat || seat.index === 0) return this.err('Cannot lock this seat');
      seat.locked = p.locked == null ? !seat.locked : !!p.locked;
      if (seat.locked && seat.userId) { const t = this.user(seat.userId); seat.userId = null; if (t) this.emit('room:seat-removed', { by: this.pubUser(u) }, { user: t.id }); }
      this.broadcastSeats(r); return { ok: true };
    }
    removeFromSeat(userId, p) {
      const u = this.user(userId); if (!u || !u.roomId) return this.err('Not in a room');
      const r = this.room(u.roomId); if (!this.canManage(r, userId)) return this.err('Only host or admins can do that');
      const seat = r.seats[Number(p && p.index)]; if (!seat || !seat.userId || seat.userId === r.hostId) return this.err('Cannot remove');
      const t = seat.userId; seat.userId = null; seat.muted = false; this.broadcastSeats(r);
      this.emit('room:seat-removed', { by: this.pubUser(u) }, { user: t });
      return { ok: true };
    }
    inviteToSeat(userId, p) {
      const u = this.user(userId); if (!u || !u.roomId) return this.err('Not in a room');
      const r = this.room(u.roomId); if (!this.canManage(r, userId)) return this.err('Only host or admins can invite');
      const t = this.user(p && p.targetId); if (!t || !r.members.has(t.id)) return this.err('User is not in the room');
      r.invited.add(t.id);
      this.emit('room:seat-invite', { index: Number(p.index), by: this.pubUser(u), roomId: r.id }, { user: t.id });
      return { ok: true };
    }
    approveMic(userId, p) {
      const u = this.user(userId); if (!u || !u.roomId) return this.err('Not in a room');
      const r = this.room(u.roomId); if (!this.canManage(r, userId)) return this.err('Only host or admins can approve');
      const t = this.user(p && p.targetId); if (!t) return this.err('No user');
      if (!p.approve) { r.applicants.delete(t.id); this.emit('room:applicants', { roomId: r.id, applicants: [...r.applicants].map(id => this.pubUser(this.user(id))) }, { room: r.id }); return { ok: true }; }
      const free = r.seats.find(s => s.index > 0 && !s.userId && !s.locked); if (!free) return this.err('No free seat');
      const res = this.takeSeat(t.id, { index: free.index, approved: true });
      this.emit('room:applicants', { roomId: r.id, applicants: [...r.applicants].map(id => this.pubUser(this.user(id))) }, { room: r.id });
      return res;
    }
    kickUser(userId, p) {
      const u = this.user(userId); if (!u || !u.roomId) return this.err('Not in a room');
      const r = this.room(u.roomId); if (!this.canManage(r, userId)) return this.err('Only host or admins can remove people');
      const t = this.user(p && p.targetId); if (!t || t.id === r.hostId) return this.err('Cannot remove the host');
      if (t.vip >= 2 && r.hostId !== userId) return this.err('VIP members can only be removed by the host');
      if (p.ban) r.banned.add(t.id);
      this.emit('room:kicked', { roomId: r.id, by: this.pubUser(u), banned: !!p.ban }, { user: t.id });
      this.leaveRoom(t.id);
      this.sysMessage(r, `${t.name} was removed from the room`);
      return { ok: true };
    }
    setAdmin(userId, p) {
      const u = this.user(userId); if (!u || !u.roomId) return this.err('Not in a room');
      const r = this.room(u.roomId); if (r.hostId !== userId) return this.err('Only the host can manage admins');
      const t = this.user(p && p.targetId); if (!t) return this.err('No user');
      if (p.admin) { if (r.admins.size >= 7) return this.err('Max 7 admins'); r.admins.add(t.id); this.sysMessage(r, `${t.name} is now a room admin 🛡️`); }
      else r.admins.delete(t.id);
      this.emit('room:updated', Object.assign(this.pubRoom(r), { admins: [...r.admins] }), { room: r.id });
      return { ok: true, admins: [...r.admins] };
    }
    speaking(userId, p) { const u = this.user(userId); if (!u || !u.roomId) return { ok: true }; this.emit('room:speaking', { userId, level: Math.max(0, Math.min(1, Number(p && p.level) || 0)) }, { room: u.roomId }); return { ok: true }; }
    sendMessage(userId, p) {
      const u = this.user(userId); if (!u || !u.roomId) return this.err('Join a room first');
      const r = this.room(u.roomId); const text = this.moderate(this.clean(p && p.text)); if (!text) return this.err('Empty message');
      const m = { id: this.id('m'), type: 'chat', userId, user: { id: u.id, name: u.name, level: u.level, vip: u.vip, bubble: u.equipped.bubble, avatar: u.avatar, isAdmin: r.admins.has(userId), isHost: r.hostId === userId }, text, ts: this.now() };
      r.messages.push(m); if (r.messages.length > 200) r.messages.splice(0, r.messages.length - 200);
      this.stats.messages++;
      this.emit('room:message', { roomId: r.id, message: m }, { room: r.id });
      return { ok: true, message: m };
    }
    sendReaction(userId, p) { const u = this.user(userId); if (!u || !u.roomId) return this.err('Not in a room'); this.emit('room:reaction', { userId, emoji: String(p && p.emoji || '❤️').slice(0, 4) }, { room: u.roomId }); return { ok: true }; }
    followRoom(userId, p) {
      const u = this.user(userId); const r = this.room(p && p.roomId); if (!u || !r) return this.err('No room');
      const follow = p.follow == null ? !r.followers.has(userId) : !!p.follow;
      if (follow) { r.followers.add(userId); u.followedRooms.add(r.id); } else { r.followers.delete(userId); u.followedRooms.delete(r.id); }
      this.emit('room:updated', this.pubRoom(r), { room: r.id });
      this.pushUser(u);
      return { ok: true, following: follow, followers: r.followers.size };
    }
    shareRoom(userId, p) { const u = this.user(userId); const r = this.room(p && p.roomId); if (!u || !r) return this.err('No room'); this.progressTask(u, 'share', 1); this.pushUser(u); return { ok: true, link: `${this.catalog.BRAND.website}/room/${r.id}`, text: `Join "${r.title}" on Classic Friends 🎤 Room ID ${r.id}` }; }
    setMusic(userId, p) { const u = this.user(userId); if (!u || !u.roomId) return this.err('Not in a room'); const r = this.room(u.roomId); if (!this.canManage(r, userId)) return this.err('Only host or admins can play music'); r.music = p && p.playing ? { title: this.clean(p.title).slice(0, 60) || 'Now playing', by: u.name, startedAt: this.now() } : null; this.emit('room:music', { roomId: r.id, music: r.music }, { room: r.id }); return { ok: true }; }

    /* ------------------------------------------------------------ gifts */
    sendGift(userId, p) {
      const u = this.user(userId); if (!u || !u.roomId) return this.err('Join a room first');
      const r = this.room(u.roomId);
      const gift = this.giftCatalog.find(g => g.id === (p && p.giftId) && g.active !== false); if (!gift) return this.err('Gift not available');
      if (gift.vip && u.vip < gift.vip) return this.err(`This gift needs VIP ${gift.vip}`);
      const qty = Math.max(1, Math.min(9999, Number(p.qty) || 1));
      let receivers;
      if (p.to === 'all') receivers = r.seats.filter(s => s.userId && s.userId !== userId).map(s => s.userId);
      else if (Array.isArray(p.to)) receivers = p.to.filter(id => this.user(id));
      else receivers = p.to && this.user(p.to) ? [p.to] : [];
      receivers = [...new Set(receivers)].filter(id => id !== userId);
      if (!receivers.length) return this.err('Pick someone on a mic to send to');
      const total = gift.price * qty * receivers.length;
      if (u.coins < total) return this.err('Not enough coins', 'NO_COINS');
      u.coins -= total; u.stats.giftsSent += qty * receivers.length;
      this.stats.giftsToday += qty * receivers.length; this.stats.coinsSpentToday += total;
      this.addXp(u, total);
      if (u.stats.giftsSent >= 100 && !u.badges.includes('gifter')) u.badges.push('gifter');
      r.contributions.set(userId, (r.contributions.get(userId) || 0) + total); r.totalGifts += total; r.hot = (r.hot || 0) + total;
      const diamondsEach = Math.round(gift.price * qty * this.catalog.DIAMONDS_PER_COIN);
      const toUsers = [];
      for (const id of receivers) {
        const t = this.user(id); t.diamonds += diamondsEach; t.stats.giftsReceived += qty; this.addCharm(t, gift.price * qty);
        if (t.charm >= 10000 && !t.badges.includes('charm')) t.badges.push('charm');
        if (u.cp && u.cp.userId === t.id) { u.cp.bond += total; if (t.cp && t.cp.userId === u.id) t.cp.bond = u.cp.bond; }
        toUsers.push(this.pubUser(t));
        this.notify(t.id, { type: 'gift', text: `${u.name} sent you ${gift.emoji} ${gift.name} x${qty}`, from: this.pubUser(u), data: { giftId: gift.id, qty } });
        this.pushUser(t);
      }
      let luckyWin = 0;
      if (gift.lucky) { const roll = Math.random(); const mult = roll > 0.98 ? 50 : roll > 0.9 ? 10 : roll > 0.6 ? 2 : roll > 0.3 ? 1 : 0; luckyWin = mult * gift.price * qty; if (luckyWin) { u.coins += luckyWin; } }
      if (r.pk) { for (const id of receivers) { const s = r.seats.find(x => x.userId === id); if (s) { if (s.index % 2 === 0) r.pk.red += gift.price * qty; else r.pk.blue += gift.price * qty; } } this.emit('room:pk', r.pk, { room: r.id }); }
      const fam = u.familyId && this.families.get(u.familyId); if (fam) { fam.xp += total; fam.weekly += total; fam.level = Math.max(1, Math.floor(Math.log10(fam.xp + 1))); }
      this.progressTask(u, 'gift', 1);
      const ev = { id: this.id('g'), roomId: r.id, from: this.pubUser(u), to: toUsers, gift: { id: gift.id, name: gift.name, emoji: gift.emoji, price: gift.price, tier: gift.tier }, qty, total, luckyWin, ts: this.now(), seatIndexes: receivers.map(id => { const s = r.seats.find(x => x.userId === id); return s ? s.index : -1; }) };
      const m = { id: this.id('m'), type: 'gift', ts: ev.ts, gift: ev.gift, qty, from: { id: u.id, name: u.name, level: u.level, vip: u.vip }, to: toUsers.map(t => ({ id: t.id, name: t.name })), luckyWin };
      r.messages.push(m); if (r.messages.length > 200) r.messages.splice(0, r.messages.length - 200);
      this.emit('room:message', { roomId: r.id, message: m }, { room: r.id });
      this.emit('room:gift', ev, { room: r.id });
      this.emit('room:contributions', { roomId: r.id, top: [...r.contributions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([uid, coins]) => ({ user: this.pubUser(this.user(uid)), coins })), totalGifts: r.totalGifts }, { room: r.id });
      this.pushUser(u);
      return { ok: true, coins: u.coins, luckyWin, event: ev };
    }

    /* ------------------------------------------------------------ games */
    startPk(userId, p) {
      const u = this.user(userId); if (!u || !u.roomId) return this.err('Not in a room'); const r = this.room(u.roomId);
      if (!this.canManage(r, userId)) return this.err('Only host or admins can start a PK');
      if (r.pk) return this.err('PK already running');
      const mins = Math.max(1, Math.min(10, Number(p && p.minutes) || 3));
      r.pk = { startedAt: this.now(), endsAt: this.now() + mins * 60000, red: 0, blue: 0, minutes: mins };
      this.emit('room:pk', r.pk, { room: r.id }); this.sysMessage(r, `⚔️ PK battle started! Red seats vs Blue seats for ${mins} min`);
      return { ok: true, pk: r.pk };
    }
    endPk(r) { if (!r.pk) return; const w = r.pk.red === r.pk.blue ? 'Draw!' : r.pk.red > r.pk.blue ? '🔴 Red team wins!' : '🔵 Blue team wins!'; this.sysMessage(r, `⚔️ PK over — ${w} (${r.pk.red} vs ${r.pk.blue})`); r.pk = null; this.emit('room:pk', null, { room: r.id }); }
    spinWheel(userId) {
      const u = this.user(userId); if (!u) return this.err('No user'); const W = this.catalog.WHEEL;
      if (u.coins < W.cost) return this.err('Not enough coins', 'NO_COINS');
      u.coins -= W.cost; const tw = W.slices.reduce((a, s) => a + s.weight, 0); let roll = Math.random() * tw, idx = 0;
      for (let i = 0; i < W.slices.length; i++) { roll -= W.slices[i].weight; if (roll <= 0) { idx = i; break; } }
      const prize = W.slices[idx]; u.coins += prize.coins; this.pushUser(u);
      if (u.roomId && prize.coins >= 100) this.sysMessage(this.room(u.roomId), `🎡 ${u.name} won ${prize.coins} coins on the Lucky Wheel!`);
      return { ok: true, index: idx, coins: prize.coins, balance: u.coins };
    }
    rollDice(userId) { const u = this.user(userId); if (!u || !u.roomId) return this.err('Not in a room'); const value = 1 + Math.floor(Math.random() * 6); this.emit('room:dice', { user: this.pubUser(u), value }, { room: u.roomId }); return { ok: true, value }; }
    sendLuckyBag(userId, p) {
      const u = this.user(userId); if (!u || !u.roomId) return this.err('Not in a room');
      const coins = Math.max(10, Math.min(100000, Number(p && p.coins) || 0)); const count = Math.max(1, Math.min(50, Number(p && p.count) || 5));
      if (u.coins < coins) return this.err('Not enough coins', 'NO_COINS');
      u.coins -= coins; this.addXp(u, coins);
      const bag = { id: this.id('bag'), roomId: u.roomId, from: userId, coins, count, remaining: count, pool: coins, message: this.clean(p.message).slice(0, 40) || 'Good luck! 🧧', grabs: [], createdAt: this.now() };
      this.luckyBags.set(bag.id, bag);
      this.emit('room:luckybag', this.pubBag(bag), { room: u.roomId });
      this.sysMessage(this.room(u.roomId), `🧧 ${u.name} dropped a Lucky Bag with ${coins} coins!`);
      this.pushUser(u);
      return { ok: true, bag: this.pubBag(bag) };
    }
    grabLuckyBag(userId, p) {
      const u = this.user(userId); const bag = this.luckyBags.get(p && p.bagId); if (!u || !bag) return this.err('This bag is gone');
      if (bag.remaining <= 0) return this.err('All grabbed! Faster next time 🏃');
      if (bag.grabs.some(g => g.userId === userId)) return this.err('You already grabbed this one');
      let share;
      if (bag.remaining === 1) share = bag.pool; else { const max = Math.floor(bag.pool / bag.remaining * 2); share = Math.max(1, Math.floor(Math.random() * max)); if (share > bag.pool - (bag.remaining - 1)) share = bag.pool - (bag.remaining - 1); }
      bag.pool -= share; bag.remaining--; bag.grabs.push({ userId, coins: share });
      u.coins += share; this.pushUser(u);
      this.emit('room:luckybag-grab', { bagId: bag.id, user: this.pubUser(u), coins: share, remaining: bag.remaining, bag: this.pubBag(bag) }, { room: bag.roomId });
      return { ok: true, coins: share, bag: this.pubBag(bag) };
    }

    /* ------------------------------------------------------------ rankings */
    rankings(userId, p) {
      p = p || {}; const type = p.type || 'wealth'; const period = p.period || 'daily';
      const k = periodKeys(this.now()); const key = period === 'weekly' ? k.week : period === 'monthly' ? k.month : period === 'all' ? null : k.day;
      let list;
      if (type === 'rooms') list = [...this.rooms.values()].filter(r => !r.closed).map(r => ({ room: this.pubRoom(r), score: r.totalGifts })).sort((a, b) => b.score - a.score);
      else if (type === 'family') list = [...this.families.values()].map(f => ({ family: this.pubFamily(f), score: period === 'all' ? f.xp : f.weekly })).sort((a, b) => b.score - a.score);
      else list = [...this.users.values()].map(u => ({ user: this.pubUser(u), score: key ? ((u.periods[key] || {})[type === 'charm' ? 'charm' : 'xp'] || 0) : (type === 'charm' ? u.charm : u.xp) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
      const me = this.user(userId); let myRank = null;
      if (me && (type === 'wealth' || type === 'charm')) { const i = list.findIndex(x => x.user.id === me.id); myRank = i >= 0 ? { rank: i + 1, score: list[i].score } : null; }
      return { ok: true, type, period, list: list.slice(0, 50), myRank };
    }

    /* ------------------------------------------------------------ social */
    followUser(userId, p) {
      const u = this.user(userId); const t = this.user(p && p.targetId); if (!u || !t || u.id === t.id) return this.err('No user');
      const follow = p.follow == null ? !u.following.has(t.id) : !!p.follow;
      if (follow) { u.following.add(t.id); t.followers.add(u.id); this.notify(t.id, { type: 'follow', text: `${u.name} started following you`, from: this.pubUser(u) }); }
      else { u.following.delete(t.id); t.followers.delete(u.id); }
      this.pushUser(u); return { ok: true, following: follow };
    }
    friendRequest(userId, p) {
      const u = this.user(userId); const t = this.user(p && p.targetId); if (!u || !t || u.id === t.id) return this.err('No user');
      if (u.friends.has(t.id)) return this.err('Already friends');
      if (t.blocked.has(u.id)) return this.err('Cannot send request');
      if (u.friendRequests.has(t.id)) return this.acceptFriend(userId, { fromId: t.id });
      t.friendRequests.add(u.id);
      this.notify(t.id, { type: 'friend-request', text: `${u.name} sent you a friend request`, from: this.pubUser(u), data: { fromId: u.id } });
      this.emit('friend:request', { from: this.pubUser(u) }, { user: t.id });
      this.pushUser(t);
      return { ok: true, sent: true };
    }
    acceptFriend(userId, p) {
      const u = this.user(userId); const f = this.user(p && p.fromId); if (!u || !f) return this.err('No user');
      if (!u.friendRequests.has(f.id) && !f.friendRequests.has(u.id)) return this.err('No request found');
      u.friendRequests.delete(f.id); f.friendRequests.delete(u.id);
      u.friends.add(f.id); f.friends.add(u.id); u.following.add(f.id); f.following.add(u.id); u.followers.add(f.id); f.followers.add(u.id);
      this.progressTask(u, 'friend', 1); this.progressTask(f, 'friend', 1);
      for (const x of [u, f]) if (x.friends.size >= 100 && !x.badges.includes('social')) x.badges.push('social');
      this.notify(f.id, { type: 'friend-accepted', text: `${u.name} accepted your friend request 🎉`, from: this.pubUser(u) });
      this.emit('friend:accepted', { user: this.pubUser(u) }, { user: f.id });
      this.emit('friend:accepted', { user: this.pubUser(f) }, { user: u.id });
      this.pushUser(u); this.pushUser(f);
      return { ok: true };
    }
    declineFriend(userId, p) { const u = this.user(userId); if (!u) return this.err('No user'); u.friendRequests.delete(p && p.fromId); this.pushUser(u); return { ok: true }; }
    removeFriend(userId, p) { const u = this.user(userId); const f = this.user(p && p.targetId); if (!u || !f) return this.err('No user'); u.friends.delete(f.id); f.friends.delete(u.id); this.pushUser(u); this.pushUser(f); return { ok: true }; }
    blockUser(userId, p) { const u = this.user(userId); const t = this.user(p && p.targetId); if (!u || !t) return this.err('No user'); if (p.block === false) u.blocked.delete(t.id); else { u.blocked.add(t.id); u.friends.delete(t.id); t.friends.delete(u.id); u.following.delete(t.id); t.followers.delete(u.id); } this.pushUser(u); return { ok: true, blocked: [...u.blocked] }; }
    reportUser(userId, p) { const u = this.user(userId); const t = this.user(p && p.targetId); if (!u || !t) return this.err('No user'); const rep = { id: this.id('rep'), from: this.pubUser(u), target: this.pubUser(t), reason: this.clean(p.reason).slice(0, 60) || 'Other', details: this.clean(p.details).slice(0, 300), roomId: p.roomId || null, ts: this.now(), status: 'open' }; this.reports.unshift(rep); return { ok: true, reportId: rep.id }; }
    cpRequest(userId, p) {
      const u = this.user(userId); const t = this.user(p && p.targetId); if (!u || !t || u.id === t.id) return this.err('No user');
      if (u.cp) return this.err('You already have a CP. Break it first.'); if (t.cp) return this.err(`${t.name} already has a CP`);
      t.cpRequestFrom = u.id;
      this.notify(t.id, { type: 'cp-request', text: `${u.name} wants to be your CP 💞`, from: this.pubUser(u), data: { fromId: u.id } });
      this.emit('cp:request', { from: this.pubUser(u) }, { user: t.id }); this.pushUser(t);
      return { ok: true };
    }
    cpAccept(userId, p) {
      const u = this.user(userId); const f = this.user(p && p.fromId); if (!u || !f) return this.err('No user');
      if (u.cpRequestFrom !== f.id && !(p && p.force)) return this.err('No CP request');
      const since = this.now(); u.cp = { userId: f.id, bond: 0, since }; f.cp = { userId: u.id, bond: 0, since }; u.cpRequestFrom = null;
      if (!u.friends.has(f.id)) this.acceptFriend(userId, { fromId: f.id, force: true }) ;
      this.notify(f.id, { type: 'cp', text: `${u.name} accepted — you are now CP 💞`, from: this.pubUser(u) });
      this.pushUser(u); this.pushUser(f);
      if (u.roomId) this.emit('room:member-updated', { user: this.pubUser(u) }, { room: u.roomId });
      return { ok: true };
    }
    cpBreak(userId) { const u = this.user(userId); if (!u || !u.cp) return this.err('No CP'); const f = this.user(u.cp.userId); u.cp = null; if (f && f.cp && f.cp.userId === u.id) { f.cp = null; this.pushUser(f); } this.pushUser(u); return { ok: true }; }

    /* ------------------------------------------------------------ messages (DM) */
    sendDm(userId, p) {
      const u = this.user(userId); const t = this.user(p && p.toUserId); if (!u || !t) return this.err('No user');
      if (t.blocked.has(u.id)) return this.err('You cannot message this user');
      if (t.settings.privacy.allowDm === 'friends' && !t.friends.has(u.id)) return this.err(`${t.name} only accepts messages from friends`);
      const text = this.moderate(this.clean(p.text)); const gift = p.giftId ? this.giftCatalog.find(g => g.id === p.giftId) : null;
      if (!text && !gift) return this.err('Empty message');
      if (gift) { if (u.coins < gift.price) return this.err('Not enough coins', 'NO_COINS'); u.coins -= gift.price; t.diamonds += Math.round(gift.price * this.catalog.DIAMONDS_PER_COIN); this.addXp(u, gift.price); this.addCharm(t, gift.price); this.pushUser(t); }
      const key = this.pairKey(u.id, t.id); const list = this.dms.get(key) || []; this.dms.set(key, list);
      const m = { id: this.id('d'), from: u.id, to: t.id, text, gift: gift ? { id: gift.id, emoji: gift.emoji, name: gift.name } : null, ts: this.now(), read: false };
      list.push(m); if (list.length > 300) list.splice(0, list.length - 300);
      this.emit('dm:message', { message: m, from: this.pubUser(u), to: this.pubUser(t) }, { users: [u.id, t.id] });
      this.pushUser(u);
      return { ok: true, message: m };
    }
    listConversations(userId) {
      const out = [];
      for (const [key, list] of this.dms.entries()) { const [a, b] = key.split('|'); if (a !== userId && b !== userId) continue; const other = this.user(a === userId ? b : a); if (!other || !list.length) continue; const last = list[list.length - 1]; out.push({ user: this.pubUser(other), last, unread: list.filter(m => m.to === userId && !m.read).length }); }
      out.sort((x, y) => y.last.ts - x.last.ts);
      return { ok: true, conversations: out };
    }
    getConversation(userId, p) { const key = this.pairKey(userId, p && p.withId); const list = this.dms.get(key) || []; for (const m of list) if (m.to === userId) m.read = true; const other = this.user(p && p.withId); return { ok: true, user: this.pubUser(other), messages: list.slice(-100) }; }
    listNotifications(userId) { const list = this.notifications.get(userId) || []; return { ok: true, notifications: list, unread: list.filter(n => !n.read).length }; }
    readNotifications(userId) { const list = this.notifications.get(userId) || []; for (const n of list) n.read = true; return { ok: true }; }

    /* ------------------------------------------------------------ moments */
    pubMoment(m, viewerId) { const u = this.user(m.userId); return { id: m.id, user: this.pubUser(u), text: m.text, emoji: m.emoji, art: m.art, ts: m.ts, likes: m.likes.size, liked: viewerId ? m.likes.has(viewerId) : false, comments: m.comments.slice(-20).map(c => ({ id: c.id, user: this.pubUser(this.user(c.userId)), text: c.text, ts: c.ts })), commentCount: m.comments.length }; }
    postMoment(userId, p) {
      const u = this.user(userId); if (!u) return this.err('No user'); const text = this.moderate(this.clean(p && p.text)).slice(0, 500); if (!text) return this.err('Write something first');
      const m = { id: this.id('mo'), userId, text, emoji: p.emoji || null, art: p.art || null, ts: this.now(), likes: new Set(), comments: [] };
      this.moments.unshift(m); if (this.moments.length > 500) this.moments.length = 500;
      this.progressTask(u, 'moment', 1); this.pushUser(u);
      this.emit('moments:new', this.pubMoment(m), { all: true });
      return { ok: true, moment: this.pubMoment(m, userId) };
    }
    listMoments(userId, p) {
      p = p || {}; const me = this.user(userId); let list = this.moments;
      if (p.tab === 'following' && me) list = list.filter(m => me.following.has(m.userId) || me.friends.has(m.userId) || m.userId === userId);
      if (p.tab === 'hot') list = [...list].sort((a, b) => (b.likes.size * 3 + b.comments.length * 5) - (a.likes.size * 3 + a.comments.length * 5));
      if (p.userId) list = list.filter(m => m.userId === p.userId);
      return { ok: true, moments: list.slice(0, 50).map(m => this.pubMoment(m, userId)) };
    }
    likeMoment(userId, p) { const m = this.moments.find(x => x.id === (p && p.momentId)); const u = this.user(userId); if (!m || !u) return this.err('No moment'); if (m.likes.has(userId)) m.likes.delete(userId); else { m.likes.add(userId); if (m.userId !== userId) this.notify(m.userId, { type: 'like', text: `${u.name} liked your Moment ❤️`, from: this.pubUser(u) }); } return { ok: true, liked: m.likes.has(userId), likes: m.likes.size }; }
    commentMoment(userId, p) { const m = this.moments.find(x => x.id === (p && p.momentId)); const u = this.user(userId); if (!m || !u) return this.err('No moment'); const text = this.moderate(this.clean(p.text)).slice(0, 200); if (!text) return this.err('Empty comment'); const c = { id: this.id('c'), userId, text, ts: this.now() }; m.comments.push(c); if (m.userId !== userId) this.notify(m.userId, { type: 'comment', text: `${u.name} commented: ${text}`, from: this.pubUser(u) }); this.emit('moments:comment', { momentId: m.id, comment: { id: c.id, user: this.pubUser(u), text, ts: c.ts } }, { all: true }); return { ok: true, moment: this.pubMoment(m, userId) }; }
    deleteMoment(userId, p) { const i = this.moments.findIndex(x => x.id === (p && p.momentId) && x.userId === userId); if (i < 0) return this.err('Not yours'); this.moments.splice(i, 1); return { ok: true }; }

    /* ------------------------------------------------------------ wallet & store */
    recharge(userId, p) {
      const u = this.user(userId); const pack = this.catalog.COIN_PACKS.find(x => x.id === (p && p.packId)); if (!u || !pack) return this.err('No such pack');
      // Production: verify the payment with your gateway (Razorpay/Stripe) BEFORE this line.
      u.coins += pack.coins + pack.bonus; this.pushUser(u);
      return { ok: true, coins: u.coins, receipt: { id: this.id('rc'), packId: pack.id, coins: pack.coins + pack.bonus, ts: this.now() } };
    }
    exchangeDiamonds(userId, p) { const u = this.user(userId); if (!u) return this.err('No user'); const d = Math.min(u.diamonds, Math.max(0, Math.floor(Number(p && p.diamonds) || 0))); if (d < 10) return this.err('Minimum 10 diamonds'); u.diamonds -= d; const coins = Math.floor(d * this.catalog.DIAMOND_TO_COIN); u.coins += coins; this.pushUser(u); return { ok: true, coins, balance: u.coins }; }
    buyItem(userId, p) {
      const u = this.user(userId); const item = this.catalog.storeById(p && p.itemId); if (!u || !item) return this.err('No such item');
      if (u.coins < item.price) return this.err('Not enough coins', 'NO_COINS');
      u.coins -= item.price; this.addXp(u, Math.floor(item.price / 2));
      const exp = item.days ? this.now() + item.days * 86400000 : 0; const existing = u.inventory.find(i => i.itemId === item.id);
      if (existing) existing.expiresAt = Math.max(existing.expiresAt, this.now()) + (item.days * 86400000); else u.inventory.push({ itemId: item.id, type: item.type, expiresAt: exp });
      u.equipped[item.type] = item.id; this.pushUser(u);
      if (u.roomId) this.emit('room:member-updated', { user: this.pubUser(u) }, { room: u.roomId });
      return { ok: true, coins: u.coins };
    }
    equipItem(userId, p) { const u = this.user(userId); if (!u) return this.err('No user'); const type = p && p.type; if (!type) return this.err('No type'); if (p.itemId && !u.inventory.some(i => i.itemId === p.itemId) && this.catalog.storeById(p.itemId) && this.catalog.storeById(p.itemId).price > 0) return this.err('You do not own this item'); u.equipped[type] = p.itemId || null; this.pushUser(u); if (u.roomId) this.emit('room:member-updated', { user: this.pubUser(u) }, { room: u.roomId }); return { ok: true }; }
    buyVip(userId, p) { const u = this.user(userId); const tier = this.catalog.VIP_TIERS.find(t => t.level === Number(p && p.level)); if (!u || !tier) return this.err('No such VIP'); if (u.coins < tier.price) return this.err('Not enough coins', 'NO_COINS'); u.coins -= tier.price; u.vip = Math.max(u.vip, tier.level); u.vipUntil = Math.max(u.vipUntil, this.now()) + 30 * 86400000; this.addXp(u, tier.price); this.pushUser(u); if (u.roomId) this.emit('room:member-updated', { user: this.pubUser(u) }, { room: u.roomId }); return { ok: true, vip: u.vip }; }
    checkIn(userId) {
      const u = this.user(userId); if (!u) return this.err('No user'); const today = periodKeys(this.now()).day;
      if (u.checkIn.last === today) return this.err('Already checked in today');
      const y = periodKeys(this.now() - 86400000).day; u.checkIn.streak = u.checkIn.last === y ? Math.min(7, u.checkIn.streak + 1) : 1; u.checkIn.last = today;
      const reward = this.catalog.CHECKIN_REWARDS[u.checkIn.streak - 1]; u.coins += reward; this.progressTask(u, 'checkin', 1);
      if (u.checkIn.streak >= 7 && !u.badges.includes('streak')) u.badges.push('streak');
      this.pushUser(u); return { ok: true, reward, streak: u.checkIn.streak };
    }
    claimTask(userId, p) { const u = this.user(userId); if (!u) return this.err('No user'); const t = this.taskProgress(u).find(x => x.id === (p && p.taskId)); if (!t) return this.err('No task'); if (t.claimed) return this.err('Already claimed'); if (t.progress < t.target) return this.err('Not finished yet'); u.tasks.claimed[t.id] = true; u.coins += t.reward; this.pushUser(u); return { ok: true, reward: t.reward }; }

    /* ------------------------------------------------------------ families */
    pubFamily(f) { if (!f) return null; return { id: f.id, name: f.name, badge: f.badge, color: f.color, leader: this.pubUser(this.user(f.leaderId)), members: f.members.size, level: f.level, xp: f.xp, weekly: f.weekly, slogan: f.slogan, createdAt: f.createdAt }; }
    createFamily(userId, p) {
      const u = this.user(userId); if (!u) return this.err('No user'); if (u.familyId) return this.err('Leave your current family first');
      const name = this.clean(p && p.name).slice(0, 20); if (!name) return this.err('Give your family a name');
      const f = { id: this.id('f'), name, badge: this.clean(p.badge).slice(0, 6) || name.slice(0, 3).toUpperCase(), color: p.color || '#8B5CF6', leaderId: userId, members: new Set([userId]), level: 1, xp: 0, weekly: 0, slogan: this.clean(p.slogan).slice(0, 60) || 'Together we shine ✨', createdAt: this.now() };
      this.families.set(f.id, f); u.familyId = f.id; if (!u.badges.includes('family')) u.badges.push('family'); this.pushUser(u);
      return { ok: true, family: this.pubFamily(f) };
    }
    joinFamily(userId, p) { const u = this.user(userId); const f = this.families.get(p && p.familyId); if (!u || !f) return this.err('No family'); if (u.familyId) return this.err('Leave your current family first'); if (f.members.size >= 100) return this.err('Family is full'); f.members.add(userId); u.familyId = f.id; if (!u.badges.includes('family')) u.badges.push('family'); this.pushUser(u); if (u.roomId) this.emit('room:member-updated', { user: this.pubUser(u) }, { room: u.roomId }); return { ok: true, family: this.pubFamily(f) }; }
    leaveFamily(userId) { const u = this.user(userId); if (!u || !u.familyId) return this.err('Not in a family'); const f = this.families.get(u.familyId); if (f) { f.members.delete(userId); if (f.leaderId === userId) { const next = [...f.members][0]; if (next) f.leaderId = next; else this.families.delete(f.id); } } u.familyId = null; this.pushUser(u); return { ok: true }; }
    listFamilies() { return { ok: true, families: [...this.families.values()].map(f => this.pubFamily(f)).sort((a, b) => b.weekly - a.weekly) }; }
    getFamily(userId, p) { const f = this.families.get(p && p.familyId); if (!f) return this.err('No family'); const out = this.pubFamily(f); out.memberList = [...f.members].map(id => this.pubUser(this.user(id))).filter(Boolean); return { ok: true, family: out }; }

    /* ------------------------------------------------------------ admin */
    adminStats() {
      const users = [...this.users.values()]; const rooms = [...this.rooms.values()].filter(r => !r.closed);
      return { ok: true, stats: { users: users.length, online: users.filter(u => u.online).length, bots: users.filter(u => u.isBot).length, rooms: rooms.length, onMic: rooms.reduce((a, r) => a + r.seats.filter(s => s.userId).length, 0), giftsToday: this.stats.giftsToday, coinsSpentToday: this.stats.coinsSpentToday, messages: this.stats.messages, reportsOpen: this.reports.filter(r => r.status === 'open').length, families: this.families.size, moments: this.moments.length, revenueEstimate: Math.round(this.stats.coinsSpentToday * 0.89) }, topRooms: rooms.sort((a, b) => b.totalGifts - a.totalGifts).slice(0, 5).map(r => this.pubRoom(r)), topGifters: users.sort((a, b) => b.xp - a.xp).slice(0, 5).map(u => this.pubUser(u)) };
    }
    adminUsers(p) { p = p || {}; const q = (p.q || '').toLowerCase(); let list = [...this.users.values()]; if (q) list = list.filter(u => u.name.toLowerCase().includes(q) || u.id.includes(q)); list.sort((a, b) => b.createdAt - a.createdAt); const page = Math.max(0, Number(p.page) || 0); const size = 25; return { ok: true, total: list.length, page, users: list.slice(page * size, page * size + size).map(u => Object.assign(this.pubUser(u), { coins: u.coins, diamonds: u.diamonds, xp: u.xp, lastSeen: u.lastSeen })) }; }
    adminUpdateUser(p) { const u = this.user(p && p.id); if (!u) return this.err('No user'); if (p.banned != null) { u.banned = !!p.banned; if (u.banned) { this.leaveRoom(u.id); this.emit('user:banned', { reason: p.reason || 'Policy violation' }, { user: u.id }); } } if (p.vip != null) u.vip = Number(p.vip) || 0; if (p.coins != null) u.coins = Math.max(0, Number(p.coins) || 0); if (p.grantCoins) u.coins += Number(p.grantCoins) || 0; if (p.level != null) { u.level = Number(p.level) || 1; u.xp = Math.max(u.xp, this.catalog.xpForLevel(u.level)); } this.pushUser(u); return { ok: true, user: this.pubUser(u) }; }
    adminRooms() { return { ok: true, rooms: [...this.rooms.values()].filter(r => !r.closed).map(r => this.fullRoom(r)) }; }
    adminReports() { return { ok: true, reports: this.reports }; }
    adminResolveReport(p) { const r = this.reports.find(x => x.id === (p && p.id)); if (!r) return this.err('No report'); r.status = p.action || 'resolved'; r.resolvedAt = this.now(); if (p.action === 'ban') this.adminUpdateUser({ id: r.target.id, banned: true }); return { ok: true, report: r }; }
    adminBanners(p) { if (p && p.set) this.banners = p.set.slice(0, 6); return { ok: true, banners: this.banners }; }
    adminGifts(p) { if (p && p.update) { const g = this.giftCatalog.find(x => x.id === p.update.id); if (g) Object.assign(g, p.update); else this.giftCatalog.push(Object.assign({ active: true, tier: 1, cat: 'hot' }, p.update)); } return { ok: true, gifts: this.giftCatalog }; }
    adminBroadcast(p) { const text = this.clean(p && p.text).slice(0, 200); if (!text) return this.err('Empty'); for (const u of this.users.values()) if (!u.isBot) this.notify(u.id, { type: 'system', text }); for (const r of this.rooms.values()) this.sysMessage(r, `📣 ${text}`); return { ok: true }; }

    /* ------------------------------------------------------------ time */
    tick() {
      const now = this.now();
      const day = periodKeys(now).day; if (this.stats.day !== day) { if (this.stats.day) { this.stats.giftsToday = 0; this.stats.coinsSpentToday = 0; } this.stats.day = day; }
      for (const r of this.rooms.values()) if (r.pk && now >= r.pk.endsAt) this.endPk(r);
      for (const [id, b] of this.luckyBags) if (now - b.createdAt > 10 * 60000) this.luckyBags.delete(id);
      for (const u of this.users.values()) { if (u.vipUntil && u.vipUntil < now) { u.vip = 0; u.vipUntil = 0; } u.inventory = u.inventory.filter(i => !i.expiresAt || i.expiresAt > now); for (const t of ['frame', 'bubble', 'entry', 'wave', 'theme']) { const eq = u.equipped[t]; if (eq && !u.inventory.some(i => i.itemId === eq)) { const item = this.catalog.storeById(eq); if (item && item.price > 0) u.equipped[t] = null; } } }
      for (const r of this.rooms.values()) r.hot = Math.floor((r.hot || 0) * 0.98);
    }
  }

  Engine.periodKeys = periodKeys;
  return Engine;
});
