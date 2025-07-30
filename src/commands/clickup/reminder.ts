import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';

const command: BotCommand = {
  category: CommandCategory.Utility,
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('Set up daily ClickUp task reminders')
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable daily task reminders')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to send reminders to (defaults to current channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false))
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('Time to send reminder (HH:MM in 24-hour format, e.g., 09:00)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable daily task reminders'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check your reminder settings')),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const userId = interaction.user.id;
      const subcommand = interaction.options.getSubcommand();

      const clickupUser = await database.getClickUpUser(userId);
      
      if (!clickupUser) {
        await interaction.editReply({
          content: '❌ Your ClickUp account is not linked. Use `/clickup link` to get started!'
        });
        return;
      }

      switch (subcommand) {
        case 'enable': {
          const channel = interaction.options.getChannel('channel') || interaction.channel;
          const timeStr = interaction.options.getString('time') || '09:00';
          
          const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
          if (!timeRegex.test(timeStr)) {
            await interaction.editReply({
              content: '❌ Invalid time format. Please use HH:MM format (e.g., 09:00, 14:30)'
            });
            return;
          }

          await database.setUserReminder(userId, channel!.id, timeStr);

          const embed = new EmbedBuilder()
            .setTitle('✅ Reminder Enabled')
            .setDescription('Daily task reminders have been enabled!')
            .setColor(0x00C853)
            .addFields(
              { name: '📍 Channel', value: channel!.toString(), inline: true },
              { name: '⏰ Time', value: timeStr, inline: true }
            )
            .setFooter({ text: 'You\'ll receive a summary of your tasks due today and tomorrow' });

          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'disable': {
          await database.disableUserReminder(userId);

          const embed = new EmbedBuilder()
            .setTitle('✅ Reminder Disabled')
            .setDescription('Daily task reminders have been disabled.')
            .setColor(0xF44336);

          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'status': {
          const reminder = await database.getUserReminder(userId);

          if (!reminder || !reminder.is_enabled) {
            await interaction.editReply({
              content: '❌ You don\'t have any active reminders set up.'
            });
            return;
          }

          const channel = interaction.guild?.channels.cache.get(reminder.channel_id);

          const embed = new EmbedBuilder()
            .setTitle('📊 Reminder Status')
            .setColor(0x7B68EE)
            .addFields(
              { name: '✅ Status', value: 'Enabled', inline: true },
              { name: '📍 Channel', value: channel ? channel.toString() : 'Unknown', inline: true },
              { name: '⏰ Time', value: reminder.reminder_time, inline: true }
            );

          await interaction.editReply({ embeds: [embed] });
          break;
        }
      }

    } catch (error) {
      logger.error('Reminder command error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while managing your reminder settings.'
      });
    }
  },
};

export default command;