import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { musicService } from '../../services/musicService';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the music and clear the queue'),
  
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
        content: '❌ There is no music playing!',
        ephemeral: true
      });
      return;
    }
    
    const stopped = musicService.stop(interaction.guild.id);
    
    if (stopped) {
      await interaction.reply('⏹️ Music stopped and queue cleared!');
    } else {
      await interaction.reply('❌ Failed to stop the music!');
    }
  },
};

export default command;