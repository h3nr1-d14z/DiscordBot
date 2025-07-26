import { Events, Interaction, Collection, ChatInputCommandInteraction } from 'discord.js';
import { BotEvent, BotCommand, CooldownData } from '../types';
import { logger } from '../utils/logger';

const cooldowns = new Collection<string, CooldownData>();

const event: BotEvent = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    logger.info(`Interaction received: ${interaction.type}`);
    
    if (!interaction.isChatInputCommand()) {
      logger.info('Interaction is not a chat input command');
      return;
    }

    logger.info(`Command interaction: ${interaction.commandName} by ${interaction.user.tag}`);
    
    const commands = (interaction.client as any).commands;
    if (!commands) {
      logger.error('Commands collection not found on client!');
      await interaction.reply({
        content: '❌ Bot is not properly initialized. Please contact the administrator.',
        ephemeral: true
      });
      return;
    }
    
    logger.info(`Available commands: ${Array.from(commands.keys()).join(', ')}`);
    
    const command = commands.get(interaction.commandName) as BotCommand;

    if (!command) {
      logger.warn(`No command matching ${interaction.commandName} was found.`);
      await interaction.reply({
        content: `❌ Command \`${interaction.commandName}\` not found!`,
        ephemeral: true
      });
      return;
    }

    // Handle cooldowns
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, {
        timestamps: new Collection(),
        defaultCooldown: command.cooldown || 3,
      });
    }

    const now = Date.now();
    const cooldownData = cooldowns.get(command.data.name)!;
    const cooldownAmount = cooldownData.defaultCooldown * 1000;

    if (cooldownData.timestamps.has(interaction.user.id)) {
      const expirationTime = cooldownData.timestamps.get(interaction.user.id)! + cooldownAmount;

      if (now < expirationTime) {
        const expiredTimestamp = Math.round(expirationTime / 1000);
        await interaction.reply({
          content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
          ephemeral: true,
        });
        return;
      }
    }

    cooldownData.timestamps.set(interaction.user.id, now);
    setTimeout(() => cooldownData.timestamps.delete(interaction.user.id), cooldownAmount);

    try {
      await command.execute(interaction as ChatInputCommandInteraction);
      logger.info(`Command ${interaction.commandName} executed by ${interaction.user.tag}`);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}:`, error);
      
      const errorMessage = 'There was an error while executing this command!';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};

export default event;