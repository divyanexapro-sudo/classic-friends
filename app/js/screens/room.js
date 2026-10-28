/* ============================================================
   Live room — RoomCtl (state + events, survives minimize) and Screens.room (the view)
   ============================================================ */
(function () {
  const { esc, el, I, avatar, lv, vip, fam, flag, tagOf, toast, sheet, modal, confirm, prompt, fmt, timeAgo, frameStyle, waveColor, themeStyle, $ } = UI;
  const C = () => CF.catalog; const AV = () => CF.avatar;

  const TRUTH_DARE = ['Truth: What is your biggest fear? 😱', 'Dare: Sing the chorus of your favourite song 🎤', 'Truth: Who in this room would you call at 3am?', 'Dare: Speak in a movie-villain voice for 1 minute 😈', 'Truth: Your most embarrassing moment this year?', 'Dare: Compliment everyone on mic, one by one 💐', 'Truth: Last lie you told? 🤥', 'Dare: Do your best cricket commentary 🏏', 'Truth: Chai or coffee — defend your answer ☕', 'Dare: Tell a joke; if nobody laughs, send a rose to the host 🌹'];

  /* ============================================================ controller */
  const RoomCtl = {
    view: null, mySeat: -1, applicants: [], speakTimers: {}, bagTimers: {}, joining: false,

    async join(roomId, opts) {
      opts = opts || {}; if (RoomCtl.joining) return; RoomCtl.joining = true;
      try {
        if (S.room && S.room.id === roomId) { Router.go('room/' + roomId); return; }
        let password;
        const listed = (S.get('rooms') || []).find(r => r.id === roomId);
        if (listed && listed.locked && !opts.password) { password = await modal({ title: 'Private room', html: `<p>Enter the room password to join.</p><input class="input mb-4" id="pw" inputmode="numeric" placeholder="Password">`, yesLabel: 'Join', value: m => m.querySelector('#pw').value }); if (password === false) return; }
        let res = await Net.act('joinRoom', { roomId, password: opts.password || password });
        if (!res.ok && res.error === 'Wrong room password' && password === undefined) {
          password = await modal({ title: 'Private room', html: `<p>Enter the room password to join.</p><input class="input mb-4" id="pw" inputmode="numeric" placeholder="Password">`, yesLabel: 'Join', value: m => m.querySelector('#pw').value });
          if (password === false) return;
          res = await Net.act('joinRoom', { roomId, password });
        }
        if (!res.ok) { toast(res.error, 'err'); return; }
        RoomCtl.enter(res.room, opts);
      } finally { RoomCtl.joining = false; }
    },
    enter(room, opts) {
      opts = opts || {}; const me = S.me;
      if (S.room && S.room.id !== room.id) { Voice.leaveRoom(); }
      S.set('room', room); RoomCtl.mySeat = room.seats.findIndex(s => s.user && s.user.id === me.id);
      RoomCtl.applicants = (room.applicants || []).map(id => room.members.find(m => m.id === id)).filter(Boolean);
      if (!opts.silent) Router.go('room/' + room.id);
      else RoomCtl.refreshView();
      if (RoomCtl.mySeat >= 0 && !Voice.active) RoomCtl.startVoice();
      // ask everyone on a mic for audio — covers first join, refresh and reconnect (speakers don't know we're new)
      Voice.requestAudio(room.seats.filter(s => s.user).map(s => s.user.id));
    },
    refreshView() { const v = RoomCtl.view; if (!v) return; v.renderHead(); v.renderSeats(); v.renderChat(); v.updateBar(); v.renderPk(); },
    async resync() {
      const room = S.room; if (!room) return;
      const r = await Net.act('joinRoom', { roomId: room.id, password: room.password });
      if (r.ok) RoomCtl.enter(r.room, { silent: true }); else { Voice.leaveRoom(); S.set('room', null); RoomCtl.renderMini(); if (Router.current === 'room') Router.go('home', { replace: true }); }
    },
    async leave(silent) {
      const room = S.room; if (!room) return;
      Voice.leaveRoom(); RoomCtl.mySeat = -1; S.set('room', null);
      await Net.act('leaveRoom');
      RoomCtl.renderMini();
      if (!silent && Router.current === 'room') Router.go('home', { replace: true });
    },
    minimize() { Router.go('home'); },
    renderMini() {
      const app = $('#app'); let pill = $('.mini-room', app); const room = S.room;
      if (!room || Router.current === 'room' || Router.current === 'auth') { if (pill) pill.remove(); app.classList.remove('has-mini'); return; }
      app.classList.add('has-mini');
      const html = `${avatar(room.host, '', { frame: false })}<span class="t"><b>${esc(room.title)}</b><span><i class="eq"><i></i><i></i><i></i></i> ${fmt(room.memberCount)} listening · ${RoomCtl.mySeat >= 0 ? 'on mic' : 'listening'}</span></span><button class="x" data-exit aria-label="Leave room">${I.x}</button>`;
      if (!pill) { pill = el(`<div class="mini-room"></div>`); app.appendChild(pill); pill.addEventListener('click', e => { if (e.target.closest('[data-exit]')) { RoomCtl.leave(); } else Router.go('room/' + S.room.id); }); }
      pill.innerHTML = html;
    },

    /* ---------- voice ---------- */
    async startVoice() {
      try { await Voice.start(); Voice.onLevel = l => RoomCtl.view && RoomCtl.view.setSpeaking(S.me.id, l); const ids = (S.room.members || []).map(m => m.id); Voice.connectToAll(ids); RoomCtl.view && RoomCtl.view.updateBar(); }
      catch (e) { toast('Microphone blocked — allow mic access to talk', 'err', 3000); console.warn(e); }
    },
    async takeSeat(index) {
      const room = S.room; if (!room) return;
      const res = await Net.act('takeSeat', { index });
      if (!res.ok) { toast(res.error, 'err'); return; }
      if (res.applied) { toast('Request sent to the host 🙋', 'ok'); return; }
      RoomCtl.mySeat = res.index; UI.haptic(20); RoomCtl.startVoice();
    },
    async leaveSeat() { const res = await Net.act('leaveSeat'); if (res.ok) { RoomCtl.mySeat = -1; Voice.stop(); RoomCtl.view && RoomCtl.view.updateBar(); } },
    async toggleMute() { if (RoomCtl.mySeat < 0) return RoomCtl.autoSeat(); const seat = S.room.seats[RoomCtl.mySeat]; const res = await Net.act('muteSeat', { index: RoomCtl.mySeat, muted: !seat.muted }); if (res.ok) { Voice.setMuted(res.muted); UI.haptic(); } else toast(res.error, 'err'); },
    autoSeat() { const room = S.room; const free = room.seats.find(s => s.index > 0 && !s.user && !s.locked); if (!free) return toast('All mic seats are taken'); if (room.micMode === 'apply' && !RoomCtl.canManage()) { Net.act('takeSeat', { index: free.index }).then(r => toast(r.ok ? 'Request sent to the host 🙋' : r.error, r.ok ? 'ok' : 'err')); return; } RoomCtl.takeSeat(free.index); },
    canManage() { const r = S.room, me = S.me; return r && me && (r.hostId === me.id || (r.admins || []).includes(me.id)); },
    isHost() { return S.room && S.me && S.room.hostId === S.me.id; },

    /* ---------- event binding (once) ---------- */
    bind() {
      const V = () => RoomCtl.view; const inRoom = p => S.room && (!p || !p.roomId || p.roomId === S.room.id);
      const applySeats = seats => { const r = S.room; if (!r) return; r.seats = seats; RoomCtl.mySeat = seats.findIndex(s => s.user && s.user.id === S.me.id); if (RoomCtl.mySeat < 0 && Voice.active) Voice.stop(); V() && V().renderSeats(); V() && V().updateBar(); };
      Net.on('room:seats', p => { if (inRoom(p)) applySeats(p.seats); });
      Net.on('room:member-joined', p => { const r = S.room; if (!inRoom(p)) return; r.memberCount = p.memberCount; if (!r.members.some(m => m.id === p.user.id)) r.members.push(p.user); if (p.seats) applySeats(p.seats); V() && V().onMember(); if (p.user.id !== S.me.id && (p.entry || p.user.vip >= 3)) V() && V().showEntry(p.user, p.entry); RoomCtl.renderMini(); });
      Net.on('room:member-left', p => { const r = S.room; if (!inRoom(p)) return; r.memberCount = p.memberCount; r.members = r.members.filter(m => m.id !== p.userId); applySeats(p.seats); Voice.onMemberLeft(p.userId); V() && V().onMember(); RoomCtl.renderMini(); });
      Net.on('room:member-updated', p => { const r = S.room; if (!r) return; r.members = r.members.map(m => m.id === p.user.id ? p.user : m); r.seats.forEach(s => { if (s.user && s.user.id === p.user.id) s.user = p.user; }); if (p.user.id === r.hostId) r.host = p.user; V() && V().renderSeats(); });
      Net.on('room:message', p => { const r = S.room; if (!inRoom(p)) return; r.messages.push(p.message); if (r.messages.length > 200) r.messages.shift(); V() && V().addMessage(p.message); });
      Net.on('room:gift', p => { if (!inRoom(p)) return; V() && V().showGift(p); });
      Net.on('room:reaction', p => { if (!S.room) return; V() && V().showReaction(p); });
      Net.on('room:speaking', p => { if (!S.room || p.userId === S.me.id) return; V() && V().setSpeaking(p.userId, p.level); });
      Net.on('room:updated', p => { const r = S.room; if (!r || r.id !== p.id) return; Object.assign(r, p); V() && V().renderHead(); V() && V().renderSeats(); });
      Net.on('room:contributions', p => { const r = S.room; if (!inRoom(p)) return; r.top3 = p.top; r.totalGifts = p.totalGifts; V() && V().renderMeta(); });
      Net.on('room:pk', p => { const r = S.room; if (!r) return; r.pk = p; V() && V().renderPk(); });
      Net.on('room:music', p => { const r = S.room; if (!inRoom(p)) return; r.music = p.music; V() && V().renderHead(); });
      Net.on('room:applicants', p => { if (!inRoom(p)) return; RoomCtl.applicants = p.applicants; V() && V().updateBar(); if (RoomCtl.canManage() && p.applicants.length) toast(`🙋 ${esc(p.applicants[p.applicants.length - 1].name)} wants to join the mic`); });
      Net.on('room:levelup', p => { if (!S.room) return; V() && V().showLevelUp(p); });
      Net.on('room:luckybag', p => { if (!inRoom(p)) return; V() && V().showBag(p); });
      Net.on('room:luckybag-grab', p => { if (!S.room) return; V() && V().updateBag(p); });
      Net.on('room:dice', p => { if (!S.room) return; V() && V().showDice(p); });
      Net.on('room:force-mute', p => { if (!S.room) return; Voice.setMuted(p.muted); toast(p.muted ? `🔇 ${esc(p.by.name)} muted your mic` : `🎙️ ${esc(p.by.name)} unmuted you`); });
      Net.on('room:seat-removed', p => { if (!S.room) return; RoomCtl.mySeat = -1; Voice.stop(); toast(`${esc(p.by.name)} removed you from the mic`); V() && V().updateBar(); });
      Net.on('room:seat-invite', async p => { if (!S.room || p.roomId !== S.room.id) return; const ok = await confirm('Mic invitation 🎤', `${p.by.name} invites you to take mic seat ${p.index + 1}.`, 'Take the mic'); if (ok) RoomCtl.takeSeat(p.index); });
      Net.on('room:kicked', p => { if (!S.room || p.roomId !== S.room.id) return; Voice.leaveRoom(); RoomCtl.mySeat = -1; S.set('room', null); RoomCtl.renderMini(); if (Router.current === 'room') Router.go('home', { replace: true }); toast(p.banned ? 'You were blocked from this room' : 'You were removed from the room', 'err', 3000); });
      Net.on('room:closed', p => { if (!S.room || p.roomId !== S.room.id) return; Voice.leaveRoom(); RoomCtl.mySeat = -1; S.set('room', null); RoomCtl.renderMini(); if (Router.current === 'room') Router.go('home', { replace: true }); toast('The host ended the room', '', 3000); });
    },

    /* ---------- shared sheets ---------- */
    async userCard(userId) {
      const r = S.room; const me = S.me; if (!r) return;
      if (userId === me.id) return RoomCtl.selfSheet();
      const res = await Net.act('getUser', { id: userId }); if (!res.ok) return toast(res.error, 'err');
      const u = res.user; const seat = r.seats.find(s => s.user && s.user.id === userId); const canManage = RoomCtl.canManage(); const isHost = RoomCtl.isHost(); const isAdmin = (r.admins || []).includes(userId);
      const api = sheet({ cls: 'user-card', title: '', html: `
        <div class="head">${avatar(u, 'xl')}<div class="grow"><h3 style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${esc(u.name)} ${lv(u.level)} ${vip(u.vip)} ${fam(u)}</h3><div class="muted" style="font-size:12px;margin-top:4px">ID ${u.id} · ${C().flagOf(u.country)} ${u.gender === 'f' ? '♀' : '♂'}${u.id === r.hostId ? ' · <span class="host-tag">HOST</span>' : isAdmin ? ' · <span class="admin-tag">ADMIN</span>' : ''}</div><p style="font-size:13px;margin-top:6px;color:var(--text-2)">${esc(u.bio)}</p></div></div>
        <div class="stats"><div><b>${fmt(u.followers)}</b><span>Followers</span></div><div><b>${fmt(u.friends)}</b><span>Friends</span></div><div><b>${fmt(u.charm)}</b><span>Charm</span></div><div><b>${fmt(u.wealth)}</b><span>Wealth</span></div></div>
        <div class="actions">
          <button data-a="gift"><span class="ic">🎁</span>Gift</button>
          <button data-a="friend"><span class="ic">${u.isFriend ? '💬' : u.requestSent ? '⏳' : '🤝'}</span>${u.isFriend ? 'Message' : u.requestSent ? 'Requested' : 'Add friend'}</button>
          <button data-a="follow"><span class="ic">${u.isFollowing ? '✅' : '➕'}</span>${u.isFollowing ? 'Following' : 'Follow'}</button>
          <button data-a="profile"><span class="ic">👤</span>Profile</button>
        </div>
        ${canManage && u.id !== r.hostId ? `<div class="host-actions">
          ${seat ? `<button class="btn sm" data-a="mute">${seat.muted ? '🎙️ Unmute' : '🔇 Mute'}</button><button class="btn sm" data-a="unseat">⬇️ Off mic</button>` : `<button class="btn sm" data-a="invite">🎤 Invite to mic</button>`}
          ${isHost ? `<button class="btn sm" data-a="admin">${isAdmin ? '🛡️ Remove admin' : '🛡️ Make admin'}</button>` : ''}
          <button class="btn sm danger" data-a="kick">🚪 Kick</button><button class="btn sm danger" data-a="ban">⛔ Block</button>
        </div>` : ''}
        <div class="row mt-4" style="justify-content:flex-end"><button class="btn xs ghost" data-a="report">🚩 Report</button></div>`,
        onMount(s) {
          s.addEventListener('click', async e => {
            const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
            if (a === 'gift') { api.close(); RoomCtl.giftPanel(u.id); }
            else if (a === 'friend') { if (u.isFriend) { api.close(); Router.go('chat/' + u.id); } else { const rr = await Net.act('friendRequest', { targetId: u.id }); toast(rr.ok ? 'Friend request sent 🤝' : rr.error, rr.ok ? 'ok' : 'err'); if (rr.ok) b.innerHTML = '<span class="ic">⏳</span>Requested'; } }
            else if (a === 'follow') { const rr = await Net.act('followUser', { targetId: u.id }); if (rr.ok) b.innerHTML = `<span class="ic">${rr.following ? '✅' : '➕'}</span>${rr.following ? 'Following' : 'Follow'}`; }
            else if (a === 'profile') { api.close(); Router.go('profile/' + u.id); }
            else if (a === 'mute') { const rr = await Net.act('muteSeat', { index: seat.index }); if (!rr.ok) toast(rr.error, 'err'); api.close(); }
            else if (a === 'unseat') { await Net.act('removeFromSeat', { index: seat.index }); api.close(); }
            else if (a === 'invite') { const free = r.seats.find(x => x.index > 0 && !x.user && !x.locked); if (!free) return toast('No free seat'); await Net.act('inviteToSeat', { targetId: u.id, index: free.index }); toast('Invitation sent', 'ok'); api.close(); }
            else if (a === 'admin') { const rr = await Net.act('setAdmin', { targetId: u.id, admin: !isAdmin }); if (rr.ok) r.admins = rr.admins; toast(rr.ok ? 'Updated' : rr.error); api.close(); }
            else if (a === 'kick') { if (await confirm('Remove ' + u.name + '?', 'They can rejoin later.', 'Remove', true)) { await Net.act('kickUser', { targetId: u.id }); api.close(); } }
            else if (a === 'ban') { if (await confirm('Block ' + u.name + '?', 'They will not be able to rejoin this room.', 'Block', true)) { await Net.act('kickUser', { targetId: u.id, ban: true }); api.close(); } }
            else if (a === 'report') { api.close(); RoomCtl.reportSheet(u.id); }
          });
        } });
    },
    selfSheet() {
      const r = S.room; const seat = r.seats[RoomCtl.mySeat];
      sheet({ title: 'You', html: `<div class="col" style="gap:10px">
        ${seat ? `<button class="btn block" data-a="mute">${seat.muted ? '🎙️ Unmute my mic' : '🔇 Mute my mic'}</button><button class="btn block ghost" data-a="leave">⬇️ Leave the mic</button>` : `<button class="btn block primary" data-a="take">🎤 Take a mic</button>`}
        <button class="btn block ghost" data-a="profile">👤 View my profile</button></div>`,
        onMount(s, api) { s.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; api.close(); const a = b.dataset.a; if (a === 'mute') RoomCtl.toggleMute(); else if (a === 'leave') RoomCtl.leaveSeat(); else if (a === 'take') RoomCtl.autoSeat(); else Router.go('me'); }); } });
    },
    reportSheet(targetId) {
      sheet({ title: 'Report', html: `<div class="col" style="gap:8px">${C().REPORT_REASONS.map(x => `<button class="btn block ghost" data-r="${esc(x)}">${esc(x)}</button>`).join('')}</div>`, onMount(s, api) { s.addEventListener('click', async e => { const b = e.target.closest('[data-r]'); if (!b) return; await Net.act('reportUser', { targetId, reason: b.dataset.r, roomId: S.room && S.room.id }); api.close(); toast('Thanks — our team will review this report', 'ok', 3000); }); } });
    },

    /* ---------- gift panel ---------- */
    giftPanel(preselect) {
      const r = S.room; const me = S.me; if (!r) return;
      const gifts = (S.gifts || C().GIFTS).filter(g => g.active !== false);
      const st = { cat: 'hot', gift: gifts.find(g => g.cat === 'hot'), qty: 1, to: new Set(preselect ? [preselect] : []) };
      const seated = () => r.seats.filter(s => s.user && s.user.id !== me.id).map(s => s.user);
      if (!st.to.size) { const host = seated().find(u => u.id === r.hostId) || seated()[0]; if (host) st.to.add(host.id); }
      const api = sheet({ cls: 'gift-panel', title: 'Send a gift', headRight: `<span class="coin" id="gbal">${fmt(me.coins)}</span>`, html: `
        <div class="receivers" id="grecv"></div>
        <div class="tabs" id="gcats">${C().GIFT_CATS.map(c => `<button data-cat="${c.id}" class="${c.id === st.cat ? 'active' : ''}">${c.label}</button>`).join('')}</div>
        <div class="gift-grid mt-3" id="ggrid"></div>
        <div class="foot"><button class="btn sm gold" data-a="recharge">+ Coins</button><span class="grow"></span><button class="qty" id="gqty">x1 ${I.down}</button><button class="send" id="gsend">Send</button></div>`,
        onMount(s) {
          const renderRecv = () => { const list = seated(); s.querySelector('#grecv').innerHTML = list.length ? `<button class="all ${st.to.size === list.length ? 'active' : ''}" data-r="all"><span class="avatar">ALL</span>All on mic</button>` + list.map(u => `<button data-r="${u.id}" class="${st.to.has(u.id) ? 'active' : ''}">${avatar(u, '', { frame: false })}<span class="ellipsis" style="max-width:52px">${esc(u.name)}</span></button>`).join('') : '<div class="muted" style="font-size:13px;padding:6px 0">Nobody is on a mic yet — invite friends to a seat first.</div>'; };
          const renderGrid = () => { s.querySelector('#ggrid').innerHTML = gifts.filter(g => g.cat === st.cat).map(g => { const locked = g.vip && me.vip < g.vip; return `<button class="gift-tile ${st.gift && st.gift.id === g.id ? 'active' : ''} ${locked ? 'locked' : ''}" data-g="${g.id}"><span class="em">${g.emoji}</span><span class="nm">${esc(g.name)}</span><span class="pr coin">${g.price}</span>${locked ? `<span class="pr" style="color:var(--amber)">VIP${g.vip}</span>` : ''}</button>`; }).join(''); };
          renderRecv(); renderGrid();
          s.querySelector('#grecv').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; const id = b.dataset.r; const list = seated(); if (id === 'all') { if (st.to.size === list.length) st.to.clear(); else list.forEach(u => st.to.add(u.id)); } else { st.to.has(id) ? st.to.delete(id) : st.to.add(id); } renderRecv(); });
          s.querySelector('#gcats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; st.cat = b.dataset.cat; s.querySelectorAll('#gcats button').forEach(x => x.classList.toggle('active', x === b)); st.gift = gifts.find(g => g.cat === st.cat); renderGrid(); });
          s.querySelector('#ggrid').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; st.gift = gifts.find(g => g.id === b.dataset.g); renderGrid(); UI.haptic(); });
          s.querySelector('#gqty').onclick = () => { const sub = sheet({ title: 'Quantity', html: `<div class="qty-list">${C().GIFT_QTYS.map(q => `<button data-q="${q}" class="${q === st.qty ? 'active' : ''}">x${q}${q === 520 ? ' 💘' : q === 999 ? ' 👑' : ''}</button>`).join('')}</div>`, onMount(ss, sapi) { ss.addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (!b) return; st.qty = Number(b.dataset.q); s.querySelector('#gqty').innerHTML = `x${st.qty} ${I.down}`; sapi.close(); }); } }); };
          s.querySelector('[data-a="recharge"]').onclick = () => { api.close(); Router.go('wallet'); };
          let combo = 0, comboTimer;
          s.querySelector('#gsend').onclick = async () => {
            if (!st.gift) return; if (!st.to.size) return toast('Choose who to send it to');
            const res = await Net.act('sendGift', { giftId: st.gift.id, to: [...st.to], qty: st.qty });
            if (!res.ok) { if (res.error === 'Not enough coins') { api.close(); RoomCtl.rechargePrompt(); } else toast(res.error, 'err'); return; }
            UI.haptic(25); s.querySelector('#gbal').textContent = fmt(res.coins);
            combo++; clearTimeout(comboTimer); comboTimer = setTimeout(() => combo = 0, 3000);
            const btn = s.querySelector('#gsend'); btn.textContent = combo > 1 ? `Send ×${combo} 🔥` : 'Send';
            if (res.luckyWin) toast(`🍀 Lucky! You won ${res.luckyWin} coins back`, 'gold', 2600);
          };
          const offMe = S.on('me', m => { const b = s.querySelector('#gbal'); if (b) b.textContent = fmt(m.coins); });
          s.addEventListener('cf:close', offMe);
        }, onClose() { } });
    },
    async rechargePrompt() { const ok = await confirm('Not enough coins', 'Top up your wallet to keep gifting.', 'Get coins'); if (ok) Router.go('wallet'); },

    /* ---------- games ---------- */
    gamesSheet() {
      const canManage = RoomCtl.canManage();
      sheet({ title: 'Games & fun', html: `<div class="menu-grid">
        <button class="menu-item" data-a="wheel"><span class="ic g2">🎡</span>Lucky wheel</button>
        <button class="menu-item" data-a="dice"><span class="ic g3">🎲</span>Roll dice</button>
        <button class="menu-item" data-a="bag"><span class="ic g4">🧧</span>Lucky bag</button>
        <button class="menu-item" data-a="td"><span class="ic g5">🎴</span>Truth or dare</button>
        ${canManage ? `<button class="menu-item" data-a="pk"><span class="ic g1">⚔️</span>PK battle</button>` : ''}
      </div>`, onMount(s, api) { s.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; api.close(); const a = b.dataset.a; if (a === 'wheel') RoomCtl.wheelSheet(); else if (a === 'dice') { const r = await Net.act('rollDice'); if (!r.ok) toast(r.error, 'err'); } else if (a === 'bag') RoomCtl.bagSheet(); else if (a === 'td') Net.act('sendMessage', { text: '🎴 ' + TRUTH_DARE[Math.floor(Math.random() * TRUTH_DARE.length)] }); else if (a === 'pk') { const r = await Net.act('startPk', { minutes: 3 }); if (!r.ok) toast(r.error, 'err'); } }); } });
    },
    wheelSheet() {
      const W = C().WHEEL; const n = W.slices.length; const cols = ['#8B5CF6', '#F043A6', '#FFB547', '#2DD4BF', '#60A5FA', '#FF6B8A', '#34D399'];
      const grad = W.slices.map((s, i) => `${cols[i % cols.length]} ${i * 360 / n}deg ${(i + 1) * 360 / n}deg`).join(',');
      let rot = 0, spinning = false;
      sheet({ title: 'Lucky wheel', html: `<div class="wheel-wrap"><div class="wheel-pointer"></div><div class="wheel" id="wheel" style="background:conic-gradient(${grad})">${W.slices.map((s, i) => `<div class="slice" style="transform:rotate(${i * 360 / n + 360 / n / 2 - 90}deg)"><span>${s.label}</span></div>`).join('')}</div>
        <p class="muted" style="font-size:13px">Win up to 500 coins. Each spin costs <b class="coin">${W.cost}</b></p><button class="btn primary" id="spin" style="width:200px">Spin 🎡</button><div id="wres" style="font-weight:800;font-size:18px;min-height:24px"></div></div>`,
        onMount(s) { s.querySelector('#spin').onclick = async () => { if (spinning) return; spinning = true; const res = await Net.act('spinWheel'); if (!res.ok) { spinning = false; if (res.error === 'Not enough coins') RoomCtl.rechargePrompt(); else toast(res.error, 'err'); return; } const target = 360 - (res.index * 360 / n + 360 / n / 2); rot += 360 * 5 + ((target - (rot % 360)) + 360) % 360; const w = s.querySelector('#wheel'); w.style.transform = `rotate(${rot}deg)`; setTimeout(() => { spinning = false; s.querySelector('#wres').textContent = res.coins ? `🎉 You won ${res.coins} coins!` : 'Better luck next spin 🍀'; UI.haptic(30); }, 3700); }; } });
    },
    bagSheet() {
      sheet({ title: 'Drop a lucky bag', html: `<p class="muted" style="font-size:13px;margin-bottom:12px">Everyone in the room can grab a random share. Great for celebrating!</p>
        <div class="field"><label>Total coins</label><input class="input" id="bc" type="number" min="10" value="100"></div>
        <div class="field"><label>Number of bags</label><input class="input" id="bn" type="number" min="1" max="50" value="5"></div>
        <div class="field"><label>Message</label><input class="input" id="bm" maxlength="40" placeholder="Good luck! 🧧"></div>
        <button class="btn primary block" id="bgo">Drop 🧧</button>`, onMount(s, api) { s.querySelector('#bgo').onclick = async () => { const r = await Net.act('sendLuckyBag', { coins: Number(s.querySelector('#bc').value), count: Number(s.querySelector('#bn').value), message: s.querySelector('#bm').value }); if (!r.ok) { if (r.error === 'Not enough coins') { api.close(); RoomCtl.rechargePrompt(); } else toast(r.error, 'err'); return; } api.close(); toast('Lucky bag dropped! 🧧', 'ok'); }; } });
    },

    /* ---------- room settings ---------- */
    settingsSheet() {
      const r = S.room; const me = S.me; const themes = C().STORE.filter(s => s.type === 'theme'); const owned = id => { const it = C().storeById(id); return !it.price || (me.inventory || []).some(i => i.itemId === id); };
      const st = { theme: r.theme, tag: r.tag, micMode: r.micMode, seatCount: r.seatCount, locked: r.locked };
      sheet({ title: 'Room settings', html: `
        <div class="field"><label>Room name</label><input class="input" id="st" maxlength="40" value="${esc(r.title)}"></div>
        <div class="field"><label>Announcement</label><input class="input" id="sa" maxlength="140" value="${esc(r.announcement || '')}"></div>
        <div class="field"><label>Welcome message</label><input class="input" id="sw" maxlength="80" value="${esc(r.welcome || '')}"></div>
        <div class="field"><label>Topic</label><div class="chips" id="stag">${C().ROOM_TAGS.map(t => `<button class="chip vibe ${t.id === st.tag ? 'active' : ''}" data-v="${t.id}">${t.emoji} ${t.label}</button>`).join('')}</div></div>
        <div class="row" style="gap:12px;margin-bottom:16px"><div class="field grow" style="margin:0"><label>Mic seats</label><div class="seg" id="sseats"><button data-v="8" class="${st.seatCount === 8 ? 'active' : ''}">8</button><button data-v="12" class="${st.seatCount === 12 ? 'active' : ''}">12</button></div></div><div class="field grow" style="margin:0"><label>Mic mode</label><div class="seg" id="smic"><button data-v="free" class="${st.micMode === 'free' ? 'active' : ''}">Free</button><button data-v="apply" class="${st.micMode === 'apply' ? 'active' : ''}">Apply</button></div></div></div>
        <div class="field"><label>Theme</label><div class="theme-swatches" id="stheme">${themes.map(t => `<button class="theme-swatch ${t.id === st.theme ? 'active' : ''}" data-v="${t.id}" style="background:${t.style}">${t.name}${owned(t.id) ? '' : '<span class="lock">🔒</span>'}</button>`).join('')}</div></div>
        <div class="settings-row" style="border:0;padding:6px 0"><span class="ic">🔒</span><span class="label">Private room</span><button class="switch ${st.locked ? 'on' : ''}" id="slock"></button></div>
        <div class="field ${st.locked ? '' : 'hidden'}" id="spwwrap"><input class="input" id="spw" maxlength="8" placeholder="Room password" value="${esc(r.password || '')}"></div>
        <button class="btn primary block" id="ssave">Save changes</button>`,
        onMount(s, api) {
          const seg = (id, key, num) => s.querySelector('#' + id).addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; st[key] = num ? Number(b.dataset.v) : b.dataset.v; s.querySelectorAll('#' + id + ' [data-v]').forEach(x => x.classList.toggle('active', x === b)); });
          seg('stag', 'tag'); seg('sseats', 'seatCount', true); seg('smic', 'micMode');
          s.querySelector('#stheme').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; if (!owned(b.dataset.v)) return toast('Buy this theme in the Store first'); st.theme = b.dataset.v; s.querySelectorAll('#stheme button').forEach(x => x.classList.toggle('active', x === b)); });
          s.querySelector('#slock').onclick = e => { st.locked = !st.locked; e.currentTarget.classList.toggle('on', st.locked); s.querySelector('#spwwrap').classList.toggle('hidden', !st.locked); };
          s.querySelector('#ssave').onclick = async () => { const res = await Net.act('updateRoom', { roomId: r.id, title: s.querySelector('#st').value, announcement: s.querySelector('#sa').value, welcome: s.querySelector('#sw').value, tag: st.tag, seatCount: st.seatCount, micMode: st.micMode, theme: st.theme, locked: st.locked, password: s.querySelector('#spw').value }); if (!res.ok) return toast(res.error, 'err'); Object.assign(S.room, res.room); api.close(); toast('Room updated', 'ok'); RoomCtl.view && (RoomCtl.view.renderHead(), RoomCtl.view.renderSeats()); };
        } });
    },
    moreSheet() {
      const r = S.room; const canManage = RoomCtl.canManage(); const isHost = RoomCtl.isHost();
      sheet({ title: esc(r.title), html: `<div class="col" style="gap:4px">
        ${canManage ? `<button class="settings-row" style="width:100%;text-align:left" data-a="settings"><span class="ic">⚙️</span><span class="label">Room settings</span>${I.chev}</button>
        <button class="settings-row" style="width:100%;text-align:left" data-a="music"><span class="ic">🎵</span><span class="label">${r.music ? 'Stop "Now playing"' : 'Set "Now playing"'}</span>${I.chev}</button>
        <button class="settings-row" style="width:100%;text-align:left" data-a="applicants"><span class="ic">🙋</span><span class="label">Mic requests</span><span class="value">${RoomCtl.applicants.length}</span>${I.chev}</button>` : ''}
        <button class="settings-row" style="width:100%;text-align:left" data-a="members"><span class="ic">👥</span><span class="label">People in room</span><span class="value">${r.memberCount}</span>${I.chev}</button>
        <button class="settings-row" style="width:100%;text-align:left" data-a="contrib"><span class="ic">🏆</span><span class="label">Top gifters</span>${I.chev}</button>
        <button class="settings-row" style="width:100%;text-align:left" data-a="share"><span class="ic">🔗</span><span class="label">Share room</span><span class="value">ID ${r.id}</span>${I.chev}</button>
        <button class="settings-row" style="width:100%;text-align:left" data-a="min"><span class="ic">🗗</span><span class="label">Minimize</span>${I.chev}</button>
        <button class="settings-row" style="width:100%;text-align:left" data-a="report"><span class="ic">🚩</span><span class="label">Report room</span>${I.chev}</button>
        <button class="settings-row" style="width:100%;text-align:left;color:var(--danger)" data-a="${isHost ? 'end' : 'exit'}"><span class="ic">${isHost ? '⏹️' : '🚪'}</span><span class="label">${isHost ? 'End room for everyone' : 'Leave room'}</span></button>
        </div>`, onMount(s, api) { s.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; api.close(); const a = b.dataset.a;
          if (a === 'settings') RoomCtl.settingsSheet();
          else if (a === 'music') { if (r.music) Net.act('setMusic', { playing: false }); else { const t = await prompt('Now playing', 'Song name — play it through your mic'); if (t) Net.act('setMusic', { playing: true, title: t }); } }
          else if (a === 'applicants') RoomCtl.applicantsSheet();
          else if (a === 'members') RoomCtl.membersSheet();
          else if (a === 'contrib') RoomCtl.contribSheet();
          else if (a === 'share') { const sr = await Net.act('shareRoom', { roomId: r.id }); if (sr.ok) UI.share(sr.text, sr.link); }
          else if (a === 'min') RoomCtl.minimize();
          else if (a === 'report') RoomCtl.reportSheet(r.hostId);
          else if (a === 'exit') RoomCtl.leave();
          else if (a === 'end') { if (await confirm('End this room?', 'Everyone will be sent home.', 'End room', true)) { await Net.act('closeRoom', { roomId: r.id }); Voice.leaveRoom(); S.set('room', null); RoomCtl.renderMini(); Router.go('home', { replace: true }); } }
        }); } });
    },
    membersSheet() {
      const r = S.room;
      sheet({ title: `People · ${r.memberCount}`, html: (r.members || []).map(u => `<button class="list-row" style="width:100%;text-align:left" data-u="${u.id}">${avatar(u, 'md')}<span class="grow"><span class="name"><span class="txt">${esc(u.name)}</span>${lv(u.level)}${vip(u.vip)}${u.id === r.hostId ? '<span class="host-tag">HOST</span>' : (r.admins || []).includes(u.id) ? '<span class="admin-tag">ADMIN</span>' : ''}</span><span class="sub">${r.seats.some(s => s.user && s.user.id === u.id) ? '🎤 On mic' : 'Listening'} · ${C().flagOf(u.country)}</span></span>${I.chev}</button>`).join(''), onMount(s, api) { s.addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (!b) return; api.close(); RoomCtl.userCard(b.dataset.u); }); } });
    },
    contribSheet() {
      const r = S.room; const list = r.contributions || [];
      sheet({ title: 'Top gifters in this room', html: list.length ? list.map((c, i) => `<div class="list-row rank-row"><span class="no">${i + 1}</span>${avatar(c.user, 'md')}<span class="grow"><span class="name"><span class="txt">${esc(c.user.name)}</span>${lv(c.user.level)}</span><span class="sub coin">${fmt(c.coins)}</span></span></div>`).join('') : '<div class="empty"><div class="big">🎁</div><h3>No gifts yet</h3><p>Send the first gift and top this list.</p></div>' });
    },
    applicantsSheet() {
      const list = RoomCtl.applicants;
      sheet({ title: 'Mic requests', html: list.length ? list.map(u => `<div class="list-row">${avatar(u, 'md')}<span class="grow"><span class="name"><span class="txt">${esc(u.name)}</span>${lv(u.level)}</span></span><button class="btn xs primary" data-ok="${u.id}">Approve</button><button class="btn xs ghost" data-no="${u.id}">Decline</button></div>`).join('') : '<div class="empty"><div class="big">🙋</div><h3>No requests</h3><p>Requests to join the mic will show up here.</p></div>', onMount(s, api) { s.addEventListener('click', async e => { const ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]'); if (ok) { await Net.act('approveMic', { targetId: ok.dataset.ok, approve: true }); api.close(); } if (no) { await Net.act('approveMic', { targetId: no.dataset.no, approve: false }); api.close(); } }); } });
    }
  };
  window.RoomCtl = RoomCtl;

  /* ============================================================ view */
  Screens.room = {
    nav: false,
    render(root, route) {
      const room = S.room; const me = S.me;
      if (!room || room.id !== route.id) { if (route.id) RoomCtl.join(route.id); else Router.go('home', { replace: true }); root.innerHTML = `<div class="empty" style="padding-top:140px"><div class="skeleton" style="height:120px"></div></div>`; return; }
      root.classList.add('room');
      root.innerHTML = `
        <div class="room-bg" id="rbg" style="background:${themeStyle(room.theme)}"></div>
        <div class="topbar">
          <button class="icon-btn" data-a="min" aria-label="Minimize">${I.down}</button>
          <div class="room-head" id="rhead"></div>
          <button class="icon-btn" data-a="share" aria-label="Share">${I.share}</button>
          <button class="icon-btn" data-a="more" aria-label="More">${I.moreV}</button>
        </div>
        <div class="room-meta" id="rmeta"></div>
        <div id="rann"></div><div id="rmusic"></div><div id="rpk"></div>
        <div class="seats"><div class="seat-host" id="shost"></div><div class="seat-grid" id="sgrid"></div></div>
        <div class="room-chat" id="rchat"></div>
        <button class="new-msgs hidden" id="newmsgs">${I.down} New messages</button>
        <div class="reaction-row hidden" id="rreact">${C().REACTIONS.map(e => `<button data-react="${e}">${e}</button>`).join('')}</div>
        <div class="room-bar" id="rbar"></div>
        <div class="chat-input-bar hidden" id="rinput"><button class="icon-btn plain" data-a="emoji" style="color:#fff">${I.smile}</button><input class="input" id="rtext" maxlength="300" placeholder="Say something nice…"><button class="icon-btn" data-a="send" style="background:var(--g-vibe);border:0">${I.send}</button></div>
        <div class="fx-layer" id="fx"></div>`;
      const q = sel => root.querySelector(sel);
      const speakTimers = {};
      const view = {
        renderHead() {
          const r = S.room; if (!r) return;
          q('#rhead').innerHTML = `${avatar(r.host, '', { frame: false })}<span class="t"><b>${esc(r.title)}</b><span>ID ${r.id} · ${esc(r.host ? r.host.name : '')}${r.locked ? ' 🔒' : ''}</span></span><button class="follow ${r.isFollowing ? 'on' : ''}" data-a="follow">${r.isFollowing ? 'Following' : '+ Follow'}</button>`;
          q('#rann').innerHTML = r.announcement ? `<div class="announce">📢 <span class="txt">${esc(r.announcement)}</span></div>` : '';
          q('#rmusic').innerHTML = r.music ? `<div class="music-pill"><span class="disc"></span><span class="txt">🎵 ${esc(r.music.title)}</span></div>` : '';
          q('#rbg').style.background = themeStyle(r.theme);
          view.renderMeta();
        },
        renderMeta() {
          const r = S.room; if (!r) return; const top = r.top3 || (r.contributions || []).slice(0, 3);
          q('#rmeta').innerHTML = `<button class="contrib" data-a="contrib"><span class="avatar-stack">${top.length ? top.map(c => avatar(c.user, '', { frame: false })).join('') : '<span class="avatar" style="background:rgba(255,255,255,.15)"></span>'}</span>🏆 ${fmt(r.totalGifts)}</button><button class="members" data-a="members"><span class="avatar-stack">${(r.members || []).slice(0, 3).map(u => avatar(u, '', { frame: false })).join('')}</span>${fmt(r.memberCount)}</button>`;
        },
        seatHtml(s, isHostSeat) {
          const u = s.user; const r = S.room; const cp = u && u.cp && r.seats.some(x => x.user && x.user.id === u.cp.userId);
          if (!u) return `<button class="seat" data-seat="${s.index}"><span class="ring"><span class="empty-seat ${s.locked ? 'locked' : ''}">${s.locked ? I.lock : isHostSeat ? I.crown : I.mic}</span></span><span class="nm dim">${isHostSeat ? 'Host' : s.locked ? 'Locked' : 'Seat ' + (s.index + 1)}</span></button>`;
          return `<button class="seat" data-seat="${s.index}" data-uid="${u.id}" style="--wave:${waveColor(u.wave)}"><span class="ring">${avatar(u)}${s.muted ? `<span class="mute">${I.micOff}</span>` : ''}${cp ? '<span class="cp-heart">💞</span>' : ''}</span><span class="nm">${esc(u.name)}</span><span class="tags">${isHostSeat ? '<span class="host-tag">HOST</span>' : ''}${lv(u.level)}${u.vip ? vip(u.vip) : ''}</span></button>`;
        },
        renderSeats() {
          const r = S.room; if (!r) return;
          q('#shost').innerHTML = view.seatHtml(r.seats[0], true);
          q('#sgrid').innerHTML = r.seats.slice(1).map(s => view.seatHtml(s, false)).join('');
          for (const [uid, t] of Object.entries(speakTimers)) if (t.until > Date.now()) { const elx = root.querySelector(`.seat[data-uid="${uid}"]`); if (elx) elx.classList.add('speaking'); }
        },
        setSpeaking(userId, level) {
          const elx = root.querySelector(`.seat[data-uid="${userId}"]`); const on = level > 0.08;
          if (elx) elx.classList.toggle('speaking', on);
          clearTimeout(speakTimers[userId] && speakTimers[userId].t);
          if (on) speakTimers[userId] = { until: Date.now() + 900, t: setTimeout(() => { const e2 = root.querySelector(`.seat[data-uid="${userId}"]`); if (e2) e2.classList.remove('speaking'); delete speakTimers[userId]; }, 900) };
          else delete speakTimers[userId];
        },
        renderPk() {
          const r = S.room; const box = q('#rpk'); if (!r.pk) { box.innerHTML = ''; return; }
          const total = r.pk.red + r.pk.blue || 1; const pct = Math.round(r.pk.red / total * 100); const left = Math.max(0, Math.ceil((r.pk.endsAt - Date.now()) / 1000));
          box.innerHTML = `<div class="pk-bar"><div class="bar"><div class="red" style="width:${Math.max(12, Math.min(88, pct))}%">🔴 ${fmt(r.pk.red)}</div><div class="blue">${fmt(r.pk.blue)} 🔵</div><span class="vs">VS</span></div><div class="time">⚔️ PK · even seats red, odd seats blue · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</div></div>`;
        },
        msgHtml(m) {
          if (m.type === 'chat') { const u = m.user; return `<div class="msg" data-uid="${u.id}"><div class="bubble" ${u.bubble ? `data-bubble="${u.bubble}"` : ''}>${u.isHost ? '<span class="host-tag">HOST</span>' : u.isAdmin ? '<span class="admin-tag">ADMIN</span>' : ''}${lv(u.level)}${u.vip ? vip(u.vip) : ''}<span class="who">${esc(u.name)}:</span>${esc(m.text)}</div></div>`; }
          if (m.type === 'gift') return `<div class="msg gift"><div class="bubble">🎁 <b>${esc(m.from.name)}</b> sent ${m.gift.emoji} ${esc(m.gift.name)} ×${m.qty} to <b>${esc(m.to.map(t => t.name).join(', '))}</b>${m.luckyWin ? ` · 🍀 won ${m.luckyWin}` : ''}</div></div>`;
          if (m.type === 'join') return `<div class="msg join" data-uid="${m.user ? m.user.id : ''}"><div class="bubble">👋 ${esc(m.text)}</div></div>`;
          if (m.type === 'announcement') return `<div class="msg announcement"><div class="bubble">${esc(m.text)}</div></div>`;
          return `<div class="msg system"><div class="bubble">${esc(m.text)}</div></div>`;
        },
        renderChat() { const r = S.room; const box = q('#rchat'); box.innerHTML = `<div class="msg system"><div class="bubble">💜 ${esc(r.welcome || 'Welcome! Be kind and have fun.')}</div></div>` + r.messages.slice(-80).map(view.msgHtml).join(''); box.scrollTop = box.scrollHeight; },
        addMessage(m) {
          const box = q('#rchat'); const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
          box.insertAdjacentHTML('beforeend', view.msgHtml(m)); while (box.children.length > 150) box.firstElementChild.remove();
          if (atBottom) box.scrollTop = box.scrollHeight; else q('#newmsgs').classList.remove('hidden');
        },
        onMember() { view.renderMeta(); },
        updateBar() {
          const r = S.room; const bar = q('#rbar'); const seat = RoomCtl.mySeat >= 0 ? r.seats[RoomCtl.mySeat] : null;
          const micCls = !seat ? 'take' : seat.muted ? 'off' : 'on';
          bar.innerHTML = `<button class="say" data-a="say">${I.chat}<span>Say something…</span></button>
            <button class="rb" data-a="react" aria-label="React">${I.smile}</button>
            <button class="rb" data-a="games" aria-label="Games">${I.game}${RoomCtl.canManage() && RoomCtl.applicants.length ? `<span class="n">${RoomCtl.applicants.length}</span>` : ''}</button>
            <button class="rb gift" data-a="gift" aria-label="Send gift">${I.gift}</button>
            <button class="rb mic ${micCls}" data-a="mic" aria-label="${!seat ? 'Take a mic' : seat.muted ? 'Unmute' : 'Mute'}">${!seat ? I.mic : seat.muted ? I.micOff : I.mic}</button>
            <button class="rb" data-a="speaker" aria-label="Speaker">${Voice.speakerMuted ? I.volumeOff : I.volume}</button>`;
        },
        /* ---------- effects ---------- */
        showReaction(p) { const fx = q('#fx'); const e = el(`<span class="float-react" style="--dx:${(Math.random() * 80 - 40).toFixed(0)}px;right:${20 + Math.random() * 60}px">${p.emoji}</span>`); fx.appendChild(e); setTimeout(() => e.remove(), 2500); const s = root.querySelector(`.seat[data-uid="${p.userId}"]`); if (s) { const pop = el(`<span class="emoji-pop">${p.emoji}</span>`); s.appendChild(pop); setTimeout(() => pop.remove(), 1600); } },
        bannerSlots: [0, 0, 0],
        showGift(ev) {
          const fx = q('#fx'); const tier = ev.gift.tier; const big = ev.gift.price * ev.qty;
          // hit on receiver seats
          ev.to.forEach(t => { const s = root.querySelector(`.seat[data-uid="${t.id}"]`); if (s) { const hit = el(`<span class="gift-hit">${ev.gift.emoji}</span>`); s.appendChild(hit); setTimeout(() => hit.remove(), 900); } });
          // banner
          if (tier >= 2 || big >= 9) {
            const i = view.bannerSlots.findIndex(t => t < Date.now()); const slot = i < 0 ? 0 : i; view.bannerSlots[slot] = Date.now() + 3200;
            const b = el(`<div class="gift-banner" style="top:${150 + slot * 48}px">${avatar(ev.from, '', { frame: false })}<span><b>${esc(ev.from.name)}</b> sent <b>${esc(ev.to.map(t => t.name).slice(0, 2).join(', '))}${ev.to.length > 2 ? ' +' + (ev.to.length - 2) : ''}</b></span><span class="em">${ev.gift.emoji}</span><span class="x">×${ev.qty}</span></div>`);
            fx.appendChild(b); setTimeout(() => b.remove(), 3300);
          }
          // fly from gift button to first receiver
          const target = root.querySelector(`.seat[data-uid="${ev.to[0] && ev.to[0].id}"] .ring`); const btn = q('[data-a="gift"]');
          if (target && btn && tier <= 2) { const a = btn.getBoundingClientRect(), r2 = target.getBoundingClientRect(), base = root.getBoundingClientRect(); const f = el(`<span class="fly-gift" style="left:${a.left - base.left + 4}px;top:${a.top - base.top}px">${ev.gift.emoji}</span>`); fx.appendChild(f); requestAnimationFrame(() => { f.style.transform = `translate(${r2.left - a.left + 8}px, ${r2.top - a.top + 8}px) scale(.8)`; f.style.opacity = '0'; }); setTimeout(() => f.remove(), 1400); }
          if (tier >= 3) {
            const bigEl = el(`<div class="gift-big"><div class="em">${ev.gift.emoji}</div><div class="lbl">${esc(ev.gift.name)} ×${ev.qty}</div><div class="who">${esc(ev.from.name)} → ${esc(ev.to.map(t => t.name).join(', '))}</div></div>`); fx.appendChild(bigEl); setTimeout(() => bigEl.remove(), 3400);
            const cols = ['#FFD36E', '#F043A6', '#8B5CF6', '#2DD4BF', '#fff']; const n = tier >= 4 ? 40 : 22;
            for (let i = 0; i < n; i++) { const ang = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 160; const p = el(`<span class="particle" style="background:${cols[i % cols.length]};--px:${Math.cos(ang) * dist}px;--py:${Math.sin(ang) * dist}px;animation-delay:${Math.random() * .3}s"></span>`); fx.appendChild(p); setTimeout(() => p.remove(), 2000); }
            if (tier >= 4) { q('#rbg').style.filter = 'brightness(1.5) saturate(1.3)'; setTimeout(() => q('#rbg').style.filter = '', 700); UI.haptic([30, 40, 30]); }
          }
        },
        showEntry(u, entry) { const fx = q('#fx'); const b = el(`<div class="entry-banner">${avatar(u, '', { frame: false })}<span class="em">${entry ? entry.emoji : '👑'}</span><span>${u.vip ? `VIP${u.vip} ` : ''}${esc(u.name)} ${entry ? 'arrived by ' + esc(entry.name) : 'entered the room'}</span></div>`); fx.appendChild(b); setTimeout(() => b.remove(), 3700); },
        showLevelUp(p) { const fx = q('#fx'); const b = el(`<div class="levelup-banner">🎉 ${esc(p.user.name)} reached Lv.${p.level}</div>`); fx.appendChild(b); setTimeout(() => b.remove(), 3200); },
        showBag(bag) { const fx = q('#fx'); let card = fx.querySelector(`[data-bag="${bag.id}"]`); if (!card) { card = el(`<button class="lucky-bag-card" data-bag="${bag.id}"><span class="em">🧧</span><b>${esc(bag.from.name)}</b><span>${bag.remaining}/${bag.count} left · tap!</span></button>`); fx.appendChild(card); card.onclick = async () => { const r = await Net.act('grabLuckyBag', { bagId: bag.id }); if (r.ok) { toast(`🧧 You grabbed ${r.coins} coins!`, 'gold', 2600); UI.haptic(30); } else toast(r.error); }; setTimeout(() => card.remove(), 60000); } },
        updateBag(p) { const card = q('#fx').querySelector(`[data-bag="${p.bagId}"]`); if (card) { if (p.remaining <= 0) card.remove(); else card.querySelector('span:last-child').textContent = `${p.remaining}/${p.bag.count} left · tap!`; } },
        showDice(p) { const fx = q('#fx'); const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']; const d = el(`<div class="dice-pop">${faces[p.value - 1]}</div>`); fx.appendChild(d); setTimeout(() => d.remove(), 1800); view.addMessage({ type: 'system', text: `🎲 ${p.user.name} rolled a ${p.value}` }); }
      };
      RoomCtl.view = view;
      view.renderHead(); view.renderSeats(); view.renderChat(); view.updateBar(); view.renderPk();
      if (RoomCtl.mySeat >= 0 && Voice.active) Voice.onLevel = l => view.setSpeaking(me.id, l);
      const pkTimer = setInterval(() => { if (S.room && S.room.pk) view.renderPk(); }, 1000);

      /* ---------- interactions ---------- */
      const openInput = () => { q('#rbar').classList.add('hidden'); q('#rinput').classList.remove('hidden'); setTimeout(() => q('#rtext').focus(), 50); };
      const closeInput = () => { q('#rinput').classList.add('hidden'); q('#rbar').classList.remove('hidden'); };
      const send = async () => { const t = q('#rtext'); const text = t.value.trim(); if (!text) return closeInput(); t.value = ''; const r = await Net.act('sendMessage', { text }); if (!r.ok) toast(r.error, 'err'); };
      q('#rtext').addEventListener('keydown', e => { if (e.key === 'Enter') send(); if (e.key === 'Escape') closeInput(); });
      q('#rchat').addEventListener('scroll', () => { const box = q('#rchat'); if (box.scrollHeight - box.scrollTop - box.clientHeight < 40) q('#newmsgs').classList.add('hidden'); });
      root.addEventListener('click', async e => {
        const seatEl = e.target.closest('[data-seat]');
        if (seatEl) { const idx = Number(seatEl.dataset.seat); const s = S.room.seats[idx]; if (s.user) return RoomCtl.userCard(s.user.id); if (idx === 0) return toast('This is the host seat'); if (s.locked) { if (RoomCtl.canManage()) { await Net.act('lockSeat', { index: idx, locked: false }); } else toast('This seat is locked'); return; } if (RoomCtl.canManage() && RoomCtl.mySeat >= 0) { return sheet({ title: `Seat ${idx + 1}`, html: `<div class="col" style="gap:10px"><button class="btn block" data-x="move">Move here</button><button class="btn block ghost" data-x="lock">🔒 Lock this seat</button></div>`, onMount(ss, api) { ss.addEventListener('click', async ev2 => { const b = ev2.target.closest('[data-x]'); if (!b) return; api.close(); if (b.dataset.x === 'move') RoomCtl.takeSeat(idx); else Net.act('lockSeat', { index: idx, locked: true }); }); } }); } if (S.room.micMode === 'apply' && !RoomCtl.canManage()) { const r = await Net.act('takeSeat', { index: idx }); return toast(r.ok ? 'Request sent to the host 🙋' : r.error, r.ok ? 'ok' : 'err'); } return RoomCtl.takeSeat(idx); }
        const react = e.target.closest('[data-react]'); if (react) { Net.act('sendReaction', { emoji: react.dataset.react }); UI.haptic(); return; }
        const msgU = e.target.closest('.msg[data-uid]'); if (msgU && msgU.dataset.uid) return RoomCtl.userCard(msgU.dataset.uid);
        const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
        if (a === 'min') RoomCtl.minimize();
        else if (a === 'more') RoomCtl.moreSheet();
        else if (a === 'share') { const sr = await Net.act('shareRoom', { roomId: S.room.id }); if (sr.ok) UI.share(sr.text, sr.link); }
        else if (a === 'follow') { const r = await Net.act('followRoom', { roomId: S.room.id }); if (r.ok) { S.room.isFollowing = r.following; S.room.followers = r.followers; view.renderHead(); toast(r.following ? 'Following this room 💜' : 'Unfollowed', r.following ? 'ok' : ''); } }
        else if (a === 'contrib') RoomCtl.contribSheet();
        else if (a === 'members') RoomCtl.membersSheet();
        else if (a === 'say') openInput();
        else if (a === 'send') send();
        else if (a === 'emoji') { const g = UI.emojiGrid(em => { q('#rtext').value += em; }); sheet({ title: 'Emoji', html: g.html, onMount: s => g.bind(s) }); }
        else if (a === 'react') { q('#rreact').classList.toggle('hidden'); }
        else if (a === 'games') { if (RoomCtl.canManage() && RoomCtl.applicants.length) RoomCtl.applicantsSheet(); else RoomCtl.gamesSheet(); }
        else if (a === 'gift') RoomCtl.giftPanel();
        else if (a === 'mic') RoomCtl.toggleMute();
        else if (a === 'speaker') { Voice.setSpeakerMuted(!Voice.speakerMuted); Voice.resumeAudio(); view.updateBar(); toast(Voice.speakerMuted ? 'Room audio muted' : 'Room audio on'); }
      });
      q('#newmsgs').onclick = () => { const box = q('#rchat'); box.scrollTop = box.scrollHeight; q('#newmsgs').classList.add('hidden'); };
      // welcome toast for first-time visitors of a room
      if (room.host && room.host.id !== me.id && !room._welcomed) { room._welcomed = true; setTimeout(() => toast(`🎤 Tap a free seat to join the conversation`, '', 2600), 800); }
      return () => { RoomCtl.view = null; clearInterval(pkTimer); Object.values(speakTimers).forEach(t => clearTimeout(t.t)); };
    }
  };
})();
