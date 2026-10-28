# Putting Classic Friends on the internet

> The step-by-step version of this page, with screenshots of every provider screen, is **`docs/guides/Classic-Friends-Installation-Hosting-Guide.pdf`**.

Microphones only work over **HTTPS** (or on localhost), so every option below ends with an https:// address.

## Ready-made deployment files

| File | Use |
|---|---|
| `render.yaml` | Render **Blueprint** — one web service, health check, persistent 1 GB disk, random `ADMIN_TOKEN` |
| `Dockerfile`, `docker-compose.yml` | Any Docker host (Railway, Fly.io, Cloud Run, a VPS with Docker) |
| `deploy/setup-ubuntu.sh` | One-shot Ubuntu installer: Node 20, pm2, Nginx, ufw, Let's Encrypt |
| `deploy/ecosystem.config.js` | pm2 process file (reads `.env`) |
| `deploy/nginx-app.conf`, `deploy/nginx-site.conf` | Nginx templates for the app (WebSocket-aware) and the static website |
| `deploy/Caddyfile` | Caddy alternative (automatic HTTPS, no certbot) |
| `deploy/update.sh`, `deploy/backup.sh` | Upgrade in place · timestamped copies of `server/data/users.json` |

## Option A — Render (easiest, ~30 minutes, free tier to test)

1. Put the folder in a GitHub repository (upload via the web UI or GitHub Desktop; skip `node_modules`).
2. On https://render.com choose **New → Blueprint**, pick the repository. Render reads `render.yaml`: build `npm install`, start `npm start`, health check `/healthz`, a 1 GB disk at `server/data`, `BOTS=10`, `START_COINS=200` and a generated `ADMIN_TOKEN` (read it under *Environment*).
3. Deploy. You get `https://<name>.onrender.com` with HTTPS already configured — app at `/`, admin at `/admin/`, website at `/site/`.
4. **Settings → Custom Domains** → add `app.yourdomain.com` and create the CNAME Render shows. For the website on the bare domain create a **Static Site** from the same repo with publish directory `website`.

The free plan sleeps when idle and has no disk (member data resets); use **Starter** for a real launch. Railway / Fly.io / Cloud Run detect the `Dockerfile` automatically — set the same three variables and mount a volume at `/app/server/data`.

## Option B — Your own Ubuntu server (DigitalOcean, Hetzner, Lightsail, Hostinger VPS…)

Create an Ubuntu 22.04/24.04 server (2 GB RAM), point `app.yourdomain.com` and `yourdomain.com` A records at its IP, copy the folder to `/opt/classic-friends` (`scp -r classic-friends root@IP:/opt/classic-friends`, FileZilla or `git clone`), then:

```bash
bash /opt/classic-friends/deploy/setup-ubuntu.sh app.yourdomain.com yourdomain.com you@email.com
```

The script installs Node 20, pm2 and Nginx, runs `npm install`, writes `.env` with a random `ADMIN_TOKEN` (printed at the end — save it), starts the app under pm2 (auto-start on boot), installs the two Nginx sites, opens only ports 22/80/443 and requests Let's Encrypt certificates with http→https redirect. If DNS has not propagated yet, re-run the last step later: `certbot --nginx -d app.yourdomain.com -d yourdomain.com -d www.yourdomain.com`.

Day-to-day: `pm2 status` · `pm2 logs classic-friends` · `pm2 restart classic-friends --update-env` after editing `.env` · `deploy/update.sh` after uploading a new version · `deploy/backup.sh` daily from cron (`0 3 * * * /opt/classic-friends/deploy/backup.sh`).

## Option C — Website on a static host, app + server elsewhere

`website/` is self-contained: drop it on Netlify, Vercel, GitHub Pages, S3 or any shared hosting. Uncomment the `window.CF_APP_URL = "https://app.yourdomain.com"` line in `website/index.html` so the "Open the app" buttons point at your app domain.

The single-file demo `dist/classic-friends-demo.html` (`npm run build:demo`) can also be hosted anywhere static — handy for investor and partner previews.

## Environment variables

| Name | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `ADMIN_TOKEN` | `classicfriends-admin` | Admin console / API token — **change it** |
| `BOTS` | `70` | Simulated people (0 = none) |
| `START_COINS` | `1000` | Coins for a new account |

Copy `.env.example` to `.env` next to `package.json` — the server reads it at start-up (no extra tooling) — or set the values in your host's dashboard. `deploy/setup-ubuntu.sh` creates `.env` for you.

## Production checklist

| Area | What to do | Where |
|---|---|---|
| **Sign-in** | Replace guest sign-in with phone OTP (MSG91 / Twilio Verify) or Google / Apple sign-in (Firebase Auth is the quickest). After the provider confirms the user, call `engine.login({ id: providerUserId, name, … })` on the server and never trust a client-supplied `id`. | `server/index.js` → `socket.on('auth')`, `app/js/screens/auth.js` |
| **Payments** | Coin packs: Razorpay (India), Stripe / Tap / Telr (UAE), Google Play Billing / Apple IAP in store builds. The gateway's **webhook** must call `engine.recharge(userId, { packId })`; remove the client-side `recharge` action from the `ACTIONS` list. Prices and currency are in `shared/catalog.js`. | `shared/catalog.js`, `server/index.js` |
| **Host payouts** | Diamonds → money: add a payout request table, KYC, minimum threshold and a monthly settlement job. Rate is `DIAMOND_TO_COIN` in the catalog. | engine `exchangeDiamonds` |
| **Database** | Persist users, rooms, DMs, moments, families, reports (PostgreSQL / MongoDB). | see ARCHITECTURE.md |
| **Voice at scale** | Swap the WebRTC mesh for Agora or LiveKit when rooms exceed ~8 speakers or ~30 listeners; add a TURN server (coturn / Twilio) for strict corporate and mobile networks even before that. | `app/js/voice/webrtc.js`, `config.js` → `STUN` |
| **Moderation** | Extend the word list, add image moderation if you allow photos, keep the report queue staffed, add age gate (18+) at sign-up. | `shared/engine.js` `BANNED_WORDS`, admin → Reports |
| **Legal** | Have `website/privacy.html` and `website/terms.html` reviewed; add refund policy for coins; register for applicable taxes (GST / VAT). | `website/` |
| **App stores** | The PWA is installable today. For store listings wrap it with **Capacitor** (iOS + Android) or a Trusted Web Activity (Android). Push notifications: Firebase Cloud Messaging. | — |
| **Monitoring** | `/healthz` endpoint for uptime checks; log to a service (Logtail, CloudWatch); pm2 restarts on crash. | `server/index.js` |
| **Backups** | Snapshot the database daily; keep `ADMIN_TOKEN` and payment keys in a secrets manager. | — |

## Local network testing on a phone

Run `npm start`, find your computer's IP (`ipconfig` / `ifconfig`), open `http://<ip>:3000` on the phone. Chrome on Android will block the microphone on plain http — use `ngrok http 3000` (or Cloudflare Tunnel) to get a temporary https:// address for mic testing.
