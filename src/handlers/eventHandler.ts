import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { BotEvent } from '../types';
import { logger } from '../utils/logger';

export class EventHandler {
  async loadEvents(client: Client): Promise<void> {
    const eventsPath = path.join(process.cwd(), 'src', 'events');
    logger.info(`Loading events from: ${eventsPath}`);
    
    const eventFiles = readdirSync(eventsPath).filter(
      file => file.endsWith('.ts') || file.endsWith('.js')
    );
    logger.info(`Found ${eventFiles.length} event files`);

    for (const file of eventFiles) {
      try {
        const filePath = path.join(eventsPath, file);
        logger.info(`Loading event from: ${filePath}`);
        const event: BotEvent = (await import(filePath)).default;

        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args));
        } else {
          client.on(event.name, (...args) => event.execute(...args));
        }

        logger.info(`✅ Loaded event: ${event.name}`);
      } catch (error) {
        logger.error(`Failed to load event from ${file}:`, error);
      }
    }
  }
}