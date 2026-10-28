# Classic Friends architecture

```
            ┌──────────────────────────────┐      ┌──────────────────────────┐
  phones ──▶│  app/  (PWA, vanilla JS)      │◀────▶│ server/index.js          │
            │  screens · RoomCtl · Voice    │ WS   │ Express + Socket.IO       │
            │  net/socket-client.js         │      │ ACTIONS whitelist         │
            │  net/mock-client.js (demo)    │      │ admin REST  /api/admin/*  │
            └──────────────┬───────────────┘      └──────────┬───────────────┘
                           │  same code                        │
                           ▼                                   ▼
                    ┌──────────────────────────────────────────────┐
                    │ shared/engine.js  — every product rule        │
                    │ shared/catalog.js — gifts, levels, prices …   │
                    │ shared/bots.js    — simulated people          │
                    │ shared/avatar.js  — procedural avatars        │
                    └──────────────────────────────────────────────┘
```

## One engine, two transports

`shared/engine.js` is a plain JavaScript class with **no network code**. Every product action is a method:

```js
engine.sendGift(userId, { giftId: 'rose', to: [targetId], qty: 9 })
// → { ok: true, coins: 991, luckyWin: 0, event: {...} }   or   { ok: false, error: 'Not enough coins' }
```

and every change is announced through `engine.on(ev => …)` with a **scope**:

```js
{ type: 'room:gift', payload: {...}, scope: { room: '123' } }     // everyone in room 123
{ type: 'user:update', payload: {...}, scope: { user: '42' } }    // just user 42
{ type: 'dm:message', payload: {...}, scope: { users: ['42','7'] } }
{ type: 'rooms:changed', payload: {...}, scope: { all: true } }
```

* **Server** (`server/index.js`): a Socket.IO client sends `act { name, params }`; the server checks the name against the `ACTIONS` whitelist, calls `engine[name](userId, params)` and acks the result. Engine events are routed by scope to Socket.IO rooms (`room:<id>`, `user:<id>`).
* **Demo** (`app/js/net/mock-client.js`): the same engine is instantiated in the browser; events are filtered by scope for the local user and delivered on a timer to mimic the network. The bot director keeps it alive.

Because the two transports expose the same API (`connect`, `act`, `on`, `signal`), **screens never know which one they are talking to.**

## Client structure (`app/js`)

| File | Role |
|---|---|
| `app.js` | boot (splash → stored session → connect), hash router, bottom nav, global event handlers |
| `state.js` | tiny observable store `S` + safe storage `LS` |
| `ui.js` | icons, avatars, badges, sheets, modals, toasts, formatting |
| `screens/auth.js` | sign in |
| `screens/home.js` | discovery, create-room sheet, country picker, search |
| `screens/room.js` | `RoomCtl` (room state that survives minimise; voice; sheets: user card, gifts, games, settings, members…) and `Screens.room` (the view + effects) |
| `screens/social.js` | moments, chats, chat, friends, notifications |
| `screens/profile.js` | me, other profiles, edit profile, settings, level, badges, visitors, block list, help, about |
| `screens/economy.js` | store, wallet, VIP, backpack, tasks, rankings, families |
| `voice/webrtc.js` | microphone, level meter, WebRTC mesh |

Routing is hash-based (`#/room/123`, `#/profile/42`, `#/chat/42`, `#/friends?tab=requests` …). Each screen is `{ nav, render(root, route) → cleanup }`.

## Voice

Rule: **whoever sits on a mic opens a one-way audio connection to every other person in the room.** Listeners never initiate. Offers/answers/ICE travel through `rtc:signal` on the server; STUN servers are listed in `app/js/config.js`.

Cost: with S speakers and N people in the room there are S × (N − 1) connections. Comfortable up to roughly 8 speakers × 30 listeners on normal phones and networks. Beyond that, keep the whole product and swap only `voice/webrtc.js` for an SFU:

* **Agora** — `agora-rtc-sdk-ng`: join channel = room id, `publish(microphoneTrack)` when seated, `unpublish` when leaving the seat; use `client.on('volume-indicator')` to drive the speaking rings (`RoomCtl.view.setSpeaking`). Tokens are minted on the server.
* **LiveKit** (open source, self-host or cloud) — same shape: room = room id, `localParticipant.setMicrophoneEnabled(true/false)`, `ActiveSpeakersChanged` for rings.

Everything else — seats, mute state, gifts, chat — already lives in the engine and stays unchanged.

## Data & scaling

Today the engine keeps state in memory; real users are snapshotted to `server/data/users.json` every 30 s so coins and levels survive restarts. For production:

1. Put a database behind the engine — the natural seams are the `users`, `rooms`, `moments`, `dms`, `families`, `reports` maps. PostgreSQL (Supabase / RDS) or MongoDB both fit; write-through on each mutating action.
2. Run several server instances behind a load balancer with the Socket.IO Redis adapter (`@socket.io/redis-adapter`) so events reach every instance.
3. Move purchases to a payment webhook: the gateway calls your server, the server calls `engine.recharge` (never the client).
4. Rate-limit `act` per socket (e.g. 20/s) and size-limit messages (already capped at 300 chars).

## Security notes

* The server only executes whitelisted action names and strips client-supplied privilege flags (`approved`, `admin`).
* All text is cleaned, length-capped and run through the word filter in the engine; the client escapes everything it renders.
* Admin API needs the `x-admin-token` header (`ADMIN_TOKEN` env). Put the admin console behind HTTPS and a VPN/IP allow-list in production.
* Add real authentication (OTP / Google) before launch — today a device can claim any name; the stored `id` is what identifies the account.

## Events reference (engine → clients)

`rooms:changed` · `room:state` · `room:member-joined` · `room:member-left` · `room:member-updated` · `room:seats` · `room:message` · `room:gift` · `room:contributions` · `room:reaction` · `room:speaking` · `room:updated` · `room:music` · `room:pk` · `room:applicants` · `room:levelup` · `room:luckybag` · `room:luckybag-grab` · `room:dice` · `room:force-mute` · `room:seat-removed` · `room:seat-invite` · `room:kicked` · `room:closed` · `user:update` · `user:notification` · `user:banned` · `dm:message` · `friend:request` · `friend:accepted` · `cp:request` · `moments:new` · `moments:comment` · `rtc:signal`
