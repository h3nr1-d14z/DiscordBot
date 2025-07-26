# Discord Fun Bot - Command Reference

> 📝 This documentation is auto-generated. Last updated: 2025-07-26T09:58:32.760Z

## Table of Contents

- [🛠️ Utility Commands](#utility-commands)
- [🎵 Music Commands](#music-commands)
- [🎮 Games Commands](#games-commands)
- [🎉 Fun Commands](#fun-commands)
- [💰 Economy Commands](#economy-commands)

## Command List

### 🛠️ Utility Commands

#### `/help`

**Description:** Show all available commands

**Cooldown:** 5 seconds

**Options:**

- `command` *(optional)*: Get detailed help for a specific command

**Usage:**
```
/help (command)
```

---

#### `/ping`

**Description:** Replies with Pong and bot latency!

**Cooldown:** 5 seconds

**Usage:**
```
/ping
```

---

### 🎵 Music Commands

#### `/loop`

**Description:** Set the loop mode

**Cooldown:** 3 seconds

**Options:**

- `mode` *(required)*: Loop mode
  - Choices: `Off`, `Track`, `Queue`

**Usage:**
```
/loop [mode]
```

---

#### `/nowplaying`

**Description:** Show the currently playing song

**Cooldown:** 5 seconds

**Usage:**
```
/nowplaying
```

---

#### `/pause`

**Description:** Pause the current song

**Cooldown:** 3 seconds

**Usage:**
```
/pause
```

---

#### `/play`

**Description:** Play a song from YouTube (search query or URL)

**Cooldown:** 3 seconds

**Options:**

- `query` *(required)*: Song name to search or YouTube URL

**Usage:**
```
/play [query]
```

---

#### `/queue`

**Description:** Show the music queue

**Cooldown:** 5 seconds

**Usage:**
```
/queue
```

---

#### `/resume`

**Description:** Resume the paused song

**Cooldown:** 3 seconds

**Usage:**
```
/resume
```

---

#### `/shuffle`

**Description:** Shuffle the music queue

**Cooldown:** 5 seconds

**Usage:**
```
/shuffle
```

---

#### `/skip`

**Description:** Skip the current song

**Cooldown:** 3 seconds

**Usage:**
```
/skip
```

---

#### `/stop`

**Description:** Stop the music and clear the queue

**Cooldown:** 3 seconds

**Usage:**
```
/stop
```

---

#### `/volume`

**Description:** Adjust the music volume

**Cooldown:** 3 seconds

**Options:**

- `level` *(required)*: Volume level (0-100)

**Usage:**
```
/volume [level]
```

---

### 🎮 Games Commands

#### `/rps`

**Description:** Play Rock Paper Scissors!

**Cooldown:** 5 seconds

**Options:**

- `opponent` *(optional)*: Challenge another user (leave empty to play against bot)
- `bet` *(optional)*: Bet coins on the game (max 100)

**Usage:**
```
/rps (opponent) (bet)
```

---

#### `/tictactoe`

**Description:** Play Tic-Tac-Toe

**Cooldown:** 10 seconds

**Options:**

- `opponent` *(optional)*: User to play against (leave empty to play against bot)

**Usage:**
```
/tictactoe (opponent)
```

---

#### `/trivia`

**Description:** Play a trivia game!

**Cooldown:** 10 seconds

**Options:**

- `category` *(optional)*: Choose a trivia category
  - Choices: `General Knowledge`, `Books`, `Film`, `Music`, `Video Games`, `Science & Nature`, `Computers`, `Sports`, `Geography`, `History`, `Animals`, `Anime & Manga`
- `difficulty` *(optional)*: Choose difficulty level
  - Choices: `Easy`, `Medium`, `Hard`

**Usage:**
```
/trivia (category) (difficulty)
```

---

### 🎉 Fun Commands

#### `/8ball`

**Description:** Ask the magic 8-ball a question

**Cooldown:** 3 seconds

**Options:**

- `question` *(required)*: Your question for the 8-ball

**Usage:**
```
/8ball [question]
```

---

#### `/joke`

**Description:** Get a random joke

**Cooldown:** 5 seconds

**Options:**

- `category` *(optional)*: Joke category
  - Choices: `Any`, `Programming`, `Miscellaneous`, `Pun`, `Spooky`, `Christmas`

**Usage:**
```
/joke (category)
```

---

#### `/roll`

**Description:** Roll dice with various formats

**Cooldown:** 2 seconds

**Options:**

- `dice` *(optional)*: Dice to roll (e.g., d20, 2d6, 3d6+2)

**Usage:**
```
/roll (dice)
```

---

### 💰 Economy Commands

#### `/balance`

**Description:** Check your or another user's balance

**Cooldown:** 3 seconds

**Options:**

- `user` *(optional)*: User to check balance for

**Usage:**
```
/balance (user)
```

---

#### `/daily`

**Description:** Claim your daily reward!

**Cooldown:** 5 seconds

**Usage:**
```
/daily
```

---

## Command Statistics

**Total Commands:** 20

**By Category:**

- 🛠️ Utility: 2 commands
- 🎵 Music: 10 commands
- 🎮 Games: 3 commands
- 🎉 Fun: 3 commands
- 💰 Economy: 2 commands

## Legend

- `[option]` - Required parameter
- `(option)` - Optional parameter
