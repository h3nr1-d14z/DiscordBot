import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong and bot latency!'),
  
  category: CommandCategory.Utility,
  cooldown: 5,
  
  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({ 
      content: 'Pinging...', 
      fetchReply: true 
    });
    
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);
    
    await interaction.editReply(
      `🏓 Pong!\n` +
      `💬 **Latency**: ${latency}ms\n` +
      `📡 **API Latency**: ${apiLatency}ms`
    );
  },
};

export default command;