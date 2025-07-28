import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import { Command } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('redeem')
    .setDescription('Redeem available roles for your account'),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const userId = interaction.user.id;
      const user = await database.getUser(userId);
      
      if (!user) {
        await database.createUser(userId, interaction.user.username);
      }

      const userRoles = await database.getUserRoles(userId);
      const userRoleIds = userRoles.map(r => r.role_id);

      const embed = new EmbedBuilder()
        .setTitle('🎭 Role Redemption')
        .setDescription('Choose which type of roles you want to redeem:')
        .setColor(0x5865F2)
        .addFields(
          { name: '🎵 Band Roles', value: 'Special roles for band members and music enthusiasts', inline: true },
          { name: '👥 Team Roles', value: 'Organizational roles for team collaboration', inline: true }
        )
        .setFooter({ text: 'Select a category to view available roles' });

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('redeem_band')
            .setLabel('Band Roles')
            .setEmoji('🎵')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('redeem_team')
            .setLabel('Team Roles')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('view_my_roles')
            .setLabel('My Roles')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Secondary)
        );

      const message = await interaction.editReply({
        embeds: [embed],
        components: [row]
      });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000
      });

      collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.user.id !== interaction.user.id) {
          await buttonInteraction.reply({ content: 'This button is not for you!', ephemeral: true });
          return;
        }

        if (buttonInteraction.customId === 'view_my_roles') {
          const myRoles = await database.getUserRoles(userId);
          
          if (myRoles.length === 0) {
            await buttonInteraction.reply({
              content: '📋 You haven\'t redeemed any roles yet!',
              ephemeral: true
            });
            return;
          }

          const rolesEmbed = new EmbedBuilder()
            .setTitle('📋 Your Redeemed Roles')
            .setColor(0x5865F2)
            .setDescription(myRoles.map(r => `• **${r.role_name}** (${r.role_type})\n  ${r.description || 'No description'}`).join('\n\n'));

          await buttonInteraction.reply({
            embeds: [rolesEmbed],
            ephemeral: true
          });
          return;
        }

        const roleType = buttonInteraction.customId === 'redeem_band' ? 'band' : 'team';
        const availableRoles = await database.getRedeemableRoles(roleType);
        
        const redeemableRoles = availableRoles.filter(r => !userRoleIds.includes(r.role_id));

        if (redeemableRoles.length === 0) {
          await buttonInteraction.reply({
            content: `You have already redeemed all available ${roleType} roles!`,
            ephemeral: true
          });
          return;
        }

        const roleOptions = redeemableRoles.map(role => ({
          label: role.role_name,
          description: role.description || `${role.role_type} role`,
          value: role.role_id,
          emoji: roleType === 'band' ? '🎵' : '👥'
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`select_${roleType}_role`)
          .setPlaceholder(`Choose a ${roleType} role to redeem`)
          .addOptions(roleOptions);

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(selectMenu);

        const roleEmbed = new EmbedBuilder()
          .setTitle(`${roleType === 'band' ? '🎵' : '👥'} Available ${roleType.charAt(0).toUpperCase() + roleType.slice(1)} Roles`)
          .setDescription(`Select a ${roleType} role to redeem:`)
          .setColor(roleType === 'band' ? 0xE91E63 : 0x3F51B5)
          .setFooter({ text: 'You can only redeem each role once' });

        await buttonInteraction.update({
          embeds: [roleEmbed],
          components: [selectRow]
        });
      });

      const selectCollector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 300000
      });

      selectCollector.on('collect', async (selectInteraction) => {
        if (selectInteraction.user.id !== interaction.user.id) {
          await selectInteraction.reply({ content: 'This menu is not for you!', ephemeral: true });
          return;
        }

        const selectedRoleId = selectInteraction.values[0];
        const allRoles = await database.getRedeemableRoles();
        const selectedRole = allRoles.find(r => r.role_id === selectedRoleId);

        if (!selectedRole) {
          await selectInteraction.reply({
            content: 'This role no longer exists!',
            ephemeral: true
          });
          return;
        }

        const success = await database.redeemRole(userId, selectedRoleId);

        if (!success) {
          await selectInteraction.reply({
            content: 'You have already redeemed this role!',
            ephemeral: true
          });
          return;
        }

        try {
          const member = await interaction.guild?.members.fetch(userId);
          const discordRole = interaction.guild?.roles.cache.get(selectedRoleId);
          
          if (member && discordRole) {
            await member.roles.add(discordRole);
          }
        } catch (error) {
          logger.error('Failed to add Discord role:', error);
        }

        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Role Redeemed!')
          .setDescription(`You have successfully redeemed the **${selectedRole.role_name}** role!`)
          .setColor(0x00C853)
          .addFields(
            { name: 'Role Type', value: selectedRole.role_type, inline: true },
            { name: 'Description', value: selectedRole.description || 'No description', inline: true }
          );

        await selectInteraction.update({
          embeds: [successEmbed],
          components: []
        });

        collector.stop();
        selectCollector.stop();
      });

      collector.on('end', () => {
        if (!message.deleted) {
          interaction.editReply({ components: [] }).catch(() => {});
        }
      });

    } catch (error) {
      logger.error('Redeem command error:', error);
      await interaction.editReply({
        content: 'An error occurred while processing your request. Please try again later.'
      });
    }
  },
};

export default command;