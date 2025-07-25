import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { BotCommand, CommandCategory } from '../../types';
import { logger } from '../../utils/logger';

interface JokeResponse {
  error: boolean;
  category: string;
  type: string;
  joke?: string;
  setup?: string;
  delivery?: string;
  flags: {
    nsfw: boolean;
    religious: boolean;
    political: boolean;
    racist: boolean;
    sexist: boolean;
    explicit: boolean;
  };
  safe: boolean;
  id: number;
  lang: string;
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('joke')
    .setDescription('Get a random joke')
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Joke category')
        .setRequired(false)
        .addChoices(
          { name: 'Any', value: 'Any' },
          { name: 'Programming', value: 'Programming' },
          { name: 'Miscellaneous', value: 'Miscellaneous' },
          { name: 'Pun', value: 'Pun' },
          { name: 'Spooky', value: 'Spooky' },
          { name: 'Christmas', value: 'Christmas' }
        )
    ),
  
  category: CommandCategory.Fun,
  cooldown: 5,
  
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    
    const category = interaction.options.getString('category') || 'Any';
    
    try {
      const response = await axios.get<JokeResponse>(
        `https://v2.jokeapi.dev/joke/${category}?safe-mode`
      );
      
      const joke = response.data;
      
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('😄 Joke')
        .setFooter({ 
          text: `Category: ${joke.category}`,
          iconURL: interaction.user.displayAvatarURL()
        });
      
      if (joke.type === 'single') {
        embed.setDescription(joke.joke!);
      } else if (joke.type === 'twopart') {
        embed.addFields(
          { name: 'Setup', value: joke.setup! },
          { name: 'Delivery', value: joke.delivery! }
        );
      }
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to fetch joke:', error);
      await interaction.editReply({
        content: '❌ Failed to fetch a joke. Please try again later!'
      });
    }
  },
};

export default command;