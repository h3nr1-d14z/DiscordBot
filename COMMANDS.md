# Discord Fun Bot - Command Reference

> 📝 This documentation is auto-generated. Last updated: 2025-07-29T19:46:34.291Z

## Table of Contents

- [🛠️ Utility Commands](#utility-commands)
- [🎵 Music Commands](#music-commands)
- [🎮 Games Commands](#games-commands)
- [🎉 Fun Commands](#fun-commands)
- [💰 Economy Commands](#economy-commands)

## Command List

### 🛠️ Utility Commands

#### `/clickup`

**Description:** Manage your ClickUp integration

**Options:**

- `link` *(optional)*: Link your ClickUp account
- `unlink` *(optional)*: Unlink your ClickUp account
- `status` *(optional)*: Check your ClickUp integration status

**Usage:**
```
/clickup (link) (unlink) (status)
```

---

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

#### `/reminder`

**Description:** Set up daily ClickUp task reminders

**Options:**

- `enable` *(optional)*: Enable daily task reminders
- `disable` *(optional)*: Disable daily task reminders
- `status` *(optional)*: Check your reminder settings

**Usage:**
```
/reminder (enable) (disable) (status)
```

---

#### `/tasks`

**Description:** View your upcoming ClickUp tasks

**Options:**

- `days` *(optional)*: Number of days to look ahead (default: 14)

**Usage:**
```
/tasks (days)
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

#### `/2048`

**Description:** Play the classic 2048 puzzle game with beautiful graphics!

**Options:**

- `solo` *(optional)*: Play 2048 by yourself
- `challenge` *(optional)*: Challenge another player to beat your score!
- `embed` *(optional)*: Play 2048 in an embedded activity (requires voice channel)

**Usage:**
```
/2048 (solo) (challenge) (embed)
```

---

#### `/battleship`

**Description:** Play Battleship against another player!

**Options:**

- `opponent` *(required)*: The player to challenge

**Usage:**
```
/battleship [opponent]
```

---

#### `/bingo`

**Description:** Start a Bingo game!

**Options:**

- `pattern` *(optional)*: Win pattern
  - Choices: `Line (row/column/diagonal)`, `Full House (all numbers)`, `Four Corners`, `X Pattern`, `Plus Pattern`

**Usage:**
```
/bingo (pattern)
```

---

#### `/blackjack`

**Description:** Play Blackjack against the dealer!

**Usage:**
```
/blackjack
```

---

#### `/chess`

**Description:** Play Chess against another player!

**Options:**

- `opponent` *(required)*: The player to challenge

**Usage:**
```
/chess [opponent]
```

---

#### `/connect4`

**Description:** Play Connect Four

**Cooldown:** 10 seconds

**Options:**

- `opponent` *(optional)*: User to play against (leave empty to play against bot)

**Usage:**
```
/connect4 (opponent)
```

---

#### `/dice`

**Description:** Roll the dice and bet on the outcome! 🎲

**Usage:**
```
/dice
```

---

#### `/hangman`

**Description:** Play Hangman - guess the word letter by letter!

**Options:**

- `solo` *(optional)*: Play Hangman by yourself
- `challenge` *(optional)*: Challenge someone with your own word!

**Usage:**
```
/hangman (solo) (challenge)
```

---

#### `/memory`

**Description:** Play Memory Match - find all the matching pairs!

**Options:**

- `difficulty` *(optional)*: Choose difficulty level
  - Choices: `Easy (3x4)`, `Medium (4x4)`, `Hard (4x5)`

**Usage:**
```
/memory (difficulty)
```

---

#### `/poker`

**Description:** Start a Texas Hold'em poker game! (2-8 players)

**Usage:**
```
/poker
```

---

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

#### `/slots`

**Description:** Play the slot machine! 🎰

**Options:**

- `bet` *(optional)*: Amount to bet (10-100 credits)

**Usage:**
```
/slots (bet)
```

---

#### `/snake`

**Description:** Play the classic Snake game!

**Options:**

- `play` *(optional)*: Play Snake in Discord chat
- `embed` *(optional)*: Play Snake in an embedded activity (requires voice channel)

**Usage:**
```
/snake (play) (embed)
```

---

#### `/sudoku`

**Description:** Play Sudoku puzzle game!

**Options:**

- `difficulty` *(optional)*: Choose difficulty level
  - Choices: `Easy`, `Medium`, `Hard`

**Usage:**
```
/sudoku (difficulty)
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

#### `/uno`

**Description:** Start a game of UNO! (2-8 players)

**Usage:**
```
/uno
```

---

#### `/wordchain`

**Description:** Play Word Chain - each word must start with the last letter of the previous word!

**Options:**

- `player2` *(required)*: Second player
- `player3` *(optional)*: Third player (optional)
- `player4` *(optional)*: Fourth player (optional)
- `timelimit` *(optional)*: Time limit per turn in seconds (default: 30)

**Usage:**
```
/wordchain [player2] (player3) (player4) (timelimit)
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

#### `/activity`

**Description:** Start a Discord Activity in your voice channel!

**Options:**

- `type` *(required)*: The activity to start
  - Choices: `♠️ Poker Night`, `🎣 Fishing`, `♟️ Chess`, `🏁 Checkers`, `📝 Letter League`, `🍔 Word Snacks`, `🎨 Sketch Heads`, `⚡ SpellCast`, `⛳ Putt Party`, `🏝️ Land-io`, `⚽ Bobble League`, `❓ Ask Away`, `😂 Know What I Meme`, `💥 Bash Out`, `☎️ Gartic Phone`, `📺 Watch Together`, `✏️ Whiteboard`, `🃏 Blazing 8s`

**Usage:**
```
/activity [type]
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

#### `/meme`

**Description:** Generate a meme with custom text (supports Vietnamese!)

**Options:**

- `template` *(optional)*: Create a meme using popular templates
- `custom` *(optional)*: Create a meme with your own image

**Usage:**
```
/meme (template) (custom)
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

**Total Commands:** 40

**By Category:**

- 🛠️ Utility: 5 commands
- 🎵 Music: 10 commands
- 🎮 Games: 18 commands
- 🎉 Fun: 5 commands
- 💰 Economy: 2 commands

## Legend

- `[option]` - Required parameter
- `(option)` - Optional parameter
