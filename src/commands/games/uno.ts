import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, User, StringSelectMenuBuilder } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';

type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
type CardValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

interface UnoCard {
  color: CardColor;
  value: CardValue;
}

interface Player {
  id: string;
  cards: UnoCard[];
  uno: boolean;
}

interface UnoGame {
  players: Player[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  deck: UnoCard[];
  discardPile: UnoCard[];
  currentCard: UnoCard;
  drawStack: number;
  gameStarted: boolean;
  winner: string | null;
  lastAction: string;
}

const CARD_EMOJIS = {
  red: '🟥',
  blue: '🟦',
  green: '🟩',
  yellow: '🟨',
  wild: '🌈'
};

const VALUE_DISPLAY = {
  skip: '⛔',
  reverse: '🔄',
  draw2: '+2',
  wild: '🌈',
  wild4: '+4'
};

class Uno {
  private game: UnoGame;
  private readonly MIN_PLAYERS = 2;
  private readonly MAX_PLAYERS = 8;

  constructor() {
    this.game = {
      players: [],
      currentPlayerIndex: 0,
      direction: 1,
      deck: [],
      discardPile: [],
      currentCard: { color: 'wild', value: 'wild' },
      drawStack: 0,
      gameStarted: false,
      winner: null,
      lastAction: ''
    };
  }

  addPlayer(userId: string): boolean {
    if (this.game.gameStarted || this.game.players.length >= this.MAX_PLAYERS) {
      return false;
    }

    if (this.game.players.some(p => p.id === userId)) {
      return false;
    }

    this.game.players.push({
      id: userId,
      cards: [],
      uno: false
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

  startGame(): boolean {
    if (this.game.gameStarted || this.game.players.length < this.MIN_PLAYERS) {
      return false;
    }

    this.initializeDeck();
    this.shuffleDeck();
    this.dealCards();
    
    // Draw first card for discard pile
    let firstCard: UnoCard;
    do {
      firstCard = this.game.deck.pop()!;
    } while (firstCard.value === 'wild' || firstCard.value === 'wild4');
    
    this.game.currentCard = firstCard;
    this.game.discardPile.push(firstCard);
    this.game.gameStarted = true;
    
    // Random starting player
    this.game.currentPlayerIndex = Math.floor(Math.random() * this.game.players.length);
    
    return true;
  }

  private initializeDeck(): void {
    this.game.deck = [];
    const colors: CardColor[] = ['red', 'blue', 'green', 'yellow'];
    
    // Number cards (0-9)
    for (const color of colors) {
      // One 0 card
      this.game.deck.push({ color, value: '0' });
      
      // Two of each 1-9
      for (let i = 1; i <= 9; i++) {
        this.game.deck.push({ color, value: i.toString() as CardValue });
        this.game.deck.push({ color, value: i.toString() as CardValue });
      }
      
      // Two of each action card
      for (const value of ['skip', 'reverse', 'draw2'] as CardValue[]) {
        this.game.deck.push({ color, value });
        this.game.deck.push({ color, value });
      }
    }
    
    // Wild cards
    for (let i = 0; i < 4; i++) {
      this.game.deck.push({ color: 'wild', value: 'wild' });
      this.game.deck.push({ color: 'wild', value: 'wild4' });
    }
  }

  private shuffleDeck(): void {
    for (let i = this.game.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.game.deck[i], this.game.deck[j]] = [this.game.deck[j], this.game.deck[i]];
    }
  }

  private dealCards(): void {
    const cardsPerPlayer = 7;
    for (let i = 0; i < cardsPerPlayer; i++) {
      for (const player of this.game.players) {
        player.cards.push(this.drawCard());
      }
    }
  }

  private drawCard(): UnoCard {
    if (this.game.deck.length === 0) {
      // Reshuffle discard pile
      const topCard = this.game.discardPile.pop()!;
      this.game.deck = this.game.discardPile;
      this.game.discardPile = [topCard];
      this.shuffleDeck();
    }
    
    return this.game.deck.pop()!;
  }

  canPlayCard(card: UnoCard): boolean {
    const current = this.game.currentCard;
    
    // Wild cards can always be played
    if (card.color === 'wild') return true;
    
    // Must play Draw 2/4 if draw stack exists
    if (this.game.drawStack > 0) {
      return card.value === 'draw2' || card.value === 'wild4';
    }
    
    // Match color or value
    return card.color === current.color || card.value === current.value;
  }

  playCard(playerId: string, cardIndex: number, chosenColor?: CardColor): { success: boolean; nextPlayer?: string } {
    const playerIndex = this.game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1 || playerIndex !== this.game.currentPlayerIndex) {
      return { success: false };
    }

    const player = this.game.players[playerIndex];
    if (cardIndex < 0 || cardIndex >= player.cards.length) {
      return { success: false };
    }

    const card = player.cards[cardIndex];
    if (!this.canPlayCard(card)) {
      return { success: false };
    }

    // Remove card from hand
    player.cards.splice(cardIndex, 1);
    player.uno = false;
    
    // Add to discard pile
    this.game.discardPile.push(card);
    this.game.currentCard = card;
    
    // Handle wild cards
    if (card.color === 'wild' && chosenColor) {
      this.game.currentCard = { ...card, color: chosenColor };
    }
    
    // Process card effects
    this.processCardEffect(card);
    
    // Check for winner
    if (player.cards.length === 0) {
      this.game.winner = playerId;
      return { success: true };
    }
    
    // Move to next player
    this.nextTurn();
    
    return { 
      success: true, 
      nextPlayer: this.game.players[this.game.currentPlayerIndex].id 
    };
  }

  drawCards(playerId: string): { cards: UnoCard[]; forced: boolean } {
    const playerIndex = this.game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1 || playerIndex !== this.game.currentPlayerIndex) {
      return { cards: [], forced: false };
    }

    const player = this.game.players[playerIndex];
    const drawnCards: UnoCard[] = [];
    
    if (this.game.drawStack > 0) {
      // Forced draw from draw stack
      for (let i = 0; i < this.game.drawStack; i++) {
        const card = this.drawCard();
        player.cards.push(card);
        drawnCards.push(card);
      }
      this.game.drawStack = 0;
      this.game.lastAction = `Drew ${drawnCards.length} cards (forced)`;
      this.nextTurn();
      return { cards: drawnCards, forced: true };
    } else {
      // Regular draw
      const card = this.drawCard();
      player.cards.push(card);
      drawnCards.push(card);
      this.game.lastAction = 'Drew 1 card';
      
      // Player can play the drawn card immediately if valid
      // Otherwise turn passes
      if (!this.canPlayCard(card)) {
        this.nextTurn();
      }
      
      return { cards: drawnCards, forced: false };
    }
  }

  callUno(playerId: string): boolean {
    const player = this.game.players.find(p => p.id === playerId);
    if (!player || player.cards.length !== 1) return false;
    
    player.uno = true;
    this.game.lastAction = `${playerId} called UNO!`;
    return true;
  }

  private processCardEffect(card: UnoCard): void {
    switch (card.value) {
      case 'skip':
        this.game.lastAction = 'Skipped next player';
        this.nextTurn();
        break;
      case 'reverse':
        this.game.direction *= -1;
        this.game.lastAction = 'Reversed direction';
        if (this.game.players.length === 2) {
          this.nextTurn(); // In 2-player, reverse acts as skip
        }
        break;
      case 'draw2':
        this.game.drawStack += 2;
        this.game.lastAction = 'Next player draws 2';
        break;
      case 'wild4':
        this.game.drawStack += 4;
        this.game.lastAction = 'Next player draws 4';
        break;
    }
  }

  private nextTurn(): void {
    this.game.currentPlayerIndex += this.game.direction;
    
    if (this.game.currentPlayerIndex >= this.game.players.length) {
      this.game.currentPlayerIndex = 0;
    } else if (this.game.currentPlayerIndex < 0) {
      this.game.currentPlayerIndex = this.game.players.length - 1;
    }
  }

  getPlayerCards(playerId: string): UnoCard[] {
    const player = this.game.players.find(p => p.id === playerId);
    return player ? [...player.cards] : [];
  }

  getState(): UnoGame {
    return this.game;
  }

  static cardToString(card: UnoCard): string {
    const colorEmoji = CARD_EMOJIS[card.color];
    const valueDisplay = VALUE_DISPLAY[card.value] || card.value;
    return `${colorEmoji} ${valueDisplay}`;
  }
}

const activeGames = new Map<string, { game: Uno; hostId: string }>();

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('uno')
    .setDescription('Start a game of UNO! (2-8 players)'),

  async execute(interaction: ChatInputCommandInteraction) {
    const gameId = `uno_${interaction.channelId}`;
    
    if (activeGames.has(gameId)) {
      await interaction.reply({
        content: '❌ There\'s already an active UNO game in this channel!',
        ephemeral: true
      });
      return;
    }

    const game = new Uno();
    game.addPlayer(interaction.user.id);
    activeGames.set(gameId, { game, hostId: interaction.user.id });

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
      const gameData = activeGames.get(gameId);
      if (!gameData) return;

      const { game: currentGame, hostId } = gameData;

      switch (i.customId) {
        case 'join_uno':
          if (currentGame.addPlayer(i.user.id)) {
            await i.update({
              embeds: [createLobbyEmbed(currentGame, interaction.guild!.members.cache.get(hostId)!.user)],
              components: [createLobbyButtons()]
            });
          } else {
            await i.reply({
              content: '❌ You\'re already in the game or it\'s full!',
              ephemeral: true
            });
          }
          break;

        case 'leave_uno':
          if (i.user.id === hostId) {
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
              embeds: [createLobbyEmbed(currentGame, interaction.guild!.members.cache.get(hostId)!.user)],
              components: [createLobbyButtons()]
            });
          }
          break;

        case 'start_uno':
          if (i.user.id !== hostId) {
            await i.reply({
              content: '❌ Only the host can start the game!',
              ephemeral: true
            });
            return;
          }

          if (currentGame.startGame()) {
            collector.stop();
            await startGamePhase(i, currentGame, gameId);
          } else {
            await i.reply({
              content: '❌ Need at least 2 players to start!',
              ephemeral: true
            });
          }
          break;
      }
    });

    collector.on('end', async (_collected, reason) => {
      if (reason === 'time') {
        activeGames.delete(gameId);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('⏱️ Game Timed Out')
              .setDescription('The UNO game lobby timed out.')
              .setColor(0xFF0000)
          ],
          components: []
        });
      }
    });
  },
};

function createLobbyEmbed(game: Uno, host: User): EmbedBuilder {
  const state = game.getState();
  const playerList = state.players.map((p, i) => `${i + 1}. <@${p.id}>`).join('\n');

  return new EmbedBuilder()
    .setTitle('🎮 UNO - Game Lobby')
    .setDescription(`Host: ${host}\n\n**Players (${state.players.length}/8):**\n${playerList}`)
    .setColor(0x0099FF)
    .setFooter({ text: 'Click Join to play! • Host clicks Start when ready' })
    .setTimestamp();
}

function createLobbyButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('join_uno')
        .setLabel('Join Game')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('leave_uno')
        .setLabel('Leave')
        .setEmoji('➖')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('start_uno')
        .setLabel('Start Game')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Primary)
    );
}

async function startGamePhase(interaction: any, game: Uno, gameId: string) {
  const updateDisplay = async () => {
    const state = game.getState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    const embed = createGameEmbed(game, currentPlayer.id);
    const components = createGameComponents(game, currentPlayer.id);

    await interaction.editReply({
      embeds: [embed],
      components
    });
  };

  await updateDisplay();

  const gameCollector = interaction.message.createMessageComponentCollector({
    time: 1800000 // 30 minutes
  });

  gameCollector.on('collect', async (i: any) => {
    const state = game.getState();
    const currentPlayerId = state.players[state.currentPlayerIndex].id;

    // Handle card selection
    if (i.customId === 'card_select' && i.user.id === currentPlayerId) {
      const cardIndex = parseInt(i.values[0]);
      const cards = game.getPlayerCards(i.user.id);
      const selectedCard = cards[cardIndex];

      if (selectedCard.color === 'wild') {
        // Need color selection
        const colorButtons = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('color_red')
              .setLabel('Red')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('color_blue')
              .setLabel('Blue')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('color_green')
              .setLabel('Green')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('color_yellow')
              .setLabel('Yellow')
              .setStyle(ButtonStyle.Secondary)
          );

        await i.update({
          content: 'Choose a color for your wild card:',
          components: [colorButtons]
        });

        const colorCollector = i.message.createMessageComponentCollector({
          filter: (ci: any) => ci.user.id === i.user.id,
          max: 1,
          time: 30000
        });

        colorCollector.on('collect', async (colorInteraction: any) => {
          const color = colorInteraction.customId.split('_')[1] as CardColor;
          const result = game.playCard(i.user.id, cardIndex, color);
          
          if (result.success) {
            await colorInteraction.update({ content: null, components: [] });
            
            if (game.getState().winner) {
              await endGame(interaction, game, gameId);
            } else {
              await updateDisplay();
            }
          }
        });
      } else {
        const result = game.playCard(i.user.id, cardIndex);
        
        if (result.success) {
          if (game.getState().winner) {
            await endGame(i, game, gameId);
          } else {
            await updateDisplay();
          }
        } else {
          await i.reply({
            content: '❌ You cannot play that card!',
            ephemeral: true
          });
        }
      }
    }

    // Handle draw button
    else if (i.customId === 'draw_card' && i.user.id === currentPlayerId) {
      const result = game.drawCards(i.user.id);
      
      if (result.forced || !result.cards.some(card => game.canPlayCard(card))) {
        await updateDisplay();
      } else {
        // Player can play the drawn card
        await i.reply({
          content: `You drew: ${result.cards.map(c => Uno.cardToString(c)).join(', ')}. You can play it if valid!`,
          ephemeral: true
        });
        await updateDisplay();
      }
    }

    // Handle UNO button
    else if (i.customId === 'call_uno') {
      if (game.callUno(i.user.id)) {
        await i.reply({
          content: '🎉 UNO called!',
          ephemeral: true
        });
      } else {
        await i.reply({
          content: '❌ You can only call UNO when you have exactly 1 card!',
          ephemeral: true
        });
      }
    }

    // Handle view cards button
    else if (i.customId === 'view_cards') {
      const cards = game.getPlayerCards(i.user.id);
      const cardsDisplay = cards.map((c, i) => `${i + 1}. ${Uno.cardToString(c)}`).join('\n');
      
      await i.reply({
        content: `**Your cards:**\n${cardsDisplay}`,
        ephemeral: true
      });
    } else if (i.user.id !== currentPlayerId) {
      await i.reply({
        content: '❌ It\'s not your turn!',
        ephemeral: true
      });
    }
  });

  gameCollector.on('end', async (_collected, reason) => {
    if (reason === 'time') {
      activeGames.delete(gameId);
      await interaction.followUp({
        content: '⏱️ UNO game timed out due to inactivity!'
      });
    }
  });
}

function createGameEmbed(game: Uno, viewerId: string): EmbedBuilder {
  const state = game.getState();
  const currentPlayer = state.players[state.currentPlayerIndex];
  
  const embed = new EmbedBuilder()
    .setTitle('🎮 UNO')
    .setDescription(`**Current Card:** ${Uno.cardToString(state.currentCard)}`)
    .setColor(getColorValue(state.currentCard.color))
    .addFields(
      { 
        name: 'Current Turn', 
        value: `<@${currentPlayer.id}>`,
        inline: true
      },
      { 
        name: 'Direction', 
        value: state.direction === 1 ? '➡️ Clockwise' : '⬅️ Counter-clockwise',
        inline: true
      }
    );

  // Player cards count
  const playerInfo = state.players.map(p => {
    const cardCount = p.cards.length;
    const unoStatus = cardCount === 1 && p.uno ? ' 🟡 UNO!' : '';
    return `<@${p.id}>: ${cardCount} cards${unoStatus}`;
  }).join('\n');

  embed.addFields({ name: 'Players', value: playerInfo });

  if (state.drawStack > 0) {
    embed.addFields({ 
      name: '⚠️ Draw Stack', 
      value: `+${state.drawStack} cards pending!`,
      inline: true
    });
  }

  if (state.lastAction) {
    embed.setFooter({ text: `Last action: ${state.lastAction}` });
  }

  return embed;
}

function createGameComponents(game: Uno, playerId: string): ActionRowBuilder<any>[] {
  const state = game.getState();
  const isCurrentPlayer = state.players[state.currentPlayerIndex].id === playerId;
  const components: ActionRowBuilder<any>[] = [];

  if (isCurrentPlayer) {
    // Card selector
    const cards = game.getPlayerCards(playerId);
    const cardOptions = cards.map((card, index) => ({
      label: Uno.cardToString(card),
      value: index.toString(),
      description: game.canPlayCard(card) ? 'Playable' : 'Not playable'
    })).slice(0, 25); // Discord limit

    if (cardOptions.length > 0) {
      const cardSelect = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('card_select')
            .setPlaceholder('Select a card to play')
            .addOptions(cardOptions)
        );
      components.push(cardSelect);
    }

    // Action buttons
    const actionButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('draw_card')
          .setLabel(state.drawStack > 0 ? `Draw ${state.drawStack}` : 'Draw Card')
          .setEmoji('🎴')
          .setStyle(ButtonStyle.Primary)
      );

    components.push(actionButtons);
  }

  // Always available buttons
  const generalButtons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('view_cards')
        .setLabel('View Cards')
        .setEmoji('👀')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('call_uno')
        .setLabel('UNO!')
        .setEmoji('🟡')
        .setStyle(ButtonStyle.Success)
    );

  components.push(generalButtons);

  return components;
}

function getColorValue(color: CardColor): number {
  switch (color) {
    case 'red': return 0xFF0000;
    case 'blue': return 0x0000FF;
    case 'green': return 0x00FF00;
    case 'yellow': return 0xFFFF00;
    case 'wild': return 0x800080;
  }
}

async function endGame(interaction: any, game: Uno, gameId: string) {
  const state = game.getState();
  const winner = state.players.find(p => p.id === state.winner);

  const embed = new EmbedBuilder()
    .setTitle('🎉 UNO Winner!')
    .setDescription(`**<@${winner!.id}> wins the game!**`)
    .setColor(0x00FF00)
    .addFields(
      { name: 'Total Rounds', value: state.discardPile.length.toString(), inline: true }
    )
    .setTimestamp();

  // Calculate remaining cards for other players
  const otherPlayers = state.players.filter(p => p.id !== state.winner);
  const remainingCards = otherPlayers
    .map(p => `<@${p.id}>: ${p.cards.length} cards`)
    .join('\n');

  embed.addFields({ name: 'Remaining Cards', value: remainingCards });

  await interaction.update({
    embeds: [embed],
    components: []
  });

  // Save stats
  for (const player of state.players) {
    await saveGameStats(player.id, player.id === state.winner);
  }

  activeGames.delete(gameId);
}

async function saveGameStats(userId: string, won: boolean) {
  try {
    const stats = await database.getGameStats(userId, 'uno');
    
    await database.updateGameStats(userId, 'uno', {
      wins: (stats?.wins || 0) + (won ? 1 : 0),
      losses: (stats?.losses || 0) + (won ? 0 : 1),
      highScore: stats?.highScore || 0
    });
  } catch (error) {
    logger.error('Error saving UNO stats:', error);
  }
}

export default command;