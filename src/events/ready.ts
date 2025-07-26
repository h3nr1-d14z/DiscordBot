import { Client, Events, ActivityType } from 'discord.js';
import { BotEvent } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config/config';

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
    
    // Generate invite link with proper permissions
    const permissions = '414531994688'; // All necessary permissions
    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&permissions=${permissions}&scope=bot%20applications.commands`;
    
    logger.info('===============================================');
    logger.info('Bot Invite Link:');
    logger.info(inviteLink);
    logger.info('===============================================');
    logger.info('Make sure to use this link to invite the bot!');
    logger.info('The bot needs applications.commands scope for slash commands to work!');
    
    // Debug: List all servers (helpful for troubleshooting)
    if (client.guilds.cache.size > 0) {
      logger.info('');
      logger.info('Connected to servers:');
      client.guilds.cache.forEach(guild => {
        logger.info(`  - ${guild.name} (ID: ${guild.id})`);
      });
    } else {
      logger.warn('');
      logger.warn('⚠️  Bot is not in any servers!');
      logger.warn('⚠️  Please use the invite link above to add the bot to your server.');
    }
  },
};

export default event;