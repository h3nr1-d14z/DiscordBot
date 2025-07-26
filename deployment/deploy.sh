#!/bin/bash

# Discord Bot Deployment Script
# Run this after install-debian.sh

set -e

BOT_DIR="/opt/discord-bot"
SERVICE_NAME="discord-fun-bot"

echo "========================================="
echo "Discord Fun Bot - Deployment Script"
echo "========================================="

# Check if running as discordbot user
if [ "$USER" != "discordbot" ]; then
    echo "⚠️  Please run this script as 'discordbot' user"
    echo "   sudo su - discordbot"
    echo "   cd $BOT_DIR && ./deployment/deploy.sh"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found!"
    echo "   Please run this script from the bot directory"
    exit 1
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "   Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "⚠️  Please edit .env and add your configuration:"
    echo "   nano .env"
    exit 1
fi

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm ci --production

# Build the bot
echo "🔨 Building TypeScript..."
npm run build

# Setup PM2
echo "⚙️  Setting up PM2..."
pm2 delete $SERVICE_NAME 2>/dev/null || true
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup
echo "🚀 Setting up PM2 auto-start..."
pm2 startup systemd -u discordbot --hp /home/discordbot
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u discordbot --hp /home/discordbot

# Create health check service
echo "🏥 Creating health check endpoint..."
cat > /tmp/discord-bot-health.service << EOF
[Unit]
Description=Discord Bot Health Check
After=network.target

[Service]
Type=simple
User=discordbot
WorkingDirectory=$BOT_DIR
ExecStart=/usr/bin/node $BOT_DIR/dist/services/healthCheck.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo mv /tmp/discord-bot-health.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable discord-bot-health
sudo systemctl start discord-bot-health

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Bot Status:"
pm2 status

echo ""
echo "📝 Useful commands:"
echo "  pm2 status          - Check bot status"
echo "  pm2 logs            - View bot logs"
echo "  pm2 restart all     - Restart bot"
echo "  pm2 monit           - Monitor bot"
echo ""
echo "🔍 Check logs:"
echo "  tail -f logs/combined.log"