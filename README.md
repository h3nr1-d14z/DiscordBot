# Discord Fun Bot

A feature-rich Discord bot with games, fun commands, and interactive features.

## Features

- 🎮 **Games**: Tic-Tac-Toe, Connect Four, DOOM (text-based), Trivia, and more
- 🎉 **Fun Commands**: 8ball, jokes, memes, ASCII art
- 💰 **Economy System**: Virtual currency, daily rewards, shop
- 📊 **Leveling System**: XP and levels based on activity
- 🎁 **Interactive**: Polls, giveaways, and more

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

### Utility
- `/ping` - Check bot latency
- `/help` - Show all commands
- `/userinfo` - Display user information
- `/serverinfo` - Display server information

### Games
- `/tictactoe` - Play Tic-Tac-Toe against bot or another player
- `/connect4` - Strategic board game
- `/doom` - Text-based DOOM dungeon crawler
- `/trivia` - Play trivia quiz (coming soon)
- `/rps` - Rock Paper Scissors (coming soon)

### Fun
- `/8ball` - Ask the magic 8-ball
- `/joke` - Get a random joke
- `/roll` - Roll dice with D&D notation
- `/meme` - Get a random meme (coming soon)

### Economy
- `/balance` - Check your balance
- `/daily` - Claim daily reward
- `/pay` - Transfer coins to another user

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

