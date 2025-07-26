# Discord Fun Bot 🎮

A feature-rich Discord bot packed with games, fun commands, economy system, and more!

## ✨ Features

- **🎵 Music Player**: Play YouTube music with queue, volume control, loop modes
- **🎮 Games**: Tic-Tac-Toe, Rock Paper Scissors, Trivia, Number Guessing, and more
- **🎉 Fun Commands**: 8ball, Jokes, Memes, Dice Roll, Fortune Cookie
- **💰 Economy System**: Virtual currency, daily rewards, leaderboard
- **📊 Leveling System**: XP-based progression with rewards
- **🛠️ Utility Commands**: User info, server stats, help system
- **📝 Auto Documentation**: Command docs regenerate automatically when you add new commands

## 🚀 Quick Start

### Local Development

```bash
# Clone repository
git clone https://github.com/yourusername/discord-fun-bot.git
cd discord-fun-bot

# Setup
./setup.sh

# Configure
cp .env.example .env
# Edit .env with your Discord bot token

# Register commands
npm run register

# Run
npm run dev
```

### Production Deployment (Debian Linux)

```bash
# Quick deploy
./deployment/install-debian.sh
sudo su - discordbot
cd /opt/discord-bot
./deployment/deploy.sh
```

📚 **Full deployment guide**: [deployment/DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md)

## 📋 Commands

See [COMMANDS.md](COMMANDS.md) for a complete, auto-generated list of all available commands.

**Popular Commands:**
| Command | Description | Category |
|---------|-------------|----------|
| `/play` | Play a song from YouTube | Music |
| `/skip` | Skip the current song | Music |
| `/queue` | Show the music queue | Music |
| `/help` | Show all commands | Utility |
| `/ping` | Check bot latency | Utility |
| `/tictactoe` | Play Tic-Tac-Toe | Games |
| `/8ball` | Ask the magic 8-ball | Fun |
| `/joke` | Get a random joke | Fun |
| `/roll` | Roll dice (D&D notation) | Fun |

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Discord.js v14
- **Database**: SQLite
- **Process Manager**: PM2
- **Deployment**: Docker + Cloudflare Tunnel

## 📁 Project Structure

```
discord-bot/
├── src/              # Source code
├── docs/             # Documentation
├── deployment/       # Deployment scripts
├── docker/           # Docker configs
└── package.json      # Dependencies
```

## 🔧 Configuration

Create `.env` file:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
GUILD_ID=test_guild_id  # Optional
DATABASE_PATH=./data/bot.db
ENABLE_ECONOMY=true
ENABLE_LEVELING=true
```

## 🐳 Docker Support

```bash
# Using Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f bot
```

## 📈 Future Plans

See [docs/ROADMAP.md](docs/ROADMAP.md) for upcoming features and development plans.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - feel free to use this bot for your own server!

## 🔗 Links

- [Command Reference](COMMANDS.md) - Auto-generated command list
- [Cloudflare Tunnel Setup](CLOUDFLARE_TUNNEL.md) - Secure webhook configuration
- [Deployment Guide](deployment/DEPLOYMENT_GUIDE.md)
- [Technical Documentation](docs/TECHNICAL_DOCS.md)
- [Feature Specifications](docs/FEATURES_SPEC.md)
- [Roadmap](docs/ROADMAP.md)

---

Made with ❤️ for Discord communities