/* ============================================================
   Classic Friends UI kit — icons, avatars, badges, sheets, toasts, helpers
   ============================================================ */
(function () {
  const C = () => window.CF.catalog;
  const AV = () => window.CF.avatar;

  /* ---------- escaping & DOM ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];

  /* ---------- icons (24px, stroke) ---------- */
  const P = (d, extra) => `<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra || ''}>${d}</svg>`;
  const I = {
    home: P('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>'),
    sparkles: P('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/><path d="M5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5z"/>'),
    plus: P('<path d="M12 5v14M5 12h14"/>'),
    chat: P('<path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.2-4.2A8 8 0 1 1 21 12z"/>'),
    user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    users: P('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="3"/><path d="M15.5 14.5A5.5 5.5 0 0 1 22 20"/>'),
    search: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    bell: P('<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
    mic: P('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>'),
    micOff: P('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/><path d="M4 4l16 16" stroke="#fff" stroke-width="2.4"/>'),
    gift: P('<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13"/><path d="M12 8c-2-4-6-4-6-1.5S10 8 12 8c2 0 6-1 6-3.5S14 4 12 8z"/>'),
    game: P('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 12h4M9 10v4M15 11h.01M17 13h.01"/>'),
    smile: P('<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>'),
    volume: P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
    volumeOff: P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l4 6M21 9l-4 6"/>'),
    share: P('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
    more: P('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'),
    moreV: P('<circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/>'),
    back: P('<path d="m15 5-7 7 7 7"/>'),
    chev: P('<path d="m9 5 7 7-7 7"/>'),
    down: P('<path d="m5 9 7 7 7-7"/>'),
    x: P('<path d="M6 6l12 12M18 6 6 18"/>'),
    lock: P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    unlock: P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>'),
    settings: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    heart: P('<path d="M12 21s-7-4.4-9.3-9A5.3 5.3 0 0 1 12 6.6 5.3 5.3 0 0 1 21.3 12C19 16.6 12 21 12 21z"/>'),
    heartFill: P('<path d="M12 21s-7-4.4-9.3-9A5.3 5.3 0 0 1 12 6.6 5.3 5.3 0 0 1 21.3 12C19 16.6 12 21 12 21z" fill="currentColor"/>'),
    comment: P('<path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.2-4.2A8 8 0 1 1 21 12z"/>'),
    send: P('<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>'),
    music: P('<path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
    star: P('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>'),
    crown: P('<path d="M3 18h18l-1-9-4.5 4L12 6l-3.5 7L4 9z"/><path d="M5 21h14"/>'),
    copy: P('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
    check: P('<path d="m5 12 5 5L20 7"/>'),
    flag: P('<path d="M5 21V4h12l-2 4 2 4H5"/>'),
    shield: P('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>'),
    logout: P('<path d="M10 17l5-5-5-5M15 12H3M12 3h7v18h-7"/>'),
    minimize: P('<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>'),
    info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'),
    edit: P('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    shuffle: P('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
    exit: P('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
    eye: P('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    wallet: P('<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 15h2"/>'),
    trophy: P('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 5M16 6h3a3 3 0 0 1-3 5M12 13v4M8 21h8M10 17h4"/>'),
    gem: P('<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M10 3l2 6 2-6M6 3l4 6M18 3l-4 6"/>'),
    hand: P('<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 5.5v-2a1.5 1.5 0 0 1 3 0V12M14 4.5a1.5 1.5 0 0 1 3 0V12M17 8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.5L3.5 15a1.6 1.6 0 0 1 2.6-1.8L8 15"/>'),
    link: P('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    kick: P('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 11-7.4M17 17l4 4M21 17l-4 4"/>'),
    globe: P('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
    trash: P('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    camera: P('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>')
  };

  /* ---------- formatting ---------- */
  const fmt = n => { n = Number(n) || 0; if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 >= 100 ? 1 : 0) + 'K'; return String(n); };
  const timeAgo = ts => { const d = Date.now() - ts; if (d < 60000) return 'now'; if (d < 3600000) return Math.floor(d / 60000) + 'm'; if (d < 86400000) return Math.floor(d / 3600000) + 'h'; return Math.floor(d / 86400000) + 'd'; };
  const clock = ts => { const d = new Date(ts); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); };
  const money = (pack, code) => { code = code || C().BRAND.currency.code; const sym = { INR: '₹', AED: 'AED ', USD: '$' }[code] || code + ' '; return sym + pack.price[code]; };
  const frameStyle = id => { const it = id && C().storeById(id); return it && it.type === 'frame' ? it.style : null; };
  const waveColor = id => { const it = id && C().storeById(id); return it && it.type === 'wave' ? it.color : '#2DD4BF'; };
  const themeStyle = id => { const it = id && C().storeById(id); return it && it.type === 'theme' ? it.style : C().storeById('th-lounge').style; };

  /* ---------- avatar + badges ---------- */
  function avatar(u, cls, opts) {
    opts = opts || {}; const seed = (u && u.avatar) || 'guest'; const g = u && u.gender;
    const fr = opts.frame === false ? null : frameStyle(u && u.frame);
    return `<span class="avatar ${cls || ''}" data-uid="${esc(u && u.id)}">${AV().avatarSvg(seed, { gender: g })}${fr ? `<i class="frame spin" style="background:${fr}"></i>` : ''}${opts.online && u && u.online ? '<i class="online"></i>' : ''}</span>`;
  }
  const lv = level => `<span class="lv" data-tier="${C().levelTier(level || 1)}">Lv.${level || 1}</span>`;
  const vip = v => v ? `<span class="vip">👑 VIP${v}</span>` : '';
  const fam = u => u && u.familyBadge ? `<span class="fam">${esc(u.familyBadge)}</span>` : '';
  const flag = code => `<span class="flag">${C().flagOf(code)}</span>`;
  const tagOf = id => C().ROOM_TAGS.find(t => t.id === id) || C().ROOM_TAGS[0];

  /* ---------- toast ---------- */
  let toastBox;
  function toast(msg, kind, ms) {
    if (!toastBox) { toastBox = el('<div class="toasts"></div>'); $('#app').appendChild(toastBox); }
    const t = el(`<div class="toast ${kind || ''}">${msg}</div>`); toastBox.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, ms || 2200);
  }

  /* ---------- sheet / modal ---------- */
  const layers = [];
  function sheet(opts) {
    const app = $('#app');
    const scrim = el('<div class="scrim"></div>');
    const s = el(`<div class="sheet ${opts.cls || ''}" role="dialog"><div class="grab"></div>${opts.title !== undefined ? `<div class="sheet-head"><h3>${opts.title}</h3>${opts.headRight || ''}<button class="icon-btn plain" data-close aria-label="Close">${I.x}</button></div>` : ''}<div class="sheet-body">${opts.html || ''}</div></div>`);
    app.appendChild(scrim); app.appendChild(s);
    const api = { el: s, close() { if (api.closed) return; api.closed = true; s.dispatchEvent(new Event('cf:close')); s.classList.add('closing'); scrim.classList.add('closing'); setTimeout(() => { s.remove(); scrim.remove(); }, 230); layers.splice(layers.indexOf(api), 1); opts.onClose && opts.onClose(); } };
    scrim.addEventListener('click', () => api.close());
    s.addEventListener('click', e => { if (e.target.closest('[data-close]')) api.close(); });
    layers.push(api);
    opts.onMount && opts.onMount(s, api);
    return api;
  }
  function modal(opts) {
    const app = $('#app'); const scrim = el('<div class="scrim"></div>');
    const m = el(`<div class="modal" role="dialog">${opts.title ? `<h3>${opts.title}</h3>` : ''}${opts.html || (opts.text ? `<p>${opts.text}</p>` : '')}<div class="actions">${opts.actions || `<button class="btn ghost" data-no>${opts.noLabel || 'Cancel'}</button><button class="btn ${opts.danger ? 'danger' : 'primary'}" data-yes>${opts.yesLabel || 'OK'}</button>`}</div></div>`);
    app.appendChild(scrim); app.appendChild(m);
    const api = { el: m, close() { m.remove(); scrim.remove(); } };
    return new Promise(resolve => {
      scrim.addEventListener('click', () => { api.close(); resolve(false); });
      m.addEventListener('click', e => { if (e.target.closest('[data-yes]')) { const v = opts.value ? opts.value(m) : true; api.close(); resolve(v); } else if (e.target.closest('[data-no]')) { api.close(); resolve(false); } });
      opts.onMount && opts.onMount(m, api);
    });
  }
  const confirm = (title, text, yesLabel, danger) => modal({ title, text, yesLabel, danger });
  const prompt = (title, placeholder, value) => modal({ title, html: `<input class="input mb-4" placeholder="${esc(placeholder || '')}" value="${esc(value || '')}">`, yesLabel: 'Save', value: m => m.querySelector('input').value.trim(), onMount: m => setTimeout(() => m.querySelector('input').focus(), 50) });
  function closeTop() { const top = layers[layers.length - 1]; if (top) { top.close(); return true; } return false; }

  const EMOJIS = ['😀', '😂', '🤣', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😇', '🙂', '😉', '😋', '🤗', '🤔', '😴', '🥺', '😭', '😤', '🤯', '😱', '🙄', '😏', '🤫', '👋', '👏', '🙏', '🤝', '💪', '👍', '👎', '✌️', '🤞', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💖', '💞', '💯', '🔥', '✨', '🌟', '⭐', '🎉', '🎊', '🎁', '🎤', '🎶', '🎵', '🎧', '🎮', '🎲', '🏏', '⚽', '🌹', '🌸', '🌺', '🍀', '☕', '🍕', '🍰', '🧁', '🍫', '🥂', '🌙', '☀️', '🌈', '🦋', '🐯', '🦁', '🐼', '🦄', '🐉', '🇮🇳', '🇦🇪', '🇸🇦', '🇴🇲', '🇵🇰'];
  function emojiGrid(onPick) { return { html: `<div class="emoji-pick">${EMOJIS.map(e => `<button data-em="${e}">${e}</button>`).join('')}</div>`, bind(root) { root.addEventListener('click', e => { const b = e.target.closest('[data-em]'); if (b) onPick(b.dataset.em); }); } }; }

  /* ---------- share helper ---------- */
  async function share(text, url) {
    try { if (navigator.share) { await navigator.share({ text, url }); return true; } } catch (e) { return false; }
    try { await navigator.clipboard.writeText(url ? text + ' ' + url : text); toast('Copied to clipboard', 'ok'); return true; } catch (e) { toast('Could not share'); return false; }
  }
  function copy(text) { navigator.clipboard && navigator.clipboard.writeText(text).then(() => toast('Copied', 'ok'), () => toast('Copy failed')); }
  function haptic(ms) { try { navigator.vibrate && navigator.vibrate(ms || 12); } catch (e) { } }

  window.UI = { esc, el, $, $$, I, fmt, timeAgo, clock, money, frameStyle, waveColor, themeStyle, avatar, lv, vip, fam, flag, tagOf, toast, sheet, modal, confirm, prompt, closeTop, emojiGrid, EMOJIS, share, copy, haptic };
})();
