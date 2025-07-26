import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { musicService } from '../../services/musicService';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the music queue'),
  
  category: CommandCategory.Music,
  cooldown: 5,
  
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server!',
        ephemeral: true
      });
      return;
    }
    
    const queue = musicService.getQueue(interaction.guild.id);
    
    if (!queue || queue.tracks.length <= 1) {
      await interaction.reply({
        content: '❌ Not enough songs in the queue to shuffle!',
        ephemeral: true
      });
      return;
    }
    
    const shuffled = musicService.shuffle(interaction.guild.id);
    
    if (shuffled) {
      await interaction.reply('🔀 Queue shuffled!');
    } else {
      await interaction.reply('❌ Failed to shuffle the queue!');
    }
  },
};

export default command;