# Classic Friends — feature list

Every feature below is implemented and clickable. "Screen" tells you where to find it in the app; "Engine" names the rule in `shared/engine.js`.

## Sign-in & onboarding
| Feature | Screen | Engine |
|---|---|---|
| Name, gender, country, shuffle-able avatar, instant start | Sign in | `login` |
| Session remembered on the device (auto sign-in) | — | — |
| Phone / Google buttons (hook up your provider — see DEPLOYMENT) | Sign in | — |
| 1,000 welcome coins (configurable `START_COINS`) | — | `login` |

## Home & discovery
| Feature | Screen | Engine |
|---|---|---|
| Event banner carousel (editable in admin) | Home | `adminBanners` |
| Tabs: Popular · New · Following · Games | Home | `listRooms` |
| Topic chips (Chat, Music, Singing, Comedy, Friendship, Love talk, Poetry, Gaming, Ludo, Cricket, Bollywood, Study, Late night, Family) | Home | `listRooms` |
| Country filter (21 countries) | Home → flag chip | `listRooms` |
| Room cards: cover, live count, flag, lock, people on mic, host + level, language | Home | — |
| Search rooms and people by name or ID | Search | `listRooms`, `searchUsers` |
| Live refresh when rooms change | Home | event `rooms:changed` |
| Deep links `#/room/<id>` and `/room/<id>` | — | — |

## Live room
| Feature | Screen | Engine |
|---|---|---|
| Host seat + 8 or 12 mic seats, seat numbers, lock icons | Room | `createRoom`, `updateRoom` |
| Take / leave a mic, mute / unmute, speaking rings driven by real mic level | Room | `takeSeat`, `leaveSeat`, `muteSeat`, `speaking` |
| **Real voice** between people on mics (WebRTC, STUN) | Room | signalling `rtc:signal` |
| Free mic mode or apply-to-speak with host approval queue | Room → games button badge / ⋮ → Mic requests | `takeSeat`, `approveMic` |
| Invite a listener to a seat | User card (host/admin) | `inviteToSeat` |
| Host/admin: mute others, remove from mic, lock seats, kick, block, up to 7 admins | User card, seat tap | `muteSeat`, `removeFromSeat`, `lockSeat`, `kickUser`, `setAdmin` |
| Room settings: name, announcement, welcome message, topic, language, theme, seat count, mic mode, password | ⋮ → Room settings | `updateRoom` |
| 6 room themes (Midnight Lounge free; others from the store) | Room settings | — |
| Live chat with level/VIP/host/admin tags, custom chat bubbles, word filter, emoji picker | Room | `sendMessage` |
| "New messages" pill when scrolled up | Room | — |
| Join / leave system lines, announcements, gift lines | Room | — |
| Floating reactions (8 emojis) that also pop on the sender's seat | Room → 😊 | `sendReaction` |
| Follow room, share room (native share / copy link) | Room header | `followRoom`, `shareRoom` |
| Top-gifters chip + list, people list | Room header | — |
| "Now playing" music pill set by host | ⋮ → Set now playing | `setMusic` |
| Entry banners for VIP 3+ and users with entry effects | Room | event `room:member-joined` |
| Level-up banner | Room | event `room:levelup` |
| Minimize room: floating pill while you browse the rest of the app | Everywhere | — |
| Speaker on/off (mute all room audio) | Room | — |
| Report user / room | User card, ⋮ | `reportUser` |
| End room (host) / leave room | ⋮ | `closeRoom`, `leaveRoom` |

## Gifts
| Feature | Screen | Engine |
|---|---|---|
| 29 gifts in 4 shelves (Hot, Lucky, Luxury, VIP-only) | Gift panel | `sendGift` |
| Send to one person, several, or everyone on mic; quantities ×1 ×9 ×66 ×99 ×520 ×999 | Gift panel | `sendGift` |
| Combo counter on repeat sends | Gift panel | — |
| Tier 1: seat pop · Tier 2: fly-in + banner · Tier 3: full-screen + particles · Tier 4: epic (screen flash, haptics) | Room | — |
| Lucky gifts can return coins to the sender | Gift panel | `sendGift` |
| Receiver earns diamonds (0.5 per coin) + Charm; sender earns XP (1 per coin) | — | `sendGift` |
| Room contribution ranking, room total gifts, family XP, CP bond | — | `sendGift` |
| Gifts in private chat | Chat → 🎁 | `sendDm` |
| Not enough coins → recharge prompt | — | — |

## Games
| Feature | Screen | Engine |
|---|---|---|
| Lucky wheel (10 coins a spin, up to 500) with animated wheel | Room → 🎮 | `spinWheel` |
| Dice roll shown to the whole room | Room → 🎮 | `rollDice` |
| Lucky bag: drop coins, everyone grabs a random share | Room → 🎮 | `sendLuckyBag`, `grabLuckyBag` |
| Truth-or-dare cards posted to chat | Room → 🎮 | — |
| PK battle: red (even seats) vs blue (odd seats), timed, gifts count as points | Room → 🎮 (host/admin) | `startPk` |

## Moments (feed)
| Feature | Screen | Engine |
|---|---|---|
| Tabs: Latest · Following · Hot | Moments | `listMoments` |
| Post text with optional colour card + emoji | Moments → + | `postMoment` |
| Like, comment (sheet), share | Moments | `likeMoment`, `commentMoment` |
| Notifications for likes and comments | Notifications | — |

## Chats & notifications
| Feature | Screen | Engine |
|---|---|---|
| Conversation list with unread badges, Classic Friends Team entry, friend-request entry | Chats | `listConversations` |
| 1:1 chat with emoji and gifts; "in a room — tap to join" status | Chat | `sendDm`, `getConversation` |
| Who can message me: everyone / friends only | Settings | `updateProfile` |
| Block & report from chat | Chat → ⋮ | `blockUser`, `reportUser` |
| Notifications: gifts, follows, friend requests (accept inline), CP requests, level-ups, visits, likes, comments, system | Notifications | `listNotifications` |

## Friends & social
| Feature | Screen | Engine |
|---|---|---|
| Friends, Requests, Following, Followers, Suggested tabs | Friends | `friendRequest`, `acceptFriend`, `followUser`, `suggestions` |
| Friend request → accept/decline (bots accept automatically in demo) | Friends, Notifications | — |
| CP (couple / close partner): request, accept, bond grows with gifts, heart shown on seats | Profile → ⋮, Friends | `cpRequest`, `cpAccept`, `cpBreak` |
| Profile pages: badges, stats, family, moments, in-room status, follow / add / message / gift | Profile | `getUser` |
| Visitor trail ("who visited me"), hide visits for VIP 4+ | Me → Visitors | `getUser` |
| Block list | Settings | `blockUser` |

## Families
| Feature | Screen | Engine |
|---|---|---|
| Create a family: name, badge, slogan, colour | Family → + Create | `createFamily` |
| Join / leave, member list, leader tag, level & weekly score | Family | `joinFamily`, `leaveFamily`, `getFamily` |
| Family badge next to names in rooms and lists | Everywhere | — |
| Family ranking | Rankings | `rankings` |

## Economy
| Feature | Screen | Engine |
|---|---|---|
| Wallet: coins & diamonds, 6 coin packs priced in INR/AED/USD, diamond → coin exchange | Wallet | `recharge`, `exchangeDiamonds` |
| Store: 6 avatar frames, 4 chat bubbles, 4 entry effects, 6 room themes, 4 mic waves (30-day items) | Store | `buyItem`, `equipItem` |
| Backpack: owned items, days left, equip/unequip | Backpack | `equipItem` |
| VIP centre: 7 tiers with perks, 30-day activation / extension | VIP | `buyVip` |
| Levels 1–100 with XP curve, badge colours per tier, perks list | My level | `levelFromXp` |
| Daily check-in with 7-day streak rewards | Tasks | `checkIn` |
| Daily tasks with progress and claimable rewards | Tasks | `claimTask` |
| 8 achievement badges | Badges | — |
| Rankings: Wealth · Charm · Rooms · Family — daily / weekly / monthly / all time, podium, my rank | Rankings | `rankings` |

## Settings
Edit profile (name, bio, gender, country, birthday, avatar) · Dark / light theme · Notifications toggle · App language picker · Who can message me · Hide visits · Blocked users · Help (FAQ + support email) · Terms & privacy · About · Log out · Delete account.

## Admin console (`/admin`)
Dashboard (online, live rooms, on mic, gifts & coins today, revenue estimate, open reports, top rooms, top gifters) · Users (search, grant coins, set VIP, ban/unban) · Live rooms (end room, open room) · Reports (dismiss, warned, ban) · Gift catalog (price, enable/disable, add) · Home banners (edit, add, remove) · Broadcast (announcement to every room and user).

## Demo mode (no server)
The exact same engine runs inside the browser with 70 simulated people: rooms stay alive, bots welcome you, thank you for gifts, reply in chat and DMs, accept friend and CP requests, and keep the rankings moving.

## Localisation
All visible strings live in the screen files under `app/js/screens/` and in `shared/catalog.js` (labels). To translate, wrap strings with a `t()` helper and add a dictionary per language — the Settings → App language picker is already in place.
