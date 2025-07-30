import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { clickupService } from '../../services/clickupService';
import { logger } from '../../utils/logger';

const command: BotCommand = {
  category: CommandCategory.Utility,
  data: new SlashCommandBuilder()
    .setName('tasks')
    .setDescription('View your upcoming ClickUp tasks')
    .addIntegerOption(option =>
      option
        .setName('days')
        .setDescription('Number of days to look ahead (default: 14)')
        .setMinValue(1)
        .setMaxValue(30)
        .setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const userId = interaction.user.id;
      const days = interaction.options.getInteger('days') || 14;

      const clickupUser = await database.getClickUpUser(userId);
      
      if (!clickupUser) {
        await interaction.editReply({
          content: '❌ Your ClickUp account is not linked. Use `/clickup link` to get started!'
        });
        return;
      }

      const tasks = await clickupService.getUpcomingTasks(userId, days);

      if (tasks.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('📋 No Upcoming Tasks')
          .setDescription(`You don't have any tasks due in the next ${days} days. Great job staying on top of things!`)
          .setColor(0x00C853)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const tasksPerPage = 5;
      const totalPages = Math.ceil(tasks.length / tasksPerPage);
      let currentPage = 0;

      const generateEmbed = (page: number) => {
        const start = page * tasksPerPage;
        const end = Math.min(start + tasksPerPage, tasks.length);
        const pageTasks = tasks.slice(start, end);

        const embed = new EmbedBuilder()
          .setTitle(`📋 Upcoming Tasks (Next ${days} Days)`)
          .setDescription(`Showing ${start + 1}-${end} of ${tasks.length} tasks`)
          .setColor(0x7B68EE)
          .setTimestamp()
          .setFooter({ text: `Page ${page + 1} of ${totalPages}` });

        const todayTasks = tasks.filter(t => {
          if (!t.dueDate) return false;
          const due = new Date(t.dueDate);
          const today = new Date();
          return due.toDateString() === today.toDateString();
        });

        const overdueTasks = tasks.filter(t => {
          if (!t.dueDate) return false;
          const due = new Date(t.dueDate);
          return due < new Date();
        });

        if (todayTasks.length > 0 || overdueTasks.length > 0) {
          let summary = '';
          if (overdueTasks.length > 0) {
            summary += `❌ **${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}**\n`;
          }
          if (todayTasks.length > 0) {
            summary += `🚨 **${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''} due today**\n`;
          }
          embed.addFields({ name: '⚠️ Attention Required', value: summary, inline: false });
        }

        for (const task of pageTasks) {
          const taskDisplay = clickupService.formatTaskForDisplay(task);
          
          embed.addFields({
            name: '\u200B',
            value: taskDisplay,
            inline: false
          });
        }

        return embed;
      };

      const generateButtons = (page: number) => {
        const row = new ActionRowBuilder<ButtonBuilder>();
        
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('first')
            .setEmoji('⏮️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0)
        );
        
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0)
        );
        
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Primary)
        );
        
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('next')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages - 1)
        );
        
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('last')
            .setEmoji('⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages - 1)
        );

        return row;
      };

      const message = await interaction.editReply({
        embeds: [generateEmbed(currentPage)],
        components: totalPages > 1 ? [generateButtons(currentPage)] : []
      });

      if (totalPages > 1) {
        const collector = message.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 300000
        });

        collector.on('collect', async (buttonInteraction) => {
          if (buttonInteraction.user.id !== interaction.user.id) {
            await buttonInteraction.reply({ content: 'These buttons are not for you!', ephemeral: true });
            return;
          }

          if (buttonInteraction.customId === 'refresh') {
            await buttonInteraction.deferUpdate();
            
            try {
              const refreshedTasks = await clickupService.getUpcomingTasks(userId, days);
              tasks.length = 0;
              tasks.push(...refreshedTasks);
              
              await buttonInteraction.editReply({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
              });
            } catch (error) {
              await buttonInteraction.followUp({
                content: '❌ Failed to refresh tasks. Please try again.',
                ephemeral: true
              });
            }
            return;
          }

          switch (buttonInteraction.customId) {
            case 'first':
              currentPage = 0;
              break;
            case 'prev':
              currentPage = Math.max(0, currentPage - 1);
              break;
            case 'next':
              currentPage = Math.min(totalPages - 1, currentPage + 1);
              break;
            case 'last':
              currentPage = totalPages - 1;
              break;
          }

          await buttonInteraction.update({
            embeds: [generateEmbed(currentPage)],
            components: [generateButtons(currentPage)]
          });
        });

        collector.on('end', () => {
          interaction.editReply({ components: [] }).catch(() => {});
        });
      }

    } catch (error: any) {
      logger.error('Tasks command error:', error);
      
      let errorMessage = 'An error occurred while fetching your tasks.';
      if (error.message?.includes('ClickUp not linked')) {
        errorMessage = error.message;
      }
      
      await interaction.editReply({
        content: `❌ ${errorMessage}`
      });
    }
  },
};

export default command;