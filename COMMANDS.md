# Discord Fun Bot - Command Reference

> 📝 This documentation is auto-generated. Last updated: 2026-11-19T04:47:45.924Z

## Table of Contents

- [🎮 Games Commands](#games-commands)
- [🎉 Fun Commands](#fun-commands)

## Command List

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

#### `/doom`

**Description:** Play DOOM!

**Cooldown:** 5 seconds

**Options:**

- `text` *(optional)*: Play text-based Doom in Discord chat
- `embed` *(optional)*: Play DOOM in an embedded activity (requires voice channel)

**Usage:**
```
/doom (text) (embed)
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

#### `/rps`

**Description:** Play Rock Paper Scissors!

**Cooldown:** 5 seconds

**Options:**

- `opponent` *(optional)*: Challenge another user (leave empty to play against bot)

**Usage:**
```
/rps (opponent)
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

## Command Statistics

**Total Commands:** 19

**By Category:**

- 🎮 Games: 14 commands
- 🎉 Fun: 5 commands

## Legend

- `[option]` - Required parameter
- `(option)` - Optional parameter
