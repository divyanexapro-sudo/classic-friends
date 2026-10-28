/* ============================================================
   Classic Friends bot director
   Seeds demo rooms/users/moments/families and keeps rooms alive:
   chat, gifts, reactions, speaking bursts, people coming and going.
   Reacts to the real user: welcomes, thanks, DM replies, accepts friends.
   Runs on the server (with the real engine) and in-browser (demo mode).
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.CF = root.CF || {}; root.CF.BotDirector = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NAMES_F = ['Priya', 'Fatima', 'Ayesha', 'Meera', 'Divya', 'Zara', 'Lakshmi', 'Nisha', 'Sara', 'Anjali', 'Kavya', 'Sneha', 'Pooja', 'Noor', 'Rania', 'Hiba', 'Maryam', 'Layla', 'Sana', 'Amira', 'Shreya', 'Tanvi', 'Keerthi', 'Ishita', 'Preethi', 'Harini', 'Swathi', 'Nandini', 'Bhavana', 'Janani', 'Riya', 'Aafreen', 'Mehak', 'Deepika', 'Yasmin'];
  const NAMES_M = ['Arjun', 'Rahul', 'Karthik', 'Omar', 'Sanjay', 'Vikram', 'Hassan', 'Aditya', 'Rohan', 'Yusuf', 'Deepak', 'Ahmed', 'Imran', 'Suresh', 'Varun', 'Manoj', 'Ravi', 'Gokul', 'Aravind', 'Naveen', 'Dinesh', 'Farhan', 'Bilal', 'Salim', 'Tariq', 'Abdul', 'Irfan', 'Majid', 'Ali', 'Rashid', 'Vishal', 'Nikhil', 'Faisal', 'Prakash', 'Zaid'];
  const SUFFIX = ['', '', '', '_official', ' ✨', ' 🎤', ' 💫', '_dxb', '_chn', ' 🦋', '_07', ' 👑', '_blr', ' 🌙', '_hyd'];
  const COUNTRIES = ['IN', 'IN', 'IN', 'IN', 'AE', 'AE', 'SA', 'OM', 'QA', 'KW', 'PK', 'BD', 'LK', 'MY', 'GB', 'US'];

  const ROOMS = [
    { title: 'Late night chill 🌙', tag: 'latenight', lang: 'Hindi', country: 'IN' },
    { title: 'Tamil pasanga singing 🎤', tag: 'singing', lang: 'Tamil', country: 'IN' },
    { title: 'Dubai friends zone 🇦🇪', tag: 'friends', lang: 'English', country: 'AE' },
    { title: 'Ludo & laughs 🎲', tag: 'ludo', lang: 'Hindi', country: 'IN' },
    { title: 'Poetry nights · شعر 📜', tag: 'poetry', lang: 'Urdu', country: 'SA' },
    { title: 'Bollywood antakshari 🎬', tag: 'bollywood', lang: 'Hindi', country: 'IN' },
    { title: 'Cricket talk 🏏 IND vs AUS', tag: 'cricket', lang: 'English', country: 'IN' },
    { title: 'Study together 📚 focus', tag: 'study', lang: 'English', country: 'IN' },
    { title: 'Comedy hour 😂 roast', tag: 'comedy', lang: 'Hindi', country: 'PK' },
    { title: 'Love & friendship 💞', tag: 'love', lang: 'Hindi', country: 'IN' },
    { title: 'Malayalam kootam 🌴', tag: 'chat', lang: 'Malayalam', country: 'AE' },
    { title: 'Ghazals & sufi 🎶', tag: 'music', lang: 'Urdu', country: 'OM' },
    { title: 'Telugu gang 🔥', tag: 'chat', lang: 'Telugu', country: 'IN' },
    { title: 'Muscat family room 🏠', tag: 'family', lang: 'Arabic', country: 'OM' },
    { title: 'Karaoke battle 🎤🔥', tag: 'singing', lang: 'English', country: 'AE' },
    { title: 'Good morning chai ☕', tag: 'chat', lang: 'Hindi', country: 'IN' },
    { title: 'Doha gamers 🎮', tag: 'gaming', lang: 'English', country: 'QA' },
    { title: 'Kannada kattege 🌟', tag: 'chat', lang: 'Kannada', country: 'IN' }
  ];

  const CHAT = [
    'hello everyone 👋', 'hi from Chennai!', 'anyone from Dubai here?', 'nice voice bro 🔥', 'haha 😂😂', 'sing one song please 🎤',
    'good evening all ☕', 'kya haal hai sab?', 'vanakkam 🙏', 'salam everyone', 'welcome welcome 🎉', 'this room is lit 🔥', 'can I take mic?',
    'where are you from?', 'hahaha true', 'send me friend request 🤝', 'host ji aap ka voice mast hai', 'nalla paattu 👌', 'mashallah 😍',
    'who wants to play ludo?', 'wait I am coming on mic', 'network issue sorry', 'coffee time ☕', 'guys follow this room ❤️', 'same here bro',
    'ippo enna paduveenga?', 'ek aur gaana pls', 'arre waah 👏👏', 'bahut badhiya', 'this is my fav room', 'good night all 🌙', 'lol 😆',
    'hi hi hi', 'kaise ho sab log', 'yes yes', 'no no 😂', 'aaj mausam acha hai', 'anyone from Kerala?', 'big fan of this host 🙌', 'gift aa raha hai 🎁',
    'super 👌', 'mic please host 🙏', 'ok bye guys, dinner time', 'semma 🔥', 'vera level', 'keep going!', 'thanks for the gift 😍', 'love from Muscat 🇴🇲',
    'love from Hyderabad 💜', 'hello Pakistan 🇵🇰', 'kal milte hai', 'kon kon online hai?', 'one more time 🎶', 'claps 👏👏👏', 'hehe', 'welcome to the mic!'
  ];
  const WELCOME = ['Welcome {name}! 🎉', 'Hi {name}, welcome to the room 👋', '{name} is here! 🙌', 'welcome {name} ❤️ take a mic', 'hey {name}! where are you from?', 'Hello {name} 🌹'];
  const THANKS = ['thank you so much {name} 😍', 'wow thanks {name} 🙏', 'love you {name} ❤️', '{name} you are the best 🔥', 'thanks {name}! 🎁', 'omg {name} 😭💖', 'shukriya {name} 🌹', 'nandri {name} 🙏✨'];
  const REPLIES = [
    'hello {name}! 👋 how are you?', 'welcome {name} 😊', 'haha true {name}', 'hi {name}, come on mic!', '{name} where are you from?', 'nice to meet you {name} 🤝',
    'exactly {name} 😂', 'yes {name}!', '{name} send a gift to host 🎁 haha', 'good one {name} 👏'
  ];
  const DM_OPENERS = ['Hi! I saw you in the room, welcome to Classic Friends 🎉', 'Hello 👋 nice profile! Come to my room tonight 🎤', 'Hey! Want to be friends? 🤝', 'Hi there 😊 which city are you from?', 'Your name is cool 😄 are you new here?'];
  const DM_REPLIES = ['haha nice 😄', 'I am from Dubai, you?', 'come to my room, I will sing for you 🎤', 'ok sure!', 'hehe 😊', 'good good 👍', 'let us play ludo later 🎲', 'thank you ❤️', 'yes I am online every night', 'send me a gift na 😂🎁'];
  const MOMENTS = [
    { text: 'First time hosting a room tonight — 120 people came! Thank you all 😭❤️', emoji: '🎤' },
    { text: 'Chai, rain and ghazals. Perfect evening in Muscat 🌧️☕', emoji: '🌧️' },
    { text: 'Reached Level 30 today! Next target: 50 🔥', emoji: '🏆' },
    { text: 'Who is coming to the karaoke battle tomorrow 9pm? Winner gets 5000 coins 🎶', emoji: '🎶' },
    { text: 'Made 3 new friends from Kerala in one room. This app is magic ✨', emoji: '🤝' },
    { text: 'Our family "Royal Tigers" is #1 this week! Proud of you all 🐯👑', emoji: '🐯' },
    { text: 'Late night poetry session was so peaceful 📜🌙 شكرا للجميع', emoji: '📜' },
    { text: 'Ludo champion of the room 3 days in a row 😎🎲', emoji: '🎲' },
    { text: 'Just got the Golden Wings frame. Feeling royal 👑', emoji: '👑' },
    { text: 'Diwali vibes in every room tonight 🪔✨', emoji: '🪔' },
    { text: 'Sang "Kaadhal Rojave" and the room went silent. Best feeling 🎤💙', emoji: '💙' },
    { text: 'Friday night, Dubai friends room, see you there! 🇦🇪', emoji: '🇦🇪' }
  ];
  const MOMENT_ART = ['linear-gradient(135deg,#8B5CF6,#F043A6)', 'linear-gradient(135deg,#2DD4BF,#60A5FA)', 'linear-gradient(135deg,#FFB547,#FF6B8A)', 'linear-gradient(135deg,#F043A6,#FFB547)', 'linear-gradient(135deg,#312E81,#8B5CF6)', 'linear-gradient(135deg,#0E7490,#2DD4BF)'];
  const FAMILIES = [
    { name: 'Royal Tigers', badge: 'RT', color: '#FFB547', slogan: 'Roar together 🐯' },
    { name: 'Dubai Stars', badge: 'DXB', color: '#2DD4BF', slogan: 'Shine every night ✨' },
    { name: 'Tamil Thunder', badge: 'TT', color: '#F043A6', slogan: 'Semma vibes only 🔥' },
    { name: 'Desert Kings', badge: 'DK', color: '#B57BFF', slogan: 'Kings of the mic 👑' },
    { name: 'Chai Lovers', badge: 'CL', color: '#FF6B8A', slogan: 'One more cup ☕' }
  ];

  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rand(arr.length)];
  const chance = (p) => Math.random() < p;

  class BotDirector {
    constructor(engine, opts) {
      this.engine = engine; this.opts = opts || {}; this.catalog = engine.catalog;
      this.bots = []; this.timer = null; this.timers = new Set(); this.realUsers = new Set();
      this.engine.on(ev => this.onEvent(ev));
    }
    later(ms, fn) { const t = setTimeout(() => { this.timers.delete(t); try { fn(); } catch (e) { console.error('bot timer', e); } }, ms); this.timers.add(t); return t; }

    /* ---------------- seeding ---------------- */
    seed(count) {
      const E = this.engine; const nBots = count || 70;
      for (let i = 0; i < nBots; i++) {
        const gender = chance(0.5) ? 'f' : 'm'; const base = pick(gender === 'f' ? NAMES_F : NAMES_M); const name = base + pick(SUFFIX);
        const res = E.login({ name, gender, country: pick(COUNTRIES), avatarSeed: 'bot-' + name + i, isBot: true, bio: pick(['Music is life 🎶', 'Here for good vibes only ✨', 'Dubai 🇦🇪 | Chennai 🇮🇳', 'Singer • Dreamer • Chai lover ☕', 'Be kind 🌸', 'Night owl 🦉', 'Ludo champion 🎲', 'Poetry & tea 📜']) });
        const u = E.user(res.user.id); u.isBot = true;
        const xp = chance(0.15) ? 20000 + rand(300000) : chance(0.5) ? 2000 + rand(20000) : rand(2000);
        E.addXp(u, xp); E.addCharm(u, Math.floor(xp * (0.3 + Math.random())));
        u.coins = 500 + rand(20000); u.diamonds = rand(5000);
        if (chance(0.25)) { u.vip = 1 + rand(5); u.vipUntil = E.now() + 30 * 86400000; }
        if (chance(0.3)) { const fr = pick(['fr-neon', 'fr-gold', 'fr-rose', 'fr-cyber', 'fr-royal', 'fr-ice']); u.inventory.push({ itemId: fr, type: 'frame', expiresAt: E.now() + 30 * 86400000 }); u.equipped.frame = fr; }
        if (chance(0.2)) { const bb = pick(['bb-candy', 'bb-ocean', 'bb-gold', 'bb-aurora']); u.inventory.push({ itemId: bb, type: 'bubble', expiresAt: E.now() + 30 * 86400000 }); u.equipped.bubble = bb; }
        if (chance(0.15)) { const en = pick(['en-car', 'en-dragon', 'en-carpet', 'en-stars']); u.inventory.push({ itemId: en, type: 'entry', expiresAt: E.now() + 30 * 86400000 }); u.equipped.entry = en; }
        u.createdAt = E.now() - rand(400) * 86400000;
        this.bots.push(u);
      }
      // follow each other a bit
      for (const b of this.bots) for (let k = 0; k < 3 + rand(8); k++) { const o = pick(this.bots); if (o !== b) { b.following.add(o.id); o.followers.add(b.id); if (chance(0.4)) { b.friends.add(o.id); o.friends.add(b.id); } } }
      // families
      FAMILIES.forEach((f, i) => { const leader = this.bots.find(b => !b.familyId) || this.bots[0]; const res = E.createFamily(leader.id, f); if (res.ok) { const fam = E.families.get(res.family.id); for (let k = 0; k < 6 + rand(12); k++) { const m = pick(this.bots); if (!m.familyId) { m.familyId = fam.id; fam.members.add(m.id); } } fam.xp = 20000 + rand(400000); fam.weekly = rand(80000); fam.level = Math.max(1, Math.floor(Math.log10(fam.xp))); } });
      // moments
      MOMENTS.forEach((m, i) => { const author = this.bots[(i * 5 + 3) % this.bots.length]; const res = E.postMoment(author.id, { text: m.text, emoji: m.emoji, art: MOMENT_ART[i % MOMENT_ART.length] }); if (res.ok) { const mo = E.moments.find(x => x.id === res.moment.id); mo.ts = E.now() - rand(72) * 3600000; for (let k = 0; k < rand(40); k++) mo.likes.add(pick(this.bots).id); for (let k = 0; k < rand(4); k++) mo.comments.push({ id: 'c' + i + k, userId: pick(this.bots).id, text: pick(['so true 😍', 'congrats!! 🎉', 'welcome to Classic Friends ❤️', 'see you there 🎤', 'semma 🔥', 'mashallah 🌹', '😂😂😂', 'proud of you 👏']), ts: mo.ts + k * 60000 }); } });
      E.moments.sort((a, b) => b.ts - a.ts);
      // rooms
      let bi = 0;
      ROOMS.forEach((cfg, i) => {
        const host = this.bots[bi++ % this.bots.length];
        const res = E.createRoom(host.id, Object.assign({ persistent: true, seatCount: chance(0.3) ? 12 : 8, theme: pick(['th-lounge', 'th-tokyo', 'th-dusk', 'th-ocean', 'th-rose', 'th-galaxy']), announcement: pick(['Be respectful, no spam 🙏', 'Follow the room for daily sessions 💜', 'Gift the singers 🎁🎤', 'New friends welcome, say hi!', '']), micMode: chance(0.2) ? 'apply' : 'free' }, cfg));
        if (!res.ok) return; const room = E.room(res.room.id); room.country = cfg.country; room.createdAt = E.now() - rand(180) * 60000;
        const n = 3 + rand(9);
        for (let k = 0; k < n; k++) { const b = this.bots[bi++ % this.bots.length]; if (b.roomId) continue; E.joinRoom(b.id, { roomId: room.id }); }
        const members = [...room.members].filter(id => id !== host.id);
        const onMic = Math.min(members.length, 2 + rand(Math.min(6, room.seatCount - 1)));
        for (let k = 0; k < onMic; k++) { const s = room.seats.find(x => x.index > 0 && !x.userId); if (!s) break; const b = members[k]; E.takeSeat(b, { index: s.index, approved: true }); if (chance(0.25)) room.seats[s.index].muted = true; }
        room.messages.length = 0;
        for (let k = 0; k < 8 + rand(10); k++) { const b = E.user(pick([...room.members])); const m = { id: 'seed' + i + k, type: 'chat', userId: b.id, user: { id: b.id, name: b.name, level: b.level, vip: b.vip, bubble: b.equipped.bubble, avatar: b.avatar, isHost: b.id === host.id }, text: pick(CHAT), ts: E.now() - (20 - k) * 30000 }; room.messages.push(m); }
        room.totalGifts = rand(200000); for (const id of room.members) if (chance(0.6)) room.contributions.set(id, rand(20000));
        if (chance(0.3)) room.music = { title: pick(['Kesariya — Arijit Singh', 'Vaathi Coming', 'Tum Hi Ho', 'Enna Solla Pogirai', 'Pasoori', 'Naatu Naatu']), by: host.name, startedAt: E.now() };
        for (const id of room.members) if (chance(0.5)) room.followers.add(id);
        for (const b of this.bots) if (chance(0.08)) room.followers.add(b.id);
      });
      // a few extra bots idle (not in rooms) so friend suggestions look alive
      return this;
    }

    /* ---------------- live loop ---------------- */
    // same guard as later(): one bad record must not take the whole server down every 1.1 s
    start() { if (this.timer) return this; this.timer = setInterval(() => { try { this.tick(); } catch (e) { console.error('bot tick', e); } }, 1100); return this; }
    stop() { clearInterval(this.timer); this.timer = null; for (const t of this.timers) clearTimeout(t); this.timers.clear(); }
    tick() {
      const E = this.engine; E.tick();
      for (const room of E.rooms.values()) {
        if (room.closed) continue;
        const members = [...room.members].map(id => E.user(id)).filter(u => u && u.isBot);
        const hasReal = [...room.members].some(id => this.realUsers.has(id));
        const activity = hasReal ? 1 : 0.35;              // rooms the real user is in are livelier
        if (!members.length) continue;
        const speakers = room.seats.filter(s => s.userId && !s.muted).map(s => E.user(s.userId)).filter(u => u && u.isBot);
        if (speakers.length && chance(0.35 * activity)) this.speakBurst(pick(speakers));
        if (chance(0.22 * activity)) { const b = pick(members); E.sendMessage(b.id, { text: pick(CHAT) }); }
        if (chance(0.12 * activity)) { const b = pick(members); E.sendReaction(b.id, { emoji: pick(this.catalog.REACTIONS) }); }
        if (chance(0.10 * activity)) this.botGift(room, members);
        if (chance(0.03)) { const b = pick(members); if (b.id !== room.hostId && room.members.size > 2) { E.leaveRoom(b.id); this.later(20000 + rand(60000), () => { if (!b.roomId) E.joinRoom(b.id, { roomId: room.id }); }); } }
        if (chance(0.025)) { const idle = this.bots.filter(b => !b.roomId); if (idle.length) E.joinRoom(pick(idle).id, { roomId: room.id }); }
        if (chance(0.03)) { const seated = members.filter(b => room.seats.some(s => s.userId === b.id && s.index > 0)); const unseated = members.filter(b => !room.seats.some(s => s.userId === b.id)); if (unseated.length && chance(0.6)) { const s = room.seats.find(x => x.index > 0 && !x.userId && !x.locked); if (s) E.takeSeat(pick(unseated).id, { index: s.index, approved: true }); } else if (seated.length > 1) E.leaveSeat(pick(seated).id); }
      }
    }
    speakBurst(bot) {
      const E = this.engine; const dur = 1500 + rand(3500); const start = Date.now();
      const step = () => { if (!bot.roomId) return; const t = Date.now() - start; if (t > dur) { E.speaking(bot.id, { level: 0 }); return; } E.speaking(bot.id, { level: 0.3 + Math.random() * 0.7 }); this.later(220, step); };
      step();
    }
    botGift(room, members) {
      const E = this.engine; const from = pick(members); const targets = room.seats.filter(s => s.userId && s.userId !== from.id);
      if (!targets.length) return;
      const roll = Math.random(); const pool = roll > 0.985 ? ['car', 'yacht', 'rocket', 'castle'] : roll > 0.9 ? ['diamond', 'ring', 'crown', 'fireworks'] : roll > 0.6 ? ['heart', 'kiss', 'teddy', 'cake', 'bouquet'] : ['rose', 'lolly', 'coffee', 'clover'];
      const giftId = pick(pool); const qty = roll > 0.9 ? 1 : pick([1, 1, 1, 9, 9, 66, 99]);
      from.coins += 1e6;  // bots never run out
      E.sendGift(from.id, { giftId, to: pick(targets).userId, qty });
    }

    /* ---------------- reactions to the real user ---------------- */
    isReal(id) { const u = this.engine.user(id); return u && !u.isBot; }
    onEvent(ev) {
      const E = this.engine; const p = ev.payload;
      switch (ev.type) {
        case 'room:member-joined': {
          if (!this.isReal(p.user.id)) return; this.realUsers.add(p.user.id);
          const room = E.room(p.roomId); if (!room) return;
          const host = E.user(room.hostId); if (host && host.isBot) this.later(1200 + rand(1500), () => { if (room.members.has(p.user.id)) E.sendMessage(host.id, { text: pick(WELCOME).replace('{name}', p.user.name) }); });
          if (chance(0.7)) { const others = [...room.members].map(id => E.user(id)).filter(u => u && u.isBot && u.id !== room.hostId); if (others.length) this.later(3000 + rand(4000), () => { if (room.members.has(p.user.id)) E.sendMessage(pick(others).id, { text: pick(['welcome 👋', 'hi {name}!', 'hello {name} 🌹', 'new friend! 🎉']).replace('{name}', p.user.name) }); }); }
          break;
        }
        case 'room:gift': {
          if (!this.isReal(p.from.id)) return;
          for (const t of p.to) { const bot = E.user(t.id); if (bot && bot.isBot && bot.roomId === p.roomId) this.later(900 + rand(2000), () => E.sendMessage(bot.id, { text: pick(THANKS).replace('{name}', p.from.name) })); }
          if (p.gift.tier >= 3) { const room = E.room(p.roomId); if (room) for (const id of [...room.members].slice(0, 3)) { const b = E.user(id); if (b && b.isBot && !p.to.some(t => t.id === b.id)) this.later(1500 + rand(3000), () => E.sendReaction(b.id, { emoji: pick(['🔥', '😍', '👏', '🎉']) })); } }
          break;
        }
        case 'room:message': {
          const m = p.message; if (m.type !== 'chat' || !this.isReal(m.userId)) return;
          const room = E.room(p.roomId); if (!room || !chance(0.6)) return;
          const bots = [...room.members].map(id => E.user(id)).filter(u => u && u.isBot); if (!bots.length) return;
          const t = m.text.toLowerCase(); let reply;
          if (/\b(hi|hello|hey|salam|vanakkam|namaste)\b/.test(t)) reply = pick(['hello {name}! 👋', 'hi {name} 😊 welcome', 'hey {name}, how are you?', 'salam {name} 🌹']);
          else if (/song|sing|gaana|paattu/.test(t)) reply = pick(['🎤 host will sing now!', 'yes one song please 🙏', 'which song {name}?', 'antakshari time 🎶']);
          else if (/mic/.test(t)) reply = pick(['take seat 3 {name}, it is free', 'come on mic {name} 🎤', 'host, give mic to {name}']);
          else if (/\?/.test(t)) reply = pick(['yes {name} 😄', 'haha good question', 'I think yes', 'ask the host 😂']);
          else reply = pick(REPLIES);
          this.later(1500 + rand(3500), () => E.sendMessage(pick(bots).id, { text: reply.replace('{name}', m.user.name) }));
          break;
        }
        case 'room:seats': {
          const room = E.room(p.roomId); if (!room) return;
          for (const s of p.seats) if (s.user && this.isReal(s.user.id) && !this._seatSeen) { /* noop */ }
          break;
        }
        case 'dm:message': {
          const m = p.message; if (!this.isReal(m.from)) return; const bot = E.user(m.to); if (!bot || !bot.isBot) return;
          this.later(2000 + rand(4000), () => E.sendDm(bot.id, { toUserId: m.from, text: pick(DM_REPLIES) }));
          break;
        }
        case 'friend:request': {
          const req = p.from; // bot received a request from real user
          break;
        }
        case 'cp:request': break;
        case 'user:update': break;
      }
    }
    /* called by the transport when a real user logs in */
    onUserLogin(userId) {
      const E = this.engine; const u = E.user(userId); if (!u || u.isBot) return; this.realUsers.add(userId);
      if (u._greeted) return; u._greeted = true;
      const greeters = this.bots.slice().sort(() => Math.random() - 0.5).slice(0, 3);
      greeters.forEach((b, i) => this.later(2500 + i * 6000, () => E.sendDm(b.id, { toUserId: userId, text: pick(DM_OPENERS) })));
      // with BOTS=0 (or very few bots) there may be nobody to pick
      const requester = pick(this.bots.filter(b => !greeters.includes(b)));
      if (requester) this.later(9000, () => E.friendRequest(requester.id, { targetId: userId }));
      const follower = pick(this.bots); if (follower) this.later(15000, () => E.followUser(follower.id, { targetId: userId, follow: true }));
    }
    /* bots accept friend / CP requests from real users */
    hookRequests() {
      const E = this.engine; const self = this;
      const origFriend = E.friendRequest.bind(E);
      E.friendRequest = function (userId, p) { const res = origFriend(userId, p); const t = E.user(p && p.targetId); if (res.ok && res.sent && t && t.isBot && self.isReal(userId)) self.later(2500 + rand(3000), () => E.acceptFriend(t.id, { fromId: userId })); return res; };
      const origCp = E.cpRequest.bind(E);
      E.cpRequest = function (userId, p) { const res = origCp(userId, p); const t = E.user(p && p.targetId); if (res.ok && t && t.isBot && self.isReal(userId)) self.later(3000, () => E.cpAccept(t.id, { fromId: userId })); return res; };
      const origJoinFam = E.joinFamily.bind(E); E.joinFamily = function (userId, p) { return origJoinFam(userId, p); };
      return this;
    }
  }

  BotDirector.ROOMS = ROOMS; BotDirector.CHAT = CHAT;
  return BotDirector;
});
