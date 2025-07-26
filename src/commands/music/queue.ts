import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { musicService } from '../../services/musicService';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the music queue'),
  
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
    
    if (!queue || queue.tracks.length === 0) {
      await interaction.reply({
        content: '📭 The queue is empty!',
        ephemeral: true
      });
      return;
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🎵 Music Queue')
      .setDescription(
        queue.tracks.slice(0, 10).map((track, index) => {
          const prefix = index === 0 ? '**Now Playing:**' : `**${index}.**`;
          return `${prefix} [${track.title}](${track.url}) - ${track.duration}`;
        }).join('\n')
      );
    
    if (queue.tracks.length > 10) {
      embed.setFooter({ 
        text: `And ${queue.tracks.length - 10} more songs...` 
      });
    }
    
    const loopStatus = queue.loop ? '🔂 Track' : queue.loopQueue ? '🔁 Queue' : '❌ Off';
    embed.addFields(
      { name: 'Total Songs', value: queue.tracks.length.toString(), inline: true },
      { name: 'Loop', value: loopStatus, inline: true },
      { name: 'Volume', value: `${queue.volume}%`, inline: true }
    );
    
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;