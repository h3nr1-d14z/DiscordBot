import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { musicService } from '../../services/musicService';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the currently playing song'),
  
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
    
    if (!queue || !queue.playing || queue.tracks.length === 0) {
      await interaction.reply({
        content: '❌ There is no music playing!',
        ephemeral: true
      });
      return;
    }
    
    const currentTrack = queue.tracks[0];
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🎵 Now Playing')
      .setDescription(`[${currentTrack.title}](${currentTrack.url})`)
      .setThumbnail(currentTrack.thumbnail)
      .addFields(
        { name: 'Duration', value: currentTrack.duration, inline: true },
        { name: 'Requested by', value: currentTrack.requestedBy ? `<@${currentTrack.requestedBy}>` : 'Unknown', inline: true },
        { name: 'Volume', value: `${queue.volume}%`, inline: true }
      );
    
    if (queue.loop) {
      embed.addFields({ name: 'Loop', value: '🔂 Track', inline: true });
    } else if (queue.loopQueue) {
      embed.addFields({ name: 'Loop', value: '🔁 Queue', inline: true });
    }
    
    if (queue.tracks.length > 1) {
      embed.addFields({ 
        name: 'Up Next', 
        value: `${queue.tracks[1].title} and ${queue.tracks.length - 2} more...`, 
        inline: false 
      });
    }
    
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;