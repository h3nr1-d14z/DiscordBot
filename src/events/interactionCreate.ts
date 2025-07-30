import { Events, Interaction, Collection, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BotEvent, BotCommand, CooldownData } from '../types';
import { logger } from '../utils/logger';
import { database } from '../services/database';
import { clickupService } from '../services/clickupService';

const cooldowns = new Collection<string, CooldownData>();

const event: BotEvent = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    logger.info(`Interaction received: ${interaction.type}`);
    
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'clickup_link_modal') {
        await handleClickUpLinkModal(interaction);
        return;
      }
      // Return early for game-related modals - they're handled by collectors
      if (interaction.customId === 'letter_guess_modal' || 
          interaction.customId === 'letter_guess_modal_challenge') {
        return;
      }
    }
    
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

async function handleClickUpLinkModal(interaction: any) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const email = interaction.fields.getTextInputValue('clickup_email');
    const apiToken = interaction.fields.getTextInputValue('clickup_token');
    
    const isValid = await clickupService.validateApiToken(apiToken);
    
    if (!isValid) {
      await interaction.editReply({
        content: '❌ Invalid API token. Please check your token and try again.'
      });
      return;
    }
    
    const userInfo = await clickupService.getUserInfo(apiToken);
    if (!userInfo || userInfo.email.toLowerCase() !== email.toLowerCase()) {
      await interaction.editReply({
        content: '❌ The email doesn\'t match the API token owner. Please verify your information.'
      });
      return;
    }
    
    const workspaces = await clickupService.getWorkspaces(apiToken);
    const workspaceId = workspaces.length > 0 ? workspaces[0].id : null;
    
    await database.linkClickUpEmail(interaction.user.id, email);
    await database.updateClickUpUser(interaction.user.id, {
      clickupUserId: userInfo.id,
      apiToken: apiToken,
      workspaceId: workspaceId
    });
    
    const embed = new EmbedBuilder()
      .setTitle('✅ ClickUp Linked Successfully!')
      .setColor(0x00C853)
      .setDescription('Your ClickUp account has been linked to your Discord account.')
      .addFields(
        { name: '📧 Email', value: email, inline: true },
        { name: '👤 Username', value: userInfo.username, inline: true }
      );
    
    if (workspaces.length > 0) {
      embed.addFields({ name: '🏢 Workspace', value: workspaces[0].name, inline: true });
    }
    
    embed.setFooter({ text: 'You can now use /tasks to view your upcoming tasks!' });
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error linking ClickUp account:', error);
    await interaction.editReply({
      content: '❌ An error occurred while linking your account. Please try again.'
    });
  }
}

export default event;