import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';

const responses = [
  // Positive
  'It is certain.',
  'It is decidedly so.',
  'Without a doubt.',
  'Yes definitely.',
  'You may rely on it.',
  'As I see it, yes.',
  'Most likely.',
  'Outlook good.',
  'Yes.',
  'Signs point to yes.',
  
  // Non-committal
  'Reply hazy, try again.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  'Concentrate and ask again.',
  
  // Negative
  'Don\'t count on it.',
  'My reply is no.',
  'My sources say no.',
  'Outlook not so good.',
  'Very doubtful.',
];

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8-ball a question')
    .addStringOption(option =>
      option
        .setName('question')
        .setDescription('Your question for the 8-ball')
        .setRequired(true)
    ),
  
  category: CommandCategory.Fun,
  cooldown: 3,
  
  async execute(interaction: ChatInputCommandInteraction) {
    const question = interaction.options.getString('question', true);
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    const embed = new EmbedBuilder()
      .setColor(0x1C1C1C)
      .setTitle('🎱 Magic 8-Ball')
      .addFields(
        { name: 'Question', value: question },
        { name: 'Answer', value: response }
      )
      .setFooter({ 
        text: `Asked by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;