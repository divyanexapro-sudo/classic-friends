/* Classic Friends app config — edit these to rebrand or point at your server */
window.CF_CONFIG = {
  // 'auto'  → use the realtime server when the page is served by it, otherwise run the in-browser demo
  // 'live'  → always connect to SERVER_URL
  // 'demo'  → always run the in-browser demo (no server needed)
  MODE: 'auto',
  SERVER_URL: '',            // '' = same origin as the page, or e.g. 'https://classicfriends.example.com'
  DEMO_BOTS: 70,             // how many bots keep demo rooms alive
  STUN: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
  VERSION: '1.0.0'
};
