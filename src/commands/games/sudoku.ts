import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';

interface SudokuGame {
  board: number[][];
  solution: number[][];
  initialBoard: number[][];
  selectedCell: [number, number] | null;
  mistakes: number;
  hints: number;
  startTime: number;
  completed: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
}

class Sudoku {
  private game: SudokuGame;
  private readonly MAX_MISTAKES = 3;
  private readonly MAX_HINTS = 3;

  constructor(difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
    const { board, solution } = this.generatePuzzle(difficulty);
    
    this.game = {
      board: board.map(row => [...row]),
      solution,
      initialBoard: board.map(row => [...row]),
      selectedCell: null,
      mistakes: 0,
      hints: 0,
      startTime: Date.now(),
      completed: false,
      difficulty
    };
  }

  private generatePuzzle(difficulty: 'easy' | 'medium' | 'hard'): { board: number[][], solution: number[][] } {
    // Generate a complete valid sudoku board
    const solution = this.generateCompleteSudoku();
    
    // Remove numbers based on difficulty
    const cellsToRemove = {
      easy: 35,
      medium: 45,
      hard: 55
    }[difficulty];
    
    const board = solution.map(row => [...row]);
    const positions: [number, number][] = [];
    
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        positions.push([i, j]);
      }
    }
    
    // Shuffle and remove cells
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    
    for (let i = 0; i < cellsToRemove; i++) {
      const [row, col] = positions[i];
      board[row][col] = 0;
    }
    
    return { board, solution };
  }

  private generateCompleteSudoku(): number[][] {
    const board: number[][] = Array(9).fill(null).map(() => Array(9).fill(0));
    
    // Fill diagonal 3x3 boxes first (they don't affect each other)
    for (let box = 0; box < 9; box += 3) {
      this.fillBox(board, box, box);
    }
    
    // Fill remaining cells
    this.solveSudoku(board);
    
    return board;
  }

  private fillBox(board: number[][], startRow: number, startCol: number): void {
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    
    // Shuffle numbers
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    
    let index = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        board[startRow + i][startCol + j] = nums[index++];
      }
    }
  }

  private solveSudoku(board: number[][]): boolean {
    const empty = this.findEmpty(board);
    if (!empty) return true;
    
    const [row, col] = empty;
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    
    // Shuffle for randomness
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    
    for (const num of nums) {
      if (this.isValidMove(board, row, col, num)) {
        board[row][col] = num;
        
        if (this.solveSudoku(board)) {
          return true;
        }
        
        board[row][col] = 0;
      }
    }
    
    return false;
  }

  private findEmpty(board: number[][]): [number, number] | null {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col] === 0) {
          return [row, col];
        }
      }
    }
    return null;
  }

  private isValidMove(board: number[][], row: number, col: number, num: number): boolean {
    // Check row
    for (let x = 0; x < 9; x++) {
      if (board[row][x] === num) return false;
    }
    
    // Check column
    for (let x = 0; x < 9; x++) {
      if (board[x][col] === num) return false;
    }
    
    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (board[boxRow + i][boxCol + j] === num) return false;
      }
    }
    
    return true;
  }

  selectCell(row: number, col: number): boolean {
    if (row < 0 || row >= 9 || col < 0 || col >= 9) return false;
    if (this.game.initialBoard[row][col] !== 0) return false; // Can't select pre-filled cells
    
    this.game.selectedCell = [row, col];
    return true;
  }

  placeNumber(num: number): boolean {
    if (!this.game.selectedCell || this.game.completed) return false;
    
    const [row, col] = this.game.selectedCell;
    
    if (num === 0) {
      // Clear cell
      this.game.board[row][col] = 0;
      return true;
    }
    
    if (this.game.solution[row][col] === num) {
      this.game.board[row][col] = num;
      
      // Check if puzzle is completed
      if (this.checkCompletion()) {
        this.game.completed = true;
      }
      
      return true;
    } else {
      this.game.mistakes++;
      return false;
    }
  }

  useHint(): boolean {
    if (this.game.hints >= this.MAX_HINTS || this.game.completed) return false;
    
    // Find empty cells
    const emptyCells: [number, number][] = [];
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (this.game.board[row][col] === 0) {
          emptyCells.push([row, col]);
        }
      }
    }
    
    if (emptyCells.length === 0) return false;
    
    // Fill a random empty cell
    const [row, col] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    this.game.board[row][col] = this.game.solution[row][col];
    this.game.hints++;
    
    // Check completion
    if (this.checkCompletion()) {
      this.game.completed = true;
    }
    
    return true;
  }

  private checkCompletion(): boolean {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (this.game.board[row][col] !== this.game.solution[row][col]) {
          return false;
        }
      }
    }
    return true;
  }

  renderBoard(): string {
    let board = '```\n';
    
    for (let row = 0; row < 9; row++) {
      if (row % 3 === 0 && row !== 0) {
        board += '------+-------+------\n';
      }
      
      for (let col = 0; col < 9; col++) {
        if (col % 3 === 0 && col !== 0) {
          board += '| ';
        }
        
        const value = this.game.board[row][col];
        const isSelected = this.game.selectedCell && 
                          this.game.selectedCell[0] === row && 
                          this.game.selectedCell[1] === col;
        const isInitial = this.game.initialBoard[row][col] !== 0;
        
        if (value === 0) {
          board += isSelected ? '[·]' : ' · ';
        } else {
          if (isInitial) {
            board += ` ${value} `;
          } else {
            board += isSelected ? `[${value}]` : `(${value})`;
          }
        }
        
        if (col < 8) board += ' ';
      }
      
      board += '\n';
    }
    
    board += '```';
    return board;
  }

  getState(): SudokuGame {
    return this.game;
  }

  isGameOver(): boolean {
    return this.game.mistakes >= this.MAX_MISTAKES || this.game.completed;
  }
}

const activeGames = new Map<string, Sudoku>();

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('sudoku')
    .setDescription('Play Sudoku puzzle game!')
    .addStringOption(option =>
      option.setName('difficulty')
        .setDescription('Choose difficulty level')
        .addChoices(
          { name: 'Easy', value: 'easy' },
          { name: 'Medium', value: 'medium' },
          { name: 'Hard', value: 'hard' }
        )),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const gameId = `sudoku_${userId}`;
    
    if (activeGames.has(gameId)) {
      await interaction.reply({
        content: '❌ You already have an active Sudoku game! Finish it first.',
        ephemeral: true
      });
      return;
    }

    const difficulty = (interaction.options.getString('difficulty') || 'medium') as 'easy' | 'medium' | 'hard';
    const game = new Sudoku(difficulty);
    activeGames.set(gameId, game);

    const embed = createGameEmbed(game);
    const components = createGameComponents();

    const response = await interaction.reply({
      embeds: [embed],
      components
    });

    const collector = response.createMessageComponentCollector({
      time: 1800000 // 30 minutes
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== userId) {
        await i.reply({
          content: '❌ This is not your game!',
          ephemeral: true
        });
        return;
      }

      const currentGame = activeGames.get(gameId);
      if (!currentGame) return;

      if (i.componentType === ComponentType.StringSelect && i.customId === 'cell_select') {
        const [row, col] = i.values[0].split(',').map(Number);
        currentGame.selectCell(row, col);
        
        const newEmbed = createGameEmbed(currentGame);
        await i.update({
          embeds: [newEmbed],
          components: createGameComponents()
        });
      } else if (i.componentType === ComponentType.Button) {
        if (i.customId === 'hint') {
          currentGame.useHint();
        } else if (i.customId === 'clear') {
          if (currentGame.getState().selectedCell) {
            currentGame.placeNumber(0);
          }
        } else if (i.customId.startsWith('num_')) {
          const num = parseInt(i.customId.split('_')[1]);
          const correct = currentGame.placeNumber(num);
          
          if (!correct) {
            await i.reply({
              content: '❌ Wrong number! Mistake added.',
              ephemeral: true
            });
          }
        }

        const newEmbed = createGameEmbed(currentGame);
        
        if (currentGame.isGameOver()) {
          await i.update({
            embeds: [newEmbed],
            components: []
          });
          
          await saveGameStats(userId, currentGame.getState());
          activeGames.delete(gameId);
          collector.stop();
        } else {
          await i.update({
            embeds: [newEmbed],
            components: createGameComponents()
          });
        }
      }
    });

    collector.on('end', async (_collected, reason) => {
      if (reason === 'time') {
        activeGames.delete(gameId);
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏱️ Game Timed Out!')
          .setDescription('Your Sudoku game has ended due to inactivity.')
          .setColor(0xFF0000)
          .setTimestamp();
        
        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: []
        });
      }
    });
  },
};

function createGameEmbed(game: Sudoku): EmbedBuilder {
  const state = game.getState();
  const duration = Math.floor((Date.now() - state.startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  
  let status = '🎮 Playing';
  let color = 0x0099FF;
  
  if (state.completed) {
    status = '🎉 Completed!';
    color = 0x00FF00;
  } else if (state.mistakes >= 3) {
    status = '💀 Game Over!';
    color = 0xFF0000;
  }
  
  const embed = new EmbedBuilder()
    .setTitle('🔢 Sudoku')
    .setDescription(game.renderBoard())
    .addFields(
      { name: 'Status', value: status, inline: true },
      { name: 'Difficulty', value: state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1), inline: true },
      { name: 'Time', value: `${minutes}:${seconds.toString().padStart(2, '0')}`, inline: true },
      { name: 'Mistakes', value: `${state.mistakes}/3`, inline: true },
      { name: 'Hints', value: `${state.hints}/3`, inline: true }
    )
    .setColor(color)
    .setTimestamp();

  if (state.selectedCell) {
    embed.setFooter({ text: `Selected cell: Row ${state.selectedCell[0] + 1}, Column ${state.selectedCell[1] + 1}` });
  } else if (!state.completed && state.mistakes < 3) {
    embed.setFooter({ text: 'Select a cell to place a number' });
  }

  return embed;
}

function createGameComponents(): ActionRowBuilder<any>[] {
  const components: ActionRowBuilder<any>[] = [];
  
  // Cell selector
  const cellOptions = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      cellOptions.push({
        label: `Row ${row + 1}, Col ${col + 1}`,
        value: `${row},${col}`,
        description: `Select cell at (${row + 1}, ${col + 1})`
      });
    }
  }
  
  // Discord limits to 25 options, so we'll use a simplified selector
  const simplifiedOptions = [];
  for (let section = 0; section < 9; section++) {
    const row = Math.floor(section / 3) * 3 + 1;
    const col = (section % 3) * 3 + 1;
    simplifiedOptions.push({
      label: `Section ${section + 1} (${row}-${row+2}, ${col}-${col+2})`,
      value: `${row},${col}`,
      description: `Select from 3x3 section`
    });
  }
  
  const cellSelector = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('cell_select')
        .setPlaceholder('Select a cell')
        .addOptions(simplifiedOptions.slice(0, 25))
    );
  
  components.push(cellSelector);
  
  // Number buttons (1-5)
  const numberRow1 = new ActionRowBuilder<ButtonBuilder>();
  for (let i = 1; i <= 5; i++) {
    numberRow1.addComponents(
      new ButtonBuilder()
        .setCustomId(`num_${i}`)
        .setLabel(i.toString())
        .setStyle(ButtonStyle.Primary)
    );
  }
  components.push(numberRow1);
  
  // Number buttons (6-9) + Clear
  const numberRow2 = new ActionRowBuilder<ButtonBuilder>();
  for (let i = 6; i <= 9; i++) {
    numberRow2.addComponents(
      new ButtonBuilder()
        .setCustomId(`num_${i}`)
        .setLabel(i.toString())
        .setStyle(ButtonStyle.Primary)
    );
  }
  numberRow2.addComponents(
    new ButtonBuilder()
      .setCustomId('clear')
      .setLabel('Clear')
      .setStyle(ButtonStyle.Secondary)
  );
  components.push(numberRow2);
  
  // Hint button
  const controlRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('hint')
        .setLabel('Hint')
        .setEmoji('💡')
        .setStyle(ButtonStyle.Success)
    );
  components.push(controlRow);
  
  return components;
}

async function saveGameStats(userId: string, state: SudokuGame) {
  try {
    const stats = await database.getGameStats(userId, 'sudoku');
    const duration = Math.floor((Date.now() - state.startTime) / 1000);
    
    await database.updateGameStats(userId, 'sudoku', {
      wins: (stats?.wins || 0) + (state.completed ? 1 : 0),
      losses: (stats?.losses || 0) + (state.mistakes >= 3 ? 1 : 0),
      highScore: state.completed ? Math.min(duration, stats?.highScore || 999999) : (stats?.highScore || 0)
    });
  } catch (error) {
    logger.error('Error saving sudoku stats:', error);
  }
}

export default command;