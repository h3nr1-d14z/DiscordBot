import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';

interface MemoryGame {
  board: string[];
  revealed: boolean[];
  matched: boolean[];
  firstPick: number | null;
  secondPick: number | null;
  moves: number;
  matches: number;
  startTime: number;
  size: number;
}

// Different emoji sets for variety
const EMOJI_SETS = {
  fruits: ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🥝', '🍍', '🥥', '🥭'],
  animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯'],
  nature: ['🌸', '🌺', '🌻', '🌷', '🌹', '🌿', '🍀', '🌱', '🌳', '🌲'],
  space: ['⭐', '🌟', '✨', '🌙', '☀️', '🪐', '🌍', '🚀', '👽', '🛸'],
  food: ['🍕', '🍔', '🌭', '🍟', '🥪', '🌮', '🍝', '🍜', '🍱', '🍣'],
  sports: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🏑', '🥍']
};

function getRandomEmojiSet(pairs: number): string[] {
  const setNames = Object.keys(EMOJI_SETS);
  const randomSet = setNames[Math.floor(Math.random() * setNames.length)];
  const emojis = EMOJI_SETS[randomSet as keyof typeof EMOJI_SETS];
  
  // Shuffle and take the required number
  const shuffled = [...emojis].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, pairs);
}
const HIDDEN_EMOJI = '❓';

const activeGames = new Map<string, MemoryGame>();

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('Play Memory Match - find all the matching pairs!')
    .addStringOption(option =>
      option.setName('difficulty')
        .setDescription('Choose difficulty level')
        .setRequired(false)
        .addChoices(
          { name: 'Easy (3x4)', value: 'easy' },
          { name: 'Medium (4x4)', value: 'medium' },
          { name: 'Hard (4x5)', value: 'hard' }
        )),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const gameId = `memory_${userId}`;

    if (activeGames.has(gameId)) {
      await interaction.reply({
        content: '❌ You already have an active Memory game!',
        ephemeral: true
      });
      return;
    }

    const difficulty = interaction.options.getString('difficulty') || 'medium';
    let size: number;
    let pairs: number;

    switch (difficulty) {
      case 'easy':
        size = 12;
        pairs = 6;
        break;
      case 'hard':
        size = 20;
        pairs = 10;
        break;
      default:
        size = 16;
        pairs = 8;
    }

    // Create the board with random emoji set
    const emojisToUse = getRandomEmojiSet(pairs);
    const board: string[] = [];
    
    // Add each emoji twice
    emojisToUse.forEach(emoji => {
      board.push(emoji, emoji);
    });

    // Shuffle the board
    for (let i = board.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [board[i], board[j]] = [board[j], board[i]];
    }

    const game: MemoryGame = {
      board,
      revealed: new Array(size).fill(false),
      matched: new Array(size).fill(false),
      firstPick: null,
      secondPick: null,
      moves: 0,
      matches: 0,
      startTime: Date.now(),
      size
    };

    activeGames.set(gameId, game);

    const embed = createGameEmbed(game, interaction.user.username, difficulty);
    const buttons = createGameButtons(game);

    const response = await interaction.reply({
      embeds: [embed],
      components: buttons
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000
    });

    let processingMove = false;

    collector.on('collect', async (i) => {
      if (i.user.id !== userId) {
        await i.reply({
          content: '❌ This is not your game!',
          ephemeral: true
        });
        return;
      }

      if (processingMove) {
        await i.reply({
          content: '⏳ Please wait for the current move to finish!',
          ephemeral: true
        });
        return;
      }

      const position = parseInt(i.customId);

      if (game.matched[position]) {
        await i.reply({
          content: '❌ This card is already matched!',
          ephemeral: true
        });
        return;
      }

      if (game.revealed[position]) {
        await i.reply({
          content: '❌ This card is already revealed!',
          ephemeral: true
        });
        return;
      }

      processingMove = true;

      if (game.firstPick === null) {
        // First card
        game.firstPick = position;
        game.revealed[position] = true;
        
        const newEmbed = createGameEmbed(game, interaction.user.username, difficulty);
        const newButtons = createGameButtons(game);
        
        await i.update({
          embeds: [newEmbed],
          components: newButtons
        });
        
        processingMove = false;
      } else {
        // Second card
        game.secondPick = position;
        game.revealed[position] = true;
        game.moves++;
        
        const firstEmoji = game.board[game.firstPick];
        const secondEmoji = game.board[game.secondPick];
        
        const tempEmbed = createGameEmbed(game, interaction.user.username, difficulty);
        const tempButtons = createGameButtons(game);
        
        await i.update({
          embeds: [tempEmbed],
          components: tempButtons
        });

        if (firstEmoji === secondEmoji) {
          // Match found!
          game.matched[game.firstPick] = true;
          game.matched[game.secondPick] = true;
          game.matches++;
          
          game.firstPick = null;
          game.secondPick = null;
          game.revealed = [...game.matched];
          
          if (game.matches === pairs) {
            // Game won!
            const duration = Math.floor((Date.now() - game.startTime) / 1000);
            const score = Math.max(100 - game.moves * 2 + (300 - duration), 0);
            
            const winEmbed = new EmbedBuilder()
              .setTitle('🎉 Congratulations!')
              .setDescription('You found all the pairs!')
              .addFields(
                { name: 'Moves', value: game.moves.toString(), inline: true },
                { name: 'Time', value: `${duration}s`, inline: true },
                { name: 'Score', value: score.toString(), inline: true }
              )
              .setColor(0x00FF00)
              .setFooter({ text: `Player: ${interaction.user.username}` });

            await interaction.editReply({
              embeds: [winEmbed],
              components: []
            });

            await saveGameStats(userId, true, score);
            activeGames.delete(gameId);
            collector.stop();
          } else {
            processingMove = false;
          }
        } else {
          // No match - hide cards after delay
          setTimeout(async () => {
            game.revealed[game.firstPick!] = false;
            game.revealed[game.secondPick!] = false;
            game.firstPick = null;
            game.secondPick = null;
            
            const resetEmbed = createGameEmbed(game, interaction.user.username, difficulty);
            const resetButtons = createGameButtons(game);
            
            await interaction.editReply({
              embeds: [resetEmbed],
              components: resetButtons
            });
            
            processingMove = false;
          }, 1500);
        }
      }
    });

    collector.on('end', async (_collected, reason) => {
      if (reason === 'time') {
        activeGames.delete(gameId);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('⏱️ Time\'s Up!')
              .setDescription('The game has timed out.')
              .setColor(0xFF0000)
          ],
          components: []
        });
      }
    });
  },
};

function createGameEmbed(game: MemoryGame, playerName: string, difficulty: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🧠 Memory Match')
    .setDescription(`Find all the matching pairs!\nDifficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`)
    .addFields(
      { name: 'Moves', value: game.moves.toString(), inline: true },
      { name: 'Matches', value: `${game.matches}/${game.size / 2}`, inline: true }
    )
    .setColor(0x9C27B0)
    .setFooter({ text: `Player: ${playerName}` });

  return embed;
}

function createGameButtons(game: MemoryGame): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const cols = game.size === 12 ? 4 : game.size === 20 ? 5 : 4;
  const rowCount = game.size / cols;

  for (let row = 0; row < rowCount; row++) {
    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (index >= game.size) break;
      
      let emoji = HIDDEN_EMOJI;
      let style = ButtonStyle.Secondary;
      
      if (game.matched[index]) {
        emoji = game.board[index];
        style = ButtonStyle.Success;
      } else if (game.revealed[index]) {
        emoji = game.board[index];
        style = ButtonStyle.Primary;
      }
      
      const button = new ButtonBuilder()
        .setCustomId(index.toString())
        .setEmoji(emoji)
        .setStyle(style)
        .setDisabled(game.matched[index]);
      
      actionRow.addComponents(button);
    }
    
    rows.push(actionRow);
  }

  return rows;
}

async function saveGameStats(userId: string, won: boolean, score: number) {
  try {
    const stats = await database.getGameStats(userId, 'memory');
    
    await database.updateGameStats(userId, 'memory', {
      wins: (stats?.wins || 0) + (won ? 1 : 0),
      losses: (stats?.losses || 0) + (won ? 0 : 1),
      highScore: Math.max(score, stats?.highScore || 0)
    });
  } catch (error) {
    logger.error('Error saving memory game stats:', error);
  }
}

export default command;