# Cloudflare Tunnel Configuration Guide

This guide explains how to set up Cloudflare Tunnel for your Discord bot to enable webhook endpoints and secure remote access.

## Why Use Cloudflare Tunnel?

- **No Port Forwarding**: Access your bot's webhook endpoints without opening ports
- **Built-in Security**: DDoS protection and SSL/TLS encryption
- **Zero Trust Access**: Secure authentication for admin endpoints
- **Free Tier Available**: Suitable for most Discord bots

## Prerequisites

- Cloudflare account (free tier works)
- Domain name (optional, can use Cloudflare's subdomain)
- Bot deployed on your server

## Setup Steps

### 1. Install Cloudflared

**Ubuntu/Debian:**
```bash
# Add cloudflare gpg key
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

# Add repo to apt
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared focal main' | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Update and install
sudo apt-get update && sudo apt-get install cloudflared
```

**Docker (Alternative):**
Already included in docker-compose.yml

### 2. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser to authenticate. Select your domain.

### 3. Create a Tunnel

```bash
cloudflared tunnel create discord-bot
```

This creates:
- Tunnel UUID
- Credentials file at `~/.cloudflared/<TUNNEL_ID>.json`

### 4. Configure the Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/USERNAME/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # Webhook endpoint (if using interactions)
  - hostname: bot-webhook.yourdomain.com
    service: http://localhost:3000/webhook
    originRequest:
      noTLSVerify: true
  
  # Health check endpoint
  - hostname: bot-health.yourdomain.com
    service: http://localhost:3000/health
  
  # Admin dashboard (optional, with access control)
  - hostname: bot-admin.yourdomain.com
    service: http://localhost:3000
    originRequest:
      noTLSVerify: true
      access:
        required: true
        teamName: your-team-name
  
  # Catch-all
  - service: http_status:404
```

### 5. Add DNS Records

```bash
cloudflared tunnel route dns discord-bot bot-webhook.yourdomain.com
cloudflared tunnel route dns discord-bot bot-health.yourdomain.com
cloudflared tunnel route dns discord-bot bot-admin.yourdomain.com
```

### 6. Run the Tunnel

**Standalone:**
```bash
cloudflared tunnel run discord-bot
```

**As a Service:**
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

**With Docker Compose:**
The tunnel runs automatically with `docker-compose up -d`

### 7. Update Bot Configuration

Add to `.env`:
```env
TUNNEL_TOKEN=YOUR_TUNNEL_TOKEN
WEBHOOK_URL=https://bot-webhook.yourdomain.com/webhook
```

## Using Tunnel Token (Recommended)

Instead of credential files, use a tunnel token:

1. Get token from Cloudflare dashboard:
   - Go to Zero Trust → Access → Tunnels
   - Click your tunnel → Configure
   - Copy the token

2. Run with token:
   ```bash
   cloudflared tunnel run --token YOUR_TUNNEL_TOKEN
   ```

3. Or in Docker Compose (already configured):
   ```yaml
   environment:
     - TUNNEL_TOKEN=${TUNNEL_TOKEN}
   ```

## Webhook Configuration

If using Discord interactions via webhooks:

```typescript
// In your bot code
app.post('/webhook', (req, res) => {
  // Verify Discord signature
  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');
  
  if (!verifyDiscordSignature(req.body, signature, timestamp)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Handle interaction
  handleInteraction(req.body);
  res.status(200).send('OK');
});
```

## Security Best Practices

1. **Use Access Policies**:
   ```yaml
   originRequest:
     access:
       required: true
       teamName: your-team
       group: admins
   ```

2. **Limit Ingress Rules**: Only expose necessary endpoints

3. **Monitor Access Logs**: Check Cloudflare dashboard regularly

4. **Rotate Tokens**: Periodically update tunnel tokens

5. **Use Environment Variables**: Never commit tokens to git

## Troubleshooting

### Tunnel Not Connecting
```bash
# Check status
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -f

# Test connection
cloudflared tunnel info discord-bot
```

### DNS Issues
```bash
# Verify DNS records
dig bot-webhook.yourdomain.com

# Should return Cloudflare IPs
```

### Certificate Errors
Add to tunnel config:
```yaml
originRequest:
  noTLSVerify: true  # Only for self-signed certs
```

### Docker Issues
```bash
# Check container logs
docker-compose logs cloudflared

# Restart tunnel
docker-compose restart cloudflared
```

## Monitoring

1. **Cloudflare Dashboard**:
   - Zero Trust → Access → Tunnels
   - View metrics, logs, and health

2. **Health Checks**:
   ```bash
   curl https://bot-health.yourdomain.com/health
   ```

3. **Webhook Testing**:
   ```bash
   curl -X POST https://bot-webhook.yourdomain.com/webhook \
     -H "Content-Type: application/json" \
     -d '{"type": 1}'
   ```

## Cost Considerations

- **Free Tier**: 
  - Up to 50 users
  - Unlimited tunnels
  - Basic analytics

- **Paid Plans**: 
  - Advanced access controls
  - Detailed analytics
  - SLA guarantees

For most Discord bots, the free tier is sufficient.

## Next Steps

1. Set up monitoring alerts
2. Configure access policies
3. Implement webhook signature verification
4. Add rate limiting at Cloudflare level
5. Set up automated tunnel restart on failure