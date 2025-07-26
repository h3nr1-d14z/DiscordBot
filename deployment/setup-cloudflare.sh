#!/bin/bash

# Cloudflare Tunnel Setup Script for Discord Bot

set -e

echo "========================================="
echo "Cloudflare Tunnel Setup for Discord Bot"
echo "========================================="

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "📦 Installing cloudflared..."
    
    # Detect architecture
    ARCH=$(dpkg --print-architecture)
    case $ARCH in
        amd64)
            CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb"
            ;;
        arm64)
            CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb"
            ;;
        armhf)
            CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-armhf.deb"
            ;;
        *)
            echo "❌ Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    
    wget -q $CLOUDFLARED_URL -O cloudflared.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
fi

echo "✅ cloudflared is installed"

# Login to Cloudflare
echo ""
echo "🔐 Logging in to Cloudflare..."
echo "   This will open a browser window for authentication"
cloudflared tunnel login

# Create tunnel
echo ""
read -p "Enter a name for your tunnel (e.g., discord-bot): " TUNNEL_NAME
cloudflared tunnel create $TUNNEL_NAME

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}')
echo "✅ Tunnel created with ID: $TUNNEL_ID"

# Create config file
echo ""
echo "📝 Creating tunnel configuration..."
cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: /home/$USER/.cloudflared/$TUNNEL_ID.json

ingress:
  # Health check endpoint
  - hostname: $TUNNEL_NAME-health.yourdomain.com
    service: http://localhost:3000
  
  # Bot webhook endpoint (if using interactions endpoint URL)
  - hostname: $TUNNEL_NAME-webhook.yourdomain.com
    service: http://localhost:3000/webhook
    
  # Default 404 for everything else
  - service: http_status:404
EOF

echo "⚠️  Please edit ~/.cloudflared/config.yml and update:"
echo "   - Replace 'yourdomain.com' with your actual domain"
echo "   - Add any additional routes as needed"

# Create systemd service
echo ""
echo "🚀 Creating systemd service..."
sudo cloudflared service install

# Create DNS records
echo ""
echo "📌 Next steps:"
echo "1. Add these CNAME records to your DNS:"
echo "   - $TUNNEL_NAME-health.yourdomain.com → $TUNNEL_ID.cfargotunnel.com"
echo "   - $TUNNEL_NAME-webhook.yourdomain.com → $TUNNEL_ID.cfargotunnel.com"
echo ""
echo "2. Start the tunnel:"
echo "   sudo systemctl start cloudflared"
echo "   sudo systemctl enable cloudflared"
echo ""
echo "3. Check tunnel status:"
echo "   sudo systemctl status cloudflared"
echo "   cloudflared tunnel info $TUNNEL_NAME"

# Save tunnel token for docker-compose
echo ""
echo "💾 Saving tunnel token for Docker deployment..."
TUNNEL_TOKEN=$(cloudflared tunnel token $TUNNEL_NAME)
echo "TUNNEL_TOKEN=$TUNNEL_TOKEN" >> /opt/discord-bot/.env

echo ""
echo "✅ Cloudflare tunnel setup complete!"