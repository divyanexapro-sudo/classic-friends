/* Me · Profile/:id · Edit profile · Settings · Level · Badges · Visitors · Blocklist · Help · About */
(function () {
  const { esc, el, I, avatar, lv, vip, fam, toast, sheet, confirm, prompt, fmt, timeAgo } = UI;
  const C = () => CF.catalog;

  function hero(u, isMe) {
    return `<div class="profile-hero"><div class="glow"></div>${avatar(u, 'xxl')}<h2>${esc(u.name)} <span style="font-size:14px;color:var(--text-3)">${u.gender === 'f' ? '♀' : '♂'}</span></h2>
      <div class="badges">${lv(u.level)}${vip(u.vip)}${fam(u)}${C().flagOf(u.country)}${u.cp ? '<span class="pill" style="background:rgba(255,107,138,.2);color:var(--rose)">💞 CP</span>' : ''}</div>
      <button class="idline" data-copy="${u.id}">ID ${u.id} ${I.copy}</button>
      <p class="bio">${esc(u.bio || '')}</p></div>`;
  }

  /* ================= Me ================= */
  Screens.me = {
    nav: true,
    render(root) {
      const render = () => {
        const me = S.me; if (!me) return;
        root.innerHTML = `<div class="topbar"><h1>Me</h1><button class="icon-btn" data-go="edit-profile" aria-label="Edit profile">${I.edit}</button><button class="icon-btn" data-go="settings" aria-label="Settings">${I.settings}</button></div>
        <div class="screen-body">
          ${hero(me, true)}
          <div class="profile-stats"><button data-go="friends?tab=friends"><b>${fmt(me.friends)}</b><span>Friends</span></button><button data-go="friends?tab=followers"><b>${fmt(me.followers)}</b><span>Followers</span></button><button data-go="friends?tab=following"><b>${fmt(me.following)}</b><span>Following</span></button><button data-go="visitors"><b>${fmt((me.visitors || []).length)}</b><span>Visitors</span></button></div>
          <div class="wallet-card"><div class="amt"><b class="coin lg">${fmt(me.coins)}</b><span>Coins</span></div><div class="sep"></div><div class="amt"><b class="diamond">${fmt(me.diamonds)}</b><span>Diamonds</span></div><button class="btn sm gold" data-go="wallet">Recharge</button></div>
          <div class="card mt-4" style="padding:12px 14px"><div class="row between"><span style="font-weight:700">Level ${me.level}</span><span class="muted" style="font-size:12px">${fmt(me.xp - me.curXp)} / ${fmt(me.nextXp - me.curXp)} XP to Lv.${Math.min(100, me.level + 1)}</span></div><div class="progress mt-2"><i style="width:${Math.min(100, Math.round((me.xp - me.curXp) / Math.max(1, me.nextXp - me.curXp) * 100))}%"></i></div></div>
          <div class="section-title">Shortcuts</div>
          <div class="menu-grid">
            <button class="menu-item" data-go="store"><span class="ic g1">🛍️</span>Store</button>
            <button class="menu-item" data-go="backpack"><span class="ic g5">🎒</span>Backpack</button>
            <button class="menu-item" data-go="vip"><span class="ic g2">👑</span>VIP</button>
            <button class="menu-item" data-go="level"><span class="ic g3">📈</span>My level</button>
            <button class="menu-item" data-go="tasks"><span class="ic g4">✅</span>Tasks</button>
            <button class="menu-item" data-go="rankings"><span class="ic g2">🏆</span>Rankings</button>
            <button class="menu-item" data-go="family"><span class="ic g1">🏠</span>Family</button>
            <button class="menu-item" data-go="badges"><span class="ic g5">🎖️</span>Badges</button>
            <button class="menu-item" data-go="friends"><span class="ic g3">🤝</span>Friends</button>
            <button class="menu-item" data-go="moments?mine=1"><span class="ic g4">✨</span>Moments</button>
            <button class="menu-item" data-invite><span class="ic g1">📨</span>Invite</button>
            <button class="menu-item" data-go="help"><span class="ic g5">💡</span>Help</button>
          </div>
          ${S.get('mode') === 'demo' ? `<div class="banner-note mt-5">You are in demo mode — everything is simulated in your browser and resets on refresh. Run <span class="kbd">npm start</span> for real rooms with live voice.</div>` : ''}
          <div style="height:12px"></div></div>`;
      };
      render();
      root.addEventListener('click', async e => {
        const g = e.target.closest('[data-go]'); if (g) return Router.go(g.dataset.go);
        const cp = e.target.closest('[data-copy]'); if (cp) return UI.copy(cp.dataset.copy);
        if (e.target.closest('[data-invite]')) return UI.share(`Join me on Classic Friends 🎤 — voice rooms & friends. My ID: ${S.me.id}`, C().BRAND.website);
      });
      const off = S.on('me', render); return () => off();
    }
  };

  /* ================= Other user ================= */
  Screens.profile = {
    nav: false,
    render(root, route) {
      const id = route.id; if (id === S.me.id) { Router.go('me', { replace: true }); return; }
      root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><span class="grow"></span><button class="icon-btn plain" data-a="more">${I.moreV}</button></div><div class="screen-body" id="body"><div class="skeleton" style="height:220px"></div></div>`;
      let u = null;
      const load = async () => {
        const r = await Net.act('getUser', { id }); if (!r.ok) { toast(r.error, 'err'); return Router.back(); } u = r.user;
        root.querySelector('#body').innerHTML = `${hero(u)}
          <div class="profile-stats"><button><b>${fmt(u.followers)}</b><span>Followers</span></button><button><b>${fmt(u.friends)}</b><span>Friends</span></button><button><b>${fmt(u.charm)}</b><span>Charm</span></button><button><b>${fmt(u.wealth)}</b><span>Wealth</span></button></div>
          ${u.room ? `<button class="card row" style="width:100%;text-align:left;border-color:rgba(45,212,191,.4)" data-join="${u.room.id}"><span class="status-inroom"></span><span class="grow"><b>In room: ${esc(u.room.title)}</b><div class="muted" style="font-size:12px">${fmt(u.room.memberCount)} listening · tap to join</div></span>${I.chev}</button>` : ''}
          <div class="profile-actions"><button class="btn ${u.isFollowing ? '' : 'primary'}" data-a="follow">${u.isFollowing ? '✓ Following' : '+ Follow'}</button><button class="btn" data-a="friend">${u.isFriend ? '💬 Message' : u.requestSent ? '⏳ Requested' : '🤝 Add friend'}</button>${S.room ? `<button class="btn gold" data-a="gift">🎁 Gift</button>` : ''}</div>
          ${u.family ? `<div class="section-title">Family</div><button class="family-card" data-go="family/${u.family.id}"><span class="badge" style="background:${u.family.color}">${esc(u.family.badge)}</span><span class="t"><b>${esc(u.family.name)}</b><span>Lv.${u.family.level} · ${u.family.members} members</span></span>${I.chev}</button>` : ''}
          <div class="section-title">Badges</div><div class="badge-grid">${C().BADGES.filter(b => (u.badges || []).includes(b.id)).map(b => `<div><span class="em">${b.emoji}</span>${esc(b.name)}</div>`).join('') || '<div class="muted" style="font-size:13px;grid-column:1/-1">No badges yet</div>'}</div>
          <div class="section-title">Moments</div>${(u.moments || []).length ? u.moments.map(m => `<div class="card mb-3" style="padding:12px"><div style="font-size:14px">${esc(m.text)}</div><div class="muted" style="font-size:11px;margin-top:6px">${timeAgo(m.ts)} ago · ❤️ ${m.likes}</div></div>`).join('') : '<div class="muted" style="font-size:13px">No moments yet</div>'}<div style="height:12px"></div>`;
      };
      load();
      root.addEventListener('click', async e => {
        if (e.target.closest('[data-back]')) return Router.back();
        const cp = e.target.closest('[data-copy]'); if (cp) return UI.copy(cp.dataset.copy);
        const j = e.target.closest('[data-join]'); if (j) return RoomCtl.join(j.dataset.join);
        const g = e.target.closest('[data-go]'); if (g) return Router.go(g.dataset.go);
        const b = e.target.closest('[data-a]'); if (!b || !u) return; const a = b.dataset.a;
        if (a === 'follow') { const r = await Net.act('followUser', { targetId: id }); if (r.ok) { u.isFollowing = r.following; b.textContent = r.following ? '✓ Following' : '+ Follow'; b.classList.toggle('primary', !r.following); } }
        else if (a === 'friend') { if (u.isFriend) Router.go('chat/' + id); else { const r = await Net.act('friendRequest', { targetId: id }); if (r.ok) { b.textContent = '⏳ Requested'; toast('Request sent 🤝', 'ok'); } else toast(r.error, 'err'); } }
        else if (a === 'gift') { if (S.room) { Router.go('room/' + S.room.id); setTimeout(() => RoomCtl.giftPanel(id), 300); } }
        else if (a === 'more') sheet({ title: esc(u.name), html: `<div class="col" style="gap:4px"><button class="settings-row" style="width:100%;text-align:left" data-x="chat"><span class="ic">💬</span><span class="label">Send message</span></button>${!S.me.cp ? `<button class="settings-row" style="width:100%;text-align:left" data-x="cp"><span class="ic">💞</span><span class="label">Request CP</span></button>` : ''}<button class="settings-row" style="width:100%;text-align:left" data-x="block"><span class="ic">⛔</span><span class="label">Block</span></button><button class="settings-row" style="width:100%;text-align:left" data-x="report"><span class="ic">🚩</span><span class="label">Report</span></button></div>`, onMount(s, api) { s.addEventListener('click', async ev => { const x = ev.target.closest('[data-x]'); if (!x) return; api.close(); const k = x.dataset.x; if (k === 'chat') Router.go('chat/' + id); else if (k === 'cp') { const r = await Net.act('cpRequest', { targetId: id }); toast(r.ok ? 'CP request sent 💞' : r.error, r.ok ? 'ok' : 'err'); } else if (k === 'block') { if (await confirm('Block ' + u.name + '?', 'They cannot message you or send requests.', 'Block', true)) { await Net.act('blockUser', { targetId: id }); toast('Blocked'); Router.back(); } } else RoomCtl.reportSheet(id); }); } });
      });
    }
  };

  /* ================= Edit profile ================= */
  Screens['edit-profile'] = {
    nav: false,
    render(root) {
      const me = S.me; let seed = me.avatar, gender = me.gender;
      root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Edit profile</h1><button class="btn sm primary" id="save">Save</button></div>
        <div class="screen-body"><div class="avatar-picker" style="justify-content:center;flex-direction:column"><span id="av">${avatar({ avatar: seed, gender, frame: me.frame }, 'xxl')}</span><button class="btn sm" id="shuffle">${I.shuffle} New avatar</button></div>
        <div class="field"><label>Name</label><input class="input" id="name" maxlength="24" value="${esc(me.name)}"></div>
        <div class="field"><label>Bio</label><textarea class="input" id="bio" maxlength="120" style="min-height:72px">${esc(me.bio || '')}</textarea></div>
        <div class="field"><label>Gender</label><div class="gender-pills"><button data-g="f" class="${gender === 'f' ? 'active' : ''}">👩 Female</button><button data-g="m" class="${gender === 'm' ? 'active' : ''}">👨 Male</button></div></div>
        <div class="field"><label>Country</label><select class="input" id="country">${C().COUNTRIES.map(c => `<option value="${c.code}" ${c.code === me.country ? 'selected' : ''}>${c.flag} ${c.name}</option>`).join('')}</select></div>
        <div class="field"><label>Birthday</label><input class="input" id="bday" type="date" value="${esc(me.birthday || '')}"></div></div>`;
      root.querySelector('#shuffle').onclick = () => { seed = 'u' + Math.random().toString(36).slice(2, 8); root.querySelector('#av').innerHTML = avatar({ avatar: seed, gender, frame: me.frame }, 'xxl'); };
      root.querySelector('.gender-pills').onclick = e => { const b = e.target.closest('button'); if (!b) return; gender = b.dataset.g; root.querySelectorAll('.gender-pills button').forEach(x => x.classList.toggle('active', x === b)); root.querySelector('#av').innerHTML = avatar({ avatar: seed, gender, frame: me.frame }, 'xxl'); };
      root.querySelector('#save').onclick = async () => { const r = await Net.act('updateProfile', { name: root.querySelector('#name').value, bio: root.querySelector('#bio').value, gender, country: root.querySelector('#country').value, avatarSeed: seed, birthday: root.querySelector('#bday').value || null }); if (!r.ok) return toast(r.error, 'err'); const sess = JSON.parse(LS.get('classicfriends.session') || '{}'); Object.assign(sess, { name: r.user.name, gender, country: r.user.country, avatarSeed: seed }); LS.set('classicfriends.session', JSON.stringify(sess)); toast('Profile saved', 'ok'); Router.back('me'); };
      root.addEventListener('click', e => { if (e.target.closest('[data-back]')) Router.back('me'); });
    }
  };

  /* ================= Settings ================= */
  Screens.settings = {
    nav: false,
    render(root) {
      const me = S.me; const st = me.settings || {};
      const row = (ic, label, value, a, extra) => `<div class="settings-row" role="button" tabindex="0" style="cursor:pointer" data-a="${a}"><span class="ic">${ic}</span><span class="label">${label}</span>${extra || `<span class="value">${value || ''}</span>${I.chev}`}</div>`;
      root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Settings</h1></div><div class="screen-body">
        <div class="section-title">Account</div><div class="card" style="padding:0 14px">${row('👤', 'Edit profile', '', 'edit-profile')}${row('🔑', 'Classic Friends ID', me.id, 'copy')}${row('📱', 'Phone & email', me.phone || 'Not linked', 'link')}</div>
        <div class="section-title">Preferences</div><div class="card" style="padding:0 14px">
          ${row('🌙', 'Dark theme', '', 'theme', `<button class="switch ${S.get('theme') === 'dark' ? 'on' : ''}" data-sw="theme"></button>`)}
          ${row('🔔', 'Notifications', '', 'notif', `<button class="switch ${st.notifications !== false ? 'on' : ''}" data-sw="notif"></button>`)}
          ${row('🌐', 'App language', st.language === 'en' ? 'English' : st.language, 'lang')}
        </div>
        <div class="section-title">Privacy & safety</div><div class="card" style="padding:0 14px">
          ${row('✉️', 'Who can message me', st.privacy && st.privacy.allowDm === 'friends' ? 'Friends only' : 'Everyone', 'dm')}
          ${row('👀', 'Hide my visits (VIP4+)', '', 'hide', `<button class="switch ${st.privacy && st.privacy.hideVisits ? 'on' : ''}" data-sw="hide"></button>`)}
          ${row('⛔', 'Blocked users', (me.blocked || []).length, 'blocklist')}
        </div>
        <div class="section-title">About</div><div class="card" style="padding:0 14px">${row('💡', 'Help & feedback', '', 'help')}${row('📄', 'Terms & privacy', '', 'legal')}${row('ℹ️', 'About Classic Friends', 'v' + CF_CONFIG.VERSION, 'about')}</div>
        <button class="btn block ghost mt-6" data-a="logout">${I.logout} Log out</button>
        <button class="btn block mt-3" style="color:var(--danger)" data-a="delete">Delete account</button><div style="height:12px"></div></div>`;
      root.addEventListener('click', async e => {
        if (e.target.closest('[data-back]')) return Router.back('me');
        const sw = e.target.closest('[data-sw]'); if (sw) { e.stopPropagation(); const k = sw.dataset.sw; const on = !sw.classList.contains('on'); sw.classList.toggle('on', on); if (k === 'theme') { const t = on ? 'dark' : 'light'; document.documentElement.dataset.theme = t; LS.set('classicfriends.theme', t); S.set('theme', t); } else if (k === 'notif') Net.act('updateProfile', { settings: { notifications: on } }); else if (k === 'hide') { if (me.vip < 4) { sw.classList.remove('on'); return toast('Hiding visits needs VIP 4', ''); } Net.act('updateProfile', { settings: { privacy: Object.assign({}, st.privacy, { hideVisits: on }) } }); } return; }
        const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
        if (['edit-profile', 'blocklist', 'help', 'about'].includes(a)) Router.go(a);
        else if (a === 'copy') UI.copy(me.id);
        else if (a === 'link') toast('Phone/email linking is wired to your auth provider in production (docs/DEPLOYMENT.md)', '', 3200);
        else if (a === 'lang') sheet({ title: 'App language', html: `<div class="chips" style="flex-wrap:wrap">${['English', 'हिन्दी', 'தமிழ்', 'తెలుగు', 'മലയാളം', 'اردو', 'العربية'].map(l => `<button class="chip ${l === 'English' ? 'active' : ''}" data-l="${l}">${l}</button>`).join('')}</div><p class="muted mt-4" style="font-size:12px">Interface translations are a drop-in: see docs/FEATURES.md → Localisation.</p>`, onMount(s, api) { s.addEventListener('click', ev => { const c = ev.target.closest('[data-l]'); if (c) { toast(c.dataset.l + ' selected'); api.close(); } }); } });
        else if (a === 'dm') sheet({ title: 'Who can message me', html: `<div class="col"><button class="btn block" data-v="everyone">Everyone</button><button class="btn block ghost" data-v="friends">Friends only</button></div>`, onMount(s, api) { s.addEventListener('click', ev => { const c = ev.target.closest('[data-v]'); if (!c) return; Net.act('updateProfile', { settings: { privacy: Object.assign({}, st.privacy, { allowDm: c.dataset.v }) } }); api.close(); setTimeout(() => Screens.settings.render(root), 200); }); } });
        else if (a === 'legal') window.open('site/terms.html', '_blank');
        else if (a === 'logout') { if (await confirm('Log out?', 'You can sign back in anytime.', 'Log out')) App.logout(); }
        else if (a === 'delete') { if (await confirm('Delete account?', 'This removes your profile, coins and friends. This cannot be undone.', 'Delete', true)) { toast('Account deletion requested'); setTimeout(App.logout, 800); } }
      });
    }
  };

  Screens.blocklist = { nav: false, render(root) { root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Blocked users</h1></div><div class="screen-body" id="l"></div>`; const load = async () => { const ids = S.me.blocked || []; const rs = await Promise.all(ids.map(id => Net.act('getUser', { id }))); root.querySelector('#l').innerHTML = rs.filter(r => r.ok).map(r => `<div class="list-row">${avatar(r.user, 'md')}<span class="grow"><span class="name"><span class="txt">${esc(r.user.name)}</span></span><span class="sub">ID ${r.user.id}</span></span><button class="btn xs ghost" data-un="${r.user.id}">Unblock</button></div>`).join('') || '<div class="empty"><div class="big">🕊️</div><h3>Nobody blocked</h3><p>Blocked people cannot message you or join your rooms.</p></div>'; }; load(); root.addEventListener('click', async e => { if (e.target.closest('[data-back]')) return Router.back('settings'); const b = e.target.closest('[data-un]'); if (b) { await Net.act('blockUser', { targetId: b.dataset.un, block: false }); load(); } }); } };
  Screens.visitors = { nav: false, render(root) { const v = S.me.visitors || []; root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Who visited me</h1></div><div class="screen-body">${v.length ? v.map(x => `<div class="list-row" data-user="${x.user.id}">${avatar(x.user, 'md', { online: true })}<span class="grow"><span class="name"><span class="txt">${esc(x.user.name)}</span>${lv(x.user.level)}${vip(x.user.vip)}</span><span class="sub">Visited ${timeAgo(x.ts)} ago</span></span>${I.chev}</div>`).join('') : '<div class="empty"><div class="big">👀</div><h3>No visitors yet</h3><p>Join rooms and post moments so people find you.</p></div>'}</div>`; root.addEventListener('click', e => { if (e.target.closest('[data-back]')) return Router.back('me'); const u = e.target.closest('[data-user]'); if (u) Router.go('profile/' + u.dataset.user); }); } };
  Screens.badges = { nav: false, render(root) { const mine = S.me.badges || []; root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Badges</h1></div><div class="screen-body"><p class="muted mb-4" style="font-size:13px">${mine.length} of ${C().BADGES.length} earned</p><div class="badge-grid">${C().BADGES.map(b => `<div class="${mine.includes(b.id) ? '' : 'locked'}"><span class="em">${b.emoji}</span><b style="display:block;color:var(--text)">${esc(b.name)}</b>${esc(b.desc)}</div>`).join('')}</div></div>`; root.addEventListener('click', e => { if (e.target.closest('[data-back]')) Router.back('me'); }); } };
  Screens.level = { nav: false, render(root) { const me = S.me; const pct = Math.min(100, Math.round((me.xp - me.curXp) / Math.max(1, me.nextXp - me.curXp) * 100)); root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>My level</h1></div><div class="screen-body"><div class="level-hero"><div class="big">Lv.${me.level}</div><div class="muted mt-2">${fmt(me.xp)} XP total</div><div class="progress mt-4"><i style="width:${pct}%"></i></div><div class="muted mt-2" style="font-size:12px">${fmt(me.nextXp - me.xp)} XP to Lv.${Math.min(100, me.level + 1)}</div></div><div class="banner-note">Earn XP by sending gifts (1 coin = 1 XP), buying items and checking in daily. Receivers earn Charm.</div><div class="section-title">Level perks</div>${C().LEVEL_PERKS.map(p => `<div class="settings-row"><span class="ic">${me.level >= p.level ? '✅' : '🔒'}</span><span class="label">${esc(p.perk)}</span><span class="value">Lv.${p.level}</span></div>`).join('')}</div>`; root.addEventListener('click', e => { if (e.target.closest('[data-back]')) Router.back('me'); }); } };
  Screens.help = { nav: false, render(root) { const faqs = [['How do I talk in a room?', 'Tap any free mic seat or the mic button at the bottom. Allow microphone access when your browser asks.'], ['How do I earn coins?', 'Check in daily, finish tasks, grab lucky bags, spin the wheel, or recharge from your wallet.'], ['What are diamonds?', 'You earn diamonds when people send you gifts. Exchange them for coins in your wallet.'], ['How do I become a host?', 'Tap the mic button in the bottom bar and create a room. You get the host seat and the room tools.'], ['Someone is being rude', 'Open their card and tap Report. Hosts and admins can mute, remove or block people.'], ['What is a CP?', 'A Couple/Close Partner — pair with your best friend. Gifts between you grow your bond.']]; root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Help</h1></div><div class="screen-body">${faqs.map(([q, a]) => `<div class="card mb-3" style="padding:12px 14px"><b>${q}</b><p class="muted mt-2" style="font-size:13px">${a}</p></div>`).join('')}<a class="btn block mt-4" href="mailto:${C().BRAND.supportEmail}">✉️ Contact support</a></div>`; root.addEventListener('click', e => { if (e.target.closest('[data-back]')) Router.back('me'); }); } };
  Screens.about = { nav: false, render(root) { root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>About</h1></div><div class="screen-body center" style="padding-top:40px"><img src="assets/logo.svg" style="width:88px;margin:0 auto 14px"><h2>Classic Friends</h2><p class="muted mt-2">${esc(C().BRAND.description)}</p><p class="muted mt-2" style="font-size:12px">Version ${CF_CONFIG.VERSION} · ${S.get('mode') === 'live' ? 'Connected to server' : 'Demo mode'}</p><a class="btn mt-6" href="site/index.html" target="_blank">Visit website</a></div>`; root.addEventListener('click', e => { if (e.target.closest('[data-back]')) Router.back('settings'); }); } };
})();
