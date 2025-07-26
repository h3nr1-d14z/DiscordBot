import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { musicService } from '../../services/musicService';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song'),
  
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
    
    if (!queue || !queue.playing) {
      await interaction.reply({
        content: '❌ There is no music playing!',
        ephemeral: true
      });
      return;
    }
    
    const paused = musicService.pause(interaction.guild.id);
    
    if (paused) {
      await interaction.reply('⏸️ Music paused!');
    } else {
      await interaction.reply('❌ The music is already paused!');
    }
  },
};

export default command;