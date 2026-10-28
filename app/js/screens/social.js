/* Moments · Chats · Friends · Notifications */
(function () {
  const { esc, el, I, avatar, lv, vip, fam, toast, sheet, confirm, fmt, timeAgo, clock } = UI;
  const C = () => CF.catalog;
  const ARTS = ['linear-gradient(135deg,#8B5CF6,#F043A6)', 'linear-gradient(135deg,#2DD4BF,#60A5FA)', 'linear-gradient(135deg,#FFB547,#FF6B8A)', 'linear-gradient(135deg,#F043A6,#FFB547)', 'linear-gradient(135deg,#312E81,#8B5CF6)', 'linear-gradient(135deg,#0E7490,#2DD4BF)'];
  const userRow = (u, right, sub) => `<div class="list-row" data-user="${u.id}">${avatar(u, 'md', { online: true })}<span class="grow"><span class="name"><span class="txt">${esc(u.name)}</span>${lv(u.level)}${vip(u.vip)}${fam(u)}</span><span class="sub">${sub || (u.roomId ? '<span class="status-inroom">In a room</span>' : u.online ? 'Online' : 'Offline') + ' · ' + C().flagOf(u.country) + ' · ID ' + u.id}</span></span>${right || ''}</div>`;

  /* ================= Moments ================= */
  function momentHtml(m) {
    return `<article class="moment" data-m="${m.id}">
      <div class="head" data-user="${m.user.id}">${avatar(m.user, 'md')}<span class="t"><b>${esc(m.user.name)} ${lv(m.user.level)}${vip(m.user.vip)}</b><span>${timeAgo(m.ts)} ago · ${C().flagOf(m.user.country)}</span></span></div>
      <p class="text">${esc(m.text)}</p>
      ${m.art ? `<div class="art" style="background:${m.art}">${m.emoji || '✨'}</div>` : ''}
      <div class="acts"><button data-like class="${m.liked ? 'liked' : ''}">${m.liked ? I.heartFill : I.heart}<span>${fmt(m.likes)}</span></button><button data-comment>${I.comment}<span>${m.commentCount}</span></button><button data-share>${I.share}<span>Share</span></button></div>
    </article>`;
  }
  Screens.moments = {
    nav: true, tab: 'latest',
    render(root) {
      root.innerHTML = `<div class="topbar"><h1>Moments</h1><button class="icon-btn" data-go="search">${I.search}</button></div>
        <div class="screen-body"><div class="tabs" id="tabs">${[['latest', 'Latest'], ['following', 'Following'], ['hot', 'Hot']].map(([id, l]) => `<button data-tab="${id}" class="${Screens.moments.tab === id ? 'active' : ''}">${l}</button>`).join('')}</div>
        <button class="composer" data-compose>${avatar(S.me, 'sm')}<span class="grow" style="text-align:left">Share a moment…</span>${I.edit}</button><div id="feed"><div class="skeleton" style="height:160px"></div></div></div>
        <button class="fab" data-compose aria-label="Post">${I.plus}</button>`;
      const feed = root.querySelector('#feed');
      const load = async () => { const r = await Net.act('listMoments', { tab: Screens.moments.tab }); if (!r.ok) return; feed.innerHTML = r.moments.length ? r.moments.map(momentHtml).join('') : `<div class="empty"><div class="big">✨</div><h3>Nothing here yet</h3><p>${Screens.moments.tab === 'following' ? 'Follow people to see their moments.' : 'Be the first to post.'}</p></div>`; };
      load();
      root.querySelector('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; Screens.moments.tab = b.dataset.tab; root.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x === b)); load(); };
      root.addEventListener('click', async e => {
        if (e.target.closest('[data-go]')) return Router.go(e.target.closest('[data-go]').dataset.go);
        if (e.target.closest('[data-compose]')) return Screens.moments.compose(load);
        const art = e.target.closest('article'); if (!art) return; const id = art.dataset.m;
        if (e.target.closest('[data-like]')) { const r = await Net.act('likeMoment', { momentId: id }); if (r.ok) { const b = art.querySelector('[data-like]'); b.classList.toggle('liked', r.liked); b.innerHTML = (r.liked ? I.heartFill : I.heart) + `<span>${fmt(r.likes)}</span>`; UI.haptic(); } return; }
        if (e.target.closest('[data-comment]')) return Screens.moments.comments(id, art);
        if (e.target.closest('[data-share]')) return UI.share('Check this moment on Classic Friends ✨', C().BRAND.website + '/#/moments');
        const u = e.target.closest('[data-user]'); if (u) Router.go('profile/' + u.dataset.user);
      });
      const off = Net.on('moments:new', m => { if (Screens.moments.tab !== 'hot' && m.user.id !== S.me.id) feed.insertAdjacentHTML('afterbegin', momentHtml(m)); });
      return () => off();
    },
    compose(done) {
      let art = null, emoji = '✨';
      sheet({ title: 'New moment', html: `<textarea class="input" id="mt" maxlength="500" placeholder="What's happening tonight?"></textarea>
        <div class="field mt-4"><label>Add a colour card (optional)</label><div class="art-pick" id="arts"><button data-art="" class="active" style="background:var(--glass)">—</button>${ARTS.map(a => `<button data-art="${a}" style="background:${a}"></button>`).join('')}</div></div>
        <div class="field"><label>Emoji on the card</label><div class="emoji-pick" id="ems">${['✨', '🎤', '🎶', '❤️', '🔥', '🌙', '🎉', '🏆', '☕', '🎲', '👑', '🇮🇳', '🇦🇪'].map(x => `<button data-em="${x}" class="${x === emoji ? 'active' : ''}">${x}</button>`).join('')}</div></div>
        <button class="btn primary block" id="post">Post</button>`,
        onMount(s, api) {
          s.querySelector('#arts').onclick = e => { const b = e.target.closest('[data-art]'); if (!b) return; art = b.dataset.art || null; s.querySelectorAll('#arts button').forEach(x => x.classList.toggle('active', x === b)); };
          s.querySelector('#ems').onclick = e => { const b = e.target.closest('[data-em]'); if (!b) return; emoji = b.dataset.em; s.querySelectorAll('#ems button').forEach(x => x.classList.toggle('active', x === b)); };
          s.querySelector('#post').onclick = async () => { const r = await Net.act('postMoment', { text: s.querySelector('#mt').value, art, emoji }); if (!r.ok) return toast(r.error, 'err'); api.close(); toast('Posted ✨', 'ok'); done && done(); };
          setTimeout(() => s.querySelector('#mt').focus(), 100);
        } });
    },
    async comments(id, art) {
      const list = await Net.act('listMoments', {}); const m = list.ok && list.moments.find(x => x.id === id); if (!m) return;
      const render = mm => mm.comments.length ? mm.comments.map(c => `<div class="list-row" style="min-height:0;padding:8px 0">${avatar(c.user, 'sm')}<span class="grow"><span class="name" style="font-size:13px"><span class="txt">${esc(c.user.name)}</span></span><span style="font-size:14px">${esc(c.text)}</span></span><span class="muted" style="font-size:11px">${timeAgo(c.ts)}</span></div>`).join('') : '<div class="empty" style="padding:24px"><p>No comments yet — say something nice.</p></div>';
      sheet({ title: `Comments · ${m.commentCount}`, html: `<div id="cl">${render(m)}</div><div class="row mt-4"><input class="input grow" id="ct" maxlength="200" placeholder="Write a comment…"><button class="icon-btn" id="cs" style="background:var(--g-vibe);border:0;color:#fff">${I.send}</button></div>`,
        onMount(s) { const send = async () => { const t = s.querySelector('#ct'); if (!t.value.trim()) return; const r = await Net.act('commentMoment', { momentId: id, text: t.value }); if (!r.ok) return toast(r.error, 'err'); t.value = ''; s.querySelector('#cl').innerHTML = render(r.moment); const cnt = art.querySelector('[data-comment] span'); if (cnt) cnt.textContent = r.moment.commentCount; }; s.querySelector('#cs').onclick = send; s.querySelector('#ct').addEventListener('keydown', e => { if (e.key === 'Enter') send(); }); } });
    }
  };

  /* ================= Chats ================= */
  Screens.messages = {
    nav: true,
    render(root) {
      root.innerHTML = `<div class="topbar"><h1>Chats</h1><button class="icon-btn" data-go="friends">${I.users}</button><button class="icon-btn" data-go="notifications">${I.bell}${S.get('unreadNotif') ? '<i class="badge-dot"></i>' : ''}</button></div><div class="screen-body" id="list"></div>`;
      const list = root.querySelector('#list');
      const render = async () => {
        const r = await Net.act('listConversations'); if (!r.ok) return; S.set('conversations', r.conversations);
        const me = S.me; const reqs = (me.friendRequests || []).length;
        list.innerHTML = `
          <div class="list-row" data-go="notifications"><span class="avatar md" style="background:var(--g-vibe);display:grid;place-items:center;font-size:20px">📣</span><span class="grow"><span class="name"><span class="txt">Classic Friends Team</span></span><span class="sub">${esc((S.get('notifications')[0] || {}).text || 'Welcome! Updates and rewards land here.')}</span></span>${S.get('unreadNotif') ? `<span class="unread">${S.get('unreadNotif')}</span>` : ''}</div>
          ${reqs ? `<div class="list-row" data-go="friends?tab=requests"><span class="avatar md" style="background:var(--g-aqua);display:grid;place-items:center;font-size:20px">🤝</span><span class="grow"><span class="name"><span class="txt">Friend requests</span></span><span class="sub">${reqs} waiting for you</span></span><span class="unread">${reqs}</span></div>` : ''}
          ${r.conversations.length ? r.conversations.map(c => `<div class="list-row conv-row" data-chat="${c.user.id}">${avatar(c.user, 'md', { online: true })}<span class="grow"><span class="name"><span class="txt">${esc(c.user.name)}</span>${lv(c.user.level)}</span><span class="last">${c.last.from === me.id ? 'You: ' : ''}${esc(c.last.text || (c.last.gift ? c.last.gift.emoji + ' ' + c.last.gift.name : ''))}</span></span><span class="col" style="align-items:flex-end;gap:0"><span class="time">${timeAgo(c.last.ts)}</span>${c.unread ? `<span class="unread">${c.unread}</span>` : ''}</span></div>`).join('') : `<div class="empty"><div class="big">💬</div><h3>No chats yet</h3><p>Say hi to someone from a room or your friends list.</p><button class="btn mt-4" data-go="friends">Find friends</button></div>`}`;
      };
      render();
      root.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) return Router.go(g.dataset.go); const c = e.target.closest('[data-chat]'); if (c) Router.go('chat/' + c.dataset.chat); });
      const off = Net.on('dm:message', () => render()); const off2 = S.on('me', () => render());
      return () => { off(); off2(); };
    }
  };

  Screens.chat = {
    nav: false,
    render(root, route) {
      const withId = route.id; const me = S.me;
      root.innerHTML = `<div class="topbar glass"><button class="icon-btn plain" data-back>${I.back}</button><div class="row grow" id="head"></div><button class="icon-btn plain" data-a="gift">${I.gift}</button><button class="icon-btn plain" data-a="more">${I.moreV}</button></div><div class="chat-body" id="body"></div><div class="chat-input-bar"><button class="icon-btn plain" data-a="emoji">${I.smile}</button><input class="input" id="t" maxlength="300" placeholder="Message…"><button class="icon-btn" data-a="send" style="background:var(--g-vibe);border:0;color:#fff">${I.send}</button></div>`;
      const body = root.querySelector('#body'); let other = null;
      const msgHtml = m => `<div class="dm-msg ${m.from === me.id ? 'mine' : ''}"><div class="bubble">${m.gift ? `<div class="gift-line">${m.gift.emoji}</div><div style="font-size:12px;text-align:center">${esc(m.gift.name)}</div>` : ''}${m.text ? esc(m.text) : ''}<span class="time">${clock(m.ts)}</span></div></div>`;
      const load = async () => { const r = await Net.act('getConversation', { withId }); if (!r.ok || !r.user) { toast('User not found'); return Router.back('messages'); } other = r.user; root.querySelector('#head').innerHTML = `${avatar(other, 'sm', { online: true })}<span class="col" style="gap:0"><b style="font-size:15px">${esc(other.name)}</b><span class="muted" style="font-size:11px">${other.roomId ? '<span class="status-inroom">In a room — tap to join</span>' : other.online ? 'Online' : 'Offline'}</span></span>`; body.innerHTML = r.messages.map(msgHtml).join('') || `<div class="empty"><div class="big">👋</div><h3>Say hello to ${esc(other.name)}</h3><p>Messages are private between you two.</p></div>`; body.scrollTop = body.scrollHeight; App.refreshBadges(); };
      load();
      const send = async (extra) => { const t = root.querySelector('#t'); const text = t.value.trim(); if (!text && !extra) return; t.value = ''; const r = await Net.act('sendDm', Object.assign({ toUserId: withId, text }, extra || {})); if (!r.ok) { if (r.error === 'Not enough coins') RoomCtl.rechargePrompt(); else toast(r.error, 'err'); } };
      root.querySelector('#t').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
      root.addEventListener('click', e => {
        if (e.target.closest('[data-back]')) return Router.back('messages');
        if (e.target.closest('#head')) { if (other && other.roomId) RoomCtl.join(other.roomId); else if (other) Router.go('profile/' + other.id); return; }
        const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
        if (a === 'send') send();
        else if (a === 'emoji') { const g = UI.emojiGrid(em => { root.querySelector('#t').value += em; }); sheet({ title: 'Emoji', html: g.html, onMount: s => g.bind(s) }); }
        else if (a === 'gift') { const gifts = (S.gifts || C().GIFTS).filter(g => g.cat === 'hot' || g.cat === 'luxury'); sheet({ title: `Gift for ${esc(other ? other.name : '')}`, headRight: `<span class="coin">${fmt(me.coins)}</span>`, html: `<div class="gift-grid">${gifts.map(g => `<button class="gift-tile" data-g="${g.id}"><span class="em">${g.emoji}</span><span class="nm">${esc(g.name)}</span><span class="pr coin">${g.price}</span></button>`).join('')}</div>`, onMount(s, api) { s.addEventListener('click', ev => { const t = ev.target.closest('[data-g]'); if (!t) return; api.close(); send({ giftId: t.dataset.g }); }); } }); }
        else if (a === 'more') sheet({ title: esc(other ? other.name : ''), html: `<div class="col" style="gap:4px"><button class="settings-row" style="width:100%;text-align:left" data-x="profile"><span class="ic">👤</span><span class="label">View profile</span></button><button class="settings-row" style="width:100%;text-align:left" data-x="block"><span class="ic">⛔</span><span class="label">Block</span></button><button class="settings-row" style="width:100%;text-align:left" data-x="report"><span class="ic">🚩</span><span class="label">Report</span></button></div>`, onMount(s, api) { s.addEventListener('click', async ev => { const x = ev.target.closest('[data-x]'); if (!x) return; api.close(); if (x.dataset.x === 'profile') Router.go('profile/' + withId); else if (x.dataset.x === 'block') { if (await confirm('Block ' + other.name + '?', 'They will not be able to message you.', 'Block', true)) { await Net.act('blockUser', { targetId: withId }); Router.back('messages'); } } else RoomCtl.reportSheet(withId); }); } });
      });
      const off = Net.on('dm:message', p => { if (p.message.from === withId || p.message.to === withId) { if (body.querySelector('.empty')) body.innerHTML = ''; body.insertAdjacentHTML('beforeend', msgHtml(p.message)); body.scrollTop = body.scrollHeight; if (p.message.to === me.id) Net.act('getConversation', { withId }).then(() => App.refreshBadges()); } });
      return () => off();
    }
  };

  /* ================= Friends ================= */
  Screens.friends = {
    nav: false, tab: 'friends',
    render(root, route) {
      if (route.params.tab) Screens.friends.tab = route.params.tab;
      root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Friends</h1><button class="icon-btn" data-go="search">${I.search}</button></div>
        <div class="screen-body"><div id="cp"></div><div class="tabs mt-3" id="tabs">${[['friends', 'Friends'], ['requests', 'Requests'], ['following', 'Following'], ['followers', 'Followers'], ['suggested', 'Suggested']].map(([id, l]) => `<button data-tab="${id}" class="${Screens.friends.tab === id ? 'active' : ''}">${l}</button>`).join('')}</div><div id="list" class="mt-2"></div></div>`;
      const list = root.querySelector('#list');
      const renderCp = async () => { const me = S.me; const box = root.querySelector('#cp'); if (me.cp) { const r = await Net.act('getUser', { id: me.cp.userId }); if (!r.ok) return; box.innerHTML = `<div class="cp-card"><span class="pair">${avatar(me)}<span class="heart">💞</span>${avatar(r.user)}</span><span class="grow"><b>You & ${esc(r.user.name)}</b><div class="muted" style="font-size:12px">CP bond ${fmt(me.cp.bond)} · since ${new Date(me.cp.since || Date.now()).toLocaleDateString()}</div></span><button class="btn xs ghost" data-cp-break>Break</button></div>`; } else box.innerHTML = `<div class="cp-card"><span style="font-size:32px">💞</span><span class="grow"><b>Find your CP</b><div class="muted" style="font-size:12px">Pair with your closest friend. Gifts between you grow the bond.</div></span></div>`; };
      const load = async () => {
        const me = S.me; const tab = Screens.friends.tab; let users = [], html = '';
        if (tab === 'friends') { const rs = await Promise.all((me.friendIds || []).map(id => Net.act('getUser', { id }))); users = rs.filter(r => r.ok).map(r => r.user); html = users.map(u => userRow(u, `<button class="btn xs" data-chat="${u.id}">Message</button>`)).join('') || `<div class="empty"><div class="big">🤝</div><h3>No friends yet</h3><p>Add people you meet in rooms, or check Suggested.</p></div>`; }
        else if (tab === 'requests') { users = me.friendRequests || []; html = users.map(u => userRow(u, `<button class="btn xs primary" data-accept="${u.id}">Accept</button><button class="btn xs ghost" data-decline="${u.id}">✕</button>`)).join('') || `<div class="empty"><div class="big">📭</div><h3>No requests</h3><p>Friend requests will appear here.</p></div>`; }
        else if (tab === 'following') { const rs = await Promise.all((me.followingIds || []).slice(0, 50).map(id => Net.act('getUser', { id }))); users = rs.filter(r => r.ok).map(r => r.user); html = users.map(u => userRow(u, `<button class="btn xs ghost" data-unfollow="${u.id}">Following</button>`)).join('') || `<div class="empty"><div class="big">➕</div><h3>Not following anyone</h3><p>Follow hosts to find their rooms faster.</p></div>`; }
        else if (tab === 'followers') { const r = await Net.act('suggestions'); users = r.ok ? r.users.filter(u => false) : []; html = `<div class="empty"><div class="big">👀</div><h3>${fmt(me.followers)} followers</h3><p>People who follow you will see your rooms and moments first.</p></div>`; }
        else { const r = await Net.act('suggestions'); users = r.ok ? r.users : []; html = users.map(u => userRow(u, `<button class="btn xs primary" data-add="${u.id}">Add</button>`)).join(''); }
        list.innerHTML = html;
      };
      renderCp(); load();
      root.querySelector('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; Screens.friends.tab = b.dataset.tab; root.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x === b)); load(); };
      root.addEventListener('click', async e => {
        if (e.target.closest('[data-back]')) return Router.back('me');
        const g = e.target.closest('[data-go]'); if (g) return Router.go(g.dataset.go);
        const b = e.target.closest('button[data-chat],button[data-accept],button[data-decline],button[data-unfollow],button[data-add],button[data-cp-break]');
        if (b) { e.stopPropagation(); if (b.dataset.chat) return Router.go('chat/' + b.dataset.chat); if (b.dataset.accept) { const r = await Net.act('acceptFriend', { fromId: b.dataset.accept }); toast(r.ok ? 'You are now friends 🎉' : r.error, r.ok ? 'ok' : 'err'); return; } if (b.dataset.decline) { await Net.act('declineFriend', { fromId: b.dataset.decline }); return; } if (b.dataset.unfollow) { await Net.act('followUser', { targetId: b.dataset.unfollow, follow: false }); return; } if (b.dataset.add) { const r = await Net.act('friendRequest', { targetId: b.dataset.add }); if (r.ok) { b.textContent = 'Sent'; b.disabled = true; toast('Request sent 🤝', 'ok'); } else toast(r.error, 'err'); return; } if (b.hasAttribute('data-cp-break')) { if (await confirm('Break CP?', 'Your bond will reset.', 'Break', true)) { await Net.act('cpBreak'); } return; } }
        const u = e.target.closest('[data-user]'); if (u) Router.go('profile/' + u.dataset.user);
      });
      const off = S.on('me', () => { load(); renderCp(); });
      return () => off();
    }
  };

  /* ================= Notifications ================= */
  Screens.notifications = {
    nav: false,
    render(root) {
      root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Notifications</h1></div><div class="screen-body" id="list"></div>`;
      const icons = { gift: '🎁', levelup: '🏆', 'friend-request': '🤝', 'friend-accepted': '🎉', follow: '➕', visit: '👀', like: '❤️', comment: '💬', dm: '✉️', cp: '💞', 'cp-request': '💞', system: '📣' };
      const render = () => { const list = S.get('notifications') || []; root.querySelector('#list').innerHTML = list.length ? list.map(n => `<div class="notif-row ${n.read ? '' : 'unread'}" ${n.from ? `data-user="${n.from.id}"` : ''}><span class="ic">${icons[n.type] || '🔔'}</span><span class="t">${esc(n.text)}<span>${timeAgo(n.ts)} ago</span>${n.type === 'friend-request' && !n.done ? `<span class="acts"><button class="btn xs primary" data-accept="${n.data.fromId}">Accept</button><button class="btn xs ghost" data-decline="${n.data.fromId}">Decline</button></span>` : ''}${n.type === 'cp-request' && !n.done ? `<span class="acts"><button class="btn xs primary" data-cp="${n.data.fromId}">Accept CP 💞</button></span>` : ''}</span>${n.from ? avatar(n.from, 'sm') : ''}</div>`).join('') : `<div class="empty"><div class="big">🔔</div><h3>All caught up</h3><p>Gifts, friend requests and level-ups show up here.</p></div>`; };
      render(); Net.act('readNotifications').then(() => { S.set('unreadNotif', 0); (S.get('notifications') || []).forEach(n => n.read = true); });
      root.addEventListener('click', async e => {
        if (e.target.closest('[data-back]')) return Router.back('home');
        const acc = e.target.closest('[data-accept]'), dec = e.target.closest('[data-decline]'), cp = e.target.closest('[data-cp]');
        if (acc) { e.stopPropagation(); const r = await Net.act('acceptFriend', { fromId: acc.dataset.accept }); toast(r.ok ? 'You are now friends 🎉' : r.error, r.ok ? 'ok' : 'err'); acc.closest('.acts').remove(); return; }
        if (dec) { e.stopPropagation(); await Net.act('declineFriend', { fromId: dec.dataset.decline }); dec.closest('.acts').remove(); return; }
        if (cp) { e.stopPropagation(); const r = await Net.act('cpAccept', { fromId: cp.dataset.cp }); toast(r.ok ? 'You are now CP 💞' : r.error, r.ok ? 'ok' : 'err'); if (r.ok) cp.closest('.acts').remove(); return; }
        const u = e.target.closest('[data-user]'); if (u) Router.go('profile/' + u.dataset.user);
      });
      const off = S.on('notifications', render); return () => off();
    }
  };
})();
