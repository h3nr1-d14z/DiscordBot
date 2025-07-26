import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your or another user\'s balance')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check balance for')
        .setRequired(false)
    ),
  
  category: CommandCategory.Economy,
  cooldown: 3,
  
  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    
    let user = await database.getUser(targetUser.id);
    if (!user) {
      if (targetUser.id === interaction.user.id) {
        // Create user if checking own balance
        user = await database.createUser(targetUser.id, targetUser.username);
      } else {
        await interaction.reply({
          content: '❌ That user hasn\'t started playing yet!',
          ephemeral: true
        });
        return;
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('💰 Balance')
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: 'User', value: targetUser.username, inline: true },
        { name: 'Coins', value: `💰 ${user.balance}`, inline: true },
        { name: 'Level', value: `📊 ${user.level}`, inline: true },
        { name: 'XP', value: `⭐ ${user.xp}`, inline: true },
        { name: 'Daily Streak', value: `🔥 ${user.dailyStreak} days`, inline: true }
      )
      .setFooter({ 
        text: targetUser.id === interaction.user.id ? 'Your balance' : `${targetUser.username}'s balance`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;