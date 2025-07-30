import { Client, Events, ActivityType, PermissionFlagsBits } from 'discord.js';
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
    
    // Calculate permissions using Discord.js permission flags
    const permissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.SendMessagesInThreads,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.UseVAD,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageRoles,  // Added for role management
      PermissionFlagsBits.UseApplicationCommands,  // For slash command followUps
      PermissionFlagsBits.CreateInstantInvite,  // Required for embedded activities
      PermissionFlagsBits.UseEmbeddedActivities,  // For Discord activities/games
    ].reduce((acc, perm) => acc | perm, 0n);
    
    // Generate invite link with proper permissions
    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&permissions=${permissions}&scope=bot%20applications.commands`;
    
    logger.info('===============================================');
    logger.info('Bot Invite Link:');
    logger.info(inviteLink);
    logger.info('===============================================');
    logger.info('Make sure to use this link to invite the bot!');
    logger.info('The bot needs applications.commands scope for slash commands to work!');
    logger.info('For embedded activities, ensure the bot has Create Instant Invite permission in voice channels.');
    
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