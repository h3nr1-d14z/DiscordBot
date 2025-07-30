import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder, VoiceChannel, StageChannel } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';
import { createCanvas } from 'canvas';
import { activityService } from '../../services/activityService';

interface Point {
  x: number;
  y: number;
}

interface SnakeGame {
  snake: Point[];
  food: Point;
  direction: 'up' | 'down' | 'left' | 'right';
  score: number;
  gameOver: boolean;
  gridSize: number;
  speed: number;
  lastUpdate: number;
}

const GRID_SIZE = 15;
const CELL_SIZE = 20;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
const INITIAL_SPEED = 200; // milliseconds between moves

class Snake {
  private game: SnakeGame;

  constructor() {
    const startX = Math.floor(GRID_SIZE / 2);
    const startY = Math.floor(GRID_SIZE / 2);
    
    this.game = {
      snake: [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY }
      ],
      food: this.generateFood([{ x: startX, y: startY }]),
      direction: 'right',
      score: 0,
      gameOver: false,
      gridSize: GRID_SIZE,
      speed: INITIAL_SPEED,
      lastUpdate: Date.now()
    };
  }

  private generateFood(snake: Point[]): Point {
    let food: Point;
    do {
      food = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
    } while (snake.some(segment => segment.x === food.x && segment.y === food.y));
    return food;
  }

  move(newDirection: 'up' | 'down' | 'left' | 'right'): boolean {
    if (this.game.gameOver) return false;

    // Prevent moving in opposite direction
    const opposites = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left'
    };

    if (opposites[newDirection] !== this.game.direction) {
      this.game.direction = newDirection;
    }

    // Calculate new head position
    const head = { ...this.game.snake[0] };
    switch (this.game.direction) {
      case 'up':
        head.y -= 1;
        break;
      case 'down':
        head.y += 1;
        break;
      case 'left':
        head.x -= 1;
        break;
      case 'right':
        head.x += 1;
        break;
    }

    // Check wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      this.game.gameOver = true;
      return true;
    }

    // Check self collision
    if (this.game.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      this.game.gameOver = true;
      return true;
    }

    // Move snake
    this.game.snake.unshift(head);

    // Check food collision
    if (head.x === this.game.food.x && head.y === this.game.food.y) {
      this.game.score += 10;
      this.game.food = this.generateFood(this.game.snake);
      
      // Increase speed every 50 points
      if (this.game.score % 50 === 0 && this.game.speed > 100) {
        this.game.speed -= 20;
      }
    } else {
      this.game.snake.pop();
    }

    this.game.lastUpdate = Date.now();
    return true;
  }

  render(): Buffer {
    const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid lines
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // Snake
    this.game.snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#4CAF50' : '#66BB6A';
      ctx.fillRect(
        segment.x * CELL_SIZE + 2,
        segment.y * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4
      );
    });

    // Food
    ctx.fillStyle = '#FF5252';
    ctx.beginPath();
    ctx.arc(
      this.game.food.x * CELL_SIZE + CELL_SIZE / 2,
      this.game.food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    return canvas.toBuffer();
  }

  getState(): SnakeGame {
    return this.game;
  }
}

const activeGames = new Map<string, Snake>();

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('snake')
    .setDescription('Play the classic Snake game!')
    .addSubcommand(subcommand =>
      subcommand
        .setName('play')
        .setDescription('Play Snake in Discord chat'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('embed')
        .setDescription('Play Snake in an embedded activity (requires voice channel)')),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'play') {
      await playSnake(interaction);
    } else if (subcommand === 'embed') {
      await playEmbedded(interaction);
    }
  },
};

async function playSnake(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const gameId = `snake_${userId}`;

    if (activeGames.has(gameId)) {
      await interaction.reply({
        content: '❌ You already have an active Snake game! Finish it first.',
        ephemeral: true
      });
      return;
    }

    const game = new Snake();
    activeGames.set(gameId, game);

    const imageBuffer = game.render();
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'snake-game.png' });
    const embed = createGameEmbed(game.getState(), interaction.user.username);
    const buttons = createGameButtons();

    const response = await interaction.reply({
      embeds: [embed],
      files: [attachment],
      components: [buttons]
    });

    // Auto-move timer
    let moveTimer: NodeJS.Timeout;
    const startAutoMove = () => {
      moveTimer = setInterval(() => {
        const moved = game.move(game.getState().direction);
        if (moved) {
          updateGame();
        }
      }, game.getState().speed);
    };

    const updateGame = async () => {
      clearInterval(moveTimer);
      
      const newImageBuffer = game.render();
      const newAttachment = new AttachmentBuilder(newImageBuffer, { name: 'snake-game.png' });
      const newEmbed = createGameEmbed(game.getState(), interaction.user.username);
      
      if (game.getState().gameOver) {
        await interaction.editReply({
          embeds: [newEmbed],
          files: [newAttachment],
          components: []
        });
        
        await saveGameStats(userId, game.getState().score);
        activeGames.delete(gameId);
      } else {
        await interaction.editReply({
          embeds: [newEmbed],
          files: [newAttachment],
          components: [buttons]
        });
        startAutoMove();
      }
    };

    startAutoMove();

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== userId) {
        await i.reply({
          content: '❌ This is not your game!',
          ephemeral: true
        });
        return;
      }

      const direction = i.customId as 'up' | 'down' | 'left' | 'right';
      game.move(direction);
      
      await i.deferUpdate();
    });

    collector.on('end', async (_collected, reason) => {
      clearInterval(moveTimer);
      if (reason === 'time') {
        activeGames.delete(gameId);
        const finalEmbed = new EmbedBuilder()
          .setTitle('⏱️ Game Timed Out!')
          .setDescription('Your Snake game has ended due to inactivity.')
          .addFields(
            { name: 'Final Score', value: game.getState().score.toString(), inline: true }
          )
          .setColor(0xFF0000)
          .setTimestamp();
        
        await interaction.editReply({
          embeds: [finalEmbed],
          components: []
        });
      }
    });
}

function createGameEmbed(state: SnakeGame, username: string): EmbedBuilder {
  const statusText = state.gameOver ? '💀 Game Over!' : '🐍 Playing';
  
  return new EmbedBuilder()
    .setTitle('🐍 Snake Game')
    .setImage('attachment://snake-game.png')
    .addFields(
      { name: 'Score', value: state.score.toString(), inline: true },
      { name: 'Status', value: statusText, inline: true },
      { name: 'Speed', value: `${state.speed}ms`, inline: true }
    )
    .setColor(state.gameOver ? 0xFF0000 : 0x00FF00)
    .setFooter({ text: `Player: ${username}` })
    .setTimestamp();
}

function createGameButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('left')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('up')
        .setEmoji('⬆️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('down')
        .setEmoji('⬇️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('right')
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Primary)
    );
}

async function saveGameStats(userId: string, score: number) {
  try {
    const stats = await database.getGameStats(userId, 'snake');
    const highScore = Math.max(score, stats?.highScore || 0);

    await database.updateGameStats(userId, 'snake', {
      wins: (stats?.wins || 0) + (score >= 100 ? 1 : 0),
      losses: (stats?.losses || 0) + (score < 100 ? 1 : 0),
      highScore
    });
  } catch (error) {
    logger.error('Error saving snake game stats:', error);
  }
}

async function playEmbedded(interaction: ChatInputCommandInteraction) {
  // Check if user is in a voice channel
  if (!interaction.guild) {
    await interaction.reply({
      content: '❌ This command can only be used in a server!',
      ephemeral: true
    });
    return;
  }

  const member = interaction.guild.members.cache.get(interaction.user.id);
  if (!member || !member.voice.channel) {
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
    const inviteUrl = await activityService.createActivity(voiceChannel.id, 'snake');
    
    if (!inviteUrl) {
      await interaction.editReply({
        content: '❌ Failed to create the activity. Please try again later.'
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🐍 Snake Activity Started!')
      .setDescription(`Click the button below to join the Snake game in ${voiceChannel.name}!`)
      .addFields(
        { name: 'How to Play', value: 'Use arrow keys to control the snake. Eat food to grow and increase your score!' },
        { name: 'Voice Channel', value: voiceChannel.name, inline: true },
        { name: 'Players', value: 'Unlimited', inline: true }
      )
      .setColor(0x00FF00)
      .setTimestamp();

    const joinButton = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Join Snake Game')
          .setURL(inviteUrl)
          .setStyle(ButtonStyle.Link)
          .setEmoji('🐍')
      );

    await interaction.editReply({
      embeds: [embed],
      components: [joinButton]
    });
  } catch (error: any) {
    logger.error('Error creating Snake activity:', error);
    
    const errorMessage = error.message || 'Failed to create the activity. Make sure the bot has the necessary permissions.';
    await interaction.editReply({
      content: `❌ ${errorMessage}`
    });
  }
}

export default command;