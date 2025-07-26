import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { musicService } from '../../services/musicService';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the paused song'),
  
  category: CommandCategory.Music,
  cooldown: 3,
  
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server!',
        ephemeral: true
      });
      return;
    }
    
    const queue = musicService.getQueue(interaction.guild.id);
    
    if (!queue) {
      await interaction.reply({
        content: '❌ There is no music in the queue!',
        ephemeral: true
      });
      return;
    }
    
    const resumed = musicService.resume(interaction.guild.id);
    
    if (resumed) {
      await interaction.reply('▶️ Music resumed!');
    } else {
      await interaction.reply('❌ The music is not paused!');
    }
  },
};

export default command;