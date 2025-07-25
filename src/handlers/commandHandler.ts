import { Client, Collection, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { BotCommand } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class CommandHandler {
  private commands: Collection<string, BotCommand>;
  private commandArray: any[];

  constructor() {
    this.commands = new Collection();
    this.commandArray = [];
  }

  async loadCommands(client: Client): Promise<void> {
    const commandFolders = readdirSync(path.join(__dirname, '../commands'));

    for (const folder of commandFolders) {
      const commandFiles = readdirSync(path.join(__dirname, '../commands', folder)).filter(
        file => file.endsWith('.ts') || file.endsWith('.js')
      );

      for (const file of commandFiles) {
        try {
          const filePath = path.join(__dirname, '../commands', folder, file);
          const command = await import(filePath);
          
          if ('data' in command.default && 'execute' in command.default) {
            this.commands.set(command.default.data.name, command.default);
            this.commandArray.push(command.default.data.toJSON());
            logger.info(`Loaded command: ${command.default.data.name}`);
          } else {
            logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
          }
        } catch (error) {
          logger.error(`Failed to load command from ${file}:`, error);
        }
      }
    }

    (client as any).commands = this.commands;
  }

  async registerCommands(): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
      logger.info(`Started refreshing ${this.commandArray.length} application (/) commands.`);

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
    } catch (error) {
      logger.error('Failed to register commands:', error);
      throw error;
    }
  }

  getCommands(): Collection<string, BotCommand> {
    return this.commands;
  }
}