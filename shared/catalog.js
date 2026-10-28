/* ============================================================
   Classic Friends shared catalog
   Gifts, levels, VIP, store, coin packs, tags, countries, tasks.
   Loads in Node (require) and in the browser (window.CF.catalog).
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.CF = root.CF || {}; root.CF.catalog = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BRAND = {
    name: 'Classic Friends',
    tagline: 'Pull up a mic.',
    description: 'Voice rooms, gifts and friends — every night.',
    supportEmail: 'hello@classicfriends.app',
    website: 'https://classicfriends.app',
    currency: { code: 'INR', symbol: '₹' }   // change to AED / USD etc.
  };

  /* ---------- Gifts ----------
     price: coins the sender pays
     tier: 1 small (chat line) · 2 medium (fly-in) · 3 big (full-screen) · 4 epic
  */
  const GIFTS = [
    // Hot
    { id: 'rose',      name: 'Rose',        emoji: '🌹', price: 1,     cat: 'hot',    tier: 1 },
    { id: 'lolly',     name: 'Lollipop',    emoji: '🍭', price: 2,     cat: 'hot',    tier: 1 },
    { id: 'heart',     name: 'Heart',       emoji: '💖', price: 5,     cat: 'hot',    tier: 1 },
    { id: 'coffee',    name: 'Chai',        emoji: '☕', price: 8,     cat: 'hot',    tier: 1 },
    { id: 'kiss',      name: 'Kiss',        emoji: '💋', price: 10,    cat: 'hot',    tier: 1 },
    { id: 'icecream',  name: 'Ice cream',   emoji: '🍦', price: 15,    cat: 'hot',    tier: 2 },
    { id: 'teddy',     name: 'Teddy',       emoji: '🧸', price: 20,    cat: 'hot',    tier: 2 },
    { id: 'cake',      name: 'Cake',        emoji: '🎂', price: 30,    cat: 'hot',    tier: 2 },
    { id: 'bouquet',   name: 'Bouquet',     emoji: '💐', price: 50,    cat: 'hot',    tier: 2 },
    { id: 'perfume',   name: 'Perfume',     emoji: '🌸', price: 80,    cat: 'hot',    tier: 2 },
    // Lucky (returns random coins to sender)
    { id: 'clover',    name: 'Clover',      emoji: '🍀', price: 10,    cat: 'lucky',  tier: 1, lucky: true },
    { id: 'dice',      name: 'Lucky dice',  emoji: '🎲', price: 20,    cat: 'lucky',  tier: 1, lucky: true },
    { id: 'slot',      name: 'Jackpot',     emoji: '🎰', price: 50,    cat: 'lucky',  tier: 2, lucky: true },
    { id: 'redbag',    name: 'Lucky bag',   emoji: '🧧', price: 100,   cat: 'lucky',  tier: 2, lucky: true },
    // Luxury
    { id: 'diamond',   name: 'Diamond',     emoji: '💎', price: 100,   cat: 'luxury', tier: 2 },
    { id: 'ring',      name: 'Ring',        emoji: '💍', price: 200,   cat: 'luxury', tier: 2 },
    { id: 'crown',     name: 'Crown',       emoji: '👑', price: 500,   cat: 'luxury', tier: 3 },
    { id: 'car',       name: 'Sports car',  emoji: '🏎️', price: 1000,  cat: 'luxury', tier: 3 },
    { id: 'yacht',     name: 'Yacht',       emoji: '🛥️', price: 2000,  cat: 'luxury', tier: 3 },
    { id: 'rocket',    name: 'Rocket',      emoji: '🚀', price: 5000,  cat: 'luxury', tier: 4 },
    { id: 'castle',    name: 'Castle',      emoji: '🏰', price: 10000, cat: 'luxury', tier: 4 },
    { id: 'dragon',    name: 'Dragon',      emoji: '🐉', price: 20000, cat: 'luxury', tier: 4 },
    { id: 'galaxy',    name: 'Galaxy',      emoji: '🌌', price: 50000, cat: 'luxury', tier: 4 },
    // VIP exclusive
    { id: 'letter',    name: 'Love letter', emoji: '💌', price: 300,   cat: 'vip',    tier: 2, vip: 1 },
    { id: 'fireworks', name: 'Fireworks',   emoji: '🎆', price: 800,   cat: 'vip',    tier: 3, vip: 2 },
    { id: 'unicorn',   name: 'Unicorn',     emoji: '🦄', price: 3000,  cat: 'vip',    tier: 3, vip: 3 },
    { id: 'jet',       name: 'Private jet', emoji: '✈️', price: 8000,  cat: 'vip',    tier: 4, vip: 4 },
    { id: 'lion',      name: 'Golden lion', emoji: '🦁', price: 15000, cat: 'vip',    tier: 4, vip: 5 },
    { id: 'phoenix',   name: 'Phoenix',     emoji: '🔥', price: 30000, cat: 'vip',    tier: 4, vip: 6 }
  ];
  const GIFT_CATS = [
    { id: 'hot',    label: 'Hot' },
    { id: 'lucky',  label: 'Lucky' },
    { id: 'luxury', label: 'Luxury' },
    { id: 'vip',    label: 'VIP' }
  ];
  const GIFT_QTYS = [1, 9, 66, 99, 520, 999];
  // Receiver earns diamonds; diamonds exchange back to coins at DIAMOND_TO_COIN.
  const DIAMONDS_PER_COIN = 0.5;
  const DIAMOND_TO_COIN = 0.7;

  /* ---------- Levels ---------- */
  function xpForLevel(level) { return Math.round(100 * Math.pow(level, 1.8)); }
  function levelFromXp(xp) {
    let lv = 1;
    while (lv < 100 && xp >= xpForLevel(lv + 1)) lv++;
    return lv;
  }
  function levelTier(level) {
    if (level >= 70) return 70; if (level >= 50) return 50; if (level >= 40) return 40;
    if (level >= 30) return 30; if (level >= 20) return 20; if (level >= 10) return 10; return 1;
  }
  const LEVEL_PERKS = [
    { level: 5,  perk: 'Post Moments with photos' },
    { level: 10, perk: 'Create a Family' },
    { level: 15, perk: 'Blue level badge + 12-seat rooms' },
    { level: 20, perk: 'Custom room cover' },
    { level: 30, perk: 'Pink badge + exclusive chat bubble' },
    { level: 40, perk: 'Orange badge + room PK battles' },
    { level: 50, perk: 'Gold badge + entry effect' },
    { level: 70, perk: 'Rainbow badge, max 7 room admins' }
  ];

  /* ---------- VIP ---------- */
  const VIP_TIERS = [
    { level: 1, name: 'Bronze',   price: 499,   color: '#CD7F32', perks: ['VIP badge', 'Bronze entry banner', 'Gift: Love letter'] },
    { level: 2, name: 'Silver',   price: 999,   color: '#C0C0C0', perks: ['Silver name colour', 'Exclusive frame', 'Gift: Fireworks', 'Kick immunity'] },
    { level: 3, name: 'Gold',     price: 2499,  color: '#FFB547', perks: ['Gold ID', 'Entry effect', 'Gift: Unicorn', 'No ads'] },
    { level: 4, name: 'Platinum', price: 4999,  color: '#8FD3F4', perks: ['Hide visitor trail', 'Gift: Private jet', 'Priority mic'] },
    { level: 5, name: 'Diamond',  price: 9999,  color: '#7FDBFF', perks: ['Diamond frame', 'Gift: Golden lion', 'Exclusive room theme'] },
    { level: 6, name: 'Royal',    price: 19999, color: '#B57BFF', perks: ['Royal entry', 'Gift: Phoenix', 'Custom ID'] },
    { level: 7, name: 'Supreme',  price: 49999, color: '#FF4FA3', perks: ['Supreme badge', 'All exclusive gifts', 'Personal manager'] }
  ];

  /* ---------- Store ---------- */
  const STORE = [
    // Avatar frames
    { id: 'fr-neon',    type: 'frame',  name: 'Neon Halo',     price: 300,  days: 30, style: 'conic-gradient(from 0deg,#2DD4BF,#8B5CF6,#F043A6,#2DD4BF)' },
    { id: 'fr-gold',    type: 'frame',  name: 'Golden Wings',  price: 800,  days: 30, style: 'conic-gradient(from 90deg,#FFD36E,#E08A1E,#FFF2B8,#FFB547,#FFD36E)' },
    { id: 'fr-rose',    type: 'frame',  name: 'Rose Garden',   price: 500,  days: 30, style: 'conic-gradient(#FF6B8A,#F043A6,#FFB3C7,#FF6B8A)' },
    { id: 'fr-cyber',   type: 'frame',  name: 'Cyber Ring',    price: 1200, days: 30, style: 'repeating-conic-gradient(#2DD4BF 0 10deg,#0F0B2A 10deg 20deg)' },
    { id: 'fr-royal',   type: 'frame',  name: 'Royal Crown',   price: 2500, days: 30, style: 'conic-gradient(#B57BFF,#FFB547,#B57BFF,#F043A6,#B57BFF)' },
    { id: 'fr-ice',     type: 'frame',  name: 'Ice Crystal',   price: 900,  days: 30, style: 'conic-gradient(#7FDBFF,#FFFFFF,#8FD3F4,#7FDBFF)' },
    // Chat bubbles
    { id: 'bb-candy',   type: 'bubble', name: 'Candy',         price: 200,  days: 30, style: 'linear-gradient(135deg,#FF9DD1,#FFB547)' },
    { id: 'bb-ocean',   type: 'bubble', name: 'Ocean',         price: 200,  days: 30, style: 'linear-gradient(135deg,#2DD4BF,#3B82F6)' },
    { id: 'bb-gold',    type: 'bubble', name: 'Midnight Gold', price: 600,  days: 30, style: 'linear-gradient(135deg,#2A1E55,#E08A1E)' },
    { id: 'bb-aurora',  type: 'bubble', name: 'Aurora',        price: 900,  days: 30, style: 'linear-gradient(135deg,#8B5CF6,#2DD4BF,#F043A6)' },
    // Entry effects
    { id: 'en-car',     type: 'entry',  name: 'Sports car',    price: 1500, days: 30, emoji: '🏎️' },
    { id: 'en-dragon',  type: 'entry',  name: 'Dragon flight', price: 5000, days: 30, emoji: '🐉' },
    { id: 'en-carpet',  type: 'entry',  name: 'Royal carpet',  price: 3000, days: 30, emoji: '👑' },
    { id: 'en-stars',   type: 'entry',  name: 'Shooting stars', price: 800, days: 30, emoji: '🌠' },
    // Room themes
    { id: 'th-lounge',  type: 'theme',  name: 'Midnight Lounge', price: 0,    days: 0, style: 'radial-gradient(120% 80% at 50% 0%,#3B2A7A 0%,#1A1240 45%,#0F0B2A 100%)' },
    { id: 'th-tokyo',   type: 'theme',  name: 'Neon Tokyo',    price: 1000, days: 30, style: 'radial-gradient(120% 80% at 50% 0%,#5B1A6B 0%,#2A0F4A 45%,#0B0620 100%)' },
    { id: 'th-dusk',    type: 'theme',  name: 'Desert Dusk',   price: 1000, days: 30, style: 'radial-gradient(120% 80% at 50% 0%,#9A3B5C 0%,#4A1F4F 45%,#140A2A 100%)' },
    { id: 'th-ocean',   type: 'theme',  name: 'Ocean Deep',    price: 1000, days: 30, style: 'radial-gradient(120% 80% at 50% 0%,#0E4F6E 0%,#0B2F55 45%,#070F2A 100%)' },
    { id: 'th-rose',    type: 'theme',  name: 'Rose Garden',   price: 1500, days: 30, style: 'radial-gradient(120% 80% at 50% 0%,#A62A6A 0%,#4A1548 45%,#120826 100%)' },
    { id: 'th-galaxy',  type: 'theme',  name: 'Galaxy',        price: 3000, days: 30, style: 'radial-gradient(120% 80% at 50% 0%,#2B2E8F 0%,#1A1360 45%,#070520 100%)' },
    // Mic waves
    { id: 'mw-classic', type: 'wave',   name: 'Classic',       price: 0,    days: 0, color: '#2DD4BF' },
    { id: 'mw-gold',    type: 'wave',   name: 'Gold wave',     price: 400,  days: 30, color: '#FFB547' },
    { id: 'mw-rose',    type: 'wave',   name: 'Rose wave',     price: 400,  days: 30, color: '#FF6B8A' },
    { id: 'mw-vibe',    type: 'wave',   name: 'Vibe wave',     price: 900,  days: 30, color: '#F043A6' }
  ];
  const STORE_TYPES = [
    { id: 'frame',  label: 'Frames' },
    { id: 'bubble', label: 'Bubbles' },
    { id: 'entry',  label: 'Entry' },
    { id: 'theme',  label: 'Themes' },
    { id: 'wave',   label: 'Mic waves' }
  ];

  /* ---------- Coin packs (prices are placeholders — set your own) ---------- */
  const COIN_PACKS = [
    { id: 'p100',   coins: 100,   bonus: 0,    price: { INR: 89,   AED: 3.99,  USD: 0.99 } },
    { id: 'p550',   coins: 500,   bonus: 50,   price: { INR: 449,  AED: 19.99, USD: 4.99 } },
    { id: 'p1200',  coins: 1000,  bonus: 200,  price: { INR: 899,  AED: 39.99, USD: 9.99 }, popular: true },
    { id: 'p3000',  coins: 2500,  bonus: 500,  price: { INR: 2099, AED: 94.99, USD: 24.99 } },
    { id: 'p6500',  coins: 5000,  bonus: 1500, price: { INR: 4299, AED: 189.99, USD: 49.99 } },
    { id: 'p15000', coins: 10000, bonus: 5000, price: { INR: 8499, AED: 379.99, USD: 99.99 }, best: true }
  ];

  /* ---------- Room tags / languages ---------- */
  const ROOM_TAGS = [
    { id: 'chat',     label: 'Chat',        emoji: '💬' },
    { id: 'music',    label: 'Music',       emoji: '🎵' },
    { id: 'singing',  label: 'Singing',     emoji: '🎤' },
    { id: 'comedy',   label: 'Comedy',      emoji: '😂' },
    { id: 'friends',  label: 'Friendship',  emoji: '🤝' },
    { id: 'love',     label: 'Love talk',   emoji: '💞' },
    { id: 'poetry',   label: 'Poetry',      emoji: '📜' },
    { id: 'gaming',   label: 'Gaming',      emoji: '🎮' },
    { id: 'ludo',     label: 'Ludo',        emoji: '🎲' },
    { id: 'cricket',  label: 'Cricket',     emoji: '🏏' },
    { id: 'bollywood',label: 'Bollywood',   emoji: '🎬' },
    { id: 'study',    label: 'Study',       emoji: '📚' },
    { id: 'latenight',label: 'Late night',  emoji: '🌙' },
    { id: 'family',   label: 'Family room', emoji: '🏠' }
  ];
  const LANGUAGES = ['Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Urdu', 'Arabic', 'English', 'Bengali', 'Punjabi', 'Marathi', 'Gujarati'];

  /* ---------- Countries ---------- */
  const COUNTRIES = [
    { code: 'IN', name: 'India',        flag: '🇮🇳' },
    { code: 'AE', name: 'UAE',          flag: '🇦🇪' },
    { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: 'OM', name: 'Oman',         flag: '🇴🇲' },
    { code: 'QA', name: 'Qatar',        flag: '🇶🇦' },
    { code: 'KW', name: 'Kuwait',       flag: '🇰🇼' },
    { code: 'BH', name: 'Bahrain',      flag: '🇧🇭' },
    { code: 'PK', name: 'Pakistan',     flag: '🇵🇰' },
    { code: 'BD', name: 'Bangladesh',   flag: '🇧🇩' },
    { code: 'LK', name: 'Sri Lanka',    flag: '🇱🇰' },
    { code: 'NP', name: 'Nepal',        flag: '🇳🇵' },
    { code: 'MY', name: 'Malaysia',     flag: '🇲🇾' },
    { code: 'SG', name: 'Singapore',    flag: '🇸🇬' },
    { code: 'ID', name: 'Indonesia',    flag: '🇮🇩' },
    { code: 'PH', name: 'Philippines',  flag: '🇵🇭' },
    { code: 'EG', name: 'Egypt',        flag: '🇪🇬' },
    { code: 'TR', name: 'Türkiye',      flag: '🇹🇷' },
    { code: 'GB', name: 'UK',           flag: '🇬🇧' },
    { code: 'US', name: 'USA',          flag: '🇺🇸' },
    { code: 'CA', name: 'Canada',       flag: '🇨🇦' },
    { code: 'AU', name: 'Australia',    flag: '🇦🇺' }
  ];
  function flagOf(code) { const c = COUNTRIES.find(x => x.code === code); return c ? c.flag : '🌍'; }

  /* ---------- Daily tasks ---------- */
  const DAILY_TASKS = [
    { id: 'checkin',  label: 'Daily check-in',          reward: 20,  target: 1 },
    { id: 'gift',     label: 'Send any gift',           reward: 30,  target: 1 },
    { id: 'mic',      label: 'Spend 10 min on a mic',   reward: 50,  target: 10 },
    { id: 'friend',   label: 'Add a new friend',        reward: 40,  target: 1 },
    { id: 'moment',   label: 'Post a Moment',           reward: 30,  target: 1 },
    { id: 'share',    label: 'Share a room',            reward: 20,  target: 1 },
    { id: 'rooms',    label: 'Visit 3 rooms',           reward: 30,  target: 3 }
  ];
  const CHECKIN_REWARDS = [10, 20, 30, 50, 80, 120, 200]; // 7-day streak

  /* ---------- Badges ---------- */
  const BADGES = [
    { id: 'early',    name: 'Early bird',     emoji: '🐣', desc: 'Joined in the first year' },
    { id: 'host10',   name: 'Host',           emoji: '🎙️', desc: 'Hosted 10 rooms' },
    { id: 'gifter',   name: 'Generous',       emoji: '🎁', desc: 'Sent 100 gifts' },
    { id: 'charm',    name: 'Charming',       emoji: '✨', desc: 'Received 10,000 diamonds' },
    { id: 'social',   name: 'Social star',    emoji: '🌟', desc: '100 friends' },
    { id: 'night',    name: 'Night owl',      emoji: '🦉', desc: 'On mic after midnight 7 days' },
    { id: 'family',   name: 'Family first',   emoji: '🏠', desc: 'Member of a family' },
    { id: 'streak',   name: 'On a streak',    emoji: '🔥', desc: '7-day check-in streak' }
  ];

  /* ---------- Games ---------- */
  const WHEEL = {
    cost: 10,
    slices: [
      { label: '0',    coins: 0,   weight: 30 },
      { label: '5',    coins: 5,   weight: 25 },
      { label: '10',   coins: 10,  weight: 20 },
      { label: '20',   coins: 20,  weight: 12 },
      { label: '50',   coins: 50,  weight: 8 },
      { label: '100',  coins: 100, weight: 4 },
      { label: '500',  coins: 500, weight: 1 }
    ]
  };

  const REACTIONS = ['❤️', '😂', '🔥', '👏', '😍', '🎉', '👋', '🙏'];

  const REPORT_REASONS = ['Abusive language', 'Harassment', 'Spam or scam', 'Inappropriate content', 'Underage user', 'Other'];

  return {
    BRAND, GIFTS, GIFT_CATS, GIFT_QTYS, DIAMONDS_PER_COIN, DIAMOND_TO_COIN,
    xpForLevel, levelFromXp, levelTier, LEVEL_PERKS, VIP_TIERS,
    STORE, STORE_TYPES, COIN_PACKS, ROOM_TAGS, LANGUAGES, COUNTRIES, flagOf,
    DAILY_TASKS, CHECKIN_REWARDS, BADGES, WHEEL, REACTIONS, REPORT_REASONS,
    giftById: id => GIFTS.find(g => g.id === id),
    storeById: id => STORE.find(s => s.id === id)
  };
});
