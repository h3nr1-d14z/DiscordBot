import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder, User, VoiceChannel, StageChannel } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';
import { SafeInteractionHandler } from '../../utils/interactionUtils';
import { createCanvas, Canvas } from 'canvas';
import { activityService } from '../../services/activityService';

interface GameState {
  board: number[][];
  score: number;
  moves: number;
  gameOver: boolean;
  won: boolean;
}

const BOARD_SIZE = 4;
const WINNING_TILE = 2048;
const TILE_SIZE = 100;
const TILE_MARGIN = 10;
const BOARD_PADDING = 20;
const CANVAS_SIZE = BOARD_PADDING * 2 + BOARD_SIZE * TILE_SIZE + (BOARD_SIZE - 1) * TILE_MARGIN;

// Color scheme for tiles
const TILE_COLORS: { [key: number]: { bg: string; text: string } } = {
  0: { bg: '#cdc1b4', text: '#776e65' },
  2: { bg: '#eee4da', text: '#776e65' },
  4: { bg: '#ede0c8', text: '#776e65' },
  8: { bg: '#f2b179', text: '#f9f6f2' },
  16: { bg: '#f59563', text: '#f9f6f2' },
  32: { bg: '#f67c5f', text: '#f9f6f2' },
  64: { bg: '#f65e3b', text: '#f9f6f2' },
  128: { bg: '#edcf72', text: '#f9f6f2' },
  256: { bg: '#edcc61', text: '#f9f6f2' },
  512: { bg: '#edc850', text: '#f9f6f2' },
  1024: { bg: '#edc53f', text: '#f9f6f2' },
  2048: { bg: '#edc22e', text: '#f9f6f2' },
  4096: { bg: '#3c3a32', text: '#f9f6f2' },
  8192: { bg: '#3c3a32', text: '#f9f6f2' }
};

class Game2048 {
  private board: number[][];
  private score: number;
  private moves: number;
  private gameOver: boolean;
  private won: boolean;

  constructor(state?: GameState) {
    if (state) {
      this.board = state.board;
      this.score = state.score;
      this.moves = state.moves;
      this.gameOver = state.gameOver;
      this.won = state.won;
    } else {
      this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
      this.score = 0;
      this.moves = 0;
      this.gameOver = false;
      this.won = false;
      this.addRandomTile();
      this.addRandomTile();
    }
  }

  private addRandomTile(): boolean {
    const emptyCells: [number, number][] = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (this.board[i][j] === 0) {
          emptyCells.push([i, j]);
        }
      }
    }

    if (emptyCells.length === 0) return false;

    const [row, col] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    this.board[row][col] = Math.random() < 0.9 ? 2 : 4;
    return true;
  }

  private canMove(): boolean {
    // Check for empty cells
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (this.board[i][j] === 0) return true;
      }
    }

    // Check for possible merges
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        const current = this.board[i][j];
        if (j < BOARD_SIZE - 1 && current === this.board[i][j + 1]) return true;
        if (i < BOARD_SIZE - 1 && current === this.board[i + 1][j]) return true;
      }
    }

    return false;
  }

  private moveLeft(): boolean {
    let moved = false;

    for (let i = 0; i < BOARD_SIZE; i++) {
      const row = this.board[i].filter(cell => cell !== 0);
      const merged: boolean[] = Array(row.length).fill(false);

      for (let j = 0; j < row.length - 1; j++) {
        if (!merged[j] && row[j] === row[j + 1]) {
          row[j] *= 2;
          this.score += row[j];
          row.splice(j + 1, 1);
          merged[j] = true;
          
          if (row[j] === WINNING_TILE) {
            this.won = true;
          }
        }
      }

      const newRow = [...row, ...Array(BOARD_SIZE - row.length).fill(0)];
      
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (this.board[i][j] !== newRow[j]) {
          moved = true;
          this.board[i][j] = newRow[j];
        }
      }
    }

    return moved;
  }

  private rotateBoard(): void {
    const rotated = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
    
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        rotated[j][BOARD_SIZE - 1 - i] = this.board[i][j];
      }
    }
    
    this.board = rotated;
  }

  move(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    if (this.gameOver) return false;

    let rotations = 0;
    switch (direction) {
      case 'up':
        rotations = 3;
        break;
      case 'right':
        rotations = 2;
        break;
      case 'down':
        rotations = 1;
        break;
    }

    for (let i = 0; i < rotations; i++) {
      this.rotateBoard();
    }

    const moved = this.moveLeft();

    for (let i = 0; i < (4 - rotations) % 4; i++) {
      this.rotateBoard();
    }

    if (moved) {
      this.moves++;
      this.addRandomTile();
      
      if (!this.canMove()) {
        this.gameOver = true;
      }
    }

    return moved;
  }

  getState(): GameState {
    return {
      board: this.board,
      score: this.score,
      moves: this.moves,
      gameOver: this.gameOver,
      won: this.won
    };
  }

  renderBoard(): Canvas {
    const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#bbada0';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw tiles
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const value = this.board[row][col];
        const x = BOARD_PADDING + col * (TILE_SIZE + TILE_MARGIN);
        const y = BOARD_PADDING + row * (TILE_SIZE + TILE_MARGIN);

        // Tile background
        const colors = TILE_COLORS[value] || TILE_COLORS[4096];
        ctx.fillStyle = colors.bg;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Tile text
        if (value > 0) {
          ctx.fillStyle = colors.text;
          ctx.font = value >= 1024 ? 'bold 35px Arial' : value >= 128 ? 'bold 45px Arial' : 'bold 55px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(value.toString(), x + TILE_SIZE / 2, y + TILE_SIZE / 2);
        }
      }
    }

    return canvas;
  }
}

const activeGames = new Map<string, { game: Game2048, challenger?: string, challengerGame?: Game2048 }>();

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('2048')
    .setDescription('Play the classic 2048 puzzle game with beautiful graphics!')
    .addSubcommand(subcommand =>
      subcommand
        .setName('solo')
        .setDescription('Play 2048 by yourself'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('challenge')
        .setDescription('Challenge another player to beat your score!')
        .addUserOption(option =>
          option.setName('opponent')
            .setDescription('The player to challenge')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('embed')
        .setDescription('Play 2048 in an embedded activity (requires voice channel)')),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'solo') {
      await playSolo(interaction);
    } else if (subcommand === 'challenge') {
      await playChallenge(interaction);
    } else if (subcommand === 'embed') {
      await playEmbedded(interaction);
    }
  },
};

async function playSolo(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const gameId = `2048_${userId}`;

  if (activeGames.has(gameId)) {
    await interaction.reply({
      content: '❌ You already have an active game! Finish it first.',
      ephemeral: true
    });
    return;
  }

  const game = new Game2048();
  activeGames.set(gameId, { game });

  const { embed, attachment } = await createGameEmbed(game, interaction.user);
  const buttons = createGameButtons();

  const response = await interaction.reply({
    embeds: [embed],
    files: [attachment],
    components: [buttons]
  });

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 600000
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

    const direction = i.customId as 'up' | 'down' | 'left' | 'right';
    const moved = game.move(direction);

    if (!moved && !game.getState().gameOver) {
      await interactionHandler.reply(i, {
        content: '❌ Invalid move! Try a different direction.',
        ephemeral: true
      });
      return;
    }

    const { embed: newEmbed, attachment: newAttachment } = await createGameEmbed(game, interaction.user);
    
    if (game.getState().gameOver || game.getState().won) {
      await interactionHandler.update(i, {
        embeds: [newEmbed],
        files: [newAttachment],
        components: []
      });

      await saveGameStats(userId, game.getState());
      activeGames.delete(gameId);
      collector.stop();
    } else {
      await interactionHandler.update(i, {
        embeds: [newEmbed],
        files: [newAttachment],
        components: [buttons]
      });
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'time') {
      activeGames.delete(gameId);
      const state = game.getState();
      const timeoutEmbed = new EmbedBuilder()
        .setTitle('⏱️ Game Timed Out!')
        .setDescription(`Your game has ended due to inactivity.`)
        .addFields(
          { name: 'Final Score', value: state.score.toString(), inline: true },
          { name: 'Moves Made', value: state.moves.toString(), inline: true }
        )
        .setColor(0xFF0000)
        .setTimestamp();
      
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

  const gameId = `2048_challenge_${challenger.id}_${opponent.id}`;

  if (activeGames.has(gameId)) {
    await interaction.reply({
      content: '❌ There\'s already an active challenge between you two!',
      ephemeral: true
    });
    return;
  }

  const acceptEmbed = new EmbedBuilder()
    .setTitle('🎮 2048 Challenge!')
    .setDescription(`${opponent}, you've been challenged by ${challenger} to a game of 2048!\n\nIn this mode, both players play simultaneously and whoever gets the highest score wins!`)
    .setColor(0xFFD700)
    .setTimestamp();

  const acceptButton = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('accept_2048')
        .setLabel('Accept Challenge')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('decline_2048')
        .setLabel('Decline')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

  const response = await interaction.reply({
    content: `${opponent}`,
    embeds: [acceptEmbed],
    components: [acceptButton]
  });

  const acceptCollector = response.createMessageComponentCollector({
    filter: i => i.user.id === opponent.id,
    componentType: ComponentType.Button,
    time: 60000,
    max: 1
  });

  acceptCollector.on('collect', async (i) => {
    if (i.customId === 'decline_2048') {
      await i.update({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Challenge Declined')
            .setDescription(`${opponent} declined the challenge!`)
            .setColor(0xFF0000)
        ],
        components: []
      });
      return;
    }

    const challengerGame = new Game2048();
    const opponentGame = new Game2048();
    
    activeGames.set(gameId, {
      game: challengerGame,
      challenger: opponent.id,
      challengerGame: opponentGame
    });

    const { embed: challengerEmbed, attachment: challengerAttachment } = await createChallengeEmbed(challengerGame, opponentGame, challenger, opponent, 'challenger');
    const { embed: opponentEmbed, attachment: opponentAttachment } = await createChallengeEmbed(challengerGame, opponentGame, challenger, opponent, 'opponent');

    await i.update({
      embeds: [challengerEmbed, opponentEmbed],
      files: [challengerAttachment, opponentAttachment],
      components: [createGameButtons()]
    });

    const gameCollector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 600000
    });

    gameCollector.on('collect', async (btnInteraction) => {
      const isChallenger = btnInteraction.user.id === challenger.id;
      const isOpponent = btnInteraction.user.id === opponent.id;

      if (!isChallenger && !isOpponent) {
        await btnInteraction.reply({
          content: '❌ This is not your game!',
          ephemeral: true
        });
        return;
      }

      const direction = btnInteraction.customId as 'up' | 'down' | 'left' | 'right';
      const currentGame = isChallenger ? challengerGame : opponentGame;
      const moved = currentGame.move(direction);

      if (!moved && !currentGame.getState().gameOver) {
        await btnInteraction.reply({
          content: '❌ Invalid move! Try a different direction.',
          ephemeral: true
        });
        return;
      }

      const { embed: newChallengerEmbed, attachment: newChallengerAttachment } = await createChallengeEmbed(challengerGame, opponentGame, challenger, opponent, 'challenger');
      const { embed: newOpponentEmbed, attachment: newOpponentAttachment } = await createChallengeEmbed(challengerGame, opponentGame, challenger, opponent, 'opponent');

      const bothFinished = (challengerGame.getState().gameOver || challengerGame.getState().won) && 
                          (opponentGame.getState().gameOver || opponentGame.getState().won);

      if (bothFinished) {
        const challengerScore = challengerGame.getState().score;
        const opponentScore = opponentGame.getState().score;
        
        let resultText = '';
        if (challengerScore > opponentScore) {
          resultText = `🏆 ${challenger} wins with ${challengerScore} points!`;
        } else if (opponentScore > challengerScore) {
          resultText = `🏆 ${opponent} wins with ${opponentScore} points!`;
        } else {
          resultText = `🤝 It's a tie! Both players scored ${challengerScore} points!`;
        }

        const finalEmbed = new EmbedBuilder()
          .setTitle('🎮 2048 Challenge Results')
          .setDescription(resultText)
          .addFields(
            { name: challenger.username, value: `Score: ${challengerScore}\nMoves: ${challengerGame.getState().moves}`, inline: true },
            { name: opponent.username, value: `Score: ${opponentScore}\nMoves: ${opponentGame.getState().moves}`, inline: true }
          )
          .setColor(0xFFD700)
          .setTimestamp();

        await btnInteraction.update({
          embeds: [finalEmbed],
          files: [],
          components: []
        });

        await saveGameStats(challenger.id, challengerGame.getState());
        await saveGameStats(opponent.id, opponentGame.getState());
        
        activeGames.delete(gameId);
        gameCollector.stop();
      } else {
        await btnInteraction.update({
          embeds: [newChallengerEmbed, newOpponentEmbed],
          files: [newChallengerAttachment, newOpponentAttachment],
          components: [createGameButtons()]
        });
      }
    });
  });

  acceptCollector.on('end', async (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⏱️ Challenge Expired')
            .setDescription('The challenge was not accepted in time.')
            .setColor(0xFF0000)
        ],
        components: []
      });
    }
  });
}

async function createGameEmbed(game: Game2048, player: User): Promise<{ embed: EmbedBuilder; attachment: AttachmentBuilder }> {
  const state = game.getState();
  const statusText = state.won ? '🎉 You Won!' : state.gameOver ? '💀 Game Over!' : '🎮 Playing';
  
  const canvas = game.renderBoard();
  const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: '2048-board.png' });
  
  const embed = new EmbedBuilder()
    .setTitle('2048')
    .setImage('attachment://2048-board.png')
    .addFields(
      { name: 'Score', value: state.score.toString(), inline: true },
      { name: 'Moves', value: state.moves.toString(), inline: true },
      { name: 'Status', value: statusText, inline: true }
    )
    .setColor(state.won ? 0x00FF00 : state.gameOver ? 0xFF0000 : 0xFFD700)
    .setFooter({ text: `Player: ${player.username}` })
    .setTimestamp();

  return { embed, attachment };
}

async function createChallengeEmbed(game1: Game2048, game2: Game2048, player1: User, player2: User, perspective: 'challenger' | 'opponent'): Promise<{ embed: EmbedBuilder; attachment: AttachmentBuilder }> {
  const state1 = game1.getState();
  const state2 = game2.getState();
  
  const currentGame = perspective === 'challenger' ? game1 : game2;
  const canvas = currentGame.renderBoard();
  const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `2048-board-${perspective}.png` });
  
  const embed = new EmbedBuilder()
    .setTitle('🎮 2048 Challenge')
    .setImage(`attachment://2048-board-${perspective}.png`)
    .setColor(0xFFD700);

  if (perspective === 'challenger') {
    embed.setDescription(`**${player1.username}'s Board**`);
    embed.addFields(
      { name: 'Your Score', value: state1.score.toString(), inline: true },
      { name: 'Your Moves', value: state1.moves.toString(), inline: true },
      { name: `${player2.username}'s Score`, value: state2.score.toString(), inline: true }
    );
  } else {
    embed.setDescription(`**${player2.username}'s Board**`);
    embed.addFields(
      { name: 'Your Score', value: state2.score.toString(), inline: true },
      { name: 'Your Moves', value: state2.moves.toString(), inline: true },
      { name: `${player1.username}'s Score`, value: state1.score.toString(), inline: true }
    );
  }

  return { embed, attachment };
}

function createGameButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('up')
        .setEmoji('⬆️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('down')
        .setEmoji('⬇️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('left')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('right')
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Primary)
    );
}

async function saveGameStats(userId: string, state: GameState) {
  try {
    const stats = await database.getGameStats(userId, '2048');
    const won = state.won ? 1 : 0;
    const lost = state.gameOver && !state.won ? 1 : 0;
    const highScore = Math.max(state.score, stats?.highScore || 0);

    await database.updateGameStats(userId, '2048', {
      wins: (stats?.wins || 0) + won,
      losses: (stats?.losses || 0) + lost,
      highScore
    });
  } catch (error) {
    logger.error('Error saving 2048 game stats:', error);
  }
}

async function playEmbedded(interaction: ChatInputCommandInteraction) {
  // Check if user is in a voice channel
  const member = interaction.member;
  if (!member || typeof member === 'string' || !member.voice.channel) {
    await interaction.reply({
      content: '❌ You must be in a voice channel to start an embedded activity!',
      ephemeral: true
    });
    return;
  }

  const voiceChannel = member.voice.channel;
  
  // Check if the channel is a voice or stage channel
  if (!(voiceChannel instanceof VoiceChannel) && !(voiceChannel instanceof StageChannel)) {
    await interaction.reply({
      content: '❌ Activities can only be started in voice or stage channels!',
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply();

  try {
    // Create the activity
    const inviteUrl = await activityService.createActivity(voiceChannel.id, '2048');
    
    if (!inviteUrl) {
      await interaction.editReply({
        content: '❌ Failed to create the activity. Please try again later.'
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎮 2048 Activity Started!')
      .setDescription(`Click the button below to join the 2048 game in ${voiceChannel.name}!`)
      .addFields(
        { name: 'How to Play', value: 'Use arrow keys or swipe to move tiles. Combine tiles with the same number to reach 2048!' },
        { name: 'Voice Channel', value: voiceChannel.name, inline: true },
        { name: 'Players', value: 'Unlimited', inline: true }
      )
      .setColor(0xFFD700)
      .setTimestamp();

    const joinButton = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Join 2048 Game')
          .setURL(inviteUrl)
          .setStyle(ButtonStyle.Link)
          .setEmoji('🎮')
      );

    await interaction.editReply({
      embeds: [embed],
      components: [joinButton]
    });
  } catch (error: any) {
    logger.error('Error creating 2048 activity:', error);
    
    const errorMessage = error.message || 'Failed to create the activity. Make sure the bot has the necessary permissions.';
    await interaction.editReply({
      content: `❌ ${errorMessage}`
    });
  }
}

export default command;