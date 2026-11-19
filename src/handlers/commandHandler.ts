import { Client, Collection, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { BotCommand } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class CommandHandler {
  private commands: Collection<string, BotCommand>;
  private commandArray: any[];
  // tsx dev: __dirname is src/handlers; compiled prod: dist/handlers — sibling commands either way
  private readonly commandsPath = path.join(__dirname, '..', 'commands');

  constructor() {
    this.commands = new Collection();
    this.commandArray = [];
  }

  async loadCommands(client: Client): Promise<void> {
    logger.info(`Loading commands from: ${this.commandsPath}`);

    const commandFolders = readdirSync(this.commandsPath);
    logger.info(`Found command folders: ${commandFolders.join(', ')}`);

    for (const folder of commandFolders) {
      const folderPath = path.join(this.commandsPath, folder);
      const commandFiles = readdirSync(folderPath).filter(
        file => file.endsWith('.ts') || file.endsWith('.js')
      );
      logger.info(`Found ${commandFiles.length} command files in ${folder}`);

      for (const file of commandFiles) {
        try {
          const filePath = path.join(folderPath, file);
          logger.info(`Loading command from: ${filePath}`);
          
          const command = await import(filePath);
          
          if ('data' in command.default && 'execute' in command.default) {
            this.commands.set(command.default.data.name, command.default);
            this.commandArray.push(command.default.data.toJSON());
            logger.info(`✅ Loaded command: ${command.default.data.name}`);
          } else {
            logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
          }
        } catch (error) {
          logger.error(`Failed to load command from ${file}:`, error);
        }
      }
    }

    logger.info(`Total commands loaded: ${this.commands.size}`);
    (client as any).commands = this.commands;
  }

  async registerCommands(): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
      logger.info(`Started refreshing ${this.commandArray.length} application (/) commands.`);

      // First, get existing commands to check for Entry Point command
      const route = config.guildId 
        ? Routes.applicationGuildCommands(config.clientId, config.guildId)
        : Routes.applicationCommands(config.clientId);

      const existingCommands = await rest.get(route) as any[];
      logger.info(`Found ${existingCommands.length} existing commands`);
      
      // Find ALL Entry Point commands. Only type 4 is a true Entry Point —
      // matching integration_types containing 1 resurrected deleted commands
      // (they merely carry the user-install flag) on every boot.
      const entryPointCommands = existingCommands.filter(cmd => cmd.type === 4);
      for (const entryPoint of entryPointCommands) {
        logger.info(`Entry Point command preserved: ${entryPoint.name} (type 4)`);
      }
      
      // Remove any commands from our array that match Entry Point command names
      const entryPointNames = entryPointCommands.map(cmd => cmd.name);
      this.commandArray = this.commandArray.filter(cmd => !entryPointNames.includes(cmd.name));

      // Re-send Entry Points verbatim — the GET object carries the `handler`
      // field (what makes type 4 the Launch App entry point); a hand-copied
      // subset drops it and degrades the button on every boot.
      this.commandArray.push(...entryPointCommands);
      
      logger.info(`Final command array has ${this.commandArray.length} commands`);
      logger.info(`Commands: ${this.commandArray.map(cmd => cmd.name).join(', ')}`);

      if (config.guildId) {
        // Guild commands update instantly (for development)
        await rest.put(
          Routes.applicationGuildCommands(config.clientId, config.guildId),
          { body: this.commandArray }
        );
        logger.info(`Successfully reloaded commands for guild ${config.guildId}`);
      } else {
        // Global commands take up to an hour to update
        await rest.put(
          Routes.applicationCommands(config.clientId),
          { body: this.commandArray }
        );
        logger.info('Successfully reloaded global commands');
      }
    } catch (error: any) {
      // Special handling for Entry Point command error
      if (error.code === 50240) {
        logger.error('Entry Point command error detected. You may need to:');
        logger.error('1. Disable Activities in Discord Developer Portal temporarily');
        logger.error('2. Or manually include the Entry Point command in your bot');
        logger.error('3. Or use guild-specific commands for development (set GUILD_ID in .env)');
      }
      logger.error('Failed to register commands:', error);
      throw error;
    }
  }

  getCommands(): Collection<string, BotCommand> {
    return this.commands;
  }
  
  async loadCommandsForRegistration(): Promise<any[]> {
    const commands: any[] = [];

    const commandFolders = readdirSync(this.commandsPath);

    for (const folder of commandFolders) {
      const folderPath = path.join(this.commandsPath, folder);
      const commandFiles = readdirSync(folderPath).filter(
        file => file.endsWith('.ts') || file.endsWith('.js')
      );
      
      for (const file of commandFiles) {
        try {
          const filePath = path.join(folderPath, file);
          const command = await import(filePath);
          
          if ('data' in command.default && 'execute' in command.default) {
            commands.push(command.default.data.toJSON());
          }
        } catch (error) {
          logger.error(`Failed to load command from ${file} for registration:`, error);
        }
      }
    }
    
    return commands;
  }
}