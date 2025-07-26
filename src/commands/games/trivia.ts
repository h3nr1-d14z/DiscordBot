import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType
} from 'discord.js';
import axios from 'axios';
import { BotCommand, CommandCategory, GameType, TriviaQuestion } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';

interface TriviaResponse {
  response_code: number;
  results: TriviaQuestion[];
}

const categoryMap: Record<string, number> = {
  'general': 9,
  'books': 10,
  'film': 11,
  'music': 12,
  'television': 14,
  'video_games': 15,
  'science': 17,
  'computers': 18,
  'mathematics': 19,
  'sports': 21,
  'geography': 22,
  'history': 23,
  'politics': 24,
  'animals': 27,
  'vehicles': 28,
  'anime': 31,
};

const difficultyRewards = {
  easy: { xp: 10, coins: 5 },
  medium: { xp: 20, coins: 10 },
  hard: { xp: 30, coins: 20 },
};

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Play a trivia game!')
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Choose a trivia category')
        .setRequired(false)
        .addChoices(
          { name: 'General Knowledge', value: 'general' },
          { name: 'Books', value: 'books' },
          { name: 'Film', value: 'film' },
          { name: 'Music', value: 'music' },
          { name: 'Video Games', value: 'video_games' },
          { name: 'Science & Nature', value: 'science' },
          { name: 'Computers', value: 'computers' },
          { name: 'Sports', value: 'sports' },
          { name: 'Geography', value: 'geography' },
          { name: 'History', value: 'history' },
          { name: 'Animals', value: 'animals' },
          { name: 'Anime & Manga', value: 'anime' }
        )
    )
    .addStringOption(option =>
      option
        .setName('difficulty')
        .setDescription('Choose difficulty level')
        .setRequired(false)
        .addChoices(
          { name: 'Easy', value: 'easy' },
          { name: 'Medium', value: 'medium' },
          { name: 'Hard', value: 'hard' }
        )
    ),
  
  category: CommandCategory.Games,
  cooldown: 10,
  
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    
    const category = interaction.options.getString('category');
    const difficulty = interaction.options.getString('difficulty') || 'medium';
    
    try {
      // Build API URL
      let apiUrl = 'https://opentdb.com/api.php?amount=1&type=multiple';
      if (category && categoryMap[category]) {
        apiUrl += `&category=${categoryMap[category]}`;
      }
      apiUrl += `&difficulty=${difficulty}`;
      
      // Fetch question
      const response = await axios.get<TriviaResponse>(apiUrl);
      
      if (response.data.response_code !== 0 || response.data.results.length === 0) {
        await interaction.editReply({
          content: '❌ Failed to fetch a trivia question. Please try again!'
        });
        return;
      }
      
      const question = response.data.results[0];
      
      // Decode HTML entities
      const decodeHTML = (text: string): string => {
        return text
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&ldquo;/g, '"')
          .replace(/&rdquo;/g, '"')
          .replace(/&rsquo;/g, "'");
      };
      
      question.question = decodeHTML(question.question);
      question.correct_answer = decodeHTML(question.correct_answer);
      question.incorrect_answers = question.incorrect_answers.map(ans => decodeHTML(ans));
      
      // Shuffle answers
      const allAnswers = [...question.incorrect_answers, question.correct_answer];
      const shuffledAnswers = allAnswers.sort(() => Math.random() - 0.5);
      const correctIndex = shuffledAnswers.indexOf(question.correct_answer);
      
      // Create embed
      const rewards = difficultyRewards[difficulty as keyof typeof difficultyRewards];
      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🧠 Trivia Question')
        .setDescription(question.question)
        .addFields(
          { name: 'Category', value: question.category, inline: true },
          { name: 'Difficulty', value: difficulty.charAt(0).toUpperCase() + difficulty.slice(1), inline: true },
          { name: 'Reward', value: `💰 ${rewards.coins} coins | ⭐ ${rewards.xp} XP`, inline: true }
        )
        .setFooter({ 
          text: 'You have 15 seconds to answer!',
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();
      
      // Create buttons
      const row = new ActionRowBuilder<ButtonBuilder>();
      const buttonEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
      
      shuffledAnswers.forEach((answer, index) => {
        const button = new ButtonBuilder()
          .setCustomId(`trivia_${index}`)
          .setLabel(`${answer}`)
          .setEmoji(buttonEmojis[index])
          .setStyle(ButtonStyle.Secondary);
        row.addComponents(button);
      });
      
      // Add answers to embed
      let answersText = '';
      shuffledAnswers.forEach((answer, index) => {
        answersText += `${buttonEmojis[index]} ${answer}\n`;
      });
      embed.addFields({ name: 'Options', value: answersText });
      
      const message = await interaction.editReply({
        embeds: [embed],
        components: [row]
      });
      
      // Set up collector
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 15000 // 15 seconds
      });
      
      let answered = false;
      
      collector.on('collect', async (i: ButtonInteraction) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: 'This trivia question is not for you!',
            ephemeral: true
          });
          return;
        }
        
        answered = true;
        const selectedIndex = parseInt(i.customId.split('_')[1]);
        const isCorrect = selectedIndex === correctIndex;
        
        // Update user stats
        const user = await database.getUser(interaction.user.id);
        if (!user) {
          await database.createUser(interaction.user.id, interaction.user.username);
        }
        
        const rewards = difficultyRewards[difficulty as keyof typeof difficultyRewards];
        
        if (isCorrect) {
          await database.updateGameStats(interaction.user.id, GameType.Trivia, { wins: 1 });
          await database.updateUser(interaction.user.id, {
            xp: (user?.xp || 0) + rewards.xp,
            balance: (user?.balance || 0) + rewards.coins
          });
        } else {
          await database.updateGameStats(interaction.user.id, GameType.Trivia, { losses: 1 });
          await database.updateUser(interaction.user.id, {
            xp: (user?.xp || 0) + 5 // Consolation XP
          });
        }
        
        // Create result embed
        const resultEmbed = new EmbedBuilder()
          .setColor(isCorrect ? 0x00FF00 : 0xFF0000)
          .setTitle(isCorrect ? '✅ Correct!' : '❌ Incorrect!');
        
        if (isCorrect) {
          resultEmbed
            .setDescription(question.question)
            .addFields(
              { name: 'Category', value: question.category, inline: true },
              { name: 'Difficulty', value: difficulty.charAt(0).toUpperCase() + difficulty.slice(1), inline: true },
              { name: 'Reward', value: `💰 ${rewards.coins} coins | ⭐ ${rewards.xp} XP`, inline: true }
            )
            .setFooter({ 
              text: 'Great job!',
              iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();
        } else {
          resultEmbed
            .setDescription(question.question)
            .addFields(
              { name: 'Your Answer', value: shuffledAnswers[selectedIndex], inline: true },
              { name: 'Correct Answer', value: question.correct_answer, inline: true },
              { name: 'Consolation', value: '⭐ 5 XP', inline: true }
            )
            .setFooter({ 
              text: 'Better luck next time!',
              iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();
        }
        
        // Disable all buttons
        row.components.forEach((button, index) => {
          button.setDisabled(true);
          if (index === correctIndex) {
            button.setStyle(ButtonStyle.Success);
          } else if (index === selectedIndex && !isCorrect) {
            button.setStyle(ButtonStyle.Danger);
          }
        });
        
        await i.update({
          embeds: [resultEmbed],
          components: [row]
        });
        
        collector.stop();
      });
      
      collector.on('end', async () => {
        if (!answered) {
          const timeoutEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('⏰ Time\'s Up!')
            .setDescription(question.question)
            .addFields({
              name: 'Correct Answer',
              value: question.correct_answer,
              inline: false
            });
          
          // Disable all buttons and highlight correct answer
          row.components.forEach((button, index) => {
            button.setDisabled(true);
            if (index === correctIndex) {
              button.setStyle(ButtonStyle.Success);
            }
          });
          
          await interaction.editReply({
            embeds: [timeoutEmbed],
            components: [row]
          }).catch(() => {});
        }
      });
      
    } catch (error) {
      logger.error('Failed to fetch trivia question:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching the trivia question. Please try again!'
      });
    }
  },
};

export default command;