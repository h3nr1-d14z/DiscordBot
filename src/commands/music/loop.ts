import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { musicService } from '../../services/musicService';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the loop mode')
    .addStringOption(option =>
      option
        .setName('mode')
        .setDescription('Loop mode')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' }
        )
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
    
    const mode = interaction.options.getString('mode', true) as 'off' | 'track' | 'queue';
    const success = musicService.setLoop(interaction.guild.id, mode);
    
    if (success) {
      const modeEmoji = mode === 'track' ? '🔂' : mode === 'queue' ? '🔁' : '❌';
      const modeText = mode === 'track' ? 'current track' : mode === 'queue' ? 'entire queue' : 'disabled';
      await interaction.reply(`${modeEmoji} Loop ${modeText}`);
    } else {
      await interaction.reply('❌ Failed to set loop mode!');
    }
  },
};

export default command;