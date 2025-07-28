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
          const guildId = interaction.guildId!;

          // Check if role already exists in this guild
          const existingRole = await database.getRedeemableRole(guildId, role.id);
          
          if (existingRole) {
            // If role exists but is inactive, reactivate it
            if (!existingRole.is_active) {
              await database.reactivateRedeemableRole(guildId, role.id, description || undefined);
              
              const embed = new EmbedBuilder()
                .setTitle('✅ Role Reactivated')
                .setDescription(`**${role.name}** has been reactivated in the redeemable roles list!`)
                .setColor(0x00C853)
                .addFields(
                  { name: 'Role', value: role.toString(), inline: true },
                  { name: 'Type', value: existingRole.role_type, inline: true },
                  { name: 'Description', value: description || existingRole.description || 'No description', inline: false }
                );
              
              if (description && description !== existingRole.description) {
                embed.addFields({ name: '📝 Updated', value: 'Description has been updated', inline: true });
              }
              
              await interaction.editReply({ embeds: [embed] });
              return;
            }
            
            // Role is already active
            const embed = new EmbedBuilder()
              .setTitle('⚠️ Role Already Active')
              .setDescription(`**${role.name}** is already active in the redeemable roles list!`)
              .setColor(0xFFA726)
              .addFields(
                { name: 'Role', value: role.toString(), inline: true },
                { name: 'Type', value: existingRole.role_type, inline: true },
                { name: 'Description', value: existingRole.description || 'No description', inline: false }
              );
            
            await interaction.editReply({ embeds: [embed] });
            return;
          }

          try {
            await database.addRedeemableRole(guildId, role.id, role.name, type, description || undefined);

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
            logger.error('Error adding redeemable role:', error);
            await interaction.editReply({
              content: '❌ An unexpected error occurred while adding the role. Please try again.'
            });
          }
          break;
        }

        case 'list': {
          const typeFilter = interaction.options.getString('type') as 'band' | 'team' | null;
          const guildId = interaction.guildId!;
          const roles = await database.getRedeemableRoles(guildId, typeFilter || undefined);

          if (roles.length === 0) {
            await interaction.editReply({
              content: typeFilter ? `No ${typeFilter} roles found in this server.` : 'No redeemable roles found in this server.'
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle('📋 Redeemable Roles')
            .setDescription(typeFilter ? `Showing ${typeFilter} roles for this server:` : 'Showing all redeemable roles for this server:')
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
          const guildId = interaction.guildId!;
          
          // Check if role exists in this guild
          const existingRole = await database.getRedeemableRole(guildId, role.id);
          
          if (!existingRole) {
            const embed = new EmbedBuilder()
              .setTitle('❌ Role Not Found')
              .setDescription(`**${role.name}** is not in the redeemable roles list for this server!`)
              .setColor(0xF44336);
            
            await interaction.editReply({ embeds: [embed] });
            return;
          }
          
          if (!existingRole.is_active) {
            const embed = new EmbedBuilder()
              .setTitle('⚠️ Role Already Inactive')
              .setDescription(`**${role.name}** has already been removed from the redeemable roles list!`)
              .setColor(0xFFA726);
            
            await interaction.editReply({ embeds: [embed] });
            return;
          }
          
          await database.removeRedeemableRole(guildId, role.id);

          const embed = new EmbedBuilder()
            .setTitle('✅ Role Removed')
            .setDescription(`Successfully removed **${role.name}** from redeemable roles!`)
            .setColor(0xF44336)
            .addFields(
              { name: 'Role', value: role.toString(), inline: true },
              { name: 'Type', value: existingRole.role_type, inline: true }
            );

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