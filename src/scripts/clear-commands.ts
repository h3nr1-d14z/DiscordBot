import { REST, Routes } from 'discord.js';
import { config } from '../config/config';
import { logger } from '../utils/logger';

async function clearCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(config.token);
    
    const args = process.argv.slice(2);
    const isGlobal = args.includes('--global');
    const guildId = args.find(arg => arg.startsWith('--guild='))?.split('=')[1];
    const isDryRun = args.includes('--dry-run');
    
    if (isDryRun) {
      logger.info('DRY RUN MODE - No commands will be deleted');
    }
    
    if (isGlobal) {
      logger.info('Fetching global commands...');
      
      const commands = await rest.get(
        Routes.applicationCommands(config.clientId)
      ) as any[];
      
      logger.info(`Found ${commands.length} global commands`);
      
      if (commands.length === 0) {
        logger.info('No global commands to clear');
        process.exit(0);
      }
      
      if (!isDryRun) {
        const confirm = args.includes('--yes');
        if (!confirm) {
          logger.warn('This will delete ALL global commands!');
          logger.warn('Add --yes to confirm deletion');
          process.exit(1);
        }
        
        logger.info('Clearing all global commands...');
        await rest.put(
          Routes.applicationCommands(config.clientId),
          { body: [] }
        );
        logger.info('Successfully cleared all global commands!');
      } else {
        logger.info('Would clear the following commands:');
        commands.forEach(cmd => {
          logger.info(`  - /${cmd.name}: ${cmd.description}`);
        });
      }
    } else {
      const guildsToProcess = guildId ? [guildId] : config.guildIds;
      
      if (!guildsToProcess || guildsToProcess.length === 0) {
        logger.error('No guild IDs specified! Use --guild=GUILD_ID or set GUILD_IDS in .env');
        process.exit(1);
      }
      
      for (const guild of guildsToProcess) {
        try {
          logger.info(`Fetching commands for guild: ${guild}`);
          
          const commands = await rest.get(
            Routes.applicationGuildCommands(config.clientId, guild)
          ) as any[];
          
          logger.info(`Found ${commands.length} commands in guild ${guild}`);
          
          if (commands.length === 0) {
            logger.info(`No commands to clear in guild ${guild}`);
            continue;
          }
          
          if (!isDryRun) {
            logger.info(`Clearing all commands for guild ${guild}...`);
            await rest.put(
              Routes.applicationGuildCommands(config.clientId, guild),
              { body: [] }
            );
            logger.info(`Successfully cleared all commands for guild ${guild}!`);
          } else {
            logger.info(`Would clear the following commands in guild ${guild}:`);
            commands.forEach(cmd => {
              logger.info(`  - /${cmd.name}: ${cmd.description}`);
            });
          }
        } catch (error) {
          logger.error(`Failed to process guild ${guild}:`, error);
        }
      }
    }
    
    logger.info('\nCommand clearing complete!');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to clear commands:', error);
    process.exit(1);
  }
}

// Add help text if --help is passed
if (process.argv.includes('--help')) {
  console.log(`
Discord Bot Command Clearing Script

Usage:
  npm run clear-commands [options]

Options:
  --global          Clear global commands
  --guild=GUILD_ID  Clear commands from a specific guild
  --dry-run         Show what would be cleared without deleting
  --yes             Skip confirmation for global command deletion
  --help            Show this help message

Examples:
  npm run clear-commands --dry-run              # Show guild commands that would be cleared
  npm run clear-commands                         # Clear commands from guilds in .env
  npm run clear-commands --global --yes          # Clear all global commands
  npm run clear-commands --guild=123456789       # Clear commands from specific guild

WARNING: This will permanently delete slash commands!
Use --dry-run first to see what will be deleted.
  `);
  process.exit(0);
}

clearCommands();