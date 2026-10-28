/* Store · Wallet · VIP · Backpack · Tasks · Rankings · Family */
(function () {
  const { esc, el, I, avatar, lv, vip, fam, toast, sheet, confirm, prompt, fmt, money, timeAgo } = UI;
  const C = () => CF.catalog;
  const back = (root, to) => root.addEventListener('click', e => { if (e.target.closest('[data-back]')) Router.back(to || 'me'); });

  function preview(it, me) {
    if (it.type === 'frame') return `<span class="avatar">${CF.avatar.avatarSvg(me.avatar, { gender: me.gender })}<i class="frame spin" style="background:${it.style}"></i></span>`;
    if (it.type === 'bubble') return `<span class="bubble-prev" style="background:${it.style}">Hi there 👋</span>`;
    if (it.type === 'theme') return `<span class="theme-prev" style="background:${it.style}"></span>`;
    if (it.type === 'entry') return `<span class="entry-prev">${it.emoji}</span>`;
    return `<span class="wave-prev" style="--c:${it.color}"></span>`;
  }

  /* ================= Store ================= */
  Screens.store = {
    nav: false, tab: 'frame',
    render(root) {
      root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Store</h1><button class="btn sm gold" data-go="wallet"><span class="coin" id="bal">${fmt(S.me.coins)}</span></button></div><div class="screen-body"><div class="tabs" id="tabs">${C().STORE_TYPES.map(t => `<button data-tab="${t.id}" class="${Screens.store.tab === t.id ? 'active' : ''}">${t.label}</button>`).join('')}</div><div class="store-grid mt-4" id="grid"></div></div>`;
      const render = () => {
        const me = S.me; const items = C().STORE.filter(i => i.type === Screens.store.tab);
        root.querySelector('#bal').textContent = fmt(me.coins);
        root.querySelector('#grid').innerHTML = items.map(it => { const owned = !it.price || (me.inventory || []).some(i => i.itemId === it.id); const eq = me.equipped && me.equipped[it.type] === it.id; return `<div class="store-item"><div class="prev">${preview(it, me)}</div><div class="nm">${esc(it.name)}</div><div class="days">${it.price ? it.days + ' days' : 'Free'}</div>${eq ? `<button class="btn sm ghost" data-unequip="${it.id}">✓ Equipped</button>` : owned ? `<button class="btn sm" data-equip="${it.id}">Use</button>` : `<button class="btn sm primary" data-buy="${it.id}"><span class="coin" style="color:#fff">${fmt(it.price)}</span></button>`}</div>`; }).join('');
      };
      render();
      root.querySelector('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; Screens.store.tab = b.dataset.tab; root.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('active', x === b)); render(); };
      root.addEventListener('click', async e => {
        if (e.target.closest('[data-back]')) return Router.back('me'); const g = e.target.closest('[data-go]'); if (g) return Router.go(g.dataset.go);
        const buy = e.target.closest('[data-buy]'), eq = e.target.closest('[data-equip]'), un = e.target.closest('[data-unequip]');
        if (buy) { const it = C().storeById(buy.dataset.buy); if (await confirm(`Buy ${it.name}?`, `${it.price} coins for ${it.days} days. It will be equipped right away.`, 'Buy')) { const r = await Net.act('buyItem', { itemId: it.id }); if (!r.ok) { if (r.error === 'Not enough coins') RoomCtl.rechargePrompt(); else toast(r.error, 'err'); } else { toast(`${it.name} is yours ✨`, 'ok'); UI.haptic(20); } } }
        else if (eq) { const it = C().storeById(eq.dataset.equip); await Net.act('equipItem', { type: it.type, itemId: it.id }); toast('Equipped', 'ok'); }
        else if (un) { const it = C().storeById(un.dataset.unequip); await Net.act('equipItem', { type: it.type, itemId: it.type === 'theme' ? 'th-lounge' : it.type === 'wave' ? 'mw-classic' : null }); }
      });
      const off = S.on('me', render); return () => off();
    }
  };

  /* ================= Wallet ================= */
  Screens.wallet = {
    nav: false,
    render(root) {
      const cur = C().BRAND.currency.code;
      const render = () => { const me = S.me; root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Wallet</h1></div><div class="screen-body">
        <div class="wallet-card"><div class="amt"><b class="coin lg">${fmt(me.coins)}</b><span>Coins — send gifts</span></div><div class="sep"></div><div class="amt"><b class="diamond">${fmt(me.diamonds)}</b><span>Diamonds — earned</span></div><button class="btn sm" data-a="exchange">Exchange</button></div>
        <div class="section-title">Get coins <span class="link">Prices in ${cur}</span></div>
        <div class="pack-grid">${C().COIN_PACKS.map(p => `<button class="pack ${p.popular || p.best ? 'hot' : ''}" data-pack="${p.id}">${p.popular ? '<span class="tagx">Popular</span>' : p.best ? '<span class="tagx">Best value</span>' : ''}<div class="coins coin">${fmt(p.coins)}</div>${p.bonus ? `<div class="bonus">+${fmt(p.bonus)} bonus</div>` : '<div class="bonus">&nbsp;</div>'}<div class="price">${money(p, cur)}</div></button>`).join('')}</div>
        <p class="muted mt-4" style="font-size:12px">${S.get('mode') === 'demo' ? 'Demo: tapping a pack adds coins instantly. In production this opens your payment gateway (Razorpay, Stripe, Apple/Google Pay).' : S.get('freeRecharge') ? 'Test server: packs are added without a real payment until a payment gateway is connected.' : 'Coin purchases open once this server connects a payment gateway.'}</p>
        <div class="section-title">How it works</div><div class="card" style="font-size:13px;color:var(--text-2);line-height:1.6">• 1 coin sent = 1 XP for you and ${C().DIAMONDS_PER_COIN} diamonds for the receiver<br>• ${Math.round(C().DIAMOND_TO_COIN * 100)} coins per 100 diamonds when you exchange<br>• Coins never expire</div></div>`; };
      render();
      root.addEventListener('click', async e => {
        if (e.target.closest('[data-back]')) return Router.back('me');
        const p = e.target.closest('[data-pack]'); if (p) { const pack = C().COIN_PACKS.find(x => x.id === p.dataset.pack); if (await confirm(`Buy ${fmt(pack.coins + pack.bonus)} coins?`, `${money(pack, cur)} — ${S.get('mode') === 'demo' ? 'demo purchase, no real payment.' : S.get('freeRecharge') ? 'test purchase, no real payment.' : 'payments are not available yet.'}`, 'Pay ' + money(pack, cur))) { const r = await Net.act('recharge', { packId: pack.id }); if (r.ok) { toast(`+${fmt(pack.coins + pack.bonus)} coins added 🎉`, 'gold', 2600); UI.haptic(30); } else toast(r.error, 'err'); } return; }
        if (e.target.closest('[data-a="exchange"]')) { const me = S.me; if (me.diamonds < 10) return toast('You need at least 10 diamonds'); const v = await UI.modal({ title: 'Exchange diamonds', html: `<p>You have ${fmt(me.diamonds)} diamonds. 100 diamonds → ${Math.round(C().DIAMOND_TO_COIN * 100)} coins.</p><input class="input mb-4" id="d" type="number" min="10" max="${me.diamonds}" value="${me.diamonds}">`, yesLabel: 'Exchange', value: m => Number(m.querySelector('#d').value) }); if (v) { const r = await Net.act('exchangeDiamonds', { diamonds: v }); toast(r.ok ? `+${r.coins} coins` : r.error, r.ok ? 'gold' : 'err'); } }
      });
      const off = S.on('me', render); return () => off();
    }
  };

  /* ================= VIP ================= */
  Screens.vip = {
    nav: false, sel: 1,
    render(root) {
      const me = S.me; Screens.vip.sel = Math.max(1, me.vip || 1);
      root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>VIP centre</h1></div><div class="screen-body"><div class="vip-strip" id="strip"></div><div id="card" class="mt-4"></div></div>`;
      const render = () => { const t = C().VIP_TIERS.find(x => x.level === Screens.vip.sel); root.querySelector('#strip').innerHTML = C().VIP_TIERS.map(x => `<button data-v="${x.level}" class="${x.level === Screens.vip.sel ? 'active' : ''}" style="--c:${x.color}"><b style="color:${x.color}">V${x.level}</b>${x.name}</button>`).join(''); root.querySelector('#card').innerHTML = `<div class="vip-card" style="border-color:${t.color}66"><h3><span style="color:${t.color}">👑 VIP ${t.level}</span> ${t.name}</h3><div class="price">${fmt(t.price)} coins / 30 days</div><ul>${t.perks.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>${me.vip >= t.level ? `<div class="banner-note mt-4">You already have VIP ${me.vip}${me.vipUntil ? ' · renews ' + new Date(me.vipUntil).toLocaleDateString() : ''}. Buying again extends it by 30 days.</div>` : ''}<button class="btn primary block mt-4" data-buy="${t.level}">${me.vip >= t.level ? 'Extend 30 days' : 'Activate VIP ' + t.level} · <span class="coin" style="color:#fff">${fmt(t.price)}</span></button>`; };
      render();
      root.addEventListener('click', async e => { if (e.target.closest('[data-back]')) return Router.back('me'); const v = e.target.closest('[data-v]'); if (v) { Screens.vip.sel = Number(v.dataset.v); render(); return; } const b = e.target.closest('[data-buy]'); if (b) { const r = await Net.act('buyVip', { level: Number(b.dataset.buy) }); if (!r.ok) { if (r.error === 'Not enough coins') RoomCtl.rechargePrompt(); else toast(r.error, 'err'); } else { toast(`Welcome to VIP ${r.vip} 👑`, 'gold', 2600); render(); } } });
    }
  };

  /* ================= Backpack ================= */
  Screens.backpack = {
    nav: false,
    render(root) {
      const render = () => { const me = S.me; const inv = (me.inventory || []).map(i => Object.assign({ item: C().storeById(i.itemId) }, i)).filter(i => i.item); root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Backpack</h1><button class="btn sm" data-go="store">Store</button></div><div class="screen-body">${inv.length ? `<div class="store-grid">${inv.map(i => { const eq = me.equipped[i.item.type] === i.item.id; const left = i.expiresAt ? Math.max(0, Math.ceil((i.expiresAt - Date.now()) / 86400000)) : null; return `<div class="store-item"><div class="prev">${preview(i.item, me)}</div><div class="nm">${esc(i.item.name)}</div><div class="days">${left != null ? left + ' days left' : 'Permanent'}</div>${eq ? `<button class="btn sm ghost" data-un="${i.item.id}">✓ In use</button>` : `<button class="btn sm" data-eq="${i.item.id}">Use</button>`}</div>`; }).join('')}</div>` : `<div class="empty"><div class="big">🎒</div><h3>Your backpack is empty</h3><p>Frames, bubbles, entry effects and themes you buy live here.</p><button class="btn primary mt-4" data-go="store">Open store</button></div>`}</div>`; };
      render();
      root.addEventListener('click', async e => { if (e.target.closest('[data-back]')) return Router.back('me'); const g = e.target.closest('[data-go]'); if (g) return Router.go(g.dataset.go); const eq = e.target.closest('[data-eq]'), un = e.target.closest('[data-un]'); if (eq) { const it = C().storeById(eq.dataset.eq); await Net.act('equipItem', { type: it.type, itemId: it.id }); } if (un) { const it = C().storeById(un.dataset.un); await Net.act('equipItem', { type: it.type, itemId: it.type === 'theme' ? 'th-lounge' : it.type === 'wave' ? 'mw-classic' : null }); } });
      const off = S.on('me', render); return () => off();
    }
  };

  /* ================= Tasks & check-in ================= */
  Screens.tasks = {
    nav: false,
    render(root) {
      const render = () => { const me = S.me; const today = new Date().toISOString().slice(0, 10); const done = me.checkIn && me.checkIn.last === today; const streak = me.checkIn ? me.checkIn.streak : 0;
        root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Tasks & rewards</h1></div><div class="screen-body">
          <div class="card"><div class="row between"><b>Daily check-in</b><span class="muted" style="font-size:12px">${streak}-day streak 🔥</span></div><div class="checkin-strip mt-3">${C().CHECKIN_REWARDS.map((r, i) => `<div class="${i < streak ? 'done' : ''} ${i === (done ? streak - 1 : streak) ? 'today' : ''}">Day ${i + 1}<b>+${r}</b></div>`).join('')}</div><button class="btn primary block mt-4" data-a="checkin" ${done ? 'disabled' : ''}>${done ? '✓ Checked in today' : 'Check in now'}</button></div>
          <div class="section-title">Today's tasks</div>${(me.tasks || []).map(t => `<div class="task-row"><span class="ic" style="font-size:22px">${t.claimed ? '✅' : t.progress >= t.target ? '🎁' : '⭐'}</span><span class="t"><b>${esc(t.label)}</b><div class="progress"><i style="width:${Math.round(t.progress / t.target * 100)}%"></i></div></span>${t.claimed ? '<span class="muted" style="font-size:12px">Done</span>' : t.progress >= t.target ? `<button class="btn xs gold" data-claim="${t.id}">+${t.reward}</button>` : `<span class="coin" style="font-size:12px">${t.reward}</span>`}</div>`).join('')}</div>`; };
      render();
      root.addEventListener('click', async e => { if (e.target.closest('[data-back]')) return Router.back('me'); if (e.target.closest('[data-a="checkin"]')) { const r = await Net.act('checkIn'); if (r.ok) { toast(`+${r.reward} coins · day ${r.streak} ✨`, 'gold', 2600); UI.haptic(20); } else toast(r.error); } const c = e.target.closest('[data-claim]'); if (c) { const r = await Net.act('claimTask', { taskId: c.dataset.claim }); toast(r.ok ? `+${r.reward} coins 🎉` : r.error, r.ok ? 'gold' : 'err'); } });
      const off = S.on('me', render); return () => off();
    }
  };

  /* ================= Rankings ================= */
  Screens.rankings = {
    nav: false, type: 'wealth', period: 'daily',
    render(root) {
      root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Rankings</h1></div><div class="screen-body"><div class="tabs fill" id="types">${[['wealth', '💰 Wealth'], ['charm', '✨ Charm'], ['rooms', '🎤 Rooms'], ['family', '🏠 Family']].map(([id, l]) => `<button data-t="${id}" class="${Screens.rankings.type === id ? 'active' : ''}">${l}</button>`).join('')}</div><div class="seg mt-3" id="periods">${[['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['all', 'All time']].map(([id, l]) => `<button data-p="${id}" class="${Screens.rankings.period === id ? 'active' : ''}">${l}</button>`).join('')}</div><div id="list" class="mt-3"></div></div><div class="my-rank hidden" id="mine"></div>`;
      const load = async () => {
        const r = await Net.act('rankings', { type: Screens.rankings.type, period: Screens.rankings.period }); if (!r.ok) return;
        const name = x => x.user ? x.user.name : x.room ? x.room.title : x.family.name; const av = x => x.user ? avatar(x.user, '') : x.room ? `<span class="avatar" style="background:${CF.avatar.coverStyle(x.room.cover)};display:grid;place-items:center;font-size:24px">${UI.tagOf(x.room.tag).emoji}</span>` : `<span class="avatar" style="background:${x.family.color};display:grid;place-items:center;font-weight:800;color:#fff;font-size:12px">${esc(x.family.badge)}</span>`;
        const link = x => x.user ? `data-user="${x.user.id}"` : x.room ? `data-room="${x.room.id}"` : `data-fam="${x.family.id}"`;
        const top = r.list.slice(0, 3); const rest = r.list.slice(3);
        root.querySelector('#list').innerHTML = r.list.length ? `<div class="podium">${[1, 0, 2].map(i => top[i] ? `<button class="p ${['first', 'second', 'third'][i]}" ${link(top[i])}><span class="crown">${['👑', '🥈', '🥉'][i]}</span>${av(top[i])}<b>${esc(name(top[i]))}</b><span>${fmt(top[i].score)}</span><span class="base">${i + 1}</span></button>` : '<div class="p"></div>').join('')}</div>${rest.map((x, i) => `<button class="list-row rank-row" style="width:100%;text-align:left" ${link(x)}><span class="no">${i + 4}</span>${av(x)}<span class="grow"><span class="name"><span class="txt">${esc(name(x))}</span>${x.user ? lv(x.user.level) + vip(x.user.vip) : ''}</span><span class="sub">${x.user ? C().flagOf(x.user.country) : x.room ? fmt(x.room.memberCount) + ' listening' : x.family.members + ' members'}</span></span><span class="coin">${fmt(x.score)}</span></button>`).join('')}` : `<div class="empty"><div class="big">🏆</div><h3>No activity yet</h3><p>Gifts sent and received today will rank here.</p></div>`;
        const mine = root.querySelector('#mine'); if (r.myRank) { mine.classList.remove('hidden'); mine.innerHTML = `${avatar(S.me, 'sm')}<span class="grow"><b>Your rank: #${r.myRank.rank}</b><div class="muted" style="font-size:12px">${fmt(r.myRank.score)} ${r.type === 'charm' ? 'charm' : 'coins sent'}</div></span><button class="btn xs primary" data-go="home">Climb higher</button>`; } else mine.classList.add('hidden');
      };
      load();
      root.addEventListener('click', e => { if (e.target.closest('[data-back]')) return Router.back('me'); const t = e.target.closest('[data-t]'); if (t) { Screens.rankings.type = t.dataset.t; root.querySelectorAll('#types button').forEach(x => x.classList.toggle('active', x === t)); return load(); } const p = e.target.closest('[data-p]'); if (p) { Screens.rankings.period = p.dataset.p; root.querySelectorAll('#periods button').forEach(x => x.classList.toggle('active', x === p)); return load(); } const g = e.target.closest('[data-go]'); if (g) return Router.go(g.dataset.go); const u = e.target.closest('[data-user]'); if (u) return Router.go('profile/' + u.dataset.user); const rm = e.target.closest('[data-room]'); if (rm) return RoomCtl.join(rm.dataset.room); const f = e.target.closest('[data-fam]'); if (f) Router.go('family/' + f.dataset.fam); });
    }
  };

  /* ================= Family ================= */
  Screens.family = {
    nav: false,
    render(root, route) {
      const famCard = f => `<button class="family-card" data-fam="${f.id}"><span class="badge" style="background:${f.color}">${esc(f.badge)}</span><span class="t"><b>${esc(f.name)}</b><span>Lv.${f.level} · ${f.members} members · ${fmt(f.weekly)} this week</span><span style="display:block;color:var(--text-2);font-size:12px">${esc(f.slogan)}</span></span>${I.chev}</button>`;
      if (route.id) {
        root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Family</h1></div><div class="screen-body" id="b"></div>`;
        const load = async () => { const r = await Net.act('getFamily', { familyId: route.id }); if (!r.ok) { toast(r.error, 'err'); return Router.back('family'); } const f = r.family; const me = S.me; const mine = me.familyId === f.id; root.querySelector('#b').innerHTML = `<div class="family-hero"><span class="badge" style="background:${f.color}">${esc(f.badge)}</span><h2>${esc(f.name)}</h2><p class="muted mt-2">${esc(f.slogan)}</p><div class="row mt-3" style="justify-content:center;gap:18px"><span><b>Lv.${f.level}</b> <span class="muted">level</span></span><span><b>${f.members}</b> <span class="muted">members</span></span><span><b>${fmt(f.weekly)}</b> <span class="muted">weekly</span></span></div></div>${mine ? `<button class="btn block ghost" data-leave>Leave family</button>` : me.familyId ? '<div class="banner-note">Leave your current family to join another.</div>' : `<button class="btn block primary" data-join="${f.id}">Join this family</button>`}<div class="section-title">Members</div>${f.memberList.map(u => `<div class="list-row" data-user="${u.id}">${avatar(u, 'md', { online: true })}<span class="grow"><span class="name"><span class="txt">${esc(u.name)}</span>${lv(u.level)}${vip(u.vip)}${u.id === (f.leader || {}).id ? '<span class="host-tag">LEADER</span>' : ''}</span><span class="sub">${u.roomId ? '<span class="status-inroom">In a room</span>' : u.online ? 'Online' : 'Offline'}</span></span>${I.chev}</div>`).join('')}`; };
        load();
        root.addEventListener('click', async e => { if (e.target.closest('[data-back]')) return Router.back('family'); const j = e.target.closest('[data-join]'); if (j) { const r = await Net.act('joinFamily', { familyId: j.dataset.join }); toast(r.ok ? 'Welcome to the family 🏠' : r.error, r.ok ? 'ok' : 'err'); if (r.ok) load(); return; } if (e.target.closest('[data-leave]')) { if (await confirm('Leave family?', '', 'Leave', true)) { await Net.act('leaveFamily'); load(); } return; } const u = e.target.closest('[data-user]'); if (u) Router.go('profile/' + u.dataset.user); });
        return;
      }
      root.innerHTML = `<div class="topbar"><button class="icon-btn plain" data-back>${I.back}</button><h1>Families</h1><button class="btn sm primary" data-create>+ Create</button></div><div class="screen-body"><div id="mine"></div><div class="section-title">Top families this week</div><div id="list" class="col"></div></div>`;
      const load = async () => { const me = S.me; const r = await Net.act('listFamilies'); if (!r.ok) return; const mine = r.families.find(f => f.id === me.familyId); root.querySelector('#mine').innerHTML = mine ? `<div class="section-title">My family</div>${famCard(mine)}` : `<div class="banner-note">Families are squads of friends who gift and host together. Join one below or create your own (Level 10+ recommended).</div>`; root.querySelector('#list').innerHTML = r.families.map(famCard).join(''); };
      load();
      root.addEventListener('click', e => { if (e.target.closest('[data-back]')) return Router.back('me'); const f = e.target.closest('[data-fam]'); if (f) return Router.go('family/' + f.dataset.fam); if (e.target.closest('[data-create]')) sheet({ title: 'Create a family', html: `<div class="field"><label>Family name</label><input class="input" id="fn" maxlength="20" placeholder="e.g. Royal Tigers"></div><div class="field"><label>Badge (2–4 letters)</label><input class="input" id="fb" maxlength="4" placeholder="RT"></div><div class="field"><label>Slogan</label><input class="input" id="fs" maxlength="60" placeholder="Together we shine ✨"></div><div class="field"><label>Colour</label><div class="art-pick" id="fc">${['#8B5CF6', '#F043A6', '#FFB547', '#2DD4BF', '#FF6B8A', '#60A5FA'].map((c, i) => `<button data-c="${c}" class="${i === 0 ? 'active' : ''}" style="background:${c}"></button>`).join('')}</div></div><button class="btn primary block" id="go">Create family</button>`, onMount(s, api) { let color = '#8B5CF6'; s.querySelector('#fc').onclick = ev => { const b = ev.target.closest('[data-c]'); if (!b) return; color = b.dataset.c; s.querySelectorAll('#fc button').forEach(x => x.classList.toggle('active', x === b)); }; s.querySelector('#go').onclick = async () => { const r = await Net.act('createFamily', { name: s.querySelector('#fn').value, badge: s.querySelector('#fb').value, slogan: s.querySelector('#fs').value, color }); if (!r.ok) return toast(r.error, 'err'); api.close(); toast('Family created 🏠', 'ok'); Router.go('family/' + r.family.id); }; } }); });
    }
  };
})();
