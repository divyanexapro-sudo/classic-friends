/* ============================================================
   Classic Friends avatar + cover generator
   Deterministic SVG faces from a seed string. No image files needed.
   Loads in Node (require) and the browser (window.CF.avatar).
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.CF = root.CF || {}; root.CF.avatar = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = hash(String(seed));
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  const BG = [
    ['#8B5CF6', '#F043A6'], ['#F043A6', '#FFB547'], ['#2DD4BF', '#60A5FA'], ['#FFB547', '#FF6B8A'],
    ['#60A5FA', '#8B5CF6'], ['#34D399', '#2DD4BF'], ['#FF6B8A', '#8B5CF6'], ['#F97316', '#F043A6'],
    ['#A78BFA', '#60A5FA'], ['#FDE68A', '#F97316'], ['#7FDBFF', '#B57BFF'], ['#FF9DD1', '#FFB547']
  ];
  const SKIN = ['#FFE0C7', '#F5C9A8', '#E0A882', '#C98A5E', '#A66B45', '#7A4A2E'];
  const HAIR = ['#1F1A2E', '#3B2416', '#7A4A1F', '#C98A3A', '#B23A3A', '#6B5BD6', '#2DD4BF', '#E8E8F0'];
  const SHIRT = ['#1E1540', '#2A1E55', '#8B5CF6', '#F043A6', '#2DD4BF', '#FFB547', '#FF6B8A', '#60A5FA', '#F7F5FF', '#34D399'];

  /* ---- hair styles (drawn relative to head at cx=50, cy=44) ---- */
  function hairSvg(style, color) {
    switch (style) {
      case 'short':  return `<path d="M29 46 C28 8 72 8 71 46 C70 38 62 34 50 34 C38 34 30 38 29 46 Z" fill="${color}"/>`;
      case 'side':   return `<path d="M29 46 C28 8 72 8 71 46 C71 38 66 33 58 33 C50 36 40 40 29 46 Z" fill="${color}"/>`;
      case 'long':   return { back: `<path d="M27 44 C26 6 74 6 73 44 L75 72 Q50 80 25 72 Z" fill="${color}"/>`, front: `<path d="M30 46 C30 10 70 10 70 46 C64 36 36 36 30 46 Z" fill="${color}"/>` };
      case 'curly':  return `<g fill="${color}"><circle cx="33" cy="34" r="9"/><circle cx="43" cy="25" r="9"/><circle cx="57" cy="25" r="9"/><circle cx="67" cy="34" r="9"/><circle cx="29" cy="46" r="6"/><circle cx="71" cy="46" r="6"/><path d="M30 44 C30 12 70 12 70 44 Z"/></g>`;
      case 'bun':    return `<g fill="${color}"><circle cx="50" cy="14" r="8"/><path d="M29 46 C28 8 72 8 71 46 C70 38 62 34 50 34 C38 34 30 38 29 46 Z"/></g>`;
      case 'spiky':  return `<path d="M30 44 L31 22 L39 30 L44 14 L50 28 L56 14 L61 30 L69 22 L70 44 C62 36 38 36 30 44 Z" fill="${color}"/>`;
      case 'hijab':  return { back: `<path d="M24 48 C24 4 76 4 76 48 L77 76 Q50 84 23 76 Z" fill="${color}"/>`, front: `<path d="M30 46 C30 10 70 10 70 46 C66 34 34 34 30 46 Z" fill="${color}"/>` };
      case 'cap':    return `<g><path d="M28 44 C28 8 72 8 72 44 C62 36 38 36 28 44 Z" fill="${color}"/><path d="M27 38 C27 6 73 6 73 38 Z" fill="#F043A6"/><rect x="24" y="36" width="56" height="6" rx="3" fill="#F043A6"/><rect x="60" y="36" width="24" height="6" rx="3" fill="#C2267F"/></g>`;
      default:       return `<path d="M30 44 C30 10 70 10 70 44 C62 38 38 38 30 44 Z" fill="${color}" opacity=".85"/>`;
    }
  }

  function accessorySvg(kind) {
    switch (kind) {
      case 'glasses': return `<g fill="none" stroke="#1A1333" stroke-width="2"><circle cx="42" cy="45" r="6"/><circle cx="58" cy="45" r="6"/><path d="M48 45 h4 M36 44 l-5 -2 M64 44 l5 -2"/></g>`;
      case 'headphones': return `<g><path d="M28 46 C28 22 72 22 72 46" fill="none" stroke="#1A1333" stroke-width="4" stroke-linecap="round"/><rect x="24" y="40" width="8" height="14" rx="4" fill="#F043A6"/><rect x="68" y="40" width="8" height="14" rx="4" fill="#F043A6"/></g>`;
      case 'earrings': return `<g fill="#FFB547"><circle cx="30" cy="52" r="2.2"/><circle cx="70" cy="52" r="2.2"/></g>`;
      case 'mic': return `<g><rect x="63" y="52" width="7" height="12" rx="3.5" fill="#1A1333"/><rect x="65.5" y="63" width="2" height="6" fill="#1A1333"/><path d="M60 58 a6.5 6.5 0 0 0 13 0" fill="none" stroke="#1A1333" stroke-width="1.6"/></g>`;
      default: return '';
    }
  }

  /**
   * avatarSvg(seed, { gender }) → SVG string (square 100×100)
   */
  function avatarSvg(seed, opts) {
    opts = opts || {};
    const r = rng(seed || 'Classic Friends');
    const bg = pick(r, BG);
    const skin = pick(r, SKIN);
    const hairColor = pick(r, HAIR);
    const shirt = pick(r, SHIRT);
    const g = opts.gender || pick(r, ['f', 'm']);
    const stylesF = ['long', 'long', 'bun', 'curly', 'hijab', 'side', 'short'];
    const stylesM = ['short', 'short', 'side', 'spiky', 'curly', 'cap', 'buzz'];
    const style = pick(r, g === 'f' ? stylesF : stylesM);
    const acc = pick(r, ['none', 'none', 'none', 'glasses', 'headphones', 'earrings', 'mic']);
    const eyes = pick(r, ['open', 'open', 'open', 'happy']);
    const mouth = pick(r, ['smile', 'smile', 'grin', 'open']);
    const h = hairSvg(style, hairColor);
    const back = typeof h === 'object' ? h.back : '';
    const front = typeof h === 'object' ? h.front : h;
    const eyesSvg = eyes === 'open'
      ? `<g fill="#1A1333"><circle cx="42" cy="45" r="2.6"/><circle cx="58" cy="45" r="2.6"/></g><g fill="#fff"><circle cx="43" cy="44" r=".9"/><circle cx="59" cy="44" r=".9"/></g>`
      : `<g fill="none" stroke="#1A1333" stroke-width="2.2" stroke-linecap="round"><path d="M38.5 46 q3.5 -3.5 7 0"/><path d="M54.5 46 q3.5 -3.5 7 0"/></g>`;
    const mouthSvg = mouth === 'smile'
      ? `<path d="M44 54 q6 5 12 0" fill="none" stroke="#1A1333" stroke-width="2" stroke-linecap="round"/>`
      : mouth === 'grin'
        ? `<path d="M42 53 q8 9 16 0 Z" fill="#1A1333"/><path d="M44.5 54 q5.5 3 11 0 Z" fill="#fff"/>`
        : `<ellipse cx="50" cy="55" rx="3.2" ry="4" fill="#1A1333"/><ellipse cx="50" cy="57" rx="2" ry="1.6" fill="#FF6B8A"/>`;
    const id = 'g' + hash(String(seed)).toString(36);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#${id})"/>
<circle cx="50" cy="48" r="36" fill="#fff" opacity=".10"/>
${back}
<path d="M14 102 C14 80 32 72 50 72 C68 72 86 80 86 102 Z" fill="${shirt}"/>
<rect x="43" y="58" width="14" height="16" rx="5" fill="${skin}" style="filter:brightness(.92)"/>
<circle cx="30" cy="46" r="4.2" fill="${skin}"/><circle cx="70" cy="46" r="4.2" fill="${skin}"/>
<ellipse cx="50" cy="44" rx="20" ry="22" fill="${skin}"/>
<g fill="#FF6B8A" opacity=".35"><circle cx="37" cy="51" r="3.2"/><circle cx="63" cy="51" r="3.2"/></g>
<g stroke="#1A1333" stroke-width="1.6" stroke-linecap="round" opacity=".8"><path d="M38 39 q4 -2 8 0"/><path d="M54 39 q4 -2 8 0"/></g>
${eyesSvg}${mouthSvg}${front}${accessorySvg(acc)}
</svg>`;
  }

  function avatarDataUri(seed, opts) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(avatarSvg(seed, opts));
  }

  /* ---- Room covers: gradient + soft blobs, with the tag emoji overlaid in HTML ---- */
  const COVER = [
    ['#5B21B6', '#F043A6', '#FFB547'], ['#0E7490', '#2DD4BF', '#A7F3D0'], ['#9D174D', '#F043A6', '#FDE68A'],
    ['#1E3A8A', '#60A5FA', '#C4B5FD'], ['#7C2D12', '#F97316', '#FDE68A'], ['#312E81', '#8B5CF6', '#2DD4BF'],
    ['#831843', '#FF6B8A', '#FFB547'], ['#134E4A', '#34D399', '#60A5FA'], ['#4C1D95', '#A78BFA', '#F9A8D4'],
    ['#78350F', '#FFB547', '#FF6B8A']
  ];
  function coverStyle(seed) {
    const r = rng('cover:' + seed);
    const c = pick(r, COVER);
    const a = Math.floor(r() * 360);
    const x = 20 + Math.floor(r() * 60), y = 20 + Math.floor(r() * 60);
    return `radial-gradient(60% 60% at ${x}% ${y}%, ${c[2]}aa 0%, transparent 70%), radial-gradient(80% 80% at ${100 - x}% ${100 - y}%, ${c[1]}cc 0%, transparent 70%), linear-gradient(${a}deg, ${c[0]}, ${c[1]})`;
  }

  return { avatarSvg, avatarDataUri, coverStyle, rng, hash };
});
