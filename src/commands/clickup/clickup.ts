import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { Command } from '../../types';
import { database } from '../../services/database';
import { clickupService } from '../../services/clickupService';
import { logger } from '../../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clickup')
    .setDescription('Manage your ClickUp integration')
    .addSubcommand(subcommand =>
      subcommand
        .setName('link')
        .setDescription('Link your ClickUp account'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('unlink')
        .setDescription('Unlink your ClickUp account'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check your ClickUp integration status')),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'link') {
      const userRoles = await database.getUserRoles(userId);
      const hasBandRole = userRoles.some(r => r.role_type === 'band');
      const hasTeamRole = userRoles.some(r => r.role_type === 'team');

      if (!hasBandRole && !hasTeamRole) {
        await interaction.reply({
          content: '❌ You need to redeem at least one role (band or team) before linking ClickUp. Use `/redeem` first!',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🔗 Link ClickUp Account')
        .setDescription('To link your ClickUp account, I\'ll need some information:')
        .setColor(0x7B68EE)
        .addFields(
          { name: '📧 Email', value: 'Your ClickUp account email', inline: true },
          { name: '🔑 API Token', value: '[Get your API token here](https://app.clickup.com/settings/apps)', inline: true }
        )
        .setFooter({ text: 'Your data is encrypted and stored securely' });

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('start_clickup_link')
            .setLabel('Start Setup')
            .setEmoji('🚀')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });

      const collector = interaction.channel?.createMessageComponentCollector({
        filter: i => i.user.id === userId && i.customId === 'start_clickup_link',
        time: 60000
      });

      collector?.on('collect', async (buttonInteraction) => {
        const modal = new ModalBuilder()
          .setCustomId('clickup_link_modal')
          .setTitle('Link ClickUp Account');

        const emailInput = new TextInputBuilder()
          .setCustomId('clickup_email')
          .setLabel('ClickUp Email')
          .setPlaceholder('your.email@example.com')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const tokenInput = new TextInputBuilder()
          .setCustomId('clickup_token')
          .setLabel('ClickUp API Token')
          .setPlaceholder('pk_...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(emailInput);
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(tokenInput);

        modal.addComponents(firstRow, secondRow);
        await buttonInteraction.showModal(modal);
      });

    } else if (subcommand === 'unlink') {
      await interaction.deferReply({ ephemeral: true });

      const clickupUser = await database.getClickUpUser(userId);
      
      if (!clickupUser) {
        await interaction.editReply({
          content: '❌ Your ClickUp account is not linked.'
        });
        return;
      }

      await database.run('DELETE FROM clickup_users WHERE user_id = ?', [userId]);
      await database.run('DELETE FROM clickup_tasks_cache WHERE user_id = ?', [userId]);

      const embed = new EmbedBuilder()
        .setTitle('✅ ClickUp Unlinked')
        .setDescription('Your ClickUp account has been unlinked successfully.')
        .setColor(0xF44336);

      await interaction.editReply({ embeds: [embed] });

    } else if (subcommand === 'status') {
      await interaction.deferReply({ ephemeral: true });

      const clickupUser = await database.getClickUpUser(userId);
      
      if (!clickupUser) {
        await interaction.editReply({
          content: '❌ Your ClickUp account is not linked. Use `/clickup link` to get started!'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📊 ClickUp Integration Status')
        .setColor(0x7B68EE)
        .addFields(
          { name: '📧 Email', value: clickupUser.email, inline: true },
          { name: '🔗 Status', value: '✅ Linked', inline: true },
          { name: '📅 Linked Since', value: new Date(clickupUser.linked_at).toLocaleDateString(), inline: true }
        );

      if (clickupUser.workspace_id) {
        embed.addFields({ name: '🏢 Workspace', value: 'Connected', inline: true });
      }

      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;