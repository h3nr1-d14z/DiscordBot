# Discord Fun Bot - Quick Start Guide 🚀

## Prerequisites
- Node.js 18+ installed
- Discord account
- A Discord server where you have admin permissions

## Step 1: Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and name it
3. Go to "Bot" section → "Add Bot"
4. Under "Privileged Gateway Intents", enable:
   - Server Members Intent
   - Message Content Intent
5. Copy the bot token (you'll need this)

## Step 2: Invite Bot to Server

1. In Discord Developer Portal, go to "OAuth2" → "URL Generator"
2. Select scopes:
   - `bot`
   - `applications.commands`
3. Select bot permissions:
   - Send Messages
   - Embed Links
   - Read Message History
   - Use Slash Commands
   - Connect (for voice)
   - Speak (for voice)
4. Copy the generated URL and open it to invite the bot

## Step 3: Set Up the Bot

```bash
# Clone and enter directory
git clone <your-repo-url>
cd discord-bot

# Run setup
./setup.sh

# Configure bot
nano .env  # or your preferred editor
```

Add to `.env`:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_test_server_id  # Optional, for faster command updates
```

## Step 4: Register Commands & Start

```bash
# Register slash commands (required first time and when adding new commands)
npm run register

# Start the bot
npm run dev
```

## Step 5: Test It!

In your Discord server, try:
- `/ping` - Check if bot is responsive
- `/help` - See all available commands
- `/tictactoe` - Play a game!

## Common Issues

### Commands not showing up?
- Make sure you ran `npm run register`
- For guild commands (with GUILD_ID set), they appear instantly
- For global commands, wait up to 1 hour

### Bot not responding?
- Check console for errors
- Verify bot has proper permissions in your server
- Ensure bot token is correct

### Music commands not working?
- Install FFmpeg: `sudo apt install ffmpeg` (Linux) or `brew install ffmpeg` (macOS)

## Next Steps

- Check [COMMANDS.md](COMMANDS.md) for all available commands
- Read [deployment/DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md) for production setup
- Add more features by creating new command files in `src/commands/`

Happy botting! 🎉