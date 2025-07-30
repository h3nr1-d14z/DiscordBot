import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, User, StringSelectMenuBuilder } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';

interface Ship {
  name: string;
  size: number;
  positions: [number, number][];
  hits: number;
}

interface Grid {
  ships: Ship[];
  shots: { x: number; y: number; hit: boolean }[];
}

interface BattleshipGame {
  player1: string;
  player2: string;
  currentTurn: string;
  phase: 'setup' | 'battle' | 'finished';
  grids: {
    [playerId: string]: Grid;
  };
  winner: string | null;
  lastShot: { player: string; x: number; y: number; hit: boolean; sunk?: string } | null;
}

const GRID_SIZE = 10;
const SHIPS = [
  { name: 'Carrier', size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser', size: 3 },
  { name: 'Submarine', size: 3 },
  { name: 'Destroyer', size: 2 }
];

class Battleship {
  private game: BattleshipGame;

  constructor(player1: string, player2: string) {
    this.game = {
      player1,
      player2,
      currentTurn: player1,
      phase: 'setup',
      grids: {
        [player1]: { ships: [], shots: [] },
        [player2]: { ships: [], shots: [] }
      },
      winner: null,
      lastShot: null
    };
  }

  autoPlaceShips(playerId: string): void {
    const grid = this.game.grids[playerId];
    grid.ships = [];

    for (const shipTemplate of SHIPS) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 100) {
        attempts++;
        const horizontal = Math.random() < 0.5;
        const x = Math.floor(Math.random() * (horizontal ? GRID_SIZE - shipTemplate.size + 1 : GRID_SIZE));
        const y = Math.floor(Math.random() * (horizontal ? GRID_SIZE : GRID_SIZE - shipTemplate.size + 1));

        const positions: [number, number][] = [];
        for (let i = 0; i < shipTemplate.size; i++) {
          positions.push(horizontal ? [x + i, y] : [x, y + i]);
        }

        if (this.canPlaceShip(playerId, positions)) {
          const ship: Ship = {
            name: shipTemplate.name,
            size: shipTemplate.size,
            positions,
            hits: 0
          };
          grid.ships.push(ship);
          placed = true;
        }
      }
    }
  }

  private canPlaceShip(playerId: string, positions: [number, number][]): boolean {
    const grid = this.game.grids[playerId];

    for (const [x, y] of positions) {
      // Check bounds
      if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;

      // Check collision with other ships (including adjacent cells)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const checkX = x + dx;
          const checkY = y + dy;
          
          if (checkX >= 0 && checkX < GRID_SIZE && checkY >= 0 && checkY < GRID_SIZE) {
            for (const ship of grid.ships) {
              if (ship.positions.some(([sx, sy]) => sx === checkX && sy === checkY)) {
                return false;
              }
            }
          }
        }
      }
    }

    return true;
  }

  startBattle(): void {
    if (this.game.grids[this.game.player1].ships.length === SHIPS.length &&
        this.game.grids[this.game.player2].ships.length === SHIPS.length) {
      this.game.phase = 'battle';
    }
  }

  shoot(playerId: string, x: number, y: number): { hit: boolean; sunk?: string; gameOver: boolean } {
    if (this.game.phase !== 'battle' || this.game.currentTurn !== playerId) {
      return { hit: false, gameOver: false };
    }

    const opponentId = playerId === this.game.player1 ? this.game.player2 : this.game.player1;
    const opponentGrid = this.game.grids[opponentId];

    // Check if already shot here
    if (opponentGrid.shots.some(shot => shot.x === x && shot.y === y)) {
      return { hit: false, gameOver: false };
    }

    let hit = false;
    let sunkShip: string | undefined;

    // Check for hit
    for (const ship of opponentGrid.ships) {
      const hitIndex = ship.positions.findIndex(([sx, sy]) => sx === x && sy === y);
      if (hitIndex !== -1) {
        hit = true;
        ship.hits++;
        
        if (ship.hits === ship.size) {
          sunkShip = ship.name;
        }
        break;
      }
    }

    // Record shot
    opponentGrid.shots.push({ x, y, hit });
    this.game.lastShot = { player: playerId, x, y, hit, sunk: sunkShip };

    // Check for game over
    const allShipsSunk = opponentGrid.ships.every(ship => ship.hits === ship.size);
    if (allShipsSunk) {
      this.game.winner = playerId;
      this.game.phase = 'finished';
      return { hit, sunk: sunkShip, gameOver: true };
    }

    // Switch turns
    this.game.currentTurn = opponentId;
    return { hit, sunk: sunkShip, gameOver: false };
  }

  renderGrid(playerId: string, hideShips: boolean = false): string {
    const grid = this.game.grids[playerId];
    let display = '```\n   ';
    
    // Column headers
    for (let x = 0; x < GRID_SIZE; x++) {
      display += ` ${x}`;
    }
    display += '\n';

    for (let y = 0; y < GRID_SIZE; y++) {
      display += ` ${String.fromCharCode(65 + y)} `;
      
      for (let x = 0; x < GRID_SIZE; x++) {
        const shot = grid.shots.find(s => s.x === x && s.y === y);
        const ship = grid.ships.find(s => s.positions.some(([sx, sy]) => sx === x && sy === y));
        
        if (shot) {
          display += shot.hit ? '💥' : '💦';
        } else if (ship && !hideShips) {
          display += '🚢';
        } else {
          display += '🌊';
        }
      }
      display += '\n';
    }
    
    display += '```';
    return display;
  }

  renderTargetGrid(playerId: string): string {
    const opponentId = playerId === this.game.player1 ? this.game.player2 : this.game.player1;
    const opponentGrid = this.game.grids[opponentId];
    
    let display = '```\n   ';
    
    // Column headers
    for (let x = 0; x < GRID_SIZE; x++) {
      display += ` ${x}`;
    }
    display += '\n';

    for (let y = 0; y < GRID_SIZE; y++) {
      display += ` ${String.fromCharCode(65 + y)} `;
      
      for (let x = 0; x < GRID_SIZE; x++) {
        const shot = opponentGrid.shots.find(s => s.x === x && s.y === y);
        
        if (shot) {
          display += shot.hit ? '💥' : '💦';
        } else {
          display += '🌊';
        }
      }
      display += '\n';
    }
    
    display += '```';
    return display;
  }

  getState(): BattleshipGame {
    return this.game;
  }
}

const activeGames = new Map<string, Battleship>();

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('battleship')
    .setDescription('Play Battleship against another player!')
    .addUserOption(option =>
      option.setName('opponent')
        .setDescription('The player to challenge')
        .setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    const challenger = interaction.user;
    const opponent = interaction.options.getUser('opponent', true);

    if (opponent.bot) {
      await interaction.reply({
        content: '❌ You cannot play battleship against a bot!',
        ephemeral: true
      });
      return;
    }

    if (opponent.id === challenger.id) {
      await interaction.reply({
        content: '❌ You cannot play battleship against yourself!',
        ephemeral: true
      });
      return;
    }

    const gameId = `battleship_${interaction.channelId}`;

    if (activeGames.has(gameId)) {
      await interaction.reply({
        content: '❌ There\'s already an active battleship game in this channel!',
        ephemeral: true
      });
      return;
    }

    // Create accept/decline embed
    const acceptEmbed = new EmbedBuilder()
      .setTitle('⚓ Battleship Challenge!')
      .setDescription(`${opponent}, you've been challenged by ${challenger} to a game of Battleship!`)
      .setColor(0x0099FF)
      .setTimestamp();

    const acceptButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('accept_battleship')
          .setLabel('Accept')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('decline_battleship')
          .setLabel('Decline')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
      );

    const response = await interaction.reply({
      content: `${opponent}`,
      embeds: [acceptEmbed],
      components: [acceptButtons]
    });

    const acceptCollector = response.createMessageComponentCollector({
      filter: i => i.user.id === opponent.id,
      componentType: ComponentType.Button,
      time: 60000,
      max: 1
    });

    acceptCollector.on('collect', async (i) => {
      if (i.customId === 'decline_battleship') {
        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Challenge Declined')
              .setDescription(`${opponent} declined the battleship challenge!`)
              .setColor(0xFF0000)
          ],
          components: []
        });
        return;
      }

      // Start game
      const game = new Battleship(challenger.id, opponent.id);
      activeGames.set(gameId, game);

      // Auto-place ships for both players
      game.autoPlaceShips(challenger.id);
      game.autoPlaceShips(opponent.id);
      game.startBattle();

      await startBattlePhase(i, game, challenger, opponent, gameId);
    });

    acceptCollector.on('end', async (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('⏱️ Challenge Expired')
              .setDescription('The battleship challenge was not accepted in time.')
              .setColor(0xFF0000)
          ],
          components: []
        });
      }
    });
  },
};

async function startBattlePhase(interaction: any, game: Battleship, player1: User, player2: User, gameId: string) {
  const state = game.getState();
  const currentPlayer = state.currentTurn === player1.id ? player1 : player2;
  const isPlayer1Turn = state.currentTurn === player1.id;

  const embed = new EmbedBuilder()
    .setTitle('⚓ Battleship - Battle Phase')
    .setDescription(`**${currentPlayer.username}'s turn**\n\nSelect coordinates to fire!`)
    .addFields(
      { 
        name: `${player1.username}'s Fleet`, 
        value: `Ships remaining: ${state.grids[player1.id].ships.filter(s => s.hits < s.size).length}/5`,
        inline: true
      },
      { 
        name: `${player2.username}'s Fleet`, 
        value: `Ships remaining: ${state.grids[player2.id].ships.filter(s => s.hits < s.size).length}/5`,
        inline: true
      }
    )
    .setColor(0x0099FF);

  // Show grids
  const targetGrid = game.renderTargetGrid(state.currentTurn);
  const ownGrid = game.renderGrid(state.currentTurn);
  
  embed.addFields(
    { name: 'Enemy Waters (Target)', value: targetGrid, inline: true },
    { name: 'Your Fleet', value: ownGrid, inline: true }
  );

  if (state.lastShot) {
    const lastPlayer = state.lastShot.player === player1.id ? player1 : player2;
    let shotResult = `${lastPlayer.username} fired at ${String.fromCharCode(65 + state.lastShot.y)}${state.lastShot.x}: `;
    
    if (state.lastShot.hit) {
      shotResult += '💥 **HIT!**';
      if (state.lastShot.sunk) {
        shotResult += ` Sunk the ${state.lastShot.sunk}!`;
      }
    } else {
      shotResult += '💦 Miss!';
    }
    
    embed.setFooter({ text: shotResult });
  }

  const coordinateSelect = createCoordinateSelector();

  await interaction.update({
    embeds: [embed],
    components: [coordinateSelect]
  });

  const collector = interaction.message.createMessageComponentCollector({
    time: 600000 // 10 minutes
  });

  collector.on('collect', async (i: any) => {
    const currentState = game.getState();
    
    if (i.user.id !== currentState.currentTurn) {
      await i.reply({
        content: '❌ It\'s not your turn!',
        ephemeral: true
      });
      return;
    }

    if (i.customId === 'coordinate_select') {
      const [x, y] = i.values[0].split(',').map(Number);
      const result = game.shoot(i.user.id, x, y);
      
      if (result.gameOver) {
        const winner = i.user.id === player1.id ? player1 : player2;
        const loser = i.user.id === player1.id ? player2 : player1;
        
        const gameOverEmbed = new EmbedBuilder()
          .setTitle('🎉 Victory!')
          .setDescription(`**${winner.username} wins!** All of ${loser.username}'s ships have been sunk!`)
          .addFields(
            { name: 'Final Fleet Status', value: `${winner.username}: ${currentState.grids[winner.id].ships.filter(s => s.hits < s.size).length} ships remaining` }
          )
          .setColor(0x00FF00)
          .setTimestamp();

        await i.update({
          embeds: [gameOverEmbed],
          components: []
        });

        await saveGameStats(winner.id, true);
        await saveGameStats(loser.id, false);
        
        activeGames.delete(gameId);
        collector.stop();
      } else {
        await startBattlePhase(i, game, player1, player2, gameId);
      }
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'time') {
      activeGames.delete(gameId);
      await interaction.followUp({
        content: '⏱️ Battleship game timed out due to inactivity!'
      });
    }
  });
}

function createCoordinateSelector(): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = [];
  
  // Create options for each coordinate
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const coord = `${String.fromCharCode(65 + y)}${x}`;
      options.push({
        label: coord,
        value: `${x},${y}`,
        description: `Fire at ${coord}`
      });
    }
  }

  // Discord limits to 25 options, so we'll use a subset
  const limitedOptions = options.slice(0, 25);

  return new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('coordinate_select')
        .setPlaceholder('Select coordinates to fire!')
        .addOptions(limitedOptions)
    );
}

async function saveGameStats(userId: string, won: boolean) {
  try {
    const stats = await database.getGameStats(userId, 'battleship');
    
    await database.updateGameStats(userId, 'battleship', {
      wins: (stats?.wins || 0) + (won ? 1 : 0),
      losses: (stats?.losses || 0) + (won ? 0 : 1),
      highScore: stats?.highScore || 0
    });
  } catch (error) {
    logger.error('Error saving battleship stats:', error);
  }
}

export default command;