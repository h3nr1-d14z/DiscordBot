# Discord Fun Bot - Deployment Guide for Debian Linux

## Prerequisites

- Debian 11 or 12 (64-bit)
- Minimum 2GB RAM
- 10GB free disk space
- A domain name (for Cloudflare tunnel)
- Discord Bot Token from [Discord Developer Portal](https://discord.com/developers/applications)

## Quick Deployment

### 1. Initial Server Setup

```bash
# As your regular user (not root)
git clone https://github.com/yourusername/discord-bot.git
cd discord-bot
./deployment/install-debian.sh
```

This script will:
- Install Node.js 18, PM2, and system dependencies
- Create a `discordbot` user
- Setup firewall rules
- Optionally install Docker

### 2. Deploy the Bot

```bash
# Switch to bot user
sudo su - discordbot

# Copy bot files
sudo cp -r /path/to/discord-bot /opt/discord-bot
cd /opt/discord-bot

# Configure the bot
cp .env.example .env
nano .env  # Add your Discord token and configuration

# Deploy
./deployment/deploy.sh
```

### 3. Setup Cloudflare Tunnel (Optional)

```bash
./deployment/setup-cloudflare.sh
```

Follow the prompts to:
- Authenticate with Cloudflare
- Create a tunnel
- Configure DNS records

## Manual Deployment Steps

### 1. Install Dependencies

```bash
# System packages
sudo apt update
sudo apt install -y nodejs npm git sqlite3

# PM2 for process management
sudo npm install -g pm2
```

### 2. Setup Bot

```bash
# Clone and setup
cd /opt
sudo git clone https://github.com/yourusername/discord-bot.git
cd discord-bot

# Install Node modules
npm install

# Build TypeScript
npm run build

# Configure
cp .env.example .env
# Edit .env with your settings
```

### 3. Run with PM2

```bash
# Start bot
pm2 start ecosystem.config.js

# Auto-start on boot
pm2 startup
pm2 save
```

## Docker Deployment

### 1. Using Docker Compose

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f bot
```

### 2. Using Plain Docker

```bash
# Build image
docker build -t discord-fun-bot .

# Run container
docker run -d \
  --name discord-bot \
  --restart unless-stopped \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  discord-fun-bot
```

## Configuration

### Environment Variables

```env
# Required
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id

# Optional
GUILD_ID=test_guild_id  # For development
DATABASE_PATH=./data/bot.db
ENABLE_ECONOMY=true
ENABLE_LEVELING=true
NODE_ENV=production
LOG_LEVEL=info
```

### Database

SQLite database is created automatically at first run:
- Location: `./data/bot.db`
- Backup: `cp data/bot.db data/bot.db.backup`

## Monitoring

### PM2 Commands

```bash
pm2 status          # Check status
pm2 logs            # View logs
pm2 monit           # Real-time monitoring
pm2 restart all     # Restart bot
```

### Health Check

The bot includes a health check endpoint:
```bash
curl http://localhost:3000/health
```

### Logs

- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- PM2 logs: `pm2 logs`

## Updates

### Automatic Updates

```bash
./deployment/update.sh
```

This will:
1. Create a backup
2. Pull latest changes
3. Update dependencies
4. Rebuild
5. Restart the bot

### Manual Updates

```bash
cd /opt/discord-bot
git pull
npm install
npm run build
pm2 restart discord-fun-bot
```

## Troubleshooting

### Bot Won't Start

1. Check logs: `pm2 logs`
2. Verify .env file: `cat .env`
3. Test configuration: `node dist/index.js`

### Permission Issues

```bash
# Fix ownership
sudo chown -R discordbot:discordbot /opt/discord-bot

# Fix permissions
chmod 755 /opt/discord-bot
chmod 600 /opt/discord-bot/.env
```

### Database Issues

```bash
# Check database
sqlite3 data/bot.db ".tables"

# Repair database
sqlite3 data/bot.db "VACUUM;"
```

### Memory Issues

```bash
# Check memory usage
pm2 monit

# Increase memory limit
pm2 delete all
pm2 start ecosystem.config.js --max-memory-restart 1G
```

## Security

### Firewall

```bash
# Check firewall status
sudo ufw status

# Allow only necessary ports
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP (if needed)
sudo ufw allow 443/tcp # HTTPS (if needed)
```

### Updates

```bash
# System updates
sudo apt update && sudo apt upgrade

# Node.js updates
npm audit
npm audit fix
```

### Backups

```bash
# Automated backup script
crontab -e
# Add: 0 3 * * * /opt/discord-bot/scripts/backup.sh
```

## Support

- Check logs first: `pm2 logs`
- Documentation: `/docs` folder
- Discord Server: [Your Support Server]
- GitHub Issues: [Your Repository]