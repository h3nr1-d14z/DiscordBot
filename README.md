# Discord Fun Bot

A feature-rich Discord bot with games, fun commands, and interactive features.

## Features

- 🎮 **Games**: 2048, Word Chain, Hangman, Memory Match, Tic-Tac-Toe, Connect Four, DOOM, and more
- 🎉 **Fun Commands**: 8ball, jokes, memes, ASCII art
- 📊 **Leveling System**: XP and levels based on activity

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Discord Bot Token

### Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your bot token
3. Install dependencies:
   ```bash
   npm install
   ```

### Development

```bash
npm run dev
```

### Command Management

```bash
# Register commands to development server
npm run register

# Register commands globally
npm run register:global

# Clear commands
npm run clear-commands

# See more options
npm run register -- --help
```

See [Command Management Guide](docs/COMMAND_MANAGEMENT.md) for detailed information.

### Production

#### Using PM2:
```bash
npm run build
npm run deploy
```

#### Using Docker:
```bash
docker-compose up -d
```

## Configuration

Edit `.env` file:
- `DISCORD_TOKEN`: Your bot token from Discord Developer Portal
- `CLIENT_ID`: Your application's client ID
- `GUILD_ID`: Your test server ID (optional, for development)

## Commands

### Games
- `/tictactoe` - Play Tic-Tac-Toe against bot or another player
- `/connect4` - Strategic board game
- `/doom` - Text-based DOOM dungeon crawler
- `/2048` - Classic 2048 puzzle game with solo and challenge modes
- `/wordchain` - Multiplayer word chain game (2-4 players)
- `/hangman` - Guess the word with solo and challenge modes
- `/memory` - Memory match card game with different difficulties
- `/rps` - Rock Paper Scissors

### Fun
- `/8ball` - Ask the magic 8-ball
- `/joke` - Get a random joke
- `/roll` - Roll dice with D&D notation
- `/meme` - Get a random meme (coming soon)

## Deployment with Cloudflare Tunnel

1. Install cloudflared on your server
2. Create a tunnel: `cloudflared tunnel create discord-bot`
3. Add tunnel token to `.env`
4. Run with docker-compose

## License

MIT License - feel free to use this bot for your own server!

## Links

- [Deployment Guide](deployment/DEPLOYMENT_GUIDE.md)
- [Technical Documentation](TECHNICAL_DOCS.md)
- [Feature Specifications](FEATURES_SPEC.md)
- [DOOM on Discord](DOOM_ON_DISCORD.md) - How DOOM works on Discord

