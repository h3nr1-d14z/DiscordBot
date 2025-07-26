import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { musicService } from '../../services/musicService';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),
  
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
    
    const skippedTrack = musicService.skip(interaction.guild.id);
    
    if (skippedTrack) {
      await interaction.reply(`⏭️ Skipped **${skippedTrack.title}**`);
    } else {
      await interaction.reply('❌ Failed to skip the track!');
    }
  },
};

export default command;