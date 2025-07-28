import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Command } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rolemanage')
    .setDescription('Manage redeemable roles (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a new redeemable role')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The Discord role to make redeemable')
            .setRequired(true))
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Role type (band or team)')
            .setRequired(true)
            .addChoices(
              { name: 'Band', value: 'band' },
              { name: 'Team', value: 'team' }
            ))
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Description of the role')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all redeemable roles')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Filter by role type')
            .setRequired(false)
            .addChoices(
              { name: 'Band', value: 'band' },
              { name: 'Team', value: 'team' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a redeemable role')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The Discord role to remove from redeemable list')
            .setRequired(true))),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'add': {
          const role = interaction.options.getRole('role', true);
          const type = interaction.options.getString('type', true) as 'band' | 'team';
          const description = interaction.options.getString('description');

          try {
            await database.addRedeemableRole(role.id, role.name, type, description || undefined);

            const embed = new EmbedBuilder()
              .setTitle('✅ Role Added')
              .setDescription(`Successfully added **${role.name}** as a redeemable ${type} role!`)
              .setColor(0x00C853)
              .addFields(
                { name: 'Role', value: role.toString(), inline: true },
                { name: 'Type', value: type, inline: true },
                { name: 'Description', value: description || 'No description', inline: false }
              );

            await interaction.editReply({ embeds: [embed] });
          } catch (error: any) {
            if (error.code === 'SQLITE_CONSTRAINT') {
              await interaction.editReply({
                content: 'This role is already in the redeemable roles list!'
              });
            } else {
              throw error;
            }
          }
          break;
        }

        case 'list': {
          const typeFilter = interaction.options.getString('type') as 'band' | 'team' | null;
          const roles = await database.getRedeemableRoles(typeFilter || undefined);

          if (roles.length === 0) {
            await interaction.editReply({
              content: typeFilter ? `No ${typeFilter} roles found.` : 'No redeemable roles found.'
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle('📋 Redeemable Roles')
            .setDescription(typeFilter ? `Showing ${typeFilter} roles:` : 'Showing all redeemable roles:')
            .setColor(0x5865F2);

          const bandRoles = roles.filter(r => r.role_type === 'band');
          const teamRoles = roles.filter(r => r.role_type === 'team');

          if (bandRoles.length > 0 && (!typeFilter || typeFilter === 'band')) {
            embed.addFields({
              name: '🎵 Band Roles',
              value: bandRoles.map(r => {
                const role = interaction.guild?.roles.cache.get(r.role_id);
                return `• ${role ? role.toString() : r.role_name} - ${r.description || 'No description'}`;
              }).join('\n'),
              inline: false
            });
          }

          if (teamRoles.length > 0 && (!typeFilter || typeFilter === 'team')) {
            embed.addFields({
              name: '👥 Team Roles',
              value: teamRoles.map(r => {
                const role = interaction.guild?.roles.cache.get(r.role_id);
                return `• ${role ? role.toString() : r.role_name} - ${r.description || 'No description'}`;
              }).join('\n'),
              inline: false
            });
          }

          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'remove': {
          const role = interaction.options.getRole('role', true);
          
          await database.run(
            'UPDATE redeemable_roles SET is_active = 0 WHERE role_id = ?',
            [role.id]
          );

          const embed = new EmbedBuilder()
            .setTitle('✅ Role Removed')
            .setDescription(`Successfully removed **${role.name}** from redeemable roles!`)
            .setColor(0xF44336);

          await interaction.editReply({ embeds: [embed] });
          break;
        }
      }
    } catch (error) {
      logger.error('Role manage command error:', error);
      await interaction.editReply({
        content: 'An error occurred while managing roles. Please try again later.'
      });
    }
  },
};

export default command;