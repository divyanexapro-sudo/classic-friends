/* Home: banners, tabs, room discovery, create room, country filter, search */
(function () {
  const { esc, el, I, avatar, lv, flag, tagOf, toast, sheet, fmt, themeStyle } = UI;
  const C = () => CF.catalog; const AV = () => CF.avatar;

  function roomCard(r) {
    const tag = tagOf(r.tag); const seated = r.seats.filter(s => s.user).slice(0, 4);
    return `<button class="room-card" data-room="${r.id}">
      <div class="cover" style="background:${AV().coverStyle(r.cover)}">
        <span class="em">${tag.emoji}</span>
        <span class="pill live">${fmt(r.memberCount)}</span>
        <span class="flag">${C().flagOf(r.country)}</span>
        ${r.locked ? '<span class="lock">🔒</span>' : ''}
        <span class="avatar-stack seats">${seated.map(s => avatar(s.user, '', { frame: false })).join('')}</span>
      </div>
      <div class="body">
        <div class="title">${esc(r.title)}</div>
        <div class="host">${avatar(r.host, '', { frame: false })}<span class="nm">${esc(r.host ? r.host.name : '')}</span>${r.host ? lv(r.host.level) : ''}</div>
        <div class="tagline">${tag.label} · ${esc(r.lang)}${r.pk ? ' · ⚔️ PK' : ''}${r.music ? ' · 🎵' : ''}</div>
      </div></button>`;
  }

  Screens.home = {
    nav: true,
    tab: 'popular', tag: '',
    render(root) {
      const me = S.me; const country = S.get('country') || 'ALL';
      root.innerHTML = `
        <div class="topbar">
          <div class="home-top grow">
            <span class="brand"><img src="assets/logo.svg" alt="">Classic Friends</span>
            <button class="country-chip" id="country">${country === 'ALL' ? '🌍 All' : C().flagOf(country) + ' ' + country}${I.down}</button>
          </div>
          <button class="icon-btn" data-go="search" aria-label="Search">${I.search}</button>
          <button class="icon-btn" data-go="notifications" aria-label="Notifications">${I.bell}${S.get('unreadNotif') ? '<i class="badge-dot"></i>' : ''}</button>
        </div>
        <div class="screen-body">
          <div class="banners" id="banners"></div>
          <div class="tabs" id="tabs">
            ${[['popular', 'Popular'], ['new', 'New'], ['following', 'Following'], ['games', 'Games']].map(([id, l]) => `<button data-tab="${id}" class="${Screens.home.tab === id ? 'active' : ''}">${l}</button>`).join('')}
          </div>
          <div class="chips mt-3" id="tags"><button class="chip ${!Screens.home.tag ? 'active' : ''}" data-tag="">All</button>${C().ROOM_TAGS.map(t => `<button class="chip ${Screens.home.tag === t.id ? 'active' : ''}" data-tag="${t.id}">${t.emoji} ${t.label}</button>`).join('')}</div>
          <div class="room-grid" id="grid"><div class="skeleton" style="height:220px"></div><div class="skeleton" style="height:220px"></div><div class="skeleton" style="height:220px"></div><div class="skeleton" style="height:220px"></div></div>
        </div>`;
      const grid = root.querySelector('#grid');
      let timer = null, loading = false;
      const load = async () => {
        if (loading) return; loading = true;
        const res = await Net.act('listRooms', { tab: Screens.home.tab, tag: Screens.home.tag || undefined, country: (S.get('country') || 'ALL') === 'ALL' ? undefined : S.get('country') });
        loading = false; if (!res.ok) return;
        S.set('rooms', res.rooms); if (res.banners) S.set('banners', res.banners);
        grid.innerHTML = res.rooms.length ? res.rooms.map(roomCard).join('') : `<div class="empty" style="grid-column:1/-1"><div class="big">🎤</div><h3>No rooms here yet</h3><p>Be the first — start a room and friends will find you.</p><button class="btn primary mt-4" data-create>Create a room</button></div>`;
        renderBanners();
      };
      const renderBanners = () => { const b = root.querySelector('#banners'); const list = S.get('banners') || []; b.innerHTML = list.map(x => `<div class="banner" style="background:${x.style}"><h3>${esc(x.title)}</h3><p>${esc(x.sub)}</p><span class="em">${x.emoji}</span></div>`).join(''); };
      load();
      // auto-scroll banners
      let bi = 0; const bannerTimer = setInterval(() => { const b = root.querySelector('#banners'); if (!b || !b.children.length || !root.isConnected) return; bi = (bi + 1) % b.children.length; b.scrollTo({ left: bi * b.clientWidth, behavior: 'smooth' }); }, 4500);
      root.querySelector('#tabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; Screens.home.tab = b.dataset.tab; root.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x === b)); grid.innerHTML = '<div class="skeleton" style="height:220px"></div><div class="skeleton" style="height:220px"></div>'; load(); };
      root.querySelector('#tags').onclick = e => { const b = e.target.closest('button'); if (!b) return; Screens.home.tag = b.dataset.tag; root.querySelectorAll('#tags .chip').forEach(x => x.classList.toggle('active', x === b)); load(); };
      root.addEventListener('click', e => {
        const go = e.target.closest('[data-go]'); if (go) return Router.go(go.dataset.go);
        const rc = e.target.closest('[data-room]'); if (rc) { UI.haptic(); return RoomCtl.join(rc.dataset.room); }
        if (e.target.closest('[data-create]')) return Screens.home.createRoomSheet();
        if (e.target.closest('#country')) return Screens.home.countrySheet(() => { root.querySelector('#country').innerHTML = ((S.get('country') || 'ALL') === 'ALL' ? '🌍 All' : C().flagOf(S.get('country')) + ' ' + S.get('country')) + I.down; load(); });
      });
      const off = Net.on('rooms:changed', () => { clearTimeout(timer); timer = setTimeout(load, 1800); });
      const offN = S.on('unreadNotif', n => { const b = root.querySelector('[data-go="notifications"]'); if (b) b.innerHTML = I.bell + (n ? '<i class="badge-dot"></i>' : ''); });
      return () => { off(); offN(); clearInterval(bannerTimer); clearTimeout(timer); };
    },

    countrySheet(done) {
      const cur = S.get('country') || 'ALL';
      sheet({ title: 'Rooms from', html: `<div class="chips" style="flex-wrap:wrap"><button class="chip ${cur === 'ALL' ? 'active' : ''}" data-c="ALL">🌍 All countries</button>${C().COUNTRIES.map(c => `<button class="chip ${cur === c.code ? 'active' : ''}" data-c="${c.code}">${c.flag} ${c.name}</button>`).join('')}</div>`,
        onMount(s, api) { s.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; S.set('country', b.dataset.c); api.close(); done && done(); }); } });
    },

    createRoomSheet() {
      const me = S.me; if (!me) return;
      const themes = C().STORE.filter(s => s.type === 'theme'); const owned = id => { const it = C().storeById(id); return !it.price || (me.inventory || []).some(i => i.itemId === id); };
      const st = { tag: 'chat', lang: 'Hindi', seats: 8, theme: me.equipped && me.equipped.theme || 'th-lounge', locked: false, micMode: 'free' };
      const api = sheet({ title: 'Create a room', html: `
        <div class="field"><label>Room name</label><input class="input" id="rt" maxlength="40" placeholder="e.g. Late night chill 🌙" value="${esc(me.name)}'s room"></div>
        <div class="field"><label>Topic</label><div class="chips" id="rtag">${C().ROOM_TAGS.map(t => `<button class="chip vibe ${t.id === st.tag ? 'active' : ''}" data-v="${t.id}">${t.emoji} ${t.label}</button>`).join('')}</div></div>
        <div class="field"><label>Language</label><div class="chips" id="rlang">${C().LANGUAGES.map(l => `<button class="chip ${l === st.lang ? 'active' : ''}" data-v="${l}">${l}</button>`).join('')}</div></div>
        <div class="row" style="gap:12px;margin-bottom:16px">
          <div class="field grow" style="margin:0"><label>Mic seats</label><div class="seg" id="rseats"><button data-v="8" class="active">8 seats</button><button data-v="12" ${me.level < 15 ? 'disabled title="Unlocks at Lv.15"' : ''}>12 seats</button></div></div>
          <div class="field grow" style="margin:0"><label>Mic mode</label><div class="seg" id="rmic"><button data-v="free" class="active">Free</button><button data-v="apply">Apply</button></div></div>
        </div>
        <div class="field"><label>Theme</label><div class="theme-swatches" id="rtheme">${themes.map(t => `<button class="theme-swatch ${t.id === st.theme ? 'active' : ''} ${owned(t.id) ? '' : 'locked'}" data-v="${t.id}" style="background:${t.style}">${t.name}${owned(t.id) ? '' : '<span class="lock">🔒</span>'}</button>`).join('')}</div></div>
        <div class="settings-row" style="border:0;padding:6px 0"><span class="ic">🔒</span><span class="label">Private room (password)</span><button class="switch" id="rlock"></button></div>
        <div class="field hidden" id="rpwwrap"><input class="input" id="rpw" maxlength="8" placeholder="Room password"></div>
        <div class="field"><label>Announcement (optional)</label><input class="input" id="rann" maxlength="140" placeholder="Rules, schedule, anything…"></div>
        <button class="btn primary block" id="rgo" style="height:52px">🎤 Go live</button>`,
        onMount(s) {
          const pickChips = (id, key) => s.querySelector('#' + id).addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; st[key] = b.dataset.v; s.querySelectorAll('#' + id + ' [data-v]').forEach(x => x.classList.toggle('active', x === b)); });
          pickChips('rtag', 'tag'); pickChips('rlang', 'lang'); pickChips('rmic', 'micMode');
          s.querySelector('#rseats').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b || b.disabled) return; st.seats = Number(b.dataset.v); s.querySelectorAll('#rseats button').forEach(x => x.classList.toggle('active', x === b)); });
          s.querySelector('#rtheme').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; if (!owned(b.dataset.v)) { toast('Buy this theme in the Store first'); return; } st.theme = b.dataset.v; s.querySelectorAll('#rtheme button').forEach(x => x.classList.toggle('active', x === b)); });
          s.querySelector('#rlock').onclick = e => { st.locked = !st.locked; e.currentTarget.classList.toggle('on', st.locked); s.querySelector('#rpwwrap').classList.toggle('hidden', !st.locked); };
          s.querySelector('#rgo').onclick = async () => {
            const title = s.querySelector('#rt').value.trim() || me.name + "'s room"; const b = s.querySelector('#rgo'); b.disabled = true;
            const res = await Net.act('createRoom', { title, tag: st.tag, lang: st.lang, seatCount: st.seats, theme: st.theme, locked: st.locked, password: s.querySelector('#rpw').value, micMode: st.micMode, announcement: s.querySelector('#rann').value });
            if (!res.ok) { toast(res.error, 'err'); b.disabled = false; return; }
            api.close(); RoomCtl.enter(res.room, { host: true });
          };
        } });
    }
  };

  /* ---------- search ---------- */
  Screens.search = {
    nav: false,
    render(root) {
      root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><div class="search-bar">${I.search}<input id="q" placeholder="Search rooms, people or ID"><button data-clear class="icon-btn plain" style="width:28px;height:28px">${I.x}</button></div></div><div class="screen-body" id="res"><div class="empty"><div class="big">🔎</div><h3>Find a room or a friend</h3><p>Search by name, topic or Classic Friends ID.</p></div></div>`;
      const q = root.querySelector('#q'); const res = root.querySelector('#res'); let t;
      const run = async () => {
        const v = q.value.trim(); if (!v) return;
        const [rr, ur] = await Promise.all([Net.act('listRooms', { q: v }), Net.act('searchUsers', { q: v })]);
        let html = '';
        if (rr.ok && rr.rooms.length) html += `<div class="section-title">Rooms</div>` + rr.rooms.slice(0, 10).map(r => `<button class="room-list-row" data-room="${r.id}"><span class="cover" style="background:${AV().coverStyle(r.cover)}">${tagOf(r.tag).emoji}</span><span class="grow"><b class="ellipsis" style="display:block">${esc(r.title)}</b><span class="muted" style="font-size:12px">${esc(r.host ? r.host.name : '')} · ${fmt(r.memberCount)} listening · ID ${r.id}</span></span>${I.chev}</button>`).join('');
        if (ur.ok && ur.users.length) html += `<div class="section-title">People</div>` + ur.users.map(u => `<button class="list-row" style="width:100%;text-align:left" data-user="${u.id}">${avatar(u, 'md', { online: true })}<span class="grow"><span class="name"><span class="txt">${esc(u.name)}</span>${lv(u.level)}${UI.vip(u.vip)}</span><span class="sub">ID ${u.id} · ${C().flagOf(u.country)} ${u.roomId ? '· <span class="status-inroom">In a room</span>' : ''}</span></span>${I.chev}</button>`).join('');
        res.innerHTML = html || `<div class="empty"><div class="big">🤷</div><h3>No results for “${esc(v)}”</h3><p>Try another name or a Classic Friends ID.</p></div>`;
      };
      q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 250); });
      root.addEventListener('click', e => { if (e.target.closest('[data-back]')) return Router.back(); if (e.target.closest('[data-clear]')) { q.value = ''; q.focus(); return; } const r = e.target.closest('[data-room]'); if (r) return RoomCtl.join(r.dataset.room); const u = e.target.closest('[data-user]'); if (u) return Router.go('profile/' + u.dataset.user); });
      setTimeout(() => q.focus(), 200);
    }
  };
})();
