# HexZap Game Hub Bot — Project Summary

## 🎯 What this is

A Discord **game bot**. No music, no economy, no moderation bells — the whole
point is: open an **embedded activity** in a voice channel, land in the
**Game Hub**, and play.

## 🎮 The Hub (activity at `/`)

| Game | Type | Notes |
|---|---|---|
| HexZap ⚡ | multiplayer 2-8 | blind laser duel on a collapsing hex floor; own ws server (`/hexzap` upgrade, same port) |
| DOOM 🔫 | single | original Chocolate-Doom WASM + shareware WAD (see `public/games/doom/NOTICE.txt`) |
| Snake 🐍 | single | canvas arcade |
| 2048 🔢 | single | puzzle |
| Tic-Tac-Toe ❌ | vs AI | minimax |
| Memory 🧠 | single | 3D card flips |
| Hangman 🪢 | single | progressive SVG |

## 🧱 Architecture

```
src/
├── commands/fun/     # 5 slash commands: 8ball, activity, joke, meme, roll
├── events/           # Discord gateway events
├── handlers/         # command/event loaders (resolve via __dirname: tsx dev -> src, node prod -> dist)
├── services/
│   ├── hexzapServer.ts           # ws room server, authoritative 20 Hz sim
│   ├── embeddedAppServerFixed.ts # express + static /games/* + ws attach (port 3000)
│   ├── database.ts, healthCheck.ts, reminderService.ts
├── utils/            # logger, docs generator
public/games/         # every game is a self-contained folder + index.html
```

- **One port**: express + WebSocket share port 3000; Cloudflare tunnel (host-side,
  dashboard-managed) fronts it as `https://discord.h3nr1-d14z.io.vn`.
- **Command sync**: `AUTO_REGISTER=true` (set in docker-compose) → every boot
  bulk-overwrites global commands, so removed commands disappear from Discord
  automatically.
- **Deployment**: `docker compose up -d --build` (see `docker-compose.yml`).
  `data/` and `logs/` mounts need `chown 1001:1001` once.

## 📜 Command list

Auto-generated in `COMMANDS.md` — 5 fun commands, no games (games live in the hub).
