# Discord Embedded Apps Guide

This bot supports Discord Activities, allowing games and apps to be played directly within Discord voice channels.

## Important Note

Discord Activities (embedded apps) require special approval from Discord. There are two types:

1. **Discord's Built-in Activities** - Available to all bots (implemented via `/activity` command) ✅
2. **Custom Embedded Apps** - Require Discord approval and verification ❌

**Your bot currently does not have approval for custom activities.** The Discord SDK is not being injected because your application needs to be approved for the Embedded App SDK.

### How to Get Approval for Custom Activities

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Navigate to "Activities" section
4. You'll need to:
   - Have a verified bot (100+ servers)
   - Submit your activity for review
   - Meet Discord's quality and safety standards
   - Wait for approval (can take weeks)

### What Works Now

Use the `/activity` command to access Discord's built-in activities:
- Poker Night
- Chess
- Watch Together
- And 15+ more games!

These work immediately without any approval needed.

## Overview

Discord Activities (formerly Embedded Apps) allow users to play games together while in a voice channel. The games run in an iframe within Discord, providing a seamless multiplayer experience.

## Available Activities

### Built-in Discord Activities (via `/activity` command)
These work immediately without any special setup:
- **Poker Night** - Play poker with friends
- **Chess/Checkers** - Classic board games
- **Fishing** - Competitive fishing game
- **Sketch Heads** - Drawing and guessing game
- **Word Games** - Letter League, Word Snacks, SpellCast
- **Putt Party** - Mini golf
- **Watch Together** - Watch videos together
- And many more!

### Custom Games (Requires Discord Approval)
These require your bot to be approved for embedded activities:
- **2048** - Classic puzzle game (via `/2048 embed`)
- **Snake** - Classic arcade game (via `/snake embed`)

## How to Use

### For Users

#### Using Built-in Activities (Recommended)
1. Join a voice channel in your Discord server
2. Run `/activity` and select from the available games
3. Click the "Join Game" button in the bot's response
4. The activity will open in Discord

#### Using Custom Games (If Enabled)
1. Join a voice channel in your Discord server
2. Run the game command with the `embed` subcommand:
   - `/2048 embed` - Start 2048 as an activity
   - `/snake embed` - Start Snake as an activity
3. Click the "Join Game" button in the bot's response
4. The game will open in Discord's activity viewer

**Note:** Custom games will only work if the bot has been approved for embedded activities by Discord.

### For Server Admins

Make sure the bot has the following permissions:
- `View Channels`
- `Send Messages`
- `Embed Links`
- `Create Instant Invite` (Required for creating activity invites)
- `Use Embedded Activities` (May require bot verification for some activities)

**Important:** The bot needs these permissions specifically in the voice channel where you want to start the activity. Server-wide permissions may not be enough if the voice channel has custom permission overrides.

## Technical Details

### Architecture

The embedded app system consists of:

1. **Embedded App Server** (`src/services/embeddedAppServer.ts`)
   - Express server that hosts the game HTML files
   - Serves Discord SDK configuration
   - Handles CORS for Discord domains

2. **Activity Service** (`src/services/activityService.ts`)
   - Manages Discord Activities
   - Creates activity invites
   - Tracks available games

3. **Game HTML Files** (`public/games/`)
   - Self-contained HTML games
   - Integrate with Discord Embedded App SDK
   - Handle authentication and game state

### Adding New Games

To add a new embedded game:

1. Create the game HTML file in `public/games/[game-name].html`
2. Include the Discord SDK:
   ```html
   <script src="https://unpkg.com/@discord/embedded-app-sdk@latest/bundles/discord-embedded-app-sdk.bundle.js"></script>
   ```

3. Initialize the SDK:
   ```javascript
   const discordSdk = new DiscordSDK.DiscordSDK(clientId);
   await discordSdk.ready();
   ```

4. Register the game in `activityService.ts`:
   ```typescript
   this.activities.set('game-name', {
     name: 'Game Name',
     type: 0,
     url: `${baseUrl}/games/game-name`,
     application_id: process.env.DISCORD_CLIENT_ID
   });
   ```

5. Update the game command to support embedded mode:
   ```typescript
   .addSubcommand(subcommand =>
     subcommand
       .setName('embed')
       .setDescription('Play in an embedded activity'))
   ```

### Environment Variables

Add to your `.env` file:
```env
EMBEDDED_APP_PORT=3000  # Port for embedded app server
```

### Security Considerations

- The embedded app server uses CORS to only allow Discord domains
- Games authenticate with Discord SDK before starting
- No sensitive data is exposed through the game endpoints

## Troubleshooting

### Common Issues

1. **"Failed to create activity"**
   - Ensure the bot has proper permissions
   - Check that you're in a voice channel
   - Verify the embedded app server is running

2. **Game won't load**
   - Check browser console for errors
   - Ensure Discord client is up to date
   - Try refreshing Discord (Ctrl+R)

3. **Can't see the activity button**
   - Make sure you're in a voice channel
   - Check that activities are enabled for your server

### Debug Mode

To enable debug logging for embedded apps:
```env
LOG_LEVEL=debug
```

## Future Enhancements

- Multiplayer game support
- Game state persistence
- Leaderboards integration
- More game options