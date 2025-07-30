import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, User } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';
import axios from 'axios';

interface WordChainGame {
  players: string[];
  currentPlayer: number;
  words: string[];
  lastLetter: string;
  timeLimit: number;
  startTime: number;
  scores: Map<string, number>;
}

const activeGames = new Map<string, WordChainGame>();
const COMMON_WORDS = new Set([
  // Original words
  'apple', 'elephant', 'tiger', 'rabbit', 'table', 'eagle', 'example', 'energy', 'yellow', 'window',
  'orange', 'element', 'tower', 'river', 'robot', 'tennis', 'silver', 'rainbow', 'water', 'rocket',
  'pencil', 'laptop', 'paper', 'radio', 'ocean', 'night', 'turtle', 'engine', 'eleven', 'number',
  'umbrella', 'animal', 'island', 'dragon', 'nature', 'evening', 'garden', 'narrow', 'winter', 'random',
  'banana', 'artist', 'temple', 'electric', 'camera', 'avenue', 'entire', 'error', 'royal', 'letter',
  
  // Additional common words
  'beautiful', 'language', 'education', 'nothing', 'together', 'everything', 'government', 'different',
  'because', 'important', 'example', 'another', 'between', 'through', 'question', 'without', 'against',
  'problem', 'picture', 'morning', 'evening', 'tonight', 'thought', 'tonight', 'student', 'teacher',
  'brother', 'sister', 'mother', 'father', 'family', 'friend', 'people', 'person', 'woman', 'child',
  'school', 'office', 'house', 'street', 'country', 'world', 'state', 'place', 'right', 'light',
  'music', 'story', 'money', 'power', 'party', 'voice', 'point', 'heart', 'minute', 'second',
  'moment', 'memory', 'dream', 'peace', 'truth', 'smile', 'laugh', 'happy', 'angry', 'sorry',
  'thank', 'please', 'hello', 'goodbye', 'today', 'yesterday', 'tomorrow', 'always', 'never', 'really',
  'great', 'small', 'large', 'young', 'early', 'later', 'above', 'below', 'behind', 'front', 'under',
  'inside', 'outside', 'around', 'across', 'along', 'among', 'during', 'before', 'after', 'while',
  
  // Single letters that are valid words
  'a', 'i', 'o',
  
  // Common short words
  'am', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is', 'it', 'me', 'my',
  'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we', 'yo', 'ox', 'ax',
  
  // Words ending in common letters for chain continuation
  'democracy', 'youth', 'health', 'earth', 'north', 'south', 'month', 'growth', 'strength',
  'program', 'system', 'freedom', 'wisdom', 'kingdom', 'museum', 'stadium', 'medium', 'forum',
  'piano', 'video', 'radio', 'studio', 'photo', 'zero', 'hero', 'echo',
  'office', 'police', 'notice', 'choice', 'voice', 'device', 'service', 'practice', 'surface',
  'bridge', 'knowledge', 'college', 'village', 'package', 'message', 'passage', 'storage', 'damage'
]);

// Word validation using API
async function isValidWord(word: string): Promise<boolean> {
  const cleanWord = word.toLowerCase().trim();
  
  // Basic validation first
  if (cleanWord.length < 2 || cleanWord.length > 15 || !/^[a-z]+$/.test(cleanWord)) {
    return false;
  }
  
  // Check our local cache first
  if (COMMON_WORDS.has(cleanWord)) {
    return true;
  }
  
  // Additional common patterns that are likely invalid
  const invalidPatterns = [
    /(.)\1{3,}/, // 4+ repeated letters (aaaa, bbbb)
    /^[qxz]{2,}/, // Multiple q, x, or z at start
    /[qxz]{3,}/, // 3+ q, x, or z anywhere
    /^[bcdfghjklmnpqrstvwxyz]{6,}$/, // 6+ consonants with no vowels
    /^[aeiou]{5,}$/, // 5+ vowels only
    /.*[qx](?![u])/, // q or x not followed by u (except common endings)
    /^.*[hwyz].*[hwyz].*[hwyz]/, // 3+ rare letters
  ];
  
  if (invalidPatterns.some(pattern => pattern.test(cleanWord))) {
    return false;
  }
  
  try {
    // Try primary dictionary API
    const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`, {
      timeout: 5000
    });
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      return true;
    }
  } catch (error) {
    // Try backup API
    try {
      const backupResponse = await axios.get(`https://api.datamuse.com/words?sp=${cleanWord}&max=1`, {
        timeout: 3000
      });
      
      if (backupResponse.data && Array.isArray(backupResponse.data) && backupResponse.data.length > 0) {
        const match = backupResponse.data[0];
        return match.word && match.word.toLowerCase() === cleanWord;
      }
    } catch (backupError) {
      // Both APIs failed - reject unknown words to prevent abuse
      return false;
    }
  }
  
  return false;
}

async function getStartingWord(): Promise<string> {
  try {
    // Get a random word to start the game
    const response = await axios.get('https://random-words-api.vercel.app/word', {
      timeout: 3000
    });
    
    if (response.data && response.data[0] && response.data[0].word) {
      const word = response.data[0].word.toLowerCase();
      if (word.length >= 4 && word.length <= 8 && /^[a-z]+$/.test(word)) {
        return word;
      }
    }
  } catch (error) {
    // Fallback to predefined words
  }
  
  const fallbackWords = Array.from(COMMON_WORDS).filter(w => w.length >= 4 && w.length <= 8);
  return fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
}

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('wordchain')
    .setDescription('Play Word Chain - each word must start with the last letter of the previous word!')
    .addUserOption(option =>
      option.setName('player2')
        .setDescription('Second player')
        .setRequired(true))
    .addUserOption(option =>
      option.setName('player3')
        .setDescription('Third player (optional)')
        .setRequired(false))
    .addUserOption(option =>
      option.setName('player4')
        .setDescription('Fourth player (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('timelimit')
        .setDescription('Time limit per turn in seconds (default: 30)')
        .setMinValue(10)
        .setMaxValue(120)
        .setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    const player1 = interaction.user;
    const player2 = interaction.options.getUser('player2', true);
    const player3 = interaction.options.getUser('player3');
    const player4 = interaction.options.getUser('player4');
    const timeLimit = interaction.options.getInteger('timelimit') || 30;

    const players = [player1, player2];
    if (player3) players.push(player3);
    if (player4) players.push(player4);

    // Check for bots
    if (players.some(p => p.bot)) {
      await interaction.reply({
        content: '❌ Bots cannot play Word Chain!',
        ephemeral: true
      });
      return;
    }

    // Check for duplicate players
    const uniquePlayers = new Set(players.map(p => p.id));
    if (uniquePlayers.size !== players.length) {
      await interaction.reply({
        content: '❌ Each player must be different!',
        ephemeral: true
      });
      return;
    }

    const gameId = `wordchain_${interaction.channelId}`;
    
    if (activeGames.has(gameId)) {
      await interaction.reply({
        content: '❌ There\'s already an active Word Chain game in this channel!',
        ephemeral: true
      });
      return;
    }

    // Start the game
    await interaction.deferReply();
    const firstWord = await getStartingWord();
    const game: WordChainGame = {
      players: players.map(p => p.id),
      currentPlayer: 0,
      words: [firstWord],
      lastLetter: firstWord[firstWord.length - 1],
      timeLimit: timeLimit * 1000,
      startTime: Date.now(),
      scores: new Map(players.map(p => [p.id, 0]))
    };

    activeGames.set(gameId, game);

    const embed = createGameEmbed(game, players, interaction.client);
    
    await interaction.editReply({
      embeds: [embed]
    });

    // Create message collector for the channel
    const collector = (interaction.channel as any).createMessageCollector({
      filter: (m: any) => game.players.includes(m.author.id),
      time: 600000 // 10 minutes max game time
    });

    let turnTimeout: NodeJS.Timeout;

    const startTurn = () => {
      clearTimeout(turnTimeout);
      turnTimeout = setTimeout(async () => {
        // Time's up for current player
        const currentPlayerId = game.players[game.currentPlayer];
        
        try {
          await interaction.followUp({
            content: `⏱️ Time's up! <@${currentPlayerId}> took too long and has been eliminated!`
          });
        } catch (error) {
          logger.error('Failed to send timeout message:', error);
        }

        // Remove the current player from the game
        game.players.splice(game.currentPlayer, 1);
        game.scores.delete(currentPlayerId);
        
        // Check if only one player remains
        if (game.players.length <= 1) {
          clearTimeout(turnTimeout);
          collector.stop('lastPlayerWins');
          return;
        }
        
        // Adjust current player index if needed
        if (game.currentPlayer >= game.players.length) {
          game.currentPlayer = 0;
        }
        
        const newEmbed = createGameEmbed(game, players.filter(p => game.players.includes(p.id)), interaction.client);
        try {
          await interaction.editReply({ embeds: [newEmbed] });
        } catch (error) {
          logger.error('Failed to update game embed after timeout:', error);
        }
        
        startTurn();
      }, game.timeLimit);
    };

    startTurn();

    collector.on('collect', async (message: any) => {
      const playerId = message.author.id;
      const currentPlayerId = game.players[game.currentPlayer];

      // Check if it's the correct player's turn
      if (playerId !== currentPlayerId) {
        return;
      }

      const word = message.content.toLowerCase().trim();

      // Validate the word
      if (word.length < 2) {
        try {
          await message.react('❌');
        } catch (reactionError) {
          // Ignore reaction errors - not critical
        }
        
        try {
          await message.reply('Words must be at least 2 letters long!');
        } catch (error) {
          logger.warn('Cannot reply to message due to permissions, using fallback method');
          try {
            await interaction.followUp({
              content: `<@${playerId}> Words must be at least 2 letters long!`,
              ephemeral: true
            });
          } catch (followUpError) {
            logger.error('Failed to send fallback message:', followUpError);
          }
        }
        return;
      }

      if (word[0] !== game.lastLetter) {
        try {
          await message.react('❌');
        } catch (reactionError) {
          // Ignore reaction errors - not critical
        }
        
        try {
          await message.reply(`Your word must start with "${game.lastLetter.toUpperCase()}"!`);
        } catch (error) {
          logger.warn('Cannot reply to message due to permissions, using fallback method');
          try {
            await interaction.followUp({
              content: `<@${playerId}> Your word must start with "${game.lastLetter.toUpperCase()}"!`,
              ephemeral: true
            });
          } catch (followUpError) {
            logger.error('Failed to send fallback message:', followUpError);
          }
        }
        return;
      }

      if (game.words.includes(word)) {
        try {
          await message.react('❌');
        } catch (reactionError) {
          // Ignore reaction errors - not critical
        }
        
        try {
          await message.reply('That word has already been used!');
        } catch (error) {
          logger.warn('Cannot reply to message due to permissions, using fallback method');
          try {
            await interaction.followUp({
              content: `<@${playerId}> That word has already been used!`,
              ephemeral: true
            });
          } catch (followUpError) {
            logger.error('Failed to send fallback message:', followUpError);
          }
        }
        return;
      }

      // Check if it's a valid word using API
      const isValid = await isValidWord(word);
      if (!isValid) {
        try {
          await message.react('❌');
        } catch (reactionError) {
          // Ignore reaction errors - not critical
        }
        
        try {
          await message.reply(`"${word}" is not a valid English word! Try another one.`);
        } catch (error) {
          logger.warn('Cannot reply to message due to permissions, using fallback method');
          try {
            await interaction.followUp({
              content: `<@${playerId}> "${word}" is not a valid English word! Try another one.`,
              ephemeral: true
            });
          } catch (followUpError) {
            logger.error('Failed to send fallback message:', followUpError);
          }
        }
        logger.info(`Invalid word rejected in word chain: "${word}" by ${message.author.tag}`);
        return;
      }

      // Valid word!
      try {
        await message.react('✅');
      } catch (error) {
        logger.error('Failed to react to message:', error);
        // Continue without reaction - not critical
      }
      game.words.push(word);
      game.lastLetter = word[word.length - 1];
      game.scores.set(playerId, game.scores.get(playerId)! + word.length);

      // Check for game end conditions
      if (game.words.length >= 50) {
        // Game ends after 50 words
        clearTimeout(turnTimeout);
        collector.stop('maxWords');
        return;
      }

      // Move to next player
      game.currentPlayer = (game.currentPlayer + 1) % game.players.length;
      
      const newEmbed = createGameEmbed(game, players.filter(p => game.players.includes(p.id)), interaction.client);
      try {
        await interaction.editReply({ embeds: [newEmbed] });
      } catch (error) {
        logger.error('Failed to update game embed:', error);
      }
      
      startTurn();
    });

    collector.on('end', async (_collected: any, reason: any) => {
      clearTimeout(turnTimeout);
      activeGames.delete(gameId);

      const finalEmbed = createFinalEmbed(game, players.filter(p => game.scores.has(p.id)), reason);
      try {
        await interaction.editReply({ embeds: [finalEmbed] });
      } catch (error) {
        logger.error('Failed to send final game embed:', error);
      }

      // Save stats
      for (const [playerId, score] of game.scores) {
        if (score > 0) {
          await saveGameStats(playerId, score, game);
        }
      }
    });
  },
};

function createGameEmbed(game: WordChainGame, players: User[], _client: any): EmbedBuilder {
  const currentPlayer = players.find(p => p.id === game.players[game.currentPlayer])!;
  const lastWord = game.words[game.words.length - 1];
  
  const embed = new EmbedBuilder()
    .setTitle('🔤 Word Chain')
    .setDescription(`**Current Turn:** ${currentPlayer}\n**Last Word:** \`${lastWord}\`\n**Next word must start with:** \`${game.lastLetter.toUpperCase()}\``)
    .setColor(0x00AE86)
    .addFields(
      { name: 'Words Used', value: game.words.length.toString(), inline: true },
      { name: 'Time Limit', value: `${game.timeLimit / 1000}s`, inline: true }
    )
    .setFooter({ text: 'Type a word starting with the highlighted letter!' });

  // Add scores
  const scoreText = players
    .map(p => `${p.username}: ${game.scores.get(p.id) || 0} points`)
    .join('\n');
  
  embed.addFields({ name: 'Scores', value: scoreText });

  return embed;
}

function createFinalEmbed(game: WordChainGame, players: User[], reason: string): EmbedBuilder {
  const scores = Array.from(game.scores.entries()).sort((a, b) => b[1] - a[1]);
  const winner = scores.length > 0 ? players.find(p => p.id === scores[0][0]) : undefined;
  
  const embed = new EmbedBuilder()
    .setTitle('🏁 Word Chain - Game Over!')
    .setColor(0xFFD700)
    .addFields(
      { name: 'Total Words', value: game.words.length.toString(), inline: true },
      { name: 'Game Duration', value: `${Math.floor((Date.now() - game.startTime) / 1000)}s`, inline: true }
    );

  if (reason === 'maxWords') {
    embed.setDescription(`🎉 Congratulations! You reached 50 words!`);
  } else if (reason === 'time') {
    embed.setDescription(`⏱️ Game timed out!`);
  } else if (reason === 'lastPlayerWins') {
    if (winner) {
      embed.setDescription(`🏆 ${winner.username} wins! All other players have been eliminated!`);
    } else {
      embed.setDescription(`🏆 Last player standing wins!`);
    }
  }

  // Final scores
  const finalScores = scores
    .map((s, i) => {
      const player = players.find(p => p.id === s[0])!;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
      return `${medal} ${player.username}: ${s[1]} points`;
    })
    .join('\n');

  embed.addFields({ name: '🏆 Final Scores', value: finalScores });

  // Show last 10 words
  const lastWords = game.words.slice(-10).join(' → ');
  embed.addFields({ name: '📝 Last 10 Words', value: lastWords || 'None' });

  return embed;
}

async function saveGameStats(userId: string, score: number, game: WordChainGame) {
  try {
    const stats = await database.getGameStats(userId, 'wordchain');
    const isWinner = Array.from(game.scores.entries()).sort((a, b) => b[1] - a[1])[0][0] === userId;
    
    await database.updateGameStats(userId, 'wordchain', {
      wins: (stats?.wins || 0) + (isWinner ? 1 : 0),
      losses: (stats?.losses || 0) + (isWinner ? 0 : 1),
      highScore: Math.max(score, stats?.highScore || 0)
    });
  } catch (error) {
    logger.error('Error saving word chain stats:', error);
  }
}

export default command;