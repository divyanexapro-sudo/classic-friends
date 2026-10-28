/* Classic Friends website — live phone demo, rooms ticker, gift stage, nav */
(function () {
  const C = window.CF.catalog, AV = window.CF.avatar;
  const $ = s => document.querySelector(s);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* nav */
  const nav = $('#nav'); window.addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 8), { passive: true });
  $('#burger').onclick = () => nav.classList.toggle('open');
  nav.querySelectorAll('.links a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
  $('#year').textContent = new Date().getFullYear();
  document.querySelectorAll('[data-store]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); a.textContent = 'Store listing coming soon — use the web app today'; }));

  /* ---------- live phone demo ---------- */
  const people = [
    { name: 'Rania', g: 'f', lv: 42, host: true }, { name: 'Arjun', g: 'm', lv: 18 }, { name: 'Priya', g: 'f', lv: 27 }, { name: 'Omar', g: 'm', lv: 9 },
    { name: 'Meera', g: 'f', lv: 33 }, { name: 'Karthik', g: 'm', lv: 12 }, { name: 'Fatima', g: 'f', lv: 51 }
  ];
  people.forEach((p, i) => { p.svg = AV.avatarSvg('site-' + p.name + i, { gender: p.g }); });
  const seatEl = (p, i) => p ? `<div class="dr-seat" data-i="${i}"><span class="av">${p.svg}</span><span>${p.name}</span><span class="tag ${p.host ? 'host' : ''}">${p.host ? 'HOST' : 'Lv.' + p.lv}</span></div>` : `<div class="dr-seat"><span class="empty">🎙️</span><span style="opacity:.6">Seat ${i + 1}</span></div>`;
  $('#dr-host').innerHTML = seatEl(people[0], 0);
  const grid = [people[1], people[2], null, people[3], people[4], null, people[5], people[6]];
  $('#dr-seats').innerHTML = grid.map((p, i) => seatEl(p, i + 1)).join('');
  const chat = $('#dr-chat'); const fx = $('#dr-fx');
  const lines = [['Arjun', 'hello everyone 👋', 18], ['Priya', 'host ji ek gaana please 🎤', 27], ['Omar', 'love from Muscat 🇴🇲', 9], ['Meera', 'haha true 😂', 33], ['Karthik', 'anyone from Chennai?', 12], ['Fatima', 'this room is lit 🔥', 51], ['Rania', 'welcome welcome 🎉', 42], ['Arjun', 'nice voice 👏', 18], ['Priya', 'semma 🔥', 27]];
  const giftsSmall = C.GIFTS.filter(g => g.tier <= 2); const giftsBig = C.GIFTS.filter(g => g.tier >= 3);
  const addMsg = html => { const d = document.createElement('div'); d.innerHTML = html; chat.appendChild(d.firstElementChild); while (chat.children.length > 7) chat.firstElementChild.remove(); };
  lines.slice(0, 4).forEach(([n, t, lv]) => addMsg(`<div class="dr-msg"><span class="lv">Lv.${lv}</span><b>${n}:</b>${t}</div>`));
  let step = 0;
  function speak() { document.querySelectorAll('#demo-room .dr-seat.speaking').forEach(e => e.classList.remove('speaking')); const seats = [...document.querySelectorAll('#demo-room .dr-seat[data-i]')]; pick(seats).classList.add('speaking'); if (Math.random() < .4) pick(seats).classList.add('speaking'); }
  function gift() {
    const from = pick(people.slice(1)); const big = Math.random() < .22; const g = big ? pick(giftsBig) : pick(giftsSmall); const qty = big ? 1 : pick([1, 9, 9, 66]);
    addMsg(`<div class="dr-msg gift">🎁 <b>${from.name}</b> sent ${g.emoji} ${g.name} ×${qty} to <b>Rania</b></div>`);
    const b = document.createElement('div'); b.className = 'dr-banner'; b.innerHTML = `<span class="av">${from.svg}</span><span><b>${from.name}</b> → Rania</span><span style="font-size:18px">${g.emoji}</span><span class="x">×${qty}</span>`; fx.appendChild(b); setTimeout(() => b.remove(), 3100);
    const host = $('#dr-host .dr-seat'); const pop = document.createElement('span'); pop.className = 'pop'; pop.textContent = g.emoji; host.appendChild(pop); setTimeout(() => pop.remove(), 1400);
    if (big) { const e = document.createElement('div'); e.className = 'dr-big'; e.textContent = g.emoji; fx.appendChild(e); setTimeout(() => e.remove(), 3000); }
  }
  function react() { const e = document.createElement('span'); e.className = 'dr-float'; e.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px'); e.style.right = (16 + Math.random() * 50) + 'px'; e.textContent = pick(C.REACTIONS); fx.appendChild(e); setTimeout(() => e.remove(), 2300); }
  function tick() {
    step++;
    if (step % 2 === 0) speak();
    if (step % 3 === 0) { const [n, t, lv] = lines[(step / 3) % lines.length | 0]; addMsg(`<div class="dr-msg"><span class="lv">Lv.${lv}</span><b>${n}:</b>${t}</div>`); }
    if (step % 5 === 0) gift();
    if (step % 2 === 1 && Math.random() < .7) react();
    $('#dr-count').textContent = 120 + Math.floor(Math.random() * 14);
  }
  speak(); setInterval(tick, 900);

  /* ---------- rooms ticker ---------- */
  const rooms = [['Late night chill 🌙', 'latenight', 'IN', 'Hindi', 128], ['Tamil pasanga singing 🎤', 'singing', 'IN', 'Tamil', 96], ['Dubai friends zone 🇦🇪', 'friends', 'AE', 'English', 74], ['Ludo & laughs 🎲', 'ludo', 'IN', 'Hindi', 51], ['Poetry nights · شعر 📜', 'poetry', 'SA', 'Urdu', 63], ['Bollywood antakshari 🎬', 'bollywood', 'IN', 'Hindi', 142], ['Cricket talk 🏏', 'cricket', 'IN', 'English', 88], ['Malayalam kootam 🌴', 'chat', 'AE', 'Malayalam', 40], ['Ghazals & sufi 🎶', 'music', 'OM', 'Urdu', 57], ['Muscat family room 🏠', 'family', 'OM', 'Arabic', 33], ['Karaoke battle 🎤🔥', 'singing', 'AE', 'English', 110], ['Good morning chai ☕', 'chat', 'IN', 'Hindi', 69]];
  const rc = r => { const tag = C.ROOM_TAGS.find(t => t.id === r[1]); return `<div class="rc"><div class="cover" style="background:${AV.coverStyle(r[0])}"><span class="live">${r[4]}</span><span class="flag">${C.flagOf(r[2])}</span>${tag.emoji}</div><div class="body"><b>${esc(r[0])}</b><span>${tag.label} · ${r[3]}</span></div></div>`; };
  $('#ticker-track').innerHTML = rooms.map(rc).join('') + rooms.map(rc).join('');

  /* ---------- gift stage ---------- */
  const shelf = $('#gift-shelf'); const order = ['hot', 'lucky', 'luxury', 'vip'];
  shelf.innerHTML = C.GIFTS.slice().sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat) || a.price - b.price).map(g => `<button data-g="${g.id}" class="${g.id === 'rocket' ? 'active' : ''}"><span class="e">${g.emoji}</span><span class="n">${esc(g.name)}</span><span class="p">${g.price === 1 ? '1 coin' : g.price.toLocaleString() + ' coins'}</span></button>`).join('');
  const tierLabel = t => ['', 'seat pop', 'fly-in banner', 'full-screen effect', 'epic full-screen effect'][t];
  shelf.addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return; const g = C.giftById(b.dataset.g);
    shelf.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    const em = $('#stage-emoji'); em.textContent = g.emoji; em.style.animation = 'none'; void em.offsetWidth; em.style.animation = '';
    $('#stage-name').textContent = g.name + (g.vip ? ` · VIP${g.vip}` : ''); $('#stage-price').textContent = `${g.price.toLocaleString()} coins · ${tierLabel(g.tier)}${g.lucky ? ' · can pay you back' : ''}`;
    const stage = $('#gift-stage'); const cols = ['#FFD36E', '#F043A6', '#8B5CF6', '#2DD4BF', '#fff']; const n = g.tier * 8;
    for (let i = 0; i < n; i++) { const s = document.createElement('span'); s.className = 'spark'; s.style.background = cols[i % cols.length]; const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 160; s.style.setProperty('--x', Math.cos(a) * d + 'px'); s.style.setProperty('--y', Math.sin(a) * d + 'px'); stage.appendChild(s); setTimeout(() => s.remove(), 1200); }
  });

  /* host card avatar */
  $('#hc-avatar').innerHTML = AV.avatarSvg('site-host-rania', { gender: 'f' });

  /* "Open the app" links: when served by the Classic Friends server the app is at /, when opened from the folder it's ../app/ */
  const appHref = window.CF_APP_URL || (location.hostname.endsWith('claude.ai') ? 'https://claude.ai/artifact/4JHuZ9UYhXmVCzxn26gThR' /* hosted preview of the demo */ : location.pathname.includes('/site/') ? '/' : '../app/index.html');
  document.querySelectorAll('[data-app]').forEach(a => a.href = appHref);
})();
