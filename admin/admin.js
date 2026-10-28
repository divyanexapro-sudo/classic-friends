/* Classic Friends admin console — talks to /api/admin/* on server/index.js */
(function () {
  const C = window.CF.catalog, AV = window.CF.avatar;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => { n = Number(n) || 0; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 >= 100 ? 1 : 0) + 'K'; return String(n); };
  const ago = ts => { const d = Date.now() - ts; if (d < 60000) return 'just now'; if (d < 3600000) return Math.floor(d / 60000) + ' min ago'; if (d < 86400000) return Math.floor(d / 3600000) + ' h ago'; return Math.floor(d / 86400000) + ' d ago'; };
  const lv = l => `<span class="lv" data-tier="${C.levelTier(l || 1)}">Lv.${l || 1}</span>`;
  const userCell = u => `<div class="user"><span class="av">${AV.avatarSvg(u.avatar, { gender: u.gender })}</span><div><b>${esc(u.name)} ${lv(u.level)}${u.vip ? ' 👑' + u.vip : ''}${u.isBot ? ' <span class="tag">bot</span>' : ''}</b><span>ID ${u.id} · ${C.flagOf(u.country)}</span></div></div>`;
  let token = localStorage.getItem('classicfriends.admin.token') || '';
  function toast(msg, kind) { const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 2600); }
  async function api(path, body) {
    const res = await fetch('/api/admin' + path, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'x-admin-token': token }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401) { throw new Error('unauthorized'); }
    return res.json();
  }
  function confirmBox(title, text, yes) { return new Promise(resolve => { const s = document.createElement('div'); s.className = 'modal-scrim'; s.innerHTML = `<div class="modal"><h3>${title}</h3><p class="muted" style="margin:0">${text}</p><div class="row"><button class="btn" data-no>Cancel</button><button class="btn danger" data-yes>${yes || 'Confirm'}</button></div></div>`; document.body.appendChild(s); s.addEventListener('click', e => { if (e.target === s || e.target.closest('[data-no]')) { s.remove(); resolve(false); } if (e.target.closest('[data-yes]')) { s.remove(); resolve(true); } }); }); }
  function promptBox(title, label, value) { return new Promise(resolve => { const s = document.createElement('div'); s.className = 'modal-scrim'; s.innerHTML = `<div class="modal"><h3>${title}</h3><label class="field">${label}<input class="input" id="pv" value="${esc(value || '')}"></label><div class="row"><button class="btn" data-no>Cancel</button><button class="btn primary" data-yes>Save</button></div></div>`; document.body.appendChild(s); s.querySelector('#pv').focus(); s.addEventListener('click', e => { if (e.target === s || e.target.closest('[data-no]')) { s.remove(); resolve(null); } if (e.target.closest('[data-yes]')) { const v = s.querySelector('#pv').value; s.remove(); resolve(v); } }); }); }

  /* ---------- auth ---------- */
  async function tryLogin(t) { token = t; try { await api('/stats'); localStorage.setItem('classicfriends.admin.token', t); $('#login').classList.add('hidden'); $('#shell').classList.remove('hidden'); route(); return true; } catch (e) { return false; } }
  $('#login-form').onsubmit = async e => { e.preventDefault(); const ok = await tryLogin($('#token').value.trim()); if (!ok) $('#login-err').textContent = 'That token was not accepted. Check ADMIN_TOKEN on the server.'; };
  $('#logout').onclick = () => { localStorage.removeItem('classicfriends.admin.token'); location.reload(); };
  $('#refresh').onclick = () => route();

  /* ---------- pages ---------- */
  const pages = {
    async dashboard(el) {
      const r = await api('/stats'); const s = r.stats;
      const tiles = [['Online now', s.online], ['Live rooms', s.rooms], ['On mic', s.onMic], ['Gifts today', s.giftsToday], ['Coins spent today', fmt(s.coinsSpentToday)], ['Est. revenue (coins×0.89)', fmt(s.revenueEstimate)], ['Open reports', s.reportsOpen], ['Total users', s.users], ['Messages', fmt(s.messages)], ['Families', s.families]];
      const max = Math.max(1, ...r.topRooms.map(x => x.totalGifts));
      el.innerHTML = `<div class="tiles">${tiles.map(([l, v]) => `<div class="tile"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
        <div class="grid2">
          <div class="card"><h3>Top rooms by gifts</h3><div class="bars">${r.topRooms.map(x => `<div class="bar-row" title="${esc(x.title)} — ${x.totalGifts} coins"><span class="nm">${esc(x.title)}</span><span class="track"><i style="width:${Math.round(x.totalGifts / max * 100)}%"></i></span><span class="val">${fmt(x.totalGifts)}</span></div>`).join('') || '<div class="empty">No rooms live</div>'}</div></div>
          <div class="card"><h3>Top gifters (all time)</h3><table><thead><tr><th>User</th><th>Wealth</th><th>Charm</th></tr></thead><tbody>${r.topGifters.map(u => `<tr><td>${userCell(u)}</td><td class="tnum">${fmt(u.wealth)}</td><td class="tnum">${fmt(u.charm)}</td></tr>`).join('')}</tbody></table></div>
        </div>`;
      $('#rep-count').textContent = s.reportsOpen || ''; $('#rep-count').className = 'pill ' + (s.reportsOpen ? 'hot' : '');
    },
    async users(el, q, page) {
      q = q || ''; page = page || 0; const r = await api(`/users?q=${encodeURIComponent(q)}&page=${page}`);
      el.innerHTML = `<div class="toolbar"><input class="input" id="uq" placeholder="Search name or ID" value="${esc(q)}"><span class="muted">${r.total} users</span></div>
        <table><thead><tr><th>User</th><th>Coins</th><th>Diamonds</th><th>XP</th><th>Status</th><th>Last seen</th><th>Actions</th></tr></thead><tbody>${r.users.map(u => `<tr data-id="${u.id}"><td>${userCell(u)}</td><td class="tnum">${fmt(u.coins)}</td><td class="tnum">${fmt(u.diamonds)}</td><td class="tnum">${fmt(u.xp)}</td><td>${u.banned ? '<span class="tag ban">banned</span>' : u.online ? '<span class="tag ok">online</span>' : '<span class="tag">offline</span>'}${u.roomId ? ' <span class="tag">in room</span>' : ''}</td><td class="muted">${ago(u.lastSeen)}</td><td><div class="acts"><button class="btn xs" data-a="coins">+ coins</button><button class="btn xs" data-a="vip">VIP</button><button class="btn xs ${u.banned ? '' : 'danger'}" data-a="ban">${u.banned ? 'Unban' : 'Ban'}</button></div></td></tr>`).join('')}</tbody></table>
        <div class="pager"><button class="btn xs" data-pg="${page - 1}" ${page <= 0 ? 'disabled' : ''}>‹ Prev</button><span>Page ${page + 1} of ${Math.max(1, Math.ceil(r.total / 25))}</span><button class="btn xs" data-pg="${page + 1}" ${(page + 1) * 25 >= r.total ? 'disabled' : ''}>Next ›</button></div>`;
      let t; el.querySelector('#uq').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => pages.users(el, e.target.value, 0), 300); });
      el.addEventListener('click', async e => {
        const pg = e.target.closest('[data-pg]'); if (pg && !pg.disabled) return pages.users(el, q, Number(pg.dataset.pg));
        const b = e.target.closest('[data-a]'); if (!b) return; const id = b.closest('tr').dataset.id; const u = r.users.find(x => x.id === id);
        if (b.dataset.a === 'coins') { const v = await promptBox('Grant coins', 'Coins to add to ' + u.name, '500'); if (v != null) { await api('/users/' + id, { grantCoins: Number(v) }); toast('Coins granted'); pages.users(el, q, page); } }
        else if (b.dataset.a === 'vip') { const v = await promptBox('Set VIP level', '0–7', String(u.vip || 0)); if (v != null) { await api('/users/' + id, { vip: Number(v) }); toast('VIP updated'); pages.users(el, q, page); } }
        else if (b.dataset.a === 'ban') { if (u.banned || await confirmBox('Ban ' + u.name + '?', 'They will be removed from any room and cannot sign in.', 'Ban')) { await api('/users/' + id, { banned: !u.banned }); toast(u.banned ? 'Unbanned' : 'Banned'); pages.users(el, q, page); } }
      }, { once: true });
    },
    async rooms(el) {
      const r = await api('/rooms');
      el.innerHTML = `<div class="toolbar"><span class="muted">${r.rooms.length} live rooms · ${r.rooms.reduce((a, x) => a + x.memberCount, 0)} people</span></div>
        <table><thead><tr><th>Room</th><th>Host</th><th>People</th><th>On mic</th><th>Gifts</th><th>Mode</th><th>Age</th><th></th></tr></thead><tbody>${r.rooms.map(x => `<tr data-id="${x.id}"><td><b>${esc(x.title)}</b><div class="muted">ID ${x.id} · ${esc(x.lang)} · ${C.flagOf(x.country)}${x.locked ? ' · 🔒' : ''}${x.pk ? ' · ⚔️ PK' : ''}</div></td><td>${x.host ? userCell(x.host) : '—'}</td><td class="tnum">${x.memberCount}</td><td class="tnum">${x.seats.filter(s => s.user).length}/${x.seatCount}</td><td class="tnum">${fmt(x.totalGifts)}</td><td><span class="tag">${x.micMode}</span></td><td class="muted">${ago(x.createdAt)}</td><td><div class="acts"><a class="btn xs" href="/#/room/${x.id}" target="_blank">Open</a><button class="btn xs danger" data-close>End room</button></div></td></tr>`).join('') || '<tr><td colspan="8" class="empty">No live rooms</td></tr>'}</tbody></table>`;
      el.addEventListener('click', async e => { const b = e.target.closest('[data-close]'); if (!b) return; const id = b.closest('tr').dataset.id; if (await confirmBox('End this room?', 'Everyone will be sent home.', 'End room')) { await api('/rooms/' + id + '/close', {}); toast('Room ended'); pages.rooms(el); } }, { once: true });
    },
    async reports(el) {
      const r = await api('/reports');
      el.innerHTML = `<table><thead><tr><th>When</th><th>Reported</th><th>By</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead><tbody>${r.reports.map(x => `<tr data-id="${x.id}"><td class="muted">${ago(x.ts)}</td><td>${userCell(x.target)}</td><td>${userCell(x.from)}</td><td><b>${esc(x.reason)}</b>${x.details ? `<div class="muted">${esc(x.details)}</div>` : ''}${x.roomId ? `<div class="muted">Room ${x.roomId}</div>` : ''}</td><td><span class="tag ${x.status === 'open' ? 'open' : ''}">${x.status}</span></td><td>${x.status === 'open' ? `<div class="acts"><button class="btn xs" data-a="resolved">Dismiss</button><button class="btn xs" data-a="warned">Warned</button><button class="btn xs danger" data-a="ban">Ban user</button></div>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No reports — nice and quiet 🎉</td></tr>'}</tbody></table>`;
      el.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const id = b.closest('tr').dataset.id; if (b.dataset.a === 'ban' && !(await confirmBox('Ban this user?', 'They will be removed and blocked from signing in.', 'Ban'))) return; await api('/reports/' + id, { action: b.dataset.a }); toast('Report updated'); pages.reports(el); }, { once: true });
    },
    async gifts(el) {
      const r = await api('/gifts');
      el.innerHTML = `<div class="toolbar"><span class="muted">${r.gifts.length} gifts · tier 1 seat pop · 2 banner · 3 full-screen · 4 epic</span><button class="btn sm primary" id="add-gift">+ New gift</button></div>
        <table><thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Tier</th><th>VIP</th><th>Active</th><th></th></tr></thead><tbody>${r.gifts.map(g => `<tr data-id="${g.id}"><td style="font-size:24px">${g.emoji}</td><td><b>${esc(g.name)}</b><div class="muted">${g.id}${g.lucky ? ' · lucky' : ''}</div></td><td><span class="tag">${g.cat}</span></td><td class="tnum">${g.price}</td><td>${g.tier}</td><td>${g.vip || '—'}</td><td><span class="tag ${g.active === false ? 'ban' : 'ok'}">${g.active === false ? 'off' : 'on'}</span></td><td><div class="acts"><button class="btn xs" data-a="price">Price</button><button class="btn xs" data-a="toggle">${g.active === false ? 'Enable' : 'Disable'}</button></div></td></tr>`).join('')}</tbody></table>`;
      el.addEventListener('click', async e => {
        if (e.target.closest('#add-gift')) { const name = await promptBox('New gift', 'Name', ''); if (!name) return; const emoji = await promptBox('New gift', 'Emoji', '🎈'); const price = await promptBox('New gift', 'Price in coins', '100'); await api('/gifts', { id: 'g' + Date.now().toString(36), name, emoji: emoji || '🎁', price: Number(price) || 1, cat: 'hot', tier: Number(price) >= 500 ? 3 : Number(price) >= 15 ? 2 : 1, active: true }); toast('Gift added — users see it on their next sign-in'); return pages.gifts(el); }
        const b = e.target.closest('[data-a]'); if (!b) return; const id = b.closest('tr').dataset.id; const g = r.gifts.find(x => x.id === id);
        if (b.dataset.a === 'price') { const v = await promptBox('Price for ' + g.name, 'Coins', String(g.price)); if (v != null) { await api('/gifts', { id, price: Number(v) }); toast('Price updated'); pages.gifts(el); } }
        else { await api('/gifts', { id, active: g.active === false }); toast('Updated'); pages.gifts(el); }
      }, { once: true });
    },
    async banners(el) {
      const r = await api('/banners'); let list = r.banners.map(b => Object.assign({}, b));
      const styles = ['linear-gradient(135deg,#8B5CF6,#F043A6)', 'linear-gradient(135deg,#F043A6,#FFB547)', 'linear-gradient(135deg,#2DD4BF,#60A5FA)', 'linear-gradient(135deg,#312E81,#8B5CF6)', 'linear-gradient(135deg,#FF6B8A,#FFB547)'];
      const render = () => { el.innerHTML = `<div class="toolbar"><span class="muted">Shown as the carousel on the app home screen (max 6).</span><button class="btn sm" id="add-b">+ Add banner</button><button class="btn sm primary" id="save-b">Save banners</button></div>${list.map((b, i) => `<div class="banner-edit" data-i="${i}"><div class="prev" style="background:${b.style}">${b.emoji}</div><div class="form-grid"><label class="field">Title<input class="input" data-k="title" value="${esc(b.title)}"></label><label class="field">Subtitle<input class="input" data-k="sub" value="${esc(b.sub)}"></label><label class="field">Emoji<input class="input" data-k="emoji" value="${esc(b.emoji)}"></label><label class="field">Colour<select class="input" data-k="style">${styles.map(s => `<option value="${s}" ${s === b.style ? 'selected' : ''}>${s.replace('linear-gradient(135deg,', '').replace(')', '')}</option>`).join('')}</select></label><div><button class="btn xs danger" data-del>Remove</button></div></div></div>`).join('')}`; };
      render();
      el.addEventListener('input', e => { const row = e.target.closest('[data-i]'); if (!row) return; list[Number(row.dataset.i)][e.target.dataset.k] = e.target.value; if (e.target.dataset.k === 'style' || e.target.dataset.k === 'emoji') { row.querySelector('.prev').style.background = list[Number(row.dataset.i)].style; row.querySelector('.prev').textContent = list[Number(row.dataset.i)].emoji; } });
      el.addEventListener('click', async e => { if (e.target.closest('#add-b')) { if (list.length >= 6) return toast('Max 6 banners', 'err'); list.push({ id: 'b' + Date.now().toString(36), title: 'New banner', sub: 'Subtitle', emoji: '✨', style: styles[list.length % styles.length] }); render(); } const d = e.target.closest('[data-del]'); if (d) { list.splice(Number(d.closest('[data-i]').dataset.i), 1); render(); } if (e.target.closest('#save-b')) { await api('/banners', { banners: list }); toast('Banners saved — the app refreshes them on next sign-in'); } });
    },
    async broadcast(el) {
      el.innerHTML = `<div class="card" style="max-width:640px"><h3>Send an announcement</h3><p class="muted" style="margin:0 0 12px">Posts a system message into every live room and a notification to every real user.</p><textarea class="input" id="bt" placeholder="e.g. Karaoke battle starts at 9pm tonight — 5,000 coins for the winner 🎤"></textarea><div style="margin-top:12px;display:flex;justify-content:flex-end"><button class="btn primary" id="bsend">Broadcast</button></div></div>`;
      el.querySelector('#bsend').onclick = async () => { const text = el.querySelector('#bt').value.trim(); if (!text) return; const r = await api('/broadcast', { text }); if (r.ok) { toast('Broadcast sent'); el.querySelector('#bt').value = ''; } else toast(r.error, 'err'); };
    }
  };
  const titles = { dashboard: 'Dashboard', users: 'Users', rooms: 'Live rooms', reports: 'Reports', gifts: 'Gift catalog', banners: 'Home banners', broadcast: 'Broadcast' };
  let timer;
  async function route() {
    const name = (location.hash.replace('#', '') || 'dashboard'); const page = pages[name] ? name : 'dashboard';
    document.querySelectorAll('.side nav a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
    $('#page-title').textContent = titles[page]; const el = $('#page');
    try { await pages[page](el); $('#status').textContent = '● live'; $('#status').className = 'status'; } catch (e) { if (e.message === 'unauthorized') { localStorage.removeItem('classicfriends.admin.token'); location.reload(); return; } $('#status').textContent = '● offline'; $('#status').className = 'status off'; el.innerHTML = `<div class="empty">Could not reach the server. Is <code>npm start</code> running?</div>`; }
    clearInterval(timer); if (page === 'dashboard' || page === 'rooms') timer = setInterval(() => { if (!document.hidden) route(); }, 10000);
    api('/stats').then(r => { if (r.ok) { $('#rep-count').textContent = r.stats.reportsOpen || ''; $('#rep-count').className = 'pill ' + (r.stats.reportsOpen ? 'hot' : ''); } }).catch(() => { });
  }
  window.addEventListener('hashchange', route);
  if (token) tryLogin(token).then(ok => { if (!ok) { $('#login').classList.remove('hidden'); } });
})();
