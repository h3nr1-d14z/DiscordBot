import { REST, Routes } from 'discord.js';
import { config } from '../config/config';
import { CommandHandler } from '../handlers/commandHandler';
import { logger } from '../utils/logger';
import { database } from '../services/database';

async function registerCommands() {
  try {
    logger.info('Starting command registration...');
    
    // Initialize database first (needed for command loading)
    await database.initialize();
    
    // Load commands
    const commandHandler = new CommandHandler();
    const commands = await commandHandler.loadCommandsForRegistration();
    
    if (commands.length === 0) {
      logger.error('No commands found to register!');
      process.exit(1);
    }
    
    logger.info(`Found ${commands.length} commands to register`);
    
    const rest = new REST({ version: '10' }).setToken(config.token);
    
    // Check if we should register globally or to a specific guild
    const args = process.argv.slice(2);
    const isGlobal = args.includes('--global');
    const guildId = args.find(arg => arg.startsWith('--guild='))?.split('=')[1];
    
    if (isGlobal) {
      // Register commands globally (takes up to 1 hour to propagate)
      logger.info('Registering commands globally...');
      logger.warn('Note: Global command updates can take up to 1 hour to propagate!');
      
      const data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      ) as any[];
      
      logger.info(`Successfully registered ${data.length} global commands!`);
    } else {
      // Register to specific guild(s)
      const guildsToRegister = guildId ? [guildId] : config.guildIds;
      
      if (!guildsToRegister || guildsToRegister.length === 0) {
        logger.error('No guild IDs specified! Use --guild=GUILD_ID or set GUILD_IDS in .env');
        process.exit(1);
      }
      
      for (const guild of guildsToRegister) {
        try {
          logger.info(`Registering commands for guild: ${guild}`);
          
          const data = await rest.put(
            Routes.applicationGuildCommands(config.clientId, guild),
            { body: commands }
          ) as any[];
          
          logger.info(`Successfully registered ${data.length} commands for guild ${guild}!`);
        } catch (error) {
          logger.error(`Failed to register commands for guild ${guild}:`, error);
        }
      }
    }
    
    // Show command summary
    logger.info('\nRegistered commands:');
    commands.forEach(cmd => {
      logger.info(`  - /${cmd.name}: ${cmd.description}`);
    });
    
    logger.info('\nCommand registration complete!');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to register commands:', error);
    process.exit(1);
  }
}

// Add help text if --help is passed
if (process.argv.includes('--help')) {
  console.log(`
Discord Bot Command Registration Script

Usage:
  npm run register [options]

Options:
  --global          Register commands globally (all servers)
  --guild=GUILD_ID  Register to a specific guild
  --help            Show this help message

Examples:
  npm run register                    # Register to guilds in .env
  npm run register --global           # Register globally
  npm run register --guild=123456789  # Register to specific guild

Note: Global commands can take up to 1 hour to update across all servers.
Guild-specific commands update instantly.
  `);
  process.exit(0);
}

registerCommands();