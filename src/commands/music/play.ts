import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType, GuildMember } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { musicService } from '../../services/musicService';
import { logger } from '../../utils/logger';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube (search query or URL)')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Song name to search or YouTube URL')
        .setRequired(true)
    ),
  
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
    
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;
    
    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ You need to be in a voice channel to play music!',
        ephemeral: true
      });
      return;
    }
    
    if (voiceChannel.type !== ChannelType.GuildVoice) {
      await interaction.reply({
        content: '❌ You need to be in a voice channel!',
        ephemeral: true
      });
      return;
    }
    
    const permissions = voiceChannel.permissionsFor(interaction.client.user!);
    if (!permissions?.has(['Connect', 'Speak'])) {
      await interaction.reply({
        content: '❌ I need permissions to join and speak in your voice channel!',
        ephemeral: true
      });
      return;
    }
    
    await interaction.deferReply();
    
    const query = interaction.options.getString('query', true);
    
    try {
      const track = await musicService.searchTrack(query);
      
      if (!track) {
        await interaction.editReply('❌ No results found!');
        return;
      }
      
      track.requestedBy = interaction.user.id;
      
      await musicService.addTrack(interaction.guild, track, voiceChannel, interaction.channel as any);
      
      const queue = musicService.getQueue(interaction.guild.id);
      const queuePosition = queue ? queue.tracks.length : 1;
      
      if (queuePosition === 1) {
        await interaction.editReply(`🎵 Playing **${track.title}**`);
      } else {
        await interaction.editReply({
          embeds: [{
            color: 0x0099FF,
            title: '✅ Added to Queue',
            description: `[${track.title}](${track.url})`,
            fields: [
              { name: 'Duration', value: track.duration, inline: true },
              { name: 'Position', value: `#${queuePosition}`, inline: true },
            ],
            thumbnail: { url: track.thumbnail },
            footer: {
              text: `Requested by ${interaction.user.username}`,
              iconURL: interaction.user.displayAvatarURL()
            }
          }]
        });
      }
    } catch (error) {
      logger.error('Failed to play track:', error);
      await interaction.editReply('❌ An error occurred while trying to play the track!');
    }
  },
};

export default command;