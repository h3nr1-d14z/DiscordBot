import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { config, validateConfig } from './config/config';
import { logger } from './utils/logger';
import { BotCommand } from './types';

async function registerCommands() {
  try {
    // Validate configuration
    validateConfig();

    logger.info('Starting command registration...');

    // Load all commands
    const commands: any[] = [];
    const commandFolders = readdirSync(path.join(__dirname, 'commands'));

    for (const folder of commandFolders) {
      const commandFiles = readdirSync(path.join(__dirname, 'commands', folder)).filter(
        file => file.endsWith('.ts') || file.endsWith('.js')
      );

      for (const file of commandFiles) {
        try {
          const filePath = path.join(__dirname, 'commands', folder, file);
          const command = await import(filePath);
          
          if ('data' in command.default && 'execute' in command.default) {
            commands.push(command.default.data.toJSON());
            logger.info(`Loaded command: ${command.default.data.name}`);
          } else {
            logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
          }
        } catch (error) {
          logger.error(`Failed to load command from ${file}:`, error);
        }
      }
    }

    // Register commands with Discord
    const rest = new REST({ version: '10' }).setToken(config.token);

    logger.info(`Registering ${commands.length} application (/) commands...`);

    if (config.guildId) {
      // Guild commands update instantly (for development)
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      );
      logger.info(`✅ Successfully registered ${commands.length} commands for guild ${config.guildId}`);
    } else {
      // Global commands take up to an hour to update
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      logger.info(`✅ Successfully registered ${commands.length} global commands`);
      logger.info('⚠️  Note: Global commands may take up to an hour to update across all servers');
    }

    // List registered commands
    logger.info('\n📋 Registered commands:');
    commands.forEach(cmd => {
      logger.info(`  /${cmd.name} - ${cmd.description}`);
    });

    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to register commands:', error);
    process.exit(1);
  }
}

// Run registration
registerCommands();