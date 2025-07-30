# Discord Activity Setup Guide

This guide will help you set up Discord Activities (embedded apps) for your bot.

## Prerequisites

1. Your bot must be running and accessible from the internet
2. You need a public URL for your embedded app server (localhost won't work)

## Step 1: Make Your Embedded App Server Publicly Accessible

Since Discord needs to access your embedded app server, you have several options:

### Option A: Use ngrok (For Testing)
1. Install ngrok: `npm install -g ngrok`
2. Start your bot
3. In a new terminal, run: `ngrok http 3000` (or your EMBEDDED_APP_PORT)
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Option B: Deploy to a Cloud Service
- **Heroku**: Add `PORT` environment variable
- **Railway/Render**: Automatic HTTPS URLs
- **VPS**: Set up with nginx and SSL certificate

### Option C: Use Cloudflare Tunnel
1. Install cloudflared
2. Run: `cloudflared tunnel --url http://localhost:3000`
3. Use the provided URL

## Step 2: Configure URL Mappings in Discord Developer Portal

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Navigate to **Activities** section
4. Click **"Get Started"** or **"URL Mappings"**

### Add URL Mappings

You need to add mappings for each game endpoint:

#### For 2048 Game:
- **Prefix**: `/games/2048`
- **Target**: `https://your-domain.com/games/2048.html`

#### For Snake Game:
- **Prefix**: `/games/snake`
- **Target**: `https://your-domain.com/games/snake.html`

#### For Root Path:
- **Prefix**: `/`
- **Target**: `https://your-domain.com/`

### Example with ngrok:
If your ngrok URL is `https://abc123.ngrok.io`, your mappings would be:
- Prefix: `/` → Target: `https://abc123.ngrok.io/`

## Step 3: Configure Activity Details

1. In the Activities section, click **"New Activity"**
2. Fill in the details:
   - **Name**: Your Bot Games
   - **Description**: Play games in Discord!
   - **Activity Type**: Game
   - **Supported Platforms**: Desktop, Mobile, Web

3. Set up OAuth2:
   - **Redirect URL**: `https://your-domain.com/auth/callback`
   - **Scopes**: `identify`, `guilds`, `applications.commands`

## Step 4: Update Your Environment Variables

Add these to your `.env` file:

```env
# Public URL for your embedded app server
PUBLIC_URL=https://your-domain.com

# Or if using ngrok
PUBLIC_URL=https://abc123.ngrok.io
```

## Step 5: Update Embedded App Server

Update the server to use the public URL:

```typescript
// In embeddedAppServer.ts
getUrl(): string {
  return process.env.PUBLIC_URL || `http://localhost:${this.port}`;
}
```

## Step 6: Test Your Activity

1. Restart your bot with the new configuration
2. Join a voice channel
3. Run `/2048 embed` or `/snake embed`
4. If successful, the activity should start!

## Troubleshooting

### "URL Mapping Required" Error
- Ensure you've added at least one URL mapping
- The target URL must be HTTPS (not HTTP)
- The URL must be publicly accessible

### "Invalid Application" Error
- Activities might not be enabled yet
- Try refreshing the page and enabling activities again
- Submit your bot for verification if required

### Games Not Loading
- Check browser console for errors
- Ensure CORS is properly configured
- Verify the Discord SDK is loading correctly

## Production Deployment

For production, you should:

1. Deploy your bot to a cloud service
2. Use a proper domain with SSL
3. Set up monitoring for your embedded app server
4. Consider using a CDN for game assets

## Security Considerations

1. Always use HTTPS in production
2. Validate Discord SDK tokens
3. Implement rate limiting
4. Only serve game files, not sensitive data

## Next Steps

Once URL mappings are configured:
1. Test with a few users first
2. Monitor for any errors
3. Consider adding more games
4. Submit for Discord verification if you want wider distribution

Remember: Discord's built-in activities (via `/activity` command) work without any of this setup!