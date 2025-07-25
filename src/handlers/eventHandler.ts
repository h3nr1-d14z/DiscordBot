import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { BotEvent } from '../types';
import { logger } from '../utils/logger';

export class EventHandler {
  async loadEvents(client: Client): Promise<void> {
    const eventFiles = readdirSync(path.join(__dirname, '../events')).filter(
      file => file.endsWith('.ts') || file.endsWith('.js')
    );

    for (const file of eventFiles) {
      try {
        const filePath = path.join(__dirname, '../events', file);
        const event: BotEvent = (await import(filePath)).default;

        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args));
        } else {
          client.on(event.name, (...args) => event.execute(...args));
        }

        logger.info(`Loaded event: ${event.name}`);
      } catch (error) {
        logger.error(`Failed to load event from ${file}:`, error);
      }
    }
  }
}