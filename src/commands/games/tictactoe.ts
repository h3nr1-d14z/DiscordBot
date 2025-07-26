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

interface TicTacToeGame {
  board: string[];
  players: [string, string];
  currentPlayer: number;
  gameId: string;
}

const winConditions = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6] // Diagonals
];

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('tictactoe')
    .setDescription('Play Tic-Tac-Toe')
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
    
    const gameId = `ttt_${interaction.id}`;
    const game: TicTacToeGame = {
      board: Array(9).fill(''),
      players: [interaction.user.id, isVsBot ? 'bot' : opponent!.id],
      currentPlayer: 0,
      gameId: gameId
    };
    
    const embed = createGameEmbed(game, interaction.user, isVsBot ? null : opponent!);
    const components = createGameButtons(game);
    
    const response = await interaction.reply({
      content: isVsBot ? undefined : `${opponent}, you have been challenged to Tic-Tac-Toe!`,
      embeds: [embed],
      components: components,
      fetchReply: true
    });
    
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });
    
    collector.on('collect', async (i: ButtonInteraction) => {
      // Check if it's the current player's turn
      const currentPlayerId = game.players[game.currentPlayer];
      
      if (currentPlayerId !== 'bot' && i.user.id !== currentPlayerId) {
        await i.reply({
          content: '❌ It\'s not your turn!',
          ephemeral: true
        });
        return;
      }
      
      const position = parseInt(i.customId.split('_')[1]);
      
      // Make the move
      game.board[position] = game.currentPlayer === 0 ? 'X' : 'O';
      
      // Check for winner
      const winner = checkWinner(game.board);
      const isDraw = !winner && game.board.every(cell => cell !== '');
      
      if (winner || isDraw) {
        // Game over
        await handleGameEnd(i, game, winner, isDraw, interaction.user, isVsBot ? null : opponent!, response);
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
        // Simple AI: Pick random empty cell
        const emptyCells = game.board
          .map((cell, index) => cell === '' ? index : -1)
          .filter(index => index !== -1);
        
        if (emptyCells.length > 0) {
          const botMove = emptyCells[Math.floor(Math.random() * emptyCells.length)];
          
          // Simulate bot clicking the button
          setTimeout(async () => {
            game.board[botMove] = 'O';
            
            const winner = checkWinner(game.board);
            const isDraw = !winner && game.board.every(cell => cell !== '');
            
            if (winner || isDraw) {
              await handleGameEnd(null, game, winner, isDraw, interaction.user, null, response);
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
      }
    });
    
    collector.on('end', async () => {
      await response.edit({
        components: []
      }).catch(() => {});
    });
  },
};

function createGameEmbed(game: TicTacToeGame, player1: User, player2: User | null): EmbedBuilder {
  const currentPlayerId = game.players[game.currentPlayer];
  const currentPlayerMention = currentPlayerId === 'bot' ? '🤖 Bot' : `<@${currentPlayerId}>`;
  
  return new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('🎮 Tic-Tac-Toe')
    .setDescription(`Current turn: ${currentPlayerMention} (${game.currentPlayer === 0 ? 'X' : 'O'})`)
    .addFields(
      { 
        name: 'Players', 
        value: `X: ${player1.username}\nO: ${player2 ? player2.username : '🤖 Bot'}`,
        inline: true
      }
    )
    .setFooter({ text: 'Click a button to make your move!' });
}

function createGameButtons(game: TicTacToeGame): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  
  for (let i = 0; i < 3; i++) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    
    for (let j = 0; j < 3; j++) {
      const index = i * 3 + j;
      const cell = game.board[index];
      
      const button = new ButtonBuilder()
        .setCustomId(`ttt_${index}`)
        .setLabel(cell || '\u200b')
        .setStyle(
          cell === 'X' ? ButtonStyle.Primary : 
            cell === 'O' ? ButtonStyle.Danger : 
              ButtonStyle.Secondary
        )
        .setDisabled(cell !== '');
      
      row.addComponents(button);
    }
    
    rows.push(row);
  }
  
  return rows;
}

function checkWinner(board: string[]): string | null {
  for (const condition of winConditions) {
    const [a, b, c] = condition;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

async function handleGameEnd(
  interaction: ButtonInteraction | null,
  game: TicTacToeGame,
  winner: string | null,
  isDraw: boolean,
  player1: User,
  player2: User | null,
  message?: any
) {
  let resultMessage: string;
  let winnerId: string | null = null;
  let loserId: string | null = null;
  
  if (isDraw) {
    resultMessage = '🤝 It\'s a draw!';
  } else if (winner === 'X') {
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
    await database.updateGameStats(winnerId, GameType.TicTacToe, { wins: 1 });
    await database.updateUser(winnerId, { xp: (user?.xp || 0) + 20, balance: (user?.balance || 0) + 10 });
  }
  
  if (loserId) {
    const user = await database.getUser(loserId);
    if (!user) {
      await database.createUser(loserId, loserId === player1.id ? player1.username : player2!.username);
    }
    await database.updateGameStats(loserId, GameType.TicTacToe, { losses: 1 });
    await database.updateUser(loserId, { xp: (user?.xp || 0) + 5 });
  }
  
  if (isDraw) {
    for (const playerId of [player1.id, player2?.id].filter(Boolean) as string[]) {
      const user = await database.getUser(playerId);
      if (!user) {
        await database.createUser(playerId, playerId === player1.id ? player1.username : player2!.username);
      }
      await database.updateGameStats(playerId, GameType.TicTacToe, { draws: 1 });
      await database.updateUser(playerId, { xp: (user?.xp || 0) + 10 });
    }
  }
  
  const finalEmbed = new EmbedBuilder()
    .setColor(winner === 'X' ? 0x0099FF : winner === 'O' ? 0xFF0000 : 0xFFFF00)
    .setTitle('🎮 Tic-Tac-Toe - Game Over!')
    .setDescription(resultMessage)
    .addFields(
      { 
        name: 'Final Board', 
        value: formatBoard(game.board),
        inline: false
      }
    );
  
  if (interaction) {
    await interaction.update({
      embeds: [finalEmbed],
      components: []
    });
  } else if (message) {
    await message.edit({
      embeds: [finalEmbed],
      components: []
    });
  }
}

function formatBoard(board: string[]): string {
  return board
    .map((cell, i) => {
      const symbol = cell || '⬜';
      const mapped = symbol === 'X' ? '❌' : symbol === 'O' ? '⭕' : symbol;
      return i % 3 === 2 ? mapped + '\n' : mapped + ' ';
    })
    .join('');
}

export default command;