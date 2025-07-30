import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';
import { SafeInteractionHandler } from '../../utils/interactionUtils';
import axios from 'axios';

interface HangmanGame {
  word: string;
  category: string;
  guessedLetters: Set<string>;
  wrongGuesses: number;
  maxWrongGuesses: number;
  startTime: number;
  isMultiplayer: boolean;
  challenger?: string;
  opponent?: string;
}

const HANGMAN_STAGES = [
  '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```'
];

// Fallback words in case API fails
const FALLBACK_WORDS = {
  animals: ['elephant', 'giraffe', 'penguin', 'dolphin', 'octopus', 'kangaroo', 'butterfly', 'crocodile', 'hamster', 'cheetah'],
  countries: ['australia', 'brazil', 'canada', 'denmark', 'egypt', 'france', 'germany', 'hungary', 'iceland', 'japan'],
  fruits: ['watermelon', 'strawberry', 'pineapple', 'blueberry', 'raspberry', 'blackberry', 'mango', 'papaya', 'coconut', 'dragonfruit'],
  movies: ['inception', 'avatar', 'titanic', 'matrix', 'interstellar', 'gladiator', 'braveheart', 'shawshank', 'godfather', 'starwars'],
  sports: ['basketball', 'football', 'baseball', 'tennis', 'cricket', 'volleyball', 'badminton', 'swimming', 'skiing', 'surfing'],
  technology: ['computer', 'internet', 'smartphone', 'bluetooth', 'artificial', 'quantum', 'robotics', 'cryptocurrency', 'database', 'algorithm']
};

// API word fetchers
async function fetchWordFromAPI(category: string): Promise<{ word: string; actualCategory: string }> {
  try {
    switch (category) {
      case 'animals':
        return await fetchAnimalWord();
      case 'countries':
        return await fetchCountryWord();
      case 'technology':
        return await fetchTechWord();
      case 'random':
        return await fetchRandomWord();
      default:
        // Use direct API for other categories
        return await fetchWordByCategory(category);
    }
  } catch (error) {
    logger.warn(`Failed to fetch word from API for category ${category}, using fallback`);
    return getFallbackWord(category);
  }
}

async function fetchAnimalWord(): Promise<{ word: string; actualCategory: string }> {
  try {
    // Using a simple animal API
    const response = await axios.get('https://zoo-animal-api.herokuapp.com/animals/rand', {
      timeout: 5000
    });
    
    if (response.data && response.data.name) {
      const word = response.data.name.replace(/\s+/g, '').toLowerCase();
      if (word.length >= 4 && word.length <= 12 && /^[a-z]+$/.test(word)) {
        return { word: word.toUpperCase(), actualCategory: 'animals' };
      }
    }
  } catch (error) {
    // Fallback to another animal source
  }
  
  return getFallbackWord('animals');
}

async function fetchCountryWord(): Promise<{ word: string; actualCategory: string }> {
  try {
    const response = await axios.get('https://restcountries.com/v3.1/all?fields=name', {
      timeout: 5000
    });
    
    if (response.data && Array.isArray(response.data)) {
      const countries = response.data
        .map((country: any) => country.name.common)
        .filter((name: string) => name.length >= 4 && name.length <= 12 && /^[a-zA-Z\s]+$/.test(name))
        .map((name: string) => name.replace(/\s+/g, '').toLowerCase());
      
      if (countries.length > 0) {
        const randomCountry = countries[Math.floor(Math.random() * countries.length)];
        return { word: randomCountry.toUpperCase(), actualCategory: 'countries' };
      }
    }
  } catch (error) {
    // Fallback
  }
  
  return getFallbackWord('countries');
}

async function fetchTechWord(): Promise<{ word: string; actualCategory: string }> {
  // For tech words, we'll use a curated list since there's no good free API
  const techWords = [
    'algorithm', 'database', 'javascript', 'python', 'computer', 'internet', 
    'blockchain', 'artificial', 'machine', 'software', 'hardware', 'programming',
    'developer', 'framework', 'application', 'website', 'security', 'encryption',
    'cloud', 'server', 'network', 'protocol', 'interface', 'repository'
  ];
  
  const randomWord = techWords[Math.floor(Math.random() * techWords.length)];
  return { word: randomWord.toUpperCase(), actualCategory: 'technology' };
}

async function fetchRandomWord(): Promise<{ word: string; actualCategory: string }> {
  try {
    // Using wordnik API for random words
    const response = await axios.get('https://api.wordnik.com/v4/words.json/randomWord', {
      params: {
        hasDictionaryDef: true,
        minCorpusCount: 1000,
        maxCorpusCount: -1,
        minDictionaryCount: 1,
        maxDictionaryCount: -1,
        minLength: 4,
        maxLength: 12
      },
      timeout: 5000
    });
    
    if (response.data && response.data.word) {
      const word = response.data.word.toLowerCase();
      if (/^[a-z]+$/.test(word)) {
        return { word: word.toUpperCase(), actualCategory: 'random' };
      }
    }
  } catch (error) {
    // Try another API
    try {
      const response = await axios.get('https://random-words-api.vercel.app/word', {
        timeout: 5000
      });
      
      if (response.data && response.data[0] && response.data[0].word) {
        const word = response.data[0].word.toLowerCase();
        if (word.length >= 4 && word.length <= 12 && /^[a-z]+$/.test(word)) {
          return { word: word.toUpperCase(), actualCategory: 'random' };
        }
      }
    } catch (error2) {
      // Use fallback
    }
  }
  
  // Random fallback from all categories
  const categories = Object.keys(FALLBACK_WORDS);
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  return getFallbackWord(randomCategory);
}

async function fetchWordByCategory(category: string): Promise<{ word: string; actualCategory: string }> {
  // For specific categories like fruits, movies, sports - use fallback
  // These would need specific APIs which are often paid or unreliable
  return getFallbackWord(category);
}

function getFallbackWord(category: string): { word: string; actualCategory: string } {
  const categoryWords = FALLBACK_WORDS[category as keyof typeof FALLBACK_WORDS];
  if (!categoryWords) {
    // Default to animals if category not found
    const word = FALLBACK_WORDS.animals[Math.floor(Math.random() * FALLBACK_WORDS.animals.length)];
    return { word: word.toUpperCase(), actualCategory: 'animals' };
  }
  
  const word = categoryWords[Math.floor(Math.random() * categoryWords.length)];
  return { word: word.toUpperCase(), actualCategory: category };
}

const activeGames = new Map<string, HangmanGame>();

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('hangman')
    .setDescription('Play Hangman - guess the word letter by letter!')
    .addSubcommand(subcommand =>
      subcommand
        .setName('solo')
        .setDescription('Play Hangman by yourself')
        .addStringOption(option =>
          option.setName('category')
            .setDescription('Choose a word category')
            .setRequired(false)
            .addChoices(
              { name: 'Animals', value: 'animals' },
              { name: 'Countries', value: 'countries' },
              { name: 'Fruits', value: 'fruits' },
              { name: 'Movies', value: 'movies' },
              { name: 'Sports', value: 'sports' },
              { name: 'Technology', value: 'technology' },
              { name: 'Random', value: 'random' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('challenge')
        .setDescription('Challenge someone with your own word!')
        .addUserOption(option =>
          option.setName('opponent')
            .setDescription('The player to challenge')
            .setRequired(true))),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'solo') {
      await playSolo(interaction);
    } else if (subcommand === 'challenge') {
      await playChallenge(interaction);
    }
  },
};

async function playSolo(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const gameId = `hangman_${userId}`;

  if (activeGames.has(gameId)) {
    await interaction.reply({
      content: '❌ You already have an active Hangman game!',
      ephemeral: true
    });
    return;
  }

  const categoryChoice = interaction.options.getString('category') || 'random';
  
  // Show loading message
  await interaction.deferReply();
  
  const { word, actualCategory } = await fetchWordFromAPI(categoryChoice);

  const game: HangmanGame = {
    word,
    category: actualCategory,
    guessedLetters: new Set(),
    wrongGuesses: 0,
    maxWrongGuesses: 6,
    startTime: Date.now(),
    isMultiplayer: false
  };

  activeGames.set(gameId, game);

  const embed = createGameEmbed(game, interaction.user.username);
  const guessButton = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('guess_letter')
        .setLabel('Guess a Letter')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Primary)
    );

  const response = await interaction.editReply({
    embeds: [embed],
    components: [guessButton]
  });

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300000
  });

  const interactionHandler = new SafeInteractionHandler(interaction);

  collector.on('collect', async (i) => {
    if (i.user.id !== userId) {
      await interactionHandler.reply(i, {
        content: '❌ This is not your game!',
        ephemeral: true
      });
      return;
    }

    // Create modal for letter input
    const modal = new ModalBuilder()
      .setCustomId('letter_guess_modal')
      .setTitle('Guess a Letter');

    const letterInput = new TextInputBuilder()
      .setCustomId('letter_input')
      .setLabel('Enter a letter (A-Z)')
      .setPlaceholder('Type a single letter...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(1);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(letterInput);
    modal.addComponents(row);

    await i.showModal(modal);

    // Wait for modal submission
    try {
      const modalSubmission = await i.awaitModalSubmit({
        time: 60000,
        filter: (modalInteraction) => modalInteraction.customId === 'letter_guess_modal' && modalInteraction.user.id === userId
      });

      const letter = modalSubmission.fields.getTextInputValue('letter_input').toUpperCase();

      // Validate input
      if (!/^[A-Z]$/.test(letter)) {
        await modalSubmission.reply({
          content: '❌ Please enter a valid letter (A-Z)!',
          flags: 64
        });
        return;
      }

      if (game.guessedLetters.has(letter)) {
        await modalSubmission.reply({
          content: `❌ You already guessed the letter "${letter}"!`,
          flags: 64
        });
        return;
      }

      // Process the guess
      game.guessedLetters.add(letter);

      if (!game.word.includes(letter)) {
        game.wrongGuesses++;
      }

      const isWon = game.word.split('').every(l => game.guessedLetters.has(l));
      const isLost = game.wrongGuesses >= game.maxWrongGuesses;

      if (isWon || isLost) {
        const finalEmbed = createFinalEmbed(game, interaction.user.username, isWon);
        
        // Defer the modal update first
        await modalSubmission.deferUpdate();
        
        // Then update the main interaction
        await interaction.editReply({
          embeds: [finalEmbed],
          components: []
        });

        await saveGameStats(userId, isWon, game);
        activeGames.delete(gameId);
        collector.stop();
      } else {
        const newEmbed = createGameEmbed(game, interaction.user.username);
        const guessButton = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('guess_letter')
              .setLabel('Guess a Letter')
              .setEmoji('✏️')
              .setStyle(ButtonStyle.Primary)
          );
        
        // Defer update and then respond
        await modalSubmission.deferUpdate();
        
        // Update the main message
        await interaction.editReply({
          embeds: [newEmbed],
          components: [guessButton]
        });
        
        // Send feedback as a follow-up
        await interaction.followUp({
          content: game.word.includes(letter) ? `✅ Good guess! "${letter}" is in the word!` : `❌ Sorry, "${letter}" is not in the word.`,
          flags: 64 // Ephemeral flag
        });
      }
    } catch (error) {
      // Modal timed out or error occurred
      console.error('Modal error:', error);
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'time') {
      activeGames.delete(gameId);
      const timeoutEmbed = createFinalEmbed(game, interaction.user.username, false, true);
      await interaction.editReply({
        embeds: [timeoutEmbed],
        components: []
      });
    }
  });
}

async function playChallenge(interaction: ChatInputCommandInteraction) {
  const challenger = interaction.user;
  const opponent = interaction.options.getUser('opponent', true);

  if (opponent.bot) {
    await interaction.reply({
      content: '❌ You cannot challenge a bot!',
      ephemeral: true
    });
    return;
  }

  if (opponent.id === challenger.id) {
    await interaction.reply({
      content: '❌ You cannot challenge yourself!',
      ephemeral: true
    });
    return;
  }

  await interaction.reply({
    content: `${challenger}, please check your DMs to set up the word for the challenge!`,
    ephemeral: true
  });

  try {
    const dmChannel = await challenger.createDM();
    
    const categoryMenu = new StringSelectMenuBuilder()
      .setCustomId('category_select')
      .setPlaceholder('Select a category for your word')
      .addOptions(
        Object.keys(FALLBACK_WORDS).map(cat => ({
          label: cat.charAt(0).toUpperCase() + cat.slice(1),
          value: cat
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(categoryMenu);

    const dmMessage = await dmChannel.send({
      content: '🎯 **Hangman Challenge Setup**\nFirst, select a category for your word:',
      components: [row]
    });

    const categoryCollector = dmMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
      max: 1
    });

    categoryCollector.on('collect', async (i) => {
      const selectedCategory = i.values[0];
      
      await i.update({
        content: `Category: **${selectedCategory}**\n\nNow type the word you want ${opponent} to guess (single word, letters only):`,
        components: []
      });

      const messageCollector = dmChannel.createMessageCollector({
        filter: m => m.author.id === challenger.id,
        time: 60000,
        max: 1
      });

      messageCollector.on('collect', async (message) => {
        const word = message.content.toUpperCase().trim();
        
        if (!/^[A-Z]+$/.test(word) || word.length < 3 || word.length > 15) {
          await message.reply('❌ Invalid word! Please use only letters, 3-15 characters long.');
          messageCollector.stop();
          categoryCollector.stop();
          return;
        }

        await message.reply(`✅ Word set! Starting the challenge with ${opponent}...`);

        // Start the challenge game
        const gameId = `hangman_challenge_${opponent.id}`;
        
        const game: HangmanGame = {
          word,
          category: selectedCategory,
          guessedLetters: new Set(),
          wrongGuesses: 0,
          maxWrongGuesses: 6,
          startTime: Date.now(),
          isMultiplayer: true,
          challenger: challenger.id,
          opponent: opponent.id
        };

        activeGames.set(gameId, game);

        const channel = interaction.channel;
        if (!channel || !('send' in channel)) {
          await message.reply('❌ Cannot start the game in this channel!');
          return;
        }
        
        const embed = createGameEmbed(game, opponent.username, true);
        const guessButton = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('guess_letter_challenge')
              .setLabel('Guess a Letter')
              .setEmoji('✏️')
              .setStyle(ButtonStyle.Primary)
          );

        const gameMessage = await channel.send({
          content: `${opponent}, ${challenger} has challenged you to Hangman!`,
          embeds: [embed],
          components: [guessButton]
        });

        const gameCollector = gameMessage.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 300000
        });

        gameCollector.on('collect', async (btnInt: any) => {
          if (btnInt.user.id !== opponent.id) {
            await btnInt.reply({
              content: '❌ Only the challenged player can make guesses!',
              ephemeral: true
            });
            return;
          }

          // Create modal for letter input
          const modal = new ModalBuilder()
            .setCustomId('letter_guess_modal_challenge')
            .setTitle('Guess a Letter');

          const letterInput = new TextInputBuilder()
            .setCustomId('letter_input')
            .setLabel('Enter a letter (A-Z)')
            .setPlaceholder('Type a single letter...')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(1);

          const row = new ActionRowBuilder<TextInputBuilder>().addComponents(letterInput);
          modal.addComponents(row);

          await btnInt.showModal(modal);

          try {
            const modalSubmission = await btnInt.awaitModalSubmit({
              time: 60000,
              filter: (modalInteraction: any) => modalInteraction.customId === 'letter_guess_modal_challenge' && modalInteraction.user.id === opponent.id
            });

            const letter = modalSubmission.fields.getTextInputValue('letter_input').toUpperCase();

            // Validate input
            if (!/^[A-Z]$/.test(letter)) {
              await modalSubmission.reply({
                content: '❌ Please enter a valid letter (A-Z)!',
                flags: 64
              });
              return;
            }

            if (game.guessedLetters.has(letter)) {
              await modalSubmission.reply({
                content: `❌ You already guessed the letter "${letter}"!`,
                flags: 64
              });
              return;
            }

            // Process the guess
            game.guessedLetters.add(letter);

            if (!game.word.includes(letter)) {
              game.wrongGuesses++;
            }

            const isWon = game.word.split('').every(l => game.guessedLetters.has(l));
            const isLost = game.wrongGuesses >= game.maxWrongGuesses;

            if (isWon || isLost) {
              const finalEmbed = createFinalEmbed(game, opponent.username, isWon, false, challenger.username);
              await modalSubmission.deferUpdate();
              
              await gameMessage.edit({
                embeds: [finalEmbed],
                components: []
              });

              await saveGameStats(opponent.id, isWon, game);
              activeGames.delete(gameId);
              gameCollector.stop();
            } else {
              const newEmbed = createGameEmbed(game, opponent.username, true);
              const guessButton = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId('guess_letter_challenge')
                    .setLabel('Guess a Letter')
                    .setEmoji('✏️')
                    .setStyle(ButtonStyle.Primary)
                );
              
              await modalSubmission.deferUpdate();
              
              await gameMessage.edit({
                embeds: [newEmbed],
                components: [guessButton]
              });
              
              // Send feedback
              await modalSubmission.followUp({
                content: game.word.includes(letter) ? `✅ Good guess! "${letter}" is in the word!` : `❌ Sorry, "${letter}" is not in the word.`,
                flags: 64
              });
            }
          } catch (error) {
            console.error('Modal error:', error);
          }
        });
      });
    });
  } catch (error) {
    logger.error('Error setting up Hangman challenge:', error);
    await interaction.followUp({
      content: '❌ Failed to set up the challenge. Make sure your DMs are open!',
      ephemeral: true
    });
  }
}

function createGameEmbed(game: HangmanGame, playerName: string, hideCategory = false): EmbedBuilder {
  const displayWord = game.word
    .split('')
    .map(letter => game.guessedLetters.has(letter) ? letter : '_')
    .join(' ');

  const embed = new EmbedBuilder()
    .setTitle('🎯 Hangman')
    .setDescription(HANGMAN_STAGES[game.wrongGuesses])
    .addFields(
      { name: 'Word', value: `\`${displayWord}\``, inline: false },
      { name: 'Category', value: hideCategory ? '???' : game.category.charAt(0).toUpperCase() + game.category.slice(1), inline: true },
      { name: 'Wrong Guesses', value: `${game.wrongGuesses}/${game.maxWrongGuesses}`, inline: true },
      { name: 'Letters Used', value: Array.from(game.guessedLetters).sort().join(', ') || 'None', inline: false }
    )
    .setColor(game.wrongGuesses >= 4 ? 0xFF0000 : game.wrongGuesses >= 2 ? 0xFFFF00 : 0x00FF00)
    .setFooter({ text: `Player: ${playerName}` });

  return embed;
}


function createFinalEmbed(game: HangmanGame, playerName: string, won: boolean, timedOut = false, challengerName?: string): EmbedBuilder {
  const duration = Math.floor((Date.now() - game.startTime) / 1000);
  
  const embed = new EmbedBuilder()
    .setTitle(won ? '🎉 You Won!' : timedOut ? '⏱️ Time\'s Up!' : '💀 Game Over!')
    .setDescription(won ? 'Congratulations! You guessed the word!' : `The word was: **${game.word}**`)
    .addFields(
      { name: 'Category', value: game.category.charAt(0).toUpperCase() + game.category.slice(1), inline: true },
      { name: 'Wrong Guesses', value: `${game.wrongGuesses}/${game.maxWrongGuesses}`, inline: true },
      { name: 'Duration', value: `${duration}s`, inline: true }
    )
    .setColor(won ? 0x00FF00 : 0xFF0000)
    .setFooter({ text: `Player: ${playerName}` });

  if (game.isMultiplayer && challengerName) {
    embed.addFields({ 
      name: 'Challenge', 
      value: won ? `You beat ${challengerName}'s word!` : `${challengerName} stumped you!` 
    });
  }

  if (!won) {
    embed.setDescription(`${embed.data.description}\n\n${HANGMAN_STAGES[game.maxWrongGuesses]}`);
  }

  return embed;
}

async function saveGameStats(userId: string, won: boolean, game: HangmanGame) {
  try {
    const stats = await database.getGameStats(userId, 'hangman');
    const score = won ? (game.word.length * 10 - game.wrongGuesses * 5) : 0;
    
    await database.updateGameStats(userId, 'hangman', {
      wins: (stats?.wins || 0) + (won ? 1 : 0),
      losses: (stats?.losses || 0) + (won ? 0 : 1),
      highScore: Math.max(score, stats?.highScore || 0)
    });
  } catch (error) {
    logger.error('Error saving hangman stats:', error);
  }
}

export default command;