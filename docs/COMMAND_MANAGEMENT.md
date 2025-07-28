# Command Management Guide

This guide explains how to register, update, and manage Discord bot slash commands.

## Quick Start

### Register Commands to Your Development Server
```bash
npm run register
```

### Register Commands Globally (All Servers)
```bash
npm run register:global
```

### Clear All Commands
```bash
npm run clear-commands
```

## Available Scripts

### `npm run register`
Registers all commands to the guild(s) specified in your `.env` file (GUILD_ID or GUILD_IDS).

**Options:**
- `--help` - Show help information
- `--global` - Register commands globally (all servers)
- `--guild=GUILD_ID` - Register to a specific guild

**Examples:**
```bash
# Register to development guild(s)
npm run register

# Register globally (takes up to 1 hour to propagate)
npm run register --global

# Register to specific guild
npm run register --guild=1234567890123456789
```

### `npm run clear-commands`
Removes all registered commands from guilds or globally.

**Options:**
- `--help` - Show help information
- `--global` - Clear global commands
- `--guild=GUILD_ID` - Clear from specific guild
- `--dry-run` - Preview what would be deleted
- `--yes` - Skip confirmation prompt

**Examples:**
```bash
# Preview what would be cleared
npm run clear-commands --dry-run

# Clear from development guild(s)
npm run clear-commands

# Clear all global commands (requires confirmation)
npm run clear-commands --global --yes

# Clear from specific guild
npm run clear-commands --guild=1234567890123456789
```

## Environment Configuration

Add these to your `.env` file:

```env
# Single guild (legacy support)
GUILD_ID=1234567890123456789

# Multiple guilds (comma-separated)
GUILD_IDS=1234567890123456789,9876543210987654321

# Auto-register in development mode
AUTO_REGISTER=true
```

## Important Notes

### Guild vs Global Commands
- **Guild Commands**: Update instantly, perfect for development
- **Global Commands**: Take up to 1 hour to propagate, use for production

### Development Workflow
1. Use guild-specific commands during development
2. Commands auto-register when `NODE_ENV=development` or `AUTO_REGISTER=true`
3. Test thoroughly in your development guild
4. Register globally only when ready for production

### Command Limits
- Maximum 100 global commands per bot
- Maximum 100 guild commands per guild
- Command name must be 1-32 characters
- Command description must be 1-100 characters

### Troubleshooting

**Commands not showing up?**
- Ensure the bot has `applications.commands` scope
- Try refreshing Discord (Ctrl+R)
- For global commands, wait up to 1 hour

**Registration failed?**
- Check bot token is valid
- Verify CLIENT_ID is correct
- Ensure bot is in the target guild
- Check command data is valid (name, description length)

**Can't clear commands?**
- Verify you have the correct permissions
- Use `--dry-run` first to preview
- Check the bot token has not changed

## Adding New Commands

1. Create command file in `src/commands/[category]/`
2. Follow the command template structure
3. Run `npm run register` to update commands
4. Test in your development guild first

## Command Template

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../types';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('commandname')
    .setDescription('Command description'),
    
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply('Command response');
  },
};

export default command;
```