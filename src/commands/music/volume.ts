import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { musicService } from '../../services/musicService';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Adjust the music volume')
    .addIntegerOption(option =>
      option
        .setName('level')
        .setDescription('Volume level (0-100)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
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
    
    const queue = musicService.getQueue(interaction.guild.id);
    
    if (!queue) {
      await interaction.reply({
        content: '❌ There is no music playing!',
        ephemeral: true
      });
      return;
    }
    
    const volume = interaction.options.getInteger('level', true);
    const success = musicService.setVolume(interaction.guild.id, volume);
    
    if (success) {
      const volumeEmoji = volume === 0 ? '🔇' : volume < 30 ? '🔈' : volume < 70 ? '🔉' : '🔊';
      await interaction.reply(`${volumeEmoji} Volume set to **${volume}%**`);
    } else {
      await interaction.reply('❌ Failed to set volume!');
    }
  },
};

export default command;