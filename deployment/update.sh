#!/bin/bash

# Discord Bot Update Script
# Updates the bot from git repository

set -e

SERVICE_NAME="discord-fun-bot"

echo "========================================="
echo "Discord Fun Bot - Update Script"
echo "========================================="

# Check if running as discordbot user
if [ "$USER" != "discordbot" ]; then
    echo "⚠️  Switching to discordbot user..."
    sudo su - discordbot -c "cd /opt/discord-bot && ./deployment/update.sh"
    exit 0
fi

cd /opt/discord-bot

# Create backup
echo "💾 Creating backup..."
BACKUP_DIR="/opt/discord-bot-backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
cp -r . $BACKUP_DIR/ 2>/dev/null || true
echo "✅ Backup created at: $BACKUP_DIR"

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Install/update dependencies
echo "📦 Updating dependencies..."
npm ci --production

# Build
echo "🔨 Building TypeScript..."
npm run build

# Run database migrations if needed
echo "🗄️  Checking database..."
# Add migration logic here if needed

# Restart bot
echo "🔄 Restarting bot..."
pm2 restart $SERVICE_NAME

# Show status
echo ""
echo "✅ Update complete!"
echo ""
pm2 status

# Cleanup old backups (keep last 5)
echo "🧹 Cleaning up old backups..."
cd /opt/discord-bot-backups
ls -t | tail -n +6 | xargs -r rm -rf

echo ""
echo "📝 Check logs with: pm2 logs"