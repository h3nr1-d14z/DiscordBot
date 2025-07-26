import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BotCommand, CommandCategory, TransactionType } from '../../types';
import { database } from '../../services/database';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward!'),
  
  category: CommandCategory.Economy,
  cooldown: 5,
  
  async execute(interaction: ChatInputCommandInteraction) {
    let user = await database.getUser(interaction.user.id);
    
    if (!user) {
      user = await database.createUser(interaction.user.id, interaction.user.username);
    }
    
    const now = new Date();
    const lastDaily = user.lastDaily ? new Date(user.lastDaily) : null;
    
    if (lastDaily) {
      const timeDiff = now.getTime() - lastDaily.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        const hoursUntilNext = 24 - hoursDiff;
        const hours = Math.floor(hoursUntilNext);
        const minutes = Math.floor((hoursUntilNext - hours) * 60);
        
        await interaction.reply({
          content: `❌ You already claimed your daily reward! Come back in ${hours}h ${minutes}m`,
          ephemeral: true
        });
        return;
      }
    }
    
    // Calculate streak
    let streak = user.dailyStreak;
    if (lastDaily) {
      const daysDiff = Math.floor((now.getTime() - lastDaily.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === 1) {
        streak++;
      } else if (daysDiff > 1) {
        streak = 1;
      }
    } else {
      streak = 1;
    }
    
    // Calculate reward (base + streak bonus)
    const baseReward = 50;
    const streakBonus = Math.min(streak * 10, 150); // Max 150 bonus
    const totalReward = baseReward + streakBonus;
    
    // Bonus XP
    const xpReward = 50 + (streak * 5);
    
    // Update user
    await database.updateUser(interaction.user.id, {
      balance: user.balance + totalReward,
      xp: user.xp + xpReward,
      dailyStreak: streak,
      lastDaily: now
    });
    
    // Record transaction
    await database.addTransaction(
      interaction.user.id,
      totalReward,
      TransactionType.Daily,
      `Daily reward (${streak} day streak)`
    );
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✨ Daily Reward Claimed!')
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: 'Base Reward', value: `💰 ${baseReward} coins`, inline: true },
        { name: 'Streak Bonus', value: `💰 ${streakBonus} coins`, inline: true },
        { name: 'Total Coins', value: `💰 **${totalReward} coins**`, inline: true },
        { name: 'XP Earned', value: `⭐ ${xpReward} XP`, inline: true },
        { name: 'Current Streak', value: `🔥 ${streak} days`, inline: true },
        { name: 'New Balance', value: `💰 ${user.balance + totalReward} coins`, inline: true }
      )
      .setFooter({ 
        text: 'Come back tomorrow to keep your streak!',
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    
    // Special message for milestones
    if (streak % 7 === 0 && streak > 0) {
      embed.setDescription(`🎉 **${streak} Day Streak!** Keep it up!`);
    }
    
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;