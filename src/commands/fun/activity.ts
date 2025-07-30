import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, VoiceChannel, StageChannel } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { logger } from '../../utils/logger';
import { DiscordActivities, createDiscordActivity, getActivityInfo, ActivityName } from '../../services/discordActivities';

const command: BotCommand = {
  category: CommandCategory.Fun,
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('Start a Discord Activity in your voice channel!')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('The activity to start')
        .setRequired(true)
        .addChoices(
          { name: '♠️ Poker Night', value: 'POKER_NIGHT' },
          { name: '🎣 Fishing', value: 'FISHING' },
          { name: '♟️ Chess', value: 'CHESS_IN_THE_PARK' },
          { name: '🏁 Checkers', value: 'CHECKERS_IN_THE_PARK' },
          { name: '📝 Letter League', value: 'LETTER_LEAGUE' },
          { name: '🍔 Word Snacks', value: 'WORD_SNACKS' },
          { name: '🎨 Sketch Heads', value: 'SKETCH_HEADS' },
          { name: '⚡ SpellCast', value: 'SPELL_CAST' },
          { name: '⛳ Putt Party', value: 'PUTT_PARTY' },
          { name: '🏝️ Land-io', value: 'LAND_IO' },
          { name: '⚽ Bobble League', value: 'BOBBLE_LEAGUE' },
          { name: '❓ Ask Away', value: 'ASK_AWAY' },
          { name: '😂 Know What I Meme', value: 'KNOW_WHAT_I_MEME' },
          { name: '💥 Bash Out', value: 'BASH_OUT' },
          { name: '☎️ Gartic Phone', value: 'GARTIC_PHONE' },
          { name: '📺 Watch Together', value: 'WATCH_TOGETHER' },
          { name: '✏️ Whiteboard', value: 'WHITEBOARD' },
          { name: '🃏 Blazing 8s', value: 'BLAZING_8S' }
        )),

  async execute(interaction: ChatInputCommandInteraction) {
    // Check if user is in a voice channel
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server!',
        ephemeral: true
      });
      return;
    }

    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member || !member.voice.channel) {
      await interaction.reply({
        content: '❌ You must be in a voice channel to start an activity!',
        ephemeral: true
      });
      return;
    }

    const voiceChannel = member.voice.channel;
    
    // Check if the channel is a voice or stage channel
    if (!(voiceChannel instanceof VoiceChannel) && !(voiceChannel instanceof StageChannel)) {
      await interaction.reply({
        content: '❌ Activities can only be started in voice or stage channels!',
        ephemeral: true
      });
      return;
    }

    const activityType = interaction.options.getString('type', true) as ActivityName;
    const activityId = DiscordActivities[activityType];
    const activityInfo = getActivityInfo(activityType);

    await interaction.deferReply();

    try {
      // Create the activity
      const inviteUrl = await createDiscordActivity(voiceChannel, activityId);
      
      if (!inviteUrl) {
        await interaction.editReply({
          content: '❌ Failed to create the activity. Please try again later.'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎮 ${activityInfo.name} Started!`)
        .setDescription(activityInfo.description)
        .addFields(
          { name: 'Voice Channel', value: voiceChannel.name, inline: true },
          { name: 'Host', value: interaction.user.username, inline: true },
          { name: 'Participants', value: `${voiceChannel.members.size} in voice`, inline: true }
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'Click the button below to join!' })
        .setTimestamp();

      const joinButton = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel(`Join ${activityInfo.name}`)
            .setURL(inviteUrl)
            .setStyle(ButtonStyle.Link)
            .setEmoji('🎮')
        );

      await interaction.editReply({
        embeds: [embed],
        components: [joinButton]
      });
    } catch (error: any) {
      logger.error('Error creating activity:', error);
      
      let errorMessage = 'Failed to create the activity.';
      
      if (error.code === 50013) {
        errorMessage = 'Missing permissions. Make sure the bot has "Create Instant Invite" permission in this voice channel.';
      } else if (error.code === 50035) {
        errorMessage = 'This activity may not be available in your region or server.';
      }
      
      await interaction.editReply({
        content: `❌ ${errorMessage}`
      });
    }
  },
};

export default command;