import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, User, AttachmentBuilder } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';
import { createCanvas } from 'canvas';

interface BingoCard {
  numbers: (number | null)[][];
  marked: boolean[][];
}

interface Player {
  id: string;
  card: BingoCard;
  hasWon: boolean;
}

interface BingoGame {
  players: Player[];
  calledNumbers: number[];
  currentNumber: number | null;
  gameStarted: boolean;
  gameEnded: boolean;
  winners: string[];
  hostId: string;
  autoCall: boolean;
  autoCallInterval: NodeJS.Timeout | null;
  pattern: 'line' | 'fullhouse' | 'corners' | 'x' | 'plus';
}

const BINGO_SIZE = 5;
const MAX_NUMBER = 75;
const AUTO_CALL_DELAY = 5000; // 5 seconds

const PATTERNS = {
  line: 'Any complete row, column, or diagonal',
  fullhouse: 'All numbers on the card',
  corners: 'All four corner numbers',
  x: 'Both diagonals',
  plus: 'Middle row and column'
};

class Bingo {
  private game: BingoGame;

  constructor(hostId: string, pattern: BingoGame['pattern'] = 'line') {
    this.game = {
      players: [],
      calledNumbers: [],
      currentNumber: null,
      gameStarted: false,
      gameEnded: false,
      winners: [],
      hostId,
      autoCall: false,
      autoCallInterval: null,
      pattern
    };
  }

  addPlayer(userId: string): boolean {
    if (this.game.gameStarted) return false;
    if (this.game.players.some(p => p.id === userId)) return false;

    const card = this.generateCard();
    this.game.players.push({
      id: userId,
      card,
      hasWon: false
    });

    return true;
  }

  removePlayer(userId: string): boolean {
    if (this.game.gameStarted) return false;
    const index = this.game.players.findIndex(p => p.id === userId);
    if (index === -1) return false;
    
    this.game.players.splice(index, 1);
    return true;
  }

  private generateCard(): BingoCard {
    const numbers: (number | null)[][] = [];
    const marked: boolean[][] = [];

    // Generate numbers for each column
    for (let col = 0; col < BINGO_SIZE; col++) {
      const columnNumbers: number[] = [];
      const min = col * 15 + 1;
      const max = col * 15 + 15;
      
      // Generate unique numbers for this column
      const available = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      for (let row = 0; row < BINGO_SIZE; row++) {
        const index = Math.floor(Math.random() * available.length);
        columnNumbers.push(available[index]);
        available.splice(index, 1);
      }
      
      columnNumbers.sort((a, b) => a - b);
      
      for (let row = 0; row < BINGO_SIZE; row++) {
        if (!numbers[row]) {
          numbers[row] = [];
          marked[row] = [];
        }
        
        // Free space in center
        if (row === 2 && col === 2) {
          numbers[row][col] = null;
          marked[row][col] = true;
        } else {
          numbers[row][col] = columnNumbers[row];
          marked[row][col] = false;
        }
      }
    }

    return { numbers, marked };
  }

  startGame(): boolean {
    if (this.game.players.length < 1) return false;
    if (this.game.gameStarted) return false;

    this.game.gameStarted = true;
    return true;
  }

  callNumber(): number | null {
    if (!this.game.gameStarted || this.game.gameEnded) return null;

    // Get available numbers
    const available = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1)
      .filter(n => !this.game.calledNumbers.includes(n));

    if (available.length === 0) {
      this.game.gameEnded = true;
      return null;
    }

    // Call random number
    const number = available[Math.floor(Math.random() * available.length)];
    this.game.calledNumbers.push(number);
    this.game.currentNumber = number;

    // Mark number on all cards
    for (const player of this.game.players) {
      this.markNumber(player.card, number);
    }

    // Check for winners
    this.checkWinners();

    return number;
  }

  private markNumber(card: BingoCard, number: number): void {
    for (let row = 0; row < BINGO_SIZE; row++) {
      for (let col = 0; col < BINGO_SIZE; col++) {
        if (card.numbers[row][col] === number) {
          card.marked[row][col] = true;
          return;
        }
      }
    }
  }

  private checkWinners(): void {
    for (const player of this.game.players) {
      if (!player.hasWon && this.checkWinPattern(player.card)) {
        player.hasWon = true;
        this.game.winners.push(player.id);
      }
    }

    if (this.game.winners.length > 0) {
      this.game.gameEnded = true;
      if (this.game.autoCallInterval) {
        clearInterval(this.game.autoCallInterval);
        this.game.autoCallInterval = null;
      }
    }
  }

  private checkWinPattern(card: BingoCard): boolean {
    switch (this.game.pattern) {
      case 'line':
        return this.checkLine(card);
      case 'fullhouse':
        return this.checkFullHouse(card);
      case 'corners':
        return this.checkCorners(card);
      case 'x':
        return this.checkX(card);
      case 'plus':
        return this.checkPlus(card);
    }
  }

  private checkLine(card: BingoCard): boolean {
    // Check rows
    for (let row = 0; row < BINGO_SIZE; row++) {
      if (card.marked[row].every(m => m)) return true;
    }

    // Check columns
    for (let col = 0; col < BINGO_SIZE; col++) {
      let complete = true;
      for (let row = 0; row < BINGO_SIZE; row++) {
        if (!card.marked[row][col]) {
          complete = false;
          break;
        }
      }
      if (complete) return true;
    }

    // Check diagonals
    let diagonal1 = true;
    let diagonal2 = true;
    for (let i = 0; i < BINGO_SIZE; i++) {
      if (!card.marked[i][i]) diagonal1 = false;
      if (!card.marked[i][BINGO_SIZE - 1 - i]) diagonal2 = false;
    }

    return diagonal1 || diagonal2;
  }

  private checkFullHouse(card: BingoCard): boolean {
    for (let row = 0; row < BINGO_SIZE; row++) {
      for (let col = 0; col < BINGO_SIZE; col++) {
        if (!card.marked[row][col]) return false;
      }
    }
    return true;
  }

  private checkCorners(card: BingoCard): boolean {
    return card.marked[0][0] && 
           card.marked[0][BINGO_SIZE - 1] && 
           card.marked[BINGO_SIZE - 1][0] && 
           card.marked[BINGO_SIZE - 1][BINGO_SIZE - 1];
  }

  private checkX(card: BingoCard): boolean {
    for (let i = 0; i < BINGO_SIZE; i++) {
      if (!card.marked[i][i] || !card.marked[i][BINGO_SIZE - 1 - i]) {
        return false;
      }
    }
    return true;
  }

  private checkPlus(card: BingoCard): boolean {
    const middle = Math.floor(BINGO_SIZE / 2);
    
    // Check middle row
    for (let col = 0; col < BINGO_SIZE; col++) {
      if (!card.marked[middle][col]) return false;
    }
    
    // Check middle column
    for (let row = 0; row < BINGO_SIZE; row++) {
      if (!card.marked[row][middle]) return false;
    }
    
    return true;
  }

  toggleAutoCall(): boolean {
    this.game.autoCall = !this.game.autoCall;
    
    if (this.game.autoCall && this.game.gameStarted && !this.game.gameEnded) {
      this.startAutoCall();
    } else if (this.game.autoCallInterval) {
      clearInterval(this.game.autoCallInterval);
      this.game.autoCallInterval = null;
    }
    
    return this.game.autoCall;
  }

  private startAutoCall(): void {
    this.game.autoCallInterval = setInterval(() => {
      if (!this.game.gameEnded) {
        this.callNumber();
      }
    }, AUTO_CALL_DELAY);
  }

  renderCard(playerId: string): Buffer {
    const player = this.game.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');

    const cellSize = 80;
    const padding = 20;
    const headerHeight = 60;
    const canvasSize = BINGO_SIZE * cellSize + padding * 2;
    
    const canvas = createCanvas(canvasSize, canvasSize + headerHeight);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvasSize, canvasSize + headerHeight);

    // Header
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvasSize, headerHeight);
    
    // BINGO letters
    const letters = ['B', 'I', 'N', 'G', 'O'];
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < letters.length; i++) {
      const x = padding + i * cellSize + cellSize / 2;
      ctx.fillText(letters[i], x, headerHeight / 2);
    }

    // Draw cells
    for (let row = 0; row < BINGO_SIZE; row++) {
      for (let col = 0; col < BINGO_SIZE; col++) {
        const x = padding + col * cellSize;
        const y = headerHeight + row * cellSize;
        
        // Cell background
        if (player.card.marked[row][col]) {
          ctx.fillStyle = player.hasWon ? '#27ae60' : '#3498db';
        } else {
          ctx.fillStyle = '#ffffff';
        }
        ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        
        // Cell border
        ctx.strokeStyle = '#34495e';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        
        // Number or FREE
        ctx.font = player.card.numbers[row][col] === null ? 'bold 20px Arial' : 'bold 28px Arial';
        ctx.fillStyle = player.card.marked[row][col] ? '#ffffff' : '#2c3e50';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const text = player.card.numbers[row][col] === null ? 'FREE' : player.card.numbers[row][col]!.toString();
        ctx.fillText(text, x + cellSize / 2, y + cellSize / 2);
      }
    }

    return canvas.toBuffer();
  }

  getState(): BingoGame {
    return this.game;
  }

  cleanup(): void {
    if (this.game.autoCallInterval) {
      clearInterval(this.game.autoCallInterval);
      this.game.autoCallInterval = null;
    }
  }
}

const activeGames = new Map<string, Bingo>();

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('bingo')
    .setDescription('Start a Bingo game!')
    .addStringOption(option =>
      option.setName('pattern')
        .setDescription('Win pattern')
        .addChoices(
          { name: 'Line (row/column/diagonal)', value: 'line' },
          { name: 'Full House (all numbers)', value: 'fullhouse' },
          { name: 'Four Corners', value: 'corners' },
          { name: 'X Pattern', value: 'x' },
          { name: 'Plus Pattern', value: 'plus' }
        )),

  async execute(interaction: ChatInputCommandInteraction) {
    const gameId = `bingo_${interaction.channelId}`;
    
    if (activeGames.has(gameId)) {
      await interaction.reply({
        content: '❌ There\'s already an active Bingo game in this channel!',
        ephemeral: true
      });
      return;
    }

    const pattern = (interaction.options.getString('pattern') || 'line') as BingoGame['pattern'];
    const game = new Bingo(interaction.user.id, pattern);
    game.addPlayer(interaction.user.id);
    activeGames.set(gameId, game);

    const embed = createLobbyEmbed(game, interaction.user);
    const buttons = createLobbyButtons();

    const response = await interaction.reply({
      embeds: [embed],
      components: [buttons]
    });

    const collector = response.createMessageComponentCollector({
      time: 300000 // 5 minutes to start
    });

    collector.on('collect', async (i) => {
      const currentGame = activeGames.get(gameId);
      if (!currentGame) return;

      const state = currentGame.getState();

      switch (i.customId) {
        case 'join_bingo':
          if (currentGame.addPlayer(i.user.id)) {
            await i.update({
              embeds: [createLobbyEmbed(currentGame, interaction.user)],
              components: [createLobbyButtons()]
            });
          } else {
            await i.reply({
              content: '❌ You\'re already in the game!',
              ephemeral: true
            });
          }
          break;

        case 'leave_bingo':
          if (i.user.id === state.hostId) {
            currentGame.cleanup();
            await i.update({
              embeds: [
                new EmbedBuilder()
                  .setTitle('🎮 Game Cancelled')
                  .setDescription('The host left the game.')
                  .setColor(0xFF0000)
              ],
              components: []
            });
            activeGames.delete(gameId);
            collector.stop();
          } else if (currentGame.removePlayer(i.user.id)) {
            await i.update({
              embeds: [createLobbyEmbed(currentGame, interaction.user)],
              components: [createLobbyButtons()]
            });
          }
          break;

        case 'start_bingo':
          if (i.user.id !== state.hostId) {
            await i.reply({
              content: '❌ Only the host can start the game!',
              ephemeral: true
            });
            return;
          }

          if (currentGame.startGame()) {
            collector.stop();
            await startBingoGame(i, currentGame, gameId);
          } else {
            await i.reply({
              content: '❌ Need at least 1 player to start!',
              ephemeral: true
            });
          }
          break;

        case 'view_card':
          try {
            const cardBuffer = currentGame.renderCard(i.user.id);
            const attachment = new AttachmentBuilder(cardBuffer, { name: 'bingo-card.png' });
            
            await i.reply({
              content: 'Your Bingo card:',
              files: [attachment],
              ephemeral: true
            });
          } catch {
            await i.reply({
              content: '❌ You\'re not in this game!',
              ephemeral: true
            });
          }
          break;
      }
    });

    collector.on('end', async (_collected, reason) => {
      if (reason === 'time') {
        const currentGame = activeGames.get(gameId);
        if (currentGame) currentGame.cleanup();
        activeGames.delete(gameId);
        
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('⏱️ Game Timed Out')
              .setDescription('The Bingo game lobby timed out.')
              .setColor(0xFF0000)
          ],
          components: []
        });
      }
    });
  },
};

function createLobbyEmbed(game: Bingo, host: User): EmbedBuilder {
  const state = game.getState();
  const playerList = state.players.map((p, i) => `${i + 1}. <@${p.id}>`).join('\n') || 'None';

  return new EmbedBuilder()
    .setTitle('🎱 Bingo - Game Lobby')
    .setDescription(`Host: ${host}\nPattern: **${PATTERNS[state.pattern]}**\n\n**Players:**\n${playerList}`)
    .setColor(0x9B59B6)
    .setFooter({ text: 'Click Join to play! • View your card anytime' })
    .setTimestamp();
}

function createLobbyButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('join_bingo')
        .setLabel('Join Game')
        .setEmoji('🎱')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('leave_bingo')
        .setLabel('Leave')
        .setEmoji('➖')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('view_card')
        .setLabel('View Card')
        .setEmoji('🎴')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('start_bingo')
        .setLabel('Start Game')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Primary)
    );
}

async function startBingoGame(interaction: any, game: Bingo, gameId: string) {
  const updateDisplay = async () => {
    const state = game.getState();
    const embed = createGameEmbed(game);
    const buttons = createGameButtons(game);

    await interaction.editReply({
      embeds: [embed],
      components: buttons
    });
  };

  await updateDisplay();

  const gameCollector = interaction.message.createMessageComponentCollector({
    time: 1800000 // 30 minutes
  });

  gameCollector.on('collect', async (i: any) => {
    const state = game.getState();

    switch (i.customId) {
      case 'call_number':
        if (i.user.id !== state.hostId) {
          await i.reply({
            content: '❌ Only the host can call numbers!',
            ephemeral: true
          });
          return;
        }

        const number = game.callNumber();
        if (number) {
          await updateDisplay();
          
          if (state.gameEnded) {
            await endGame(i, game, gameId);
          }
        }
        break;

      case 'toggle_auto':
        if (i.user.id !== state.hostId) {
          await i.reply({
            content: '❌ Only the host can toggle auto-call!',
            ephemeral: true
          });
          return;
        }

        game.toggleAutoCall();
        await updateDisplay();
        break;

      case 'view_card':
        try {
          const cardBuffer = game.renderCard(i.user.id);
          const attachment = new AttachmentBuilder(cardBuffer, { name: 'bingo-card.png' });
          
          await i.reply({
            content: 'Your Bingo card:',
            files: [attachment],
            ephemeral: true
          });
        } catch {
          await i.reply({
            content: '❌ You\'re not in this game!',
            ephemeral: true
          });
        }
        break;

      case 'bingo':
        const player = state.players.find(p => p.id === i.user.id);
        if (!player) {
          await i.reply({
            content: '❌ You\'re not in this game!',
            ephemeral: true
          });
          return;
        }

        if (player.hasWon) {
          await i.reply({
            content: '✅ You already have Bingo!',
            ephemeral: true
          });
        } else {
          await i.reply({
            content: '❌ You don\'t have Bingo yet!',
            ephemeral: true
          });
        }
        break;
    }
  });

  gameCollector.on('end', async (_collected, reason) => {
    if (reason === 'time') {
      game.cleanup();
      activeGames.delete(gameId);
      await interaction.followUp({
        content: '⏱️ Bingo game timed out due to inactivity!'
      });
    }
  });

  // Auto-update display when auto-calling
  const autoUpdateInterval = setInterval(async () => {
    const state = game.getState();
    if (state.autoCall && !state.gameEnded) {
      await updateDisplay();
      
      if (state.gameEnded) {
        clearInterval(autoUpdateInterval);
        await endGame(interaction, game, gameId);
      }
    } else if (state.gameEnded) {
      clearInterval(autoUpdateInterval);
    }
  }, AUTO_CALL_DELAY);
}

function createGameEmbed(game: Bingo): EmbedBuilder {
  const state = game.getState();
  
  const embed = new EmbedBuilder()
    .setTitle('🎱 Bingo')
    .setColor(0x9B59B6)
    .addFields(
      { name: 'Pattern', value: PATTERNS[state.pattern], inline: true },
      { name: 'Numbers Called', value: state.calledNumbers.length.toString(), inline: true },
      { name: 'Auto-Call', value: state.autoCall ? 'ON' : 'OFF', inline: true }
    );

  if (state.currentNumber) {
    embed.setDescription(`**Current Number: ${state.currentNumber}**`);
  }

  // Show last 10 called numbers
  if (state.calledNumbers.length > 0) {
    const recent = state.calledNumbers.slice(-10).reverse().join(', ');
    embed.addFields({ name: 'Recent Numbers', value: recent, inline: false });
  }

  // Player list
  const playerList = state.players.map(p => {
    const status = p.hasWon ? '🏆 BINGO!' : '🎮 Playing';
    return `<@${p.id}> - ${status}`;
  }).join('\n');

  embed.addFields({ name: 'Players', value: playerList, inline: false });

  return embed;
}

function createGameButtons(game: Bingo): ActionRowBuilder<ButtonBuilder>[] {
  const state = game.getState();
  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  const controlRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('call_number')
        .setLabel('Call Number')
        .setEmoji('🎲')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(state.gameEnded || state.autoCall),
      new ButtonBuilder()
        .setCustomId('toggle_auto')
        .setLabel(state.autoCall ? 'Stop Auto-Call' : 'Start Auto-Call')
        .setEmoji(state.autoCall ? '⏸️' : '▶️')
        .setStyle(state.autoCall ? ButtonStyle.Danger : ButtonStyle.Success)
        .setDisabled(state.gameEnded)
    );

  const playerRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('view_card')
        .setLabel('View Card')
        .setEmoji('🎴')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('bingo')
        .setLabel('BINGO!')
        .setEmoji('🎉')
        .setStyle(ButtonStyle.Success)
        .setDisabled(state.gameEnded)
    );

  components.push(controlRow, playerRow);
  return components;
}

async function endGame(interaction: any, game: Bingo, gameId: string) {
  const state = game.getState();
  game.cleanup();
  
  const winnerList = state.winners.map(w => `<@${w}>`).join(', ');
  
  const embed = new EmbedBuilder()
    .setTitle('🎉 Bingo Game Over!')
    .setDescription(`**Winners:** ${winnerList}`)
    .setColor(0x00FF00)
    .addFields(
      { name: 'Total Numbers Called', value: state.calledNumbers.length.toString(), inline: true },
      { name: 'Pattern', value: PATTERNS[state.pattern], inline: true }
    )
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    components: []
  });

  // Save stats
  for (const player of state.players) {
    await saveGameStats(player.id, state.winners.includes(player.id));
  }

  activeGames.delete(gameId);
}

async function saveGameStats(userId: string, won: boolean) {
  try {
    const stats = await database.getGameStats(userId, 'bingo');
    
    await database.updateGameStats(userId, 'bingo', {
      wins: (stats?.wins || 0) + (won ? 1 : 0),
      losses: (stats?.losses || 0) + (won ? 0 : 1),
      highScore: stats?.highScore || 0
    });
  } catch (error) {
    logger.error('Error saving bingo stats:', error);
  }
}

export default command;