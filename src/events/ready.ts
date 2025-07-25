import { Client, Events, ActivityType } from 'discord.js';
import { BotEvent } from '../types';
import { logger } from '../utils/logger';

const event: BotEvent = {
  name: Events.ClientReady,
  once: true,
  execute(client: Client) {
    logger.info(`Ready! Logged in as ${client.user?.tag}`);
    
    // Set bot activity
    client.user?.setActivity('games | /help', { 
      type: ActivityType.Playing 
    });

    // Log some statistics
    logger.info(`Bot is in ${client.guilds.cache.size} guilds`);
    logger.info(`Serving ${client.users.cache.size} users`);
  },
};

export default event;