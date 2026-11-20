# Taskbar Hero-style game — Research & Proposal

Ngày: 2026-11-20. Mục tiêu: game hero-idle chơi được qua **slash command** và
như **desktop companion app** (Windows / macOS / Linux), lấy cảm hứng từ
TBH: Task Bar Hero (Steam).

## 1. TBH: Task Bar Hero — nó là gì và bài học

- Idle-RPG pixel, hero tự đánh quái (hack-and-slash auto), loot, nâng cấp,
  trading. **Free-to-play**; loot bán được trên Steam Marketplace (tiền thật).
- Companion sống **trên taskbar Windows** như một dải nhỏ; người chơi để nó
  farm nền. Top most-played Steam ngay tuần đầu (27/5/2026).
- **Engine: Unity** + anti-cheat ACTk (All-In-One Anti-Cheat Toolkit).
- **Drama — bài học bắt buộc:**
  - ACTk detect "unauthorized programs" → **411 false ban** trong đợt đầu
    (ban wave 1/6/2026); game quét hành vi/máy người dùng → nghi spyware;
    crash logs bị质疑 thu thập dữ liệu, không opt-out được.
  - Save import/export (wiki có "Import save") = vector hack chính.
  - **Rút ra cho mình:** app phải minh bạch (không quét máy, không đọc ngoài
    phạm vi game), mọi logic gameplay **server-side authoritative**, không
    tin save client, không dữ liệu thu thập ngoài cần thiết.

## 2. Desktop shell — Tauri 2 vs Electron

| Tiêu chí | Tauri 2.12 | Electron 44 |
|---|---|---|
| Size cài | ~4 MB | ~287 MB |
| Download zip | ~1.7 MB | ~121 MB |
| RAM idle | ~64 MB | ~85 MB |
| Shell | WebView hệ thống | Chromium đóng gói |
| Tray icon | plugin first-party | API sẵn |
| Auto-update signed | plugin first-party | Electron Updater |

→ **Tauri 2** rõ ràng thắng cho companion app nhỏ (game hub đã là HTML/JS —
WebView render y nguyên được). Đổi lại: build cần Rust toolchain + CI matrix
3 OS; macOS cần Apple dev cert ($99/năm) để ký, Windows không ký vẫn chạy
(nhưng SmartScreen cảnh báo lần đầu).

## 3. Vị trí cửa sổ theo OS (điểm rủi ro lớn nhất)

| OS | Kiểu "taskbar companion" khả thi |
|---|---|
| Windows | window borderless dock **phía trên taskbar**, always-on-top, skip-taskbar — làm được đầy đủ |
| macOS | **menu-bar panel** (tray click → popup window) — hình thái chuẩn của OS |
| Linux | **tray/AppIndicator popup**; Wayland **không cho app tự ghim vị trí tuyệt đối** nên không làm "dải trên taskbar" đúng nghĩa được |

→ Thiết kế UX chung: **tray icon + panel window mỏng** là hình dạng duy nhất
chạy giống nhau trên cả 3 OS. "Dải nằm trên taskbar Windows" là bonus
Windows-only.

## 4. Kiến trúc ghép với bot hiện có

```
Discord slash commands          Desktop app (Tauri 2)
 /hero status                    │ login: /hero-link → code 6 số
 /hero fight                     ▼
 /hero upgrade              wss://<tunnel>/hero  (WebSocket, cùng port 3000)
        │                        │ render-only (React/vanilla như hub games)
        ▼                        ▼
              ┌───────────────────────────┐
              │ Bot server (đã có)        │
              │ sqlite: hero state        │  ← authoritative
              │ combat tick server-side   │
              │ Cloudflare tunnel (đã có) │
              └───────────────────────────┘
```

- **State authority**: server tick combat/drop (mỗi 1-2s), sqlite persist.
  App/command chỉ render + gửi intent → chôn sạch vector cheat kiểu TBH.
- **Login không cần password Discord**: `/hero-link` tạo code một-lần,
  app nhập code → server bind token ↔ discordId (device-code flow quen thuộc).
- **Reuse**: tunnel + port + ws routing + nuxt-less HTML client + nút thoát
  hub-exit.js pattern — gần như tất cả hạ tầng đã có.

## 5. Slash command surface (bản nhỏ đủ chơi)

- `/hero` — panel trạng thái (level, HP, gear, gold), embed + ảnh canvas?
- `/hero-fight` — đẩy hero vào zone, tự đánh; kênh nhận tin nhắn loot drop
  (rate-limit).
- `/hero-upgrade <item>` — mua/nâng gear bằng gold.
- `/hero-link` — cấp code ghép desktop app.
- `/hero-leaderboard` — top damage/level guild.

## 6. Roadmap đề xuất

| Phase | Nội dung | Effort |
|---|---|---|
| 1 | Hero engine server (tick, sqlite, combat, loot) + slash commands + web client trong activity hub | chỉ Node — 1-2 phiên làm việc |
| 2 | Tauri shell: tray 3 OS + panel window + login-code flow | Tauri + Rust build CI |
| 3 | Signing + auto-update + Windows dock-above-taskbar bonus | tốn phí/CI |

Phase 1 standalone có giá trị tự thân (chơi bằng slash command ngay trong
Discord). Phase 2 mới cần toolchain mới.

## 7. Rủi ro / câu hỏi mở

- Linux Wayland: không ghim vị trí — chấp nhận tray popup là chuẩn Linux.
- Node `ws` server tick 1s × N players: nhẹ (hexzap đã chạy 20Hz ok).
- Balance/economy design là phần tốn thời gian nhất, không phải kỹ thuật.
- Nếu muốn loot ~ tiền thật kiểu Steam marketplace: **không** — không có
  Steam integration; economy in-game closed (tránh cặp bài pháp lý).
