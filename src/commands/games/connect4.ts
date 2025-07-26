import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
  User
} from 'discord.js';
import { BotCommand, CommandCategory, GameType } from '../../types';
import { database } from '../../services/database';

interface Connect4Game {
  board: number[][];
  players: [string, string];
  currentPlayer: number;
  gameId: string;
  playerColors: [string, string];
}

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const PLAYER1 = 1;
const PLAYER2 = 2;

const activeGames = new Map<string, Connect4Game>();

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('connect4')
    .setDescription('Play Connect Four')
    .addUserOption(option =>
      option
        .setName('opponent')
        .setDescription('User to play against (leave empty to play against bot)')
        .setRequired(false)
    ),
  
  category: CommandCategory.Games,
  cooldown: 10,
  
  async execute(interaction: ChatInputCommandInteraction) {
    const opponent = interaction.options.getUser('opponent');
    const isVsBot = !opponent || opponent.id === interaction.client.user?.id;
    
    if (opponent && opponent.id === interaction.user.id) {
      await interaction.reply({
        content: '❌ You cannot play against yourself!',
        ephemeral: true
      });
      return;
    }
    
    if (opponent && opponent.bot && opponent.id !== interaction.client.user?.id) {
      await interaction.reply({
        content: '❌ You can only play against me or other users!',
        ephemeral: true
      });
      return;
    }
    
    const gameId = `c4_${interaction.id}`;
    const game: Connect4Game = {
      board: Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY)),
      players: [interaction.user.id, isVsBot ? 'bot' : opponent!.id],
      currentPlayer: 0,
      gameId,
      playerColors: ['🔴', '🟡']
    };
    
    activeGames.set(gameId, game);
    
    const embed = createGameEmbed(game, interaction.user, isVsBot ? null : opponent!);
    const components = createGameButtons(game);
    
    const response = await interaction.reply({
      content: isVsBot ? undefined : `${opponent}, you have been challenged to Connect Four!`,
      embeds: [embed],
      components: components,
      fetchReply: true
    });
    
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });
    
    collector.on('collect', async (i: ButtonInteraction) => {
      const currentPlayerId = game.players[game.currentPlayer];
      
      if (currentPlayerId !== 'bot' && i.user.id !== currentPlayerId) {
        await i.reply({
          content: '❌ It\'s not your turn!',
          ephemeral: true
        });
        return;
      }
      
      const column = parseInt(i.customId.split('_')[1]);
      
      // Make the move
      const row = dropPiece(game.board, column, game.currentPlayer + 1);
      
      if (row === -1) {
        await i.reply({
          content: '❌ That column is full!',
          ephemeral: true
        });
        return;
      }
      
      // Check for winner
      const winner = checkWinner(game.board, row, column);
      const isDraw = !winner && isBoardFull(game.board);
      
      if (winner || isDraw) {
        await handleGameEnd(i, game, winner, isDraw, interaction.user, isVsBot ? null : opponent!, null);
        activeGames.delete(gameId);
        collector.stop();
        return;
      }
      
      // Switch player
      game.currentPlayer = game.currentPlayer === 0 ? 1 : 0;
      
      // Update display
      const newEmbed = createGameEmbed(game, interaction.user, isVsBot ? null : opponent!);
      const newComponents = createGameButtons(game);
      
      await i.update({
        embeds: [newEmbed],
        components: newComponents
      });
      
      // Bot's turn
      if (isVsBot && game.currentPlayer === 1) {
        setTimeout(async () => {
          const botColumn = getBotMove(game.board);
          const botRow = dropPiece(game.board, botColumn, PLAYER2);
          
          const winner = checkWinner(game.board, botRow, botColumn);
          const isDraw = !winner && isBoardFull(game.board);
          
          if (winner || isDraw) {
            await handleGameEnd(null, game, winner, isDraw, interaction.user, null, response);
            activeGames.delete(gameId);
            collector.stop();
          } else {
            game.currentPlayer = 0;
            const botEmbed = createGameEmbed(game, interaction.user, null);
            const botComponents = createGameButtons(game);
            
            await response.edit({
              embeds: [botEmbed],
              components: botComponents
            });
          }
        }, 1000);
      }
    });
    
    collector.on('end', async () => {
      activeGames.delete(gameId);
      await response.edit({
        components: []
      }).catch(() => {});
    });
  },
};

function createGameEmbed(game: Connect4Game, player1: User, player2: User | null): EmbedBuilder {
  const currentPlayerId = game.players[game.currentPlayer];
  const currentPlayerMention = currentPlayerId === 'bot' ? '🤖 Bot' : `<@${currentPlayerId}>`;
  const currentColor = game.playerColors[game.currentPlayer];
  
  const boardDisplay = game.board.map(row => 
    row.map(cell => 
      cell === EMPTY ? '⚫' : 
      cell === PLAYER1 ? game.playerColors[0] : 
      game.playerColors[1]
    ).join(' ')
  ).join('\n');
  
  const columnNumbers = '1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣';
  
  return new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('🎮 Connect Four')
    .setDescription(`Current turn: ${currentPlayerMention} ${currentColor}`)
    .addFields(
      { 
        name: 'Board', 
        value: `${columnNumbers}\n${boardDisplay}`,
        inline: false
      },
      { 
        name: 'Players', 
        value: `${game.playerColors[0]} ${player1.username}\n${game.playerColors[1]} ${player2 ? player2.username : '🤖 Bot'}`,
        inline: true
      }
    )
    .setFooter({ text: 'Click a button to drop your piece!' });
}

function createGameButtons(game: Connect4Game): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const row1 = new ActionRowBuilder<ButtonBuilder>();
  const row2 = new ActionRowBuilder<ButtonBuilder>();
  
  for (let col = 0; col < COLS; col++) {
    const isFull = game.board[0][col] !== EMPTY;
    
    const button = new ButtonBuilder()
      .setCustomId(`c4_${col}`)
      .setLabel((col + 1).toString())
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isFull);
    
    // Split buttons: first 5 in row1, rest in row2
    if (col < 5) {
      row1.addComponents(button);
    } else {
      row2.addComponents(button);
    }
  }
  
  rows.push(row1);
  if (row2.components.length > 0) {
    rows.push(row2);
  }
  
  return rows;
}

function dropPiece(board: number[][], column: number, player: number): number {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][column] === EMPTY) {
      board[row][column] = player;
      return row;
    }
  }
  return -1;
}

function checkWinner(board: number[][], lastRow: number, lastCol: number): number | null {
  const player = board[lastRow][lastCol];
  
  // Check horizontal
  if (checkDirection(board, lastRow, lastCol, 0, 1, player)) return player;
  
  // Check vertical
  if (checkDirection(board, lastRow, lastCol, 1, 0, player)) return player;
  
  // Check diagonal (top-left to bottom-right)
  if (checkDirection(board, lastRow, lastCol, 1, 1, player)) return player;
  
  // Check diagonal (bottom-left to top-right)
  if (checkDirection(board, lastRow, lastCol, -1, 1, player)) return player;
  
  return null;
}

function checkDirection(
  board: number[][], 
  row: number, 
  col: number, 
  dRow: number, 
  dCol: number, 
  player: number
): boolean {
  let count = 1;
  
  // Check in positive direction
  let r = row + dRow;
  let c = col + dCol;
  while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
    count++;
    r += dRow;
    c += dCol;
  }
  
  // Check in negative direction
  r = row - dRow;
  c = col - dCol;
  while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
    count++;
    r -= dRow;
    c -= dCol;
  }
  
  return count >= 4;
}

function isBoardFull(board: number[][]): boolean {
  return board[0].every(cell => cell !== EMPTY);
}

function getBotMove(board: number[][]): number {
  // Simple AI: Try to win, block opponent wins, or pick random
  const validColumns = [];
  
  for (let col = 0; col < COLS; col++) {
    if (board[0][col] === EMPTY) {
      validColumns.push(col);
    }
  }
  
  // Try to win
  for (const col of validColumns) {
    const testBoard = board.map(row => [...row]);
    const row = dropPiece(testBoard, col, PLAYER2);
    if (checkWinner(testBoard, row, col) === PLAYER2) {
      return col;
    }
  }
  
  // Block opponent wins
  for (const col of validColumns) {
    const testBoard = board.map(row => [...row]);
    const row = dropPiece(testBoard, col, PLAYER1);
    if (checkWinner(testBoard, row, col) === PLAYER1) {
      return col;
    }
  }
  
  // Pick center or random
  if (validColumns.includes(3)) return 3;
  return validColumns[Math.floor(Math.random() * validColumns.length)];
}

async function handleGameEnd(
  interaction: ButtonInteraction | null,
  game: Connect4Game,
  winner: number | null,
  isDraw: boolean,
  player1: User,
  player2: User | null,
  response?: any
) {
  let resultMessage: string;
  let winnerId: string | null = null;
  let loserId: string | null = null;
  
  if (isDraw) {
    resultMessage = '🤝 It\'s a draw!';
  } else if (winner === PLAYER1) {
    winnerId = player1.id;
    loserId = player2?.id || null;
    resultMessage = `🎉 ${player1.username} wins!`;
  } else {
    winnerId = player2?.id || 'bot';
    loserId = player1.id;
    resultMessage = player2 ? `🎉 ${player2.username} wins!` : '🤖 Bot wins!';
  }
  
  // Update game stats
  if (winnerId && winnerId !== 'bot') {
    const user = await database.getUser(winnerId);
    if (!user) {
      await database.createUser(winnerId, winnerId === player1.id ? player1.username : player2!.username);
    }
    await database.updateGameStats(winnerId, GameType.ConnectFour, { wins: 1 });
    await database.updateUser(winnerId, { xp: (user?.xp || 0) + 30, balance: (user?.balance || 0) + 20 });
  }
  
  if (loserId) {
    const user = await database.getUser(loserId);
    if (!user) {
      await database.createUser(loserId, loserId === player1.id ? player1.username : player2!.username);
    }
    await database.updateGameStats(loserId, GameType.ConnectFour, { losses: 1 });
    await database.updateUser(loserId, { xp: (user?.xp || 0) + 10 });
  }
  
  if (isDraw) {
    for (const playerId of [player1.id, player2?.id].filter(Boolean) as string[]) {
      const user = await database.getUser(playerId);
      if (!user) {
        await database.createUser(playerId, playerId === player1.id ? player1.username : player2!.username);
      }
      await database.updateGameStats(playerId, GameType.ConnectFour, { draws: 1 });
      await database.updateUser(playerId, { xp: (user?.xp || 0) + 15 });
    }
  }
  
  const boardDisplay = game.board.map(row => 
    row.map(cell => 
      cell === EMPTY ? '⚫' : 
      cell === PLAYER1 ? game.playerColors[0] : 
      game.playerColors[1]
    ).join(' ')
  ).join('\n');
  
  const finalEmbed = new EmbedBuilder()
    .setColor(winner === PLAYER1 ? 0x0099FF : winner === PLAYER2 ? 0xFFD700 : 0xFFFF00)
    .setTitle('🎮 Connect Four - Game Over!')
    .setDescription(resultMessage)
    .addFields(
      { 
        name: 'Final Board', 
        value: boardDisplay,
        inline: false
      }
    );
  
  if (interaction) {
    await interaction.update({
      embeds: [finalEmbed],
      components: []
    });
  } else if (response) {
    // Bot made the winning move
    await response.edit({
      embeds: [finalEmbed],
      components: []
    });
  }
}

export default command;