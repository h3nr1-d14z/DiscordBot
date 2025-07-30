import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, User } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';

type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
type Color = 'white' | 'black';
type Square = [number, number]; // [row, col]

interface Piece {
  type: PieceType;
  color: Color;
  hasMoved?: boolean;
}

interface ChessGame {
  board: (Piece | null)[][];
  currentTurn: Color;
  moveHistory: string[];
  capturedPieces: { white: Piece[]; black: Piece[] };
  inCheck: boolean;
  checkmate: boolean;
  stalemate: boolean;
  selectedSquare: Square | null;
  possibleMoves: Square[];
  lastMove: { from: Square; to: Square } | null;
}

const PIECES = {
  white: {
    king: '♔',
    queen: '♕',
    rook: '♖',
    bishop: '♗',
    knight: '♘',
    pawn: '♙'
  },
  black: {
    king: '♚',
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
    pawn: '♟'
  }
};

class Chess {
  private game: ChessGame;

  constructor() {
    this.game = {
      board: this.initializeBoard(),
      currentTurn: 'white',
      moveHistory: [],
      capturedPieces: { white: [], black: [] },
      inCheck: false,
      checkmate: false,
      stalemate: false,
      selectedSquare: null,
      possibleMoves: [],
      lastMove: null
    };
  }

  private initializeBoard(): (Piece | null)[][] {
    const board: (Piece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Black pieces
    board[0][0] = { type: 'rook', color: 'black' };
    board[0][1] = { type: 'knight', color: 'black' };
    board[0][2] = { type: 'bishop', color: 'black' };
    board[0][3] = { type: 'queen', color: 'black' };
    board[0][4] = { type: 'king', color: 'black' };
    board[0][5] = { type: 'bishop', color: 'black' };
    board[0][6] = { type: 'knight', color: 'black' };
    board[0][7] = { type: 'rook', color: 'black' };
    
    for (let i = 0; i < 8; i++) {
      board[1][i] = { type: 'pawn', color: 'black' };
    }
    
    // White pieces
    for (let i = 0; i < 8; i++) {
      board[6][i] = { type: 'pawn', color: 'white' };
    }
    
    board[7][0] = { type: 'rook', color: 'white' };
    board[7][1] = { type: 'knight', color: 'white' };
    board[7][2] = { type: 'bishop', color: 'white' };
    board[7][3] = { type: 'queen', color: 'white' };
    board[7][4] = { type: 'king', color: 'white' };
    board[7][5] = { type: 'bishop', color: 'white' };
    board[7][6] = { type: 'knight', color: 'white' };
    board[7][7] = { type: 'rook', color: 'white' };
    
    return board;
  }

  selectSquare(notation: string): boolean {
    const square = this.notationToSquare(notation);
    if (!square) return false;
    
    const [row, col] = square;
    const piece = this.game.board[row][col];
    
    if (piece && piece.color === this.game.currentTurn) {
      this.game.selectedSquare = square;
      this.game.possibleMoves = this.getValidMoves(square);
      return true;
    }
    
    return false;
  }

  makeMove(from: string, to: string): boolean {
    const fromSquare = this.notationToSquare(from);
    const toSquare = this.notationToSquare(to);
    
    if (!fromSquare || !toSquare) return false;
    
    const [fromRow, fromCol] = fromSquare;
    const [toRow, toCol] = toSquare;
    
    const piece = this.game.board[fromRow][fromCol];
    if (!piece || piece.color !== this.game.currentTurn) return false;
    
    const validMoves = this.getValidMoves(fromSquare);
    if (!validMoves.some(([r, c]) => r === toRow && c === toCol)) return false;
    
    // Capture piece if any
    const capturedPiece = this.game.board[toRow][toCol];
    if (capturedPiece) {
      this.game.capturedPieces[capturedPiece.color].push(capturedPiece);
    }
    
    // Make the move
    this.game.board[toRow][toCol] = piece;
    this.game.board[fromRow][fromCol] = null;
    piece.hasMoved = true;
    
    // Handle pawn promotion
    if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
      piece.type = 'queen'; // Auto-promote to queen for simplicity
    }
    
    // Record move
    const moveNotation = `${from}${to}`;
    this.game.moveHistory.push(moveNotation);
    this.game.lastMove = { from: fromSquare, to: toSquare };
    
    // Switch turns
    this.game.currentTurn = this.game.currentTurn === 'white' ? 'black' : 'white';
    
    // Check for check/checkmate
    this.updateGameState();
    
    return true;
  }

  private getValidMoves(square: Square): Square[] {
    const [row, col] = square;
    const piece = this.game.board[row][col];
    if (!piece) return [];
    
    let moves: Square[] = [];
    
    switch (piece.type) {
      case 'pawn':
        moves = this.getPawnMoves(row, col, piece.color);
        break;
      case 'rook':
        moves = this.getRookMoves(row, col, piece.color);
        break;
      case 'knight':
        moves = this.getKnightMoves(row, col, piece.color);
        break;
      case 'bishop':
        moves = this.getBishopMoves(row, col, piece.color);
        break;
      case 'queen':
        moves = [...this.getRookMoves(row, col, piece.color), ...this.getBishopMoves(row, col, piece.color)];
        break;
      case 'king':
        moves = this.getKingMoves(row, col, piece.color);
        break;
    }
    
    // Filter out moves that would leave king in check
    return moves.filter(move => !this.wouldBeInCheck(square, move, piece.color));
  }

  private getPawnMoves(row: number, col: number, color: Color): Square[] {
    const moves: Square[] = [];
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;
    
    // Forward move
    if (this.isValidSquare(row + direction, col) && !this.game.board[row + direction][col]) {
      moves.push([row + direction, col]);
      
      // Double move from start
      if (row === startRow && !this.game.board[row + 2 * direction][col]) {
        moves.push([row + 2 * direction, col]);
      }
    }
    
    // Captures
    for (const dcol of [-1, 1]) {
      if (this.isValidSquare(row + direction, col + dcol)) {
        const target = this.game.board[row + direction][col + dcol];
        if (target && target.color !== color) {
          moves.push([row + direction, col + dcol]);
        }
      }
    }
    
    return moves;
  }

  private getRookMoves(row: number, col: number, color: Color): Square[] {
    const moves: Square[] = [];
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    
    for (const [dr, dc] of directions) {
      for (let i = 1; i < 8; i++) {
        const newRow = row + dr * i;
        const newCol = col + dc * i;
        
        if (!this.isValidSquare(newRow, newCol)) break;
        
        const target = this.game.board[newRow][newCol];
        if (!target) {
          moves.push([newRow, newCol]);
        } else {
          if (target.color !== color) moves.push([newRow, newCol]);
          break;
        }
      }
    }
    
    return moves;
  }

  private getKnightMoves(row: number, col: number, color: Color): Square[] {
    const moves: Square[] = [];
    const deltas = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    
    for (const [dr, dc] of deltas) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (this.isValidSquare(newRow, newCol)) {
        const target = this.game.board[newRow][newCol];
        if (!target || target.color !== color) {
          moves.push([newRow, newCol]);
        }
      }
    }
    
    return moves;
  }

  private getBishopMoves(row: number, col: number, color: Color): Square[] {
    const moves: Square[] = [];
    const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    
    for (const [dr, dc] of directions) {
      for (let i = 1; i < 8; i++) {
        const newRow = row + dr * i;
        const newCol = col + dc * i;
        
        if (!this.isValidSquare(newRow, newCol)) break;
        
        const target = this.game.board[newRow][newCol];
        if (!target) {
          moves.push([newRow, newCol]);
        } else {
          if (target.color !== color) moves.push([newRow, newCol]);
          break;
        }
      }
    }
    
    return moves;
  }

  private getKingMoves(row: number, col: number, color: Color): Square[] {
    const moves: Square[] = [];
    
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        
        const newRow = row + dr;
        const newCol = col + dc;
        
        if (this.isValidSquare(newRow, newCol)) {
          const target = this.game.board[newRow][newCol];
          if (!target || target.color !== color) {
            moves.push([newRow, newCol]);
          }
        }
      }
    }
    
    return moves;
  }

  private isValidSquare(row: number, col: number): boolean {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  private wouldBeInCheck(from: Square, to: Square, color: Color): boolean {
    // Make temporary move
    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;
    const piece = this.game.board[fromRow][fromCol];
    const captured = this.game.board[toRow][toCol];
    
    this.game.board[toRow][toCol] = piece;
    this.game.board[fromRow][fromCol] = null;
    
    const inCheck = this.isInCheck(color);
    
    // Undo move
    this.game.board[fromRow][fromCol] = piece;
    this.game.board[toRow][toCol] = captured;
    
    return inCheck;
  }

  private isInCheck(color: Color): boolean {
    // Find king
    let kingPos: Square | null = null;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.game.board[row][col];
        if (piece && piece.type === 'king' && piece.color === color) {
          kingPos = [row, col];
          break;
        }
      }
      if (kingPos) break;
    }
    
    if (!kingPos) return false;
    
    // Check if any opponent piece can attack the king
    const opponentColor = color === 'white' ? 'black' : 'white';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.game.board[row][col];
        if (piece && piece.color === opponentColor) {
          const moves = this.getValidMovesNoCheck([row, col]);
          if (moves.some(([r, c]) => r === kingPos![0] && c === kingPos![1])) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  private getValidMovesNoCheck(square: Square): Square[] {
    const [row, col] = square;
    const piece = this.game.board[row][col];
    if (!piece) return [];
    
    switch (piece.type) {
      case 'pawn':
        return this.getPawnMoves(row, col, piece.color);
      case 'rook':
        return this.getRookMoves(row, col, piece.color);
      case 'knight':
        return this.getKnightMoves(row, col, piece.color);
      case 'bishop':
        return this.getBishopMoves(row, col, piece.color);
      case 'queen':
        return [...this.getRookMoves(row, col, piece.color), ...this.getBishopMoves(row, col, piece.color)];
      case 'king':
        return this.getKingMoves(row, col, piece.color);
      default:
        return [];
    }
  }

  private updateGameState(): void {
    this.game.inCheck = this.isInCheck(this.game.currentTurn);
    
    // Check for checkmate or stalemate
    let hasValidMove = false;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.game.board[row][col];
        if (piece && piece.color === this.game.currentTurn) {
          const moves = this.getValidMoves([row, col]);
          if (moves.length > 0) {
            hasValidMove = true;
            break;
          }
        }
      }
      if (hasValidMove) break;
    }
    
    if (!hasValidMove) {
      if (this.game.inCheck) {
        this.game.checkmate = true;
      } else {
        this.game.stalemate = true;
      }
    }
  }

  private notationToSquare(notation: string): Square | null {
    if (notation.length !== 2) return null;
    
    const col = notation.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(notation[1]);
    
    if (this.isValidSquare(row, col)) {
      return [row, col];
    }
    
    return null;
  }

  private squareToNotation(square: Square): string {
    const [row, col] = square;
    return String.fromCharCode('a'.charCodeAt(0) + col) + (8 - row);
  }

  renderBoard(): string {
    let board = '```\n  a b c d e f g h\n';
    
    for (let row = 0; row < 8; row++) {
      board += `${8 - row} `;
      for (let col = 0; col < 8; col++) {
        const piece = this.game.board[row][col];
        if (piece) {
          board += PIECES[piece.color][piece.type] + ' ';
        } else {
          board += ((row + col) % 2 === 0 ? '□' : '■') + ' ';
        }
      }
      board += `${8 - row}\n`;
    }
    
    board += '  a b c d e f g h\n```';
    return board;
  }

  getState(): ChessGame {
    return this.game;
  }
}

const activeGames = new Map<string, { game: Chess; white: string; black: string }>();

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('chess')
    .setDescription('Play Chess against another player!')
    .addUserOption(option =>
      option.setName('opponent')
        .setDescription('The player to challenge')
        .setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    const challenger = interaction.user;
    const opponent = interaction.options.getUser('opponent', true);
    
    if (opponent.bot) {
      await interaction.reply({
        content: '❌ You cannot play chess against a bot!',
        ephemeral: true
      });
      return;
    }
    
    if (opponent.id === challenger.id) {
      await interaction.reply({
        content: '❌ You cannot play chess against yourself!',
        ephemeral: true
      });
      return;
    }
    
    const gameId = `chess_${interaction.channelId}`;
    
    if (activeGames.has(gameId)) {
      await interaction.reply({
        content: '❌ There\'s already an active chess game in this channel!',
        ephemeral: true
      });
      return;
    }
    
    const game = new Chess();
    const whitePlayer = Math.random() < 0.5 ? challenger : opponent;
    const blackPlayer = whitePlayer === challenger ? opponent : challenger;
    
    activeGames.set(gameId, {
      game,
      white: whitePlayer.id,
      black: blackPlayer.id
    });
    
    const embed = createGameEmbed(game, whitePlayer, blackPlayer);
    const moveInput = createMoveInput();
    
    await interaction.reply({
      content: `♟️ **Chess Match Started!**\n${whitePlayer} (White) vs ${blackPlayer} (Black)`,
      embeds: [embed],
      components: [moveInput]
    });
    
    const collector = (interaction.channel as any).createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 1800000 // 30 minutes
    });
    
    collector.on('collect', async (i: any) => {
      const gameData = activeGames.get(gameId);
      if (!gameData) return;
      
      const currentPlayer = gameData.game.getState().currentTurn === 'white' ? gameData.white : gameData.black;
      
      if (i.user.id !== currentPlayer) {
        await i.reply({
          content: '❌ It\'s not your turn!',
          ephemeral: true
        });
        return;
      }
      
      const move = i.values[0];
      const [from, to] = move.split('-');
      
      if (gameData.game.makeMove(from, to)) {
        const newEmbed = createGameEmbed(gameData.game, 
          interaction.guild?.members.cache.get(gameData.white)?.user || whitePlayer,
          interaction.guild?.members.cache.get(gameData.black)?.user || blackPlayer
        );
        
        if (gameData.game.getState().checkmate || gameData.game.getState().stalemate) {
          await i.update({
            embeds: [newEmbed],
            components: []
          });
          
          const winner = gameData.game.getState().checkmate 
            ? (gameData.game.getState().currentTurn === 'white' ? gameData.black : gameData.white)
            : null;
          
          if (winner) {
            await saveGameStats(winner, true);
            await saveGameStats(winner === gameData.white ? gameData.black : gameData.white, false);
          }
          
          activeGames.delete(gameId);
          collector.stop();
        } else {
          const newMoveInput = createMoveInput();
          await i.update({
            embeds: [newEmbed],
            components: [newMoveInput]
          });
        }
      } else {
        await i.reply({
          content: '❌ Invalid move! Please select a valid move.',
          ephemeral: true
        });
      }
    });
    
    collector.on('end', async (_collected: any, reason: string) => {
      if (reason === 'time') {
        activeGames.delete(gameId);
        await interaction.followUp({
          content: '⏱️ Chess game timed out due to inactivity!'
        });
      }
    });
  },
};

function createGameEmbed(game: Chess, whitePlayer: User, blackPlayer: User): EmbedBuilder {
  const state = game.getState();
  const currentPlayer = state.currentTurn === 'white' ? whitePlayer : blackPlayer;
  
  let status = `${currentPlayer}'s turn (${state.currentTurn})`;
  if (state.inCheck) status += ' - CHECK!';
  if (state.checkmate) status = `Checkmate! ${state.currentTurn === 'white' ? blackPlayer : whitePlayer} wins!`;
  if (state.stalemate) status = 'Stalemate! Draw!';
  
  const embed = new EmbedBuilder()
    .setTitle('♟️ Chess')
    .setDescription(game.renderBoard())
    .addFields(
      { name: 'Status', value: status },
      { name: 'White', value: whitePlayer.username, inline: true },
      { name: 'Black', value: blackPlayer.username, inline: true },
      { name: 'Moves', value: state.moveHistory.length.toString(), inline: true }
    )
    .setColor(state.currentTurn === 'white' ? 0xFFFFFF : 0x000000)
    .setTimestamp();
  
  if (state.moveHistory.length > 0) {
    const lastMoves = state.moveHistory.slice(-5).join(', ');
    embed.addFields({ name: 'Recent Moves', value: lastMoves });
  }
  
  return embed;
}

function createMoveInput(): ActionRowBuilder<StringSelectMenuBuilder> {
  const moves = [
    { label: 'a2-a4', value: 'a2-a4' },
    { label: 'b2-b4', value: 'b2-b4' },
    { label: 'c2-c4', value: 'c2-c4' },
    { label: 'd2-d4', value: 'd2-d4' },
    { label: 'e2-e4', value: 'e2-e4' },
    { label: 'f2-f4', value: 'f2-f4' },
    { label: 'g2-g4', value: 'g2-g4' },
    { label: 'h2-h4', value: 'h2-h4' },
    { label: 'b1-c3', value: 'b1-c3' },
    { label: 'g1-f3', value: 'g1-f3' }
  ];
  
  return new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('chess_move')
        .setPlaceholder('Select your move (from-to)')
        .addOptions(moves)
    );
}

async function saveGameStats(userId: string, won: boolean) {
  try {
    const stats = await database.getGameStats(userId, 'chess');
    
    await database.updateGameStats(userId, 'chess', {
      wins: (stats?.wins || 0) + (won ? 1 : 0),
      losses: (stats?.losses || 0) + (won ? 0 : 1),
      highScore: stats?.highScore || 0
    });
  } catch (error) {
    logger.error('Error saving chess stats:', error);
  }
}

export default command;