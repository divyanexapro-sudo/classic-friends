# Classic Friends — voice rooms & friends

A complete, premium voice-club app in one folder:

| Part | What it is | Where |
|---|---|---|
| **App** | Mobile-first web app (installable PWA): live voice rooms with mic seats, gifts, chat, moments, friends, CP, families, games, levels, VIP, store, wallet, rankings, settings | `app/` |
| **Server** | Node.js realtime server (Express + Socket.IO + WebRTC signalling) that keeps rooms, users, gifts and wallets in sync | `server/` |
| **Shared engine** | All product rules (rooms, seats, gifts, levels, coins…) — used by the server **and** by the in-browser demo mode | `shared/` |
| **Website** | Marketing site: live phone demo, features, gifts, hosts, safety, FAQ, privacy & terms | `website/` |
| **Admin console** | Dashboard, users (ban / coins / VIP), live rooms, reports, gift catalog, banners, broadcast | `admin/` |
| **Docs** | Features, design system, architecture, deployment | `docs/` |
| **Guides (PDF)** | *User Guide* for members, *Admin Console Guide* for your team, *Installation & Hosting Guide* for whoever puts it online | `docs/guides/` |
| **Deployment kit** | `render.yaml` (Render Blueprint), `Dockerfile`, `docker-compose.yml`, plus a one-shot Ubuntu installer, Nginx/Caddy configs, pm2 file, backup and update scripts | `deploy/` + project root |

Everything is plain HTML, CSS and JavaScript. No build tools, no frameworks to learn.

---

## Run it in 3 steps (about 2 minutes)

You need **Node.js 18 or newer** → https://nodejs.org (download the LTS version and install it).

1. Open a terminal (Windows: PowerShell · Mac: Terminal) and go into this folder:
   ```bash
   cd classic-friends
   ```
2. Install the two dependencies (only the first time):
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   You will see:
   ```
   Classic Friends is running 🎤
   App      → http://localhost:3000
   Website  → http://localhost:3000/site/
   Admin    → http://localhost:3000/admin/   (token: classicfriends-admin)
   ```

Open **http://localhost:3000** in Chrome, pick a name and an avatar, and you are in.
Open the same address in a second browser window (or on your phone on the same Wi-Fi, using your computer's IP address, e.g. `http://192.168.1.5:3000`) — take a mic seat in one window and you will hear yourself in the other. That is real voice over WebRTC.

> Microphone access in browsers only works on `localhost` or on **https://**. When you put Classic Friends on the internet, use HTTPS (see `docs/DEPLOYMENT.md`).

---

## No server? Try the demo

* Double-click `app/index.html` — the app runs in **demo mode** inside your browser: 18 lively rooms, 70 simulated people who chat, gift and react, and reply to you. Everything works except hearing other real people.
* `npm run build:demo` creates **`dist/classic-friends-demo.html`** — the entire app in one file. Send it on WhatsApp, upload it to any web host, or open it on your phone to show investors and friends.

---

## Where things are

```
classic-friends/
├── README.md                 ← you are here
├── package.json              ← npm start / npm run build:demo
├── app/                      ← the app (open index.html or serve with the server)
│   ├── index.html
│   ├── css/  tokens.css (colours, type), base.css, components.css, screens.css
│   ├── js/   app.js (router), ui.js (kit), state.js, net/ (server or demo), voice/ (WebRTC), screens/
│   └── assets/  logo.svg, fonts/
├── shared/                   ← product rules used by server + demo
│   ├── catalog.js            ← gifts, levels, VIP, store, coin packs, tags, countries, tasks  ✏️ edit prices here
│   ├── engine.js             ← rooms, seats, chat, gifts, wallet, friends, DMs, moments, families, games, admin
│   ├── bots.js               ← simulated people that keep rooms alive
│   └── avatar.js             ← procedural avatars & room covers
├── server/index.js           ← Express + Socket.IO + admin API (+ server/data/users.json snapshot)
├── website/                  ← standalone marketing site (can be hosted on its own)
├── admin/                    ← admin console (needs the server)
├── scripts/build-demo.js     ← builds dist/classic-friends-demo.html
├── deploy/                   ← setup-ubuntu.sh · ecosystem.config.js (pm2) · nginx-app.conf · nginx-site.conf · Caddyfile · update.sh · backup.sh
├── render.yaml · Dockerfile · docker-compose.yml   ← Render Blueprint and Docker image (must stay at the root)
└── docs/                     ← FEATURES.md · DESIGN-SYSTEM.md · ARCHITECTURE.md · DEPLOYMENT.md
    └── guides/               ← User Guide · Admin Console Guide · Installation & Hosting Guide (PDF + HTML sources, rebuild with build-guides.js)
```

---

## Make it yours

| Want to… | Do this |
|---|---|
| Change the name / tagline | `shared/catalog.js` → `BRAND` (and search-replace "Classic Friends" / "Classic Friends" in `app/`, `website/`, `admin/`) |
| Change the logo | Replace `app/assets/logo.svg` and `website/assets/logo.svg` |
| Change colours | `app/css/tokens.css` (the app) and the `:root` block in `website/css/site.css` |
| Change gift prices, VIP prices, coin packs, currency | `shared/catalog.js` |
| Add / remove room topics, languages, countries | `shared/catalog.js` → `ROOM_TAGS`, `LANGUAGES`, `COUNTRIES` |
| Change starting coins, bot count, admin token | environment variables `START_COINS`, `BOTS`, `ADMIN_TOKEN` (see `.env.example`) |
| Turn bots off for production | `BOTS=0 npm start` |
| Point the app at a server on another domain | `app/js/config.js` → `SERVER_URL` and `MODE: 'live'` |

---

## Admin console

Open http://localhost:3000/admin/ and sign in with the admin token (`classicfriends-admin` by default — change it with the `ADMIN_TOKEN` environment variable before going live). You can watch live rooms, ban users, grant coins, set VIP, act on reports, edit gifts and home banners, and broadcast announcements into every room.

---

## Going live

`docs/DEPLOYMENT.md` walks through putting Classic Friends on the internet with HTTPS (Render / Railway in minutes, or AWS EC2 + Nginx), and the production hooks you will need: phone/Google sign-in, Razorpay/Stripe payments, a database, and swapping the built-in WebRTC mesh for Agora or LiveKit when rooms grow beyond ~8 speakers.

Questions about the code? Each file starts with a short comment describing what it does.
