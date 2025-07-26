#!/bin/bash

# Discord Bot Debian Linux Installation Script
# Tested on Debian 11/12

set -e

echo "========================================="
echo "Discord Fun Bot - Debian Installation"
echo "========================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "Please don't run this script as root"
   exit 1
fi

# Update system
echo "📦 Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install dependencies
echo "📦 Installing system dependencies..."
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    sqlite3 \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw

# Install Node.js 18 via NodeSource
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install Docker (optional)
read -p "Do you want to install Docker? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    
    # Install Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Create bot user
echo "👤 Creating bot user..."
if ! id "discordbot" &>/dev/null; then
    sudo useradd -m -s /bin/bash discordbot
    sudo usermod -aG docker discordbot 2>/dev/null || true
fi

# Create directories
echo "📁 Creating directories..."
sudo mkdir -p /opt/discord-bot
sudo chown discordbot:discordbot /opt/discord-bot

echo ""
echo "✅ System preparation complete!"
echo ""
echo "Next steps:"
echo "1. Copy your bot files to /opt/discord-bot/"
echo "2. Run deployment/deploy.sh as discordbot user"
echo ""
echo "Note: You may need to log out and back in for group changes to take effect"