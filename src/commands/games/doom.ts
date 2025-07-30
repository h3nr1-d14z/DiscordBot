import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
  VoiceChannel,
  StageChannel
} from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { activityService } from '../../services/activityService';
import { logger } from '../../utils/logger';

interface DoomGame {
  playerX: number;
  playerY: number;
  health: number;
  armor: number;
  ammo: number;
  score: number;
  level: number;
  map: string[][];
  monsters: Monster[];
  items: Item[];
  gameId: string;
  userId: string;
}

interface Monster {
  x: number;
  y: number;
  type: 'imp' | 'demon' | 'zombie';
  health: number;
  damage: number;
  symbol: string;
}

interface Item {
  x: number;
  y: number;
  type: 'health' | 'armor' | 'ammo';
  value: number;
  symbol: string;
}

const MAP_SIZE = 10;
const activeGames = new Map<string, DoomGame>();

const monsterTypes = {
  imp: { health: 20, damage: 10, symbol: 'i' },
  demon: { health: 40, damage: 20, symbol: 'D' },
  zombie: { health: 15, damage: 5, symbol: 'z' }
};

const itemTypes = {
  health: { symbol: '+', value: 25 },
  armor: { symbol: 'A', value: 20 },
  ammo: { symbol: 'a', value: 10 }
};

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('doom')
    .setDescription('Play DOOM!')
    .addSubcommand(subcommand =>
      subcommand
        .setName('text')
        .setDescription('Play text-based Doom in Discord chat'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('embed')
        .setDescription('Play DOOM in an embedded activity (requires voice channel)')),
  
  category: CommandCategory.Games,
  cooldown: 5,
  
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'text') {
      await playTextDoom(interaction);
    } else if (subcommand === 'embed') {
      await playEmbeddedDoom(interaction);
    }
  },
};

async function playTextDoom(interaction: ChatInputCommandInteraction) {
    const gameId = `doom_${interaction.id}`;
    const game = initializeGame(gameId, interaction.user.id);
    
    activeGames.set(gameId, game);
    
    const embed = createGameEmbed(game);
    const components = createMovementButtons();
    
    const response = await interaction.reply({
      embeds: [embed],
      components: components,
      fetchReply: true
    });
    
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 600000 // 10 minutes
    });
    
    collector.on('collect', async (i: ButtonInteraction) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: '❌ This is not your game!',
          ephemeral: true
        });
        return;
      }
      
      const action = i.customId.split('_')[1];
      
      // Handle movement
      let dx = 0, dy = 0;
      let isShoot = false;
      
      switch (action) {
        case 'up': dy = -1; break;
        case 'down': dy = 1; break;
        case 'left': dx = -1; break;
        case 'right': dx = 1; break;
        case 'shoot': isShoot = true; break;
      }
      
      if (isShoot) {
        handleShooting(game);
      } else {
        movePlayer(game, dx, dy);
      }
      
      // Move monsters
      moveMonsters(game);
      
      // Check game over conditions
      if (game.health <= 0) {
        await handleGameEnd(i, game, false);
        activeGames.delete(gameId);
        collector.stop();
        return;
      }
      
      // Check level completion
      if (game.monsters.length === 0) {
        game.level++;
        game.score += 100 * game.level;
        generateLevel(game);
      }
      
      const newEmbed = createGameEmbed(game);
      await i.update({
        embeds: [newEmbed],
        components: components
      });
    });
    
    collector.on('end', async () => {
      activeGames.delete(gameId);
      await response.edit({
        components: []
      }).catch(() => {});
    });
}

function initializeGame(gameId: string, userId: string): DoomGame {
  const game: DoomGame = {
    playerX: Math.floor(MAP_SIZE / 2),
    playerY: Math.floor(MAP_SIZE / 2),
    health: 100,
    armor: 0,
    ammo: 50,
    score: 0,
    level: 1,
    map: Array(MAP_SIZE).fill(null).map(() => Array(MAP_SIZE).fill('.')),
    monsters: [],
    items: [],
    gameId,
    userId
  };
  
  generateLevel(game);
  return game;
}

function generateLevel(game: DoomGame) {
  // Clear previous level
  game.monsters = [];
  game.items = [];
  game.map = Array(MAP_SIZE).fill(null).map(() => Array(MAP_SIZE).fill('.'));
  
  // Generate walls
  for (let i = 0; i < MAP_SIZE * 2; i++) {
    const x = Math.floor(Math.random() * MAP_SIZE);
    const y = Math.floor(Math.random() * MAP_SIZE);
    if (x !== game.playerX || y !== game.playerY) {
      game.map[y][x] = '#';
    }
  }
  
  // Generate monsters
  const monsterCount = Math.min(3 + game.level, 10);
  for (let i = 0; i < monsterCount; i++) {
    let x, y;
    do {
      x = Math.floor(Math.random() * MAP_SIZE);
      y = Math.floor(Math.random() * MAP_SIZE);
    } while (game.map[y][x] !== '.' || (x === game.playerX && y === game.playerY));
    
    const types = Object.keys(monsterTypes) as Array<keyof typeof monsterTypes>;
    const type = types[Math.floor(Math.random() * types.length)];
    const monsterData = monsterTypes[type];
    
    game.monsters.push({
      x, y, type,
      health: monsterData.health,
      damage: monsterData.damage,
      symbol: monsterData.symbol
    });
  }
  
  // Generate items
  const itemCount = Math.floor(Math.random() * 3) + 2;
  for (let i = 0; i < itemCount; i++) {
    let x, y;
    do {
      x = Math.floor(Math.random() * MAP_SIZE);
      y = Math.floor(Math.random() * MAP_SIZE);
    } while (
      game.map[y][x] !== '.' || 
      (x === game.playerX && y === game.playerY) ||
      game.monsters.some(m => m.x === x && m.y === y)
    );
    
    const types = Object.keys(itemTypes) as Array<keyof typeof itemTypes>;
    const type = types[Math.floor(Math.random() * types.length)];
    const itemData = itemTypes[type];
    
    game.items.push({
      x, y, type,
      value: itemData.value,
      symbol: itemData.symbol
    });
  }
}

function createGameEmbed(game: DoomGame): EmbedBuilder {
  // Create map display
  const mapDisplay: string[][] = game.map.map(row => [...row]);
  
  // Place items
  game.items.forEach(item => {
    mapDisplay[item.y][item.x] = item.symbol;
  });
  
  // Place monsters
  game.monsters.forEach(monster => {
    mapDisplay[monster.y][monster.x] = monster.symbol;
  });
  
  // Place player
  mapDisplay[game.playerY][game.playerX] = '@';
  
  // Create view window (5x5 around player)
  const viewRadius = 2;
  let view = '';
  
  for (let y = game.playerY - viewRadius; y <= game.playerY + viewRadius; y++) {
    for (let x = game.playerX - viewRadius; x <= game.playerX + viewRadius; x++) {
      if (y >= 0 && y < MAP_SIZE && x >= 0 && x < MAP_SIZE) {
        view += mapDisplay[y][x] + ' ';
      } else {
        view += '█ ';
      }
    }
    view += '\n';
  }
  
  const embed = new EmbedBuilder()
    .setColor(0x8B0000)
    .setTitle('🔫 DOOM - Text Edition')
    .setDescription('```\n' + view + '```')
    .addFields(
      { name: '❤️ Health', value: `${game.health}/100`, inline: true },
      { name: '🛡️ Armor', value: `${game.armor}`, inline: true },
      { name: '🔫 Ammo', value: `${game.ammo}`, inline: true },
      { name: '📊 Score', value: `${game.score}`, inline: true },
      { name: '📍 Level', value: `${game.level}`, inline: true },
      { name: '👹 Monsters', value: `${game.monsters.length}`, inline: true }
    )
    .setFooter({ text: 'Use arrows to move, center button to shoot!' });
  
  // Add legend
  embed.addFields({
    name: 'Legend',
    value: '`@` You | `#` Wall | `i` Imp | `D` Demon | `z` Zombie | `+` Health | `A` Armor | `a` Ammo',
    inline: false
  });
  
  return embed;
}

function createMovementButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('doom_blank1')
        .setLabel('\u200b')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('doom_up')
        .setEmoji('⬆️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('doom_blank2')
        .setLabel('\u200b')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
  
  const row2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('doom_left')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('doom_shoot')
        .setEmoji('🔫')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('doom_right')
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Primary)
    );
  
  const row3 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('doom_blank3')
        .setLabel('\u200b')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('doom_down')
        .setEmoji('⬇️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('doom_blank4')
        .setLabel('\u200b')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
  
  return [row1, row2, row3];
}

function movePlayer(game: DoomGame, dx: number, dy: number) {
  const newX = game.playerX + dx;
  const newY = game.playerY + dy;
  
  // Check bounds
  if (newX < 0 || newX >= MAP_SIZE || newY < 0 || newY >= MAP_SIZE) {
    return;
  }
  
  // Check walls
  if (game.map[newY][newX] === '#') {
    return;
  }
  
  // Check monster collision
  const monster = game.monsters.find(m => m.x === newX && m.y === newY);
  if (monster) {
    // Take damage
    const damage = monster.damage - Math.floor(game.armor / 2);
    game.health -= Math.max(damage, 1);
    game.armor = Math.max(0, game.armor - 5);
    return;
  }
  
  // Move player
  game.playerX = newX;
  game.playerY = newY;
  
  // Check item pickup
  const itemIndex = game.items.findIndex(item => item.x === newX && item.y === newY);
  if (itemIndex !== -1) {
    const item = game.items[itemIndex];
    switch (item.type) {
      case 'health':
        game.health = Math.min(100, game.health + item.value);
        break;
      case 'armor':
        game.armor = Math.min(100, game.armor + item.value);
        break;
      case 'ammo':
        game.ammo += item.value;
        break;
    }
    game.items.splice(itemIndex, 1);
    game.score += 10;
  }
}

function handleShooting(game: DoomGame) {
  if (game.ammo <= 0) return;
  
  game.ammo--;
  
  // Find nearest monster
  let nearestMonster: Monster | null = null;
  let minDistance = Infinity;
  
  game.monsters.forEach(monster => {
    const distance = Math.abs(monster.x - game.playerX) + Math.abs(monster.y - game.playerY);
    if (distance < minDistance && distance <= 3) {
      minDistance = distance;
      nearestMonster = monster;
    }
  });
  
  if (nearestMonster) {
    nearestMonster.health -= 25;
    if (nearestMonster.health <= 0) {
      const index = game.monsters.indexOf(nearestMonster);
      game.monsters.splice(index, 1);
      game.score += 50;
    }
  }
}

function moveMonsters(game: DoomGame) {
  game.monsters.forEach(monster => {
    // Simple AI: move towards player
    const dx = Math.sign(game.playerX - monster.x);
    const dy = Math.sign(game.playerY - monster.y);
    
    // 50% chance to move
    if (Math.random() < 0.5) {
      const moveX = Math.random() < 0.5;
      const newX = moveX ? monster.x + dx : monster.x;
      const newY = moveX ? monster.y : monster.y + dy;
      
      // Check if move is valid
      if (
        newX >= 0 && newX < MAP_SIZE &&
        newY >= 0 && newY < MAP_SIZE &&
        game.map[newY][newX] !== '#' &&
        !(newX === game.playerX && newY === game.playerY) &&
        !game.monsters.some(m => m !== monster && m.x === newX && m.y === newY)
      ) {
        monster.x = newX;
        monster.y = newY;
      }
    }
  });
}

async function handleGameEnd(interaction: ButtonInteraction, game: DoomGame, survived: boolean) {
  const user = await database.getUser(game.userId);
  if (!user) {
    await database.createUser(game.userId, interaction.user.username);
  }
  
  const xpReward = Math.floor(game.score / 10);
  const coinReward = Math.floor(game.score / 20);
  
  await database.updateUser(game.userId, {
    xp: (user?.xp || 0) + xpReward,
    balance: (user?.balance || 0) + coinReward
  });
  
  const embed = new EmbedBuilder()
    .setColor(survived ? 0x00FF00 : 0xFF0000)
    .setTitle(survived ? '🎉 Victory!' : '💀 You Died!')
    .setDescription(survived ? 'You cleared all the demons!' : 'The demons got you...')
    .addFields(
      { name: 'Final Score', value: `${game.score}`, inline: true },
      { name: 'Level Reached', value: `${game.level}`, inline: true },
      { name: 'XP Earned', value: `+${xpReward} XP`, inline: true },
      { name: 'Coins Earned', value: `+${coinReward} coins`, inline: true }
    );
  
  await interaction.update({
    embeds: [embed],
    components: []
  });
}

async function playEmbeddedDoom(interaction: ChatInputCommandInteraction) {
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
    const inviteUrl = await activityService.createActivity(voiceChannel.id, 'doom');
    
    if (!inviteUrl) {
      await interaction.editReply({
        content: '❌ Failed to create the activity. Please try again later.'
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🔫 DOOM Activity Started!')
      .setDescription(`Click the button below to play DOOM in ${voiceChannel.name}!`)
      .addFields(
        { name: 'How to Play', value: 'Classic DOOM gameplay in your browser!' },
        { name: 'Voice Channel', value: voiceChannel.name, inline: true },
        { name: 'Players', value: 'Single Player', inline: true }
      )
      .setColor(0xFF0000)
      .setTimestamp();

    const joinButton = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Play DOOM')
          .setURL(inviteUrl)
          .setStyle(ButtonStyle.Link)
          .setEmoji('🔫')
      );

    await interaction.editReply({
      embeds: [embed],
      components: [joinButton]
    });
  } catch (error: any) {
    logger.error('Error creating DOOM activity:', error);
    
    const errorMessage = error.message || 'Failed to create the activity. Make sure the bot has the necessary permissions.';
    await interaction.editReply({
      content: `❌ ${errorMessage}`
    });
  }
}

export default command;