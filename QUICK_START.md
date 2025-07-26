# Discord Fun Bot - Quick Start Guide 🚀

## Local Development
```bash
# First time setup
git clone <repo>
cd discord-fun-bot
cp .env.example .env
# Edit .env with your Discord token
npm install
npm run dev
```

## Production Deployment (Debian)
```bash
# One-time server setup
./deployment/install-debian.sh

# Deploy bot
sudo cp -r . /opt/discord-bot
sudo chown -R discordbot:discordbot /opt/discord-bot
sudo su - discordbot
cd /opt/discord-bot
./deployment/deploy.sh
```

## Common Commands
```bash
# Check status
pm2 status

# View logs
pm2 logs

# Restart bot
pm2 restart discord-fun-bot

# Update bot
./deployment/update.sh

# Health check
curl localhost:3000/health
```

## Required Config (.env)
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
```

## Bot Invite Link
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your bot's client ID.