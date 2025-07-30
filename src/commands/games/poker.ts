import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, User } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';

type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

interface Card {
  suit: Suit;
  rank: Rank;
  value: number;
}

interface Player {
  id: string;
  chips: number;
  cards: Card[];
  currentBet: number;
  folded: boolean;
  allIn: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
}

interface PokerGame {
  players: Player[];
  deck: Card[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  currentPlayerIndex: number;
  dealerIndex: number;
  phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  smallBlind: number;
  bigBlind: number;
  minPlayers: number;
  maxPlayers: number;
  gameStarted: boolean;
  lastAction: string;
  winners: string[];
  winningHand: string;
}

const HAND_RANKINGS = {
  ROYAL_FLUSH: 10,
  STRAIGHT_FLUSH: 9,
  FOUR_OF_A_KIND: 8,
  FULL_HOUSE: 7,
  FLUSH: 6,
  STRAIGHT: 5,
  THREE_OF_A_KIND: 4,
  TWO_PAIR: 3,
  PAIR: 2,
  HIGH_CARD: 1
};

const STARTING_CHIPS = 1000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;

class Poker {
  private game: PokerGame;

  constructor() {
    this.game = {
      players: [],
      deck: [],
      communityCards: [],
      pot: 0,
      currentBet: 0,
      currentPlayerIndex: 0,
      dealerIndex: 0,
      phase: 'waiting',
      smallBlind: SMALL_BLIND,
      bigBlind: BIG_BLIND,
      minPlayers: 2,
      maxPlayers: 8,
      gameStarted: false,
      lastAction: '',
      winners: [],
      winningHand: ''
    };
  }

  addPlayer(userId: string): boolean {
    if (this.game.players.length >= this.game.maxPlayers) return false;
    if (this.game.players.some(p => p.id === userId)) return false;
    if (this.game.gameStarted) return false;

    this.game.players.push({
      id: userId,
      chips: STARTING_CHIPS,
      cards: [],
      currentBet: 0,
      folded: false,
      allIn: false,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false
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
    if (this.game.players.length < this.game.minPlayers) return false;
    if (this.game.gameStarted) return false;

    this.game.gameStarted = true;
    this.newRound();
    return true;
  }

  private newRound(): void {
    // Reset deck and shuffle
    this.initializeDeck();
    this.shuffleDeck();

    // Reset players
    for (const player of this.game.players) {
      player.cards = [];
      player.currentBet = 0;
      player.folded = false;
      player.allIn = false;
    }

    // Reset game state
    this.game.communityCards = [];
    this.game.pot = 0;
    this.game.currentBet = 0;
    this.game.winners = [];
    this.game.winningHand = '';

    // Set positions
    this.setPositions();

    // Post blinds
    this.postBlinds();

    // Deal cards
    this.dealCards();

    // Start preflop
    this.game.phase = 'preflop';
    this.game.currentPlayerIndex = this.getNextActivePlayer(this.game.dealerIndex);
  }

  private initializeDeck(): void {
    this.game.deck = [];
    const suits: Suit[] = ['♠', '♥', '♦', '♣'];
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const values = [14, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

    for (const suit of suits) {
      for (let i = 0; i < ranks.length; i++) {
        this.game.deck.push({
          suit,
          rank: ranks[i],
          value: values[i]
        });
      }
    }
  }

  private shuffleDeck(): void {
    for (let i = this.game.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.game.deck[i], this.game.deck[j]] = [this.game.deck[j], this.game.deck[i]];
    }
  }

  private setPositions(): void {
    // Clear all positions
    this.game.players.forEach(p => {
      p.isDealer = false;
      p.isSmallBlind = false;
      p.isBigBlind = false;
    });

    // Move dealer button
    this.game.dealerIndex = (this.game.dealerIndex + 1) % this.game.players.length;
    this.game.players[this.game.dealerIndex].isDealer = true;

    // Set blinds
    const sbIndex = (this.game.dealerIndex + 1) % this.game.players.length;
    const bbIndex = (this.game.dealerIndex + 2) % this.game.players.length;
    
    this.game.players[sbIndex].isSmallBlind = true;
    this.game.players[bbIndex].isBigBlind = true;
  }

  private postBlinds(): void {
    const sbPlayer = this.game.players.find(p => p.isSmallBlind)!;
    const bbPlayer = this.game.players.find(p => p.isBigBlind)!;

    // Small blind
    const sbAmount = Math.min(this.game.smallBlind, sbPlayer.chips);
    sbPlayer.chips -= sbAmount;
    sbPlayer.currentBet = sbAmount;
    this.game.pot += sbAmount;

    // Big blind
    const bbAmount = Math.min(this.game.bigBlind, bbPlayer.chips);
    bbPlayer.chips -= bbAmount;
    bbPlayer.currentBet = bbAmount;
    this.game.pot += bbAmount;

    this.game.currentBet = this.game.bigBlind;
  }

  private dealCards(): void {
    // Deal 2 cards to each player
    for (let i = 0; i < 2; i++) {
      for (const player of this.game.players) {
        if (!player.folded) {
          player.cards.push(this.game.deck.pop()!);
        }
      }
    }
  }

  private getNextActivePlayer(fromIndex: number): number {
    let index = (fromIndex + 1) % this.game.players.length;
    while (this.game.players[index].folded || this.game.players[index].allIn) {
      index = (index + 1) % this.game.players.length;
      if (index === fromIndex) break; // Prevent infinite loop
    }
    return index;
  }

  private getActivePlayers(): Player[] {
    return this.game.players.filter(p => !p.folded && !p.allIn);
  }

  private isRoundComplete(): boolean {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length <= 1) return true;

    // Check if all active players have matched the current bet
    return activePlayers.every(p => p.currentBet === this.game.currentBet);
  }

  check(playerId: string): boolean {
    const player = this.game.players[this.game.currentPlayerIndex];
    if (player.id !== playerId) return false;
    if (this.game.currentBet > player.currentBet) return false;

    this.game.lastAction = `${playerId} checks`;
    return this.nextPlayer();
  }

  call(playerId: string): boolean {
    const player = this.game.players[this.game.currentPlayerIndex];
    if (player.id !== playerId) return false;

    const callAmount = Math.min(this.game.currentBet - player.currentBet, player.chips);
    player.chips -= callAmount;
    player.currentBet += callAmount;
    this.game.pot += callAmount;

    if (player.chips === 0) {
      player.allIn = true;
    }

    this.game.lastAction = `${playerId} calls ${callAmount}`;
    return this.nextPlayer();
  }

  raise(playerId: string, amount: number): boolean {
    const player = this.game.players[this.game.currentPlayerIndex];
    if (player.id !== playerId) return false;
    if (amount < this.game.currentBet * 2) return false;
    if (amount > player.chips + player.currentBet) return false;

    const raiseAmount = amount - player.currentBet;
    player.chips -= raiseAmount;
    player.currentBet = amount;
    this.game.pot += raiseAmount;
    this.game.currentBet = amount;

    if (player.chips === 0) {
      player.allIn = true;
    }

    this.game.lastAction = `${playerId} raises to ${amount}`;
    return this.nextPlayer();
  }

  fold(playerId: string): boolean {
    const player = this.game.players[this.game.currentPlayerIndex];
    if (player.id !== playerId) return false;

    player.folded = true;
    this.game.lastAction = `${playerId} folds`;

    // Check if only one player remains
    const activePlayers = this.game.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      this.game.winners = [activePlayers[0].id];
      this.game.winningHand = 'Last player standing';
      this.game.phase = 'showdown';
      return true;
    }

    return this.nextPlayer();
  }

  allIn(playerId: string): boolean {
    const player = this.game.players[this.game.currentPlayerIndex];
    if (player.id !== playerId) return false;

    const allInAmount = player.chips;
    player.chips = 0;
    player.currentBet += allInAmount;
    player.allIn = true;
    this.game.pot += allInAmount;

    if (player.currentBet > this.game.currentBet) {
      this.game.currentBet = player.currentBet;
    }

    this.game.lastAction = `${playerId} goes all-in for ${allInAmount}`;
    return this.nextPlayer();
  }

  private nextPlayer(): boolean {
    if (this.isRoundComplete()) {
      return this.nextPhase();
    }

    this.game.currentPlayerIndex = this.getNextActivePlayer(this.game.currentPlayerIndex);
    return true;
  }

  private nextPhase(): boolean {
    // Reset bets for next round
    this.game.players.forEach(p => p.currentBet = 0);
    this.game.currentBet = 0;

    switch (this.game.phase) {
      case 'preflop':
        this.game.phase = 'flop';
        this.dealCommunityCards(3);
        break;
      case 'flop':
        this.game.phase = 'turn';
        this.dealCommunityCards(1);
        break;
      case 'turn':
        this.game.phase = 'river';
        this.dealCommunityCards(1);
        break;
      case 'river':
        this.game.phase = 'showdown';
        this.determineWinners();
        return true;
    }

    // Set current player to first active player after dealer
    this.game.currentPlayerIndex = this.getNextActivePlayer(this.game.dealerIndex);
    return true;
  }

  private dealCommunityCards(count: number): void {
    for (let i = 0; i < count; i++) {
      this.game.communityCards.push(this.game.deck.pop()!);
    }
  }

  private determineWinners(): void {
    const activePlayers = this.game.players.filter(p => !p.folded);
    const playerHands = activePlayers.map(player => ({
      player,
      hand: this.evaluateHand([...player.cards, ...this.game.communityCards])
    }));

    // Sort by hand rank
    playerHands.sort((a, b) => {
      if (a.hand.rank !== b.hand.rank) {
        return b.hand.rank - a.hand.rank;
      }
      // Compare high cards
      for (let i = 0; i < a.hand.highCards.length; i++) {
        if (a.hand.highCards[i] !== b.hand.highCards[i]) {
          return b.hand.highCards[i] - a.hand.highCards[i];
        }
      }
      return 0;
    });

    // Find winners (could be multiple in case of tie)
    const winningHand = playerHands[0].hand;
    this.game.winners = playerHands
      .filter(ph => ph.hand.rank === winningHand.rank && 
                    ph.hand.highCards.every((card, i) => card === winningHand.highCards[i]))
      .map(ph => ph.player.id);
    
    this.game.winningHand = winningHand.name;
  }

  private evaluateHand(cards: Card[]): { rank: number; name: string; highCards: number[] } {
    // Sort cards by value
    const sorted = [...cards].sort((a, b) => b.value - a.value);
    
    // Check for each hand type from highest to lowest
    const flush = this.checkFlush(sorted);
    const straight = this.checkStraight(sorted);
    const counts = this.getCardCounts(sorted);
    
    if (straight && flush && straight[0].value === 14) {
      return { rank: HAND_RANKINGS.ROYAL_FLUSH, name: 'Royal Flush', highCards: straight.map(c => c.value) };
    }
    
    if (straight && flush) {
      return { rank: HAND_RANKINGS.STRAIGHT_FLUSH, name: 'Straight Flush', highCards: straight.map(c => c.value) };
    }
    
    const fourOfAKind = this.checkNOfAKind(counts, 4);
    if (fourOfAKind) {
      return { rank: HAND_RANKINGS.FOUR_OF_A_KIND, name: 'Four of a Kind', highCards: fourOfAKind };
    }
    
    const fullHouse = this.checkFullHouse(counts);
    if (fullHouse) {
      return { rank: HAND_RANKINGS.FULL_HOUSE, name: 'Full House', highCards: fullHouse };
    }
    
    if (flush) {
      return { rank: HAND_RANKINGS.FLUSH, name: 'Flush', highCards: flush.slice(0, 5).map(c => c.value) };
    }
    
    if (straight) {
      return { rank: HAND_RANKINGS.STRAIGHT, name: 'Straight', highCards: straight.map(c => c.value) };
    }
    
    const threeOfAKind = this.checkNOfAKind(counts, 3);
    if (threeOfAKind) {
      return { rank: HAND_RANKINGS.THREE_OF_A_KIND, name: 'Three of a Kind', highCards: threeOfAKind };
    }
    
    const twoPair = this.checkTwoPair(counts);
    if (twoPair) {
      return { rank: HAND_RANKINGS.TWO_PAIR, name: 'Two Pair', highCards: twoPair };
    }
    
    const pair = this.checkNOfAKind(counts, 2);
    if (pair) {
      return { rank: HAND_RANKINGS.PAIR, name: 'Pair', highCards: pair };
    }
    
    return { 
      rank: HAND_RANKINGS.HIGH_CARD, 
      name: 'High Card', 
      highCards: sorted.slice(0, 5).map(c => c.value) 
    };
  }

  private checkFlush(cards: Card[]): Card[] | null {
    const suitCounts: { [key in Suit]?: Card[] } = {};
    
    for (const card of cards) {
      if (!suitCounts[card.suit]) suitCounts[card.suit] = [];
      suitCounts[card.suit].push(card);
    }
    
    for (const suit in suitCounts) {
      if (suitCounts[suit as Suit]!.length >= 5) {
        return suitCounts[suit as Suit]!.sort((a, b) => b.value - a.value);
      }
    }
    
    return null;
  }

  private checkStraight(cards: Card[]): Card[] | null {
    const uniqueValues = [...new Set(cards.map(c => c.value))].sort((a, b) => b - a);
    
    // Check for ace-low straight
    if (uniqueValues.includes(14) && uniqueValues.includes(2) && uniqueValues.includes(3) && 
        uniqueValues.includes(4) && uniqueValues.includes(5)) {
      return cards.filter(c => [14, 2, 3, 4, 5].includes(c.value))
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 5);
    }
    
    for (let i = 0; i <= uniqueValues.length - 5; i++) {
      if (uniqueValues[i] - uniqueValues[i + 4] === 4) {
        const straightValues = uniqueValues.slice(i, i + 5);
        return cards.filter(c => straightValues.includes(c.value))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5);
      }
    }
    
    return null;
  }

  private getCardCounts(cards: Card[]): Map<number, number> {
    const counts = new Map<number, number>();
    for (const card of cards) {
      counts.set(card.value, (counts.get(card.value) || 0) + 1);
    }
    return counts;
  }

  private checkNOfAKind(counts: Map<number, number>, n: number): number[] | null {
    for (const [value, count] of counts) {
      if (count === n) {
        const kickers = Array.from(counts.keys())
          .filter(v => v !== value)
          .sort((a, b) => b - a)
          .slice(0, 5 - n);
        return [value, ...kickers];
      }
    }
    return null;
  }

  private checkFullHouse(counts: Map<number, number>): number[] | null {
    let threeOfAKind: number | null = null;
    let pair: number | null = null;
    
    for (const [value, count] of counts) {
      if (count === 3 && !threeOfAKind) threeOfAKind = value;
      else if (count === 2 && !pair) pair = value;
    }
    
    if (threeOfAKind && pair) {
      return [threeOfAKind, pair];
    }
    
    return null;
  }

  private checkTwoPair(counts: Map<number, number>): number[] | null {
    const pairs: number[] = [];
    
    for (const [value, count] of counts) {
      if (count === 2) pairs.push(value);
    }
    
    if (pairs.length >= 2) {
      pairs.sort((a, b) => b - a);
      const kicker = Array.from(counts.keys())
        .filter(v => !pairs.includes(v))
        .sort((a, b) => b - a)[0];
      return [pairs[0], pairs[1], kicker];
    }
    
    return null;
  }

  renderPlayerCards(playerId: string): string {
    const player = this.game.players.find(p => p.id === playerId);
    if (!player) return 'No cards';
    
    return player.cards.map(c => `${c.rank}${c.suit}`).join(' ');
  }

  renderCommunityCards(): string {
    if (this.game.communityCards.length === 0) return 'No cards dealt yet';
    
    return this.game.communityCards.map(c => `${c.rank}${c.suit}`).join(' ');
  }

  getState(): PokerGame {
    return this.game;
  }

  canStartNewRound(): boolean {
    return this.game.phase === 'showdown' && this.game.players.filter(p => p.chips > 0).length >= 2;
  }
}

const activeGames = new Map<string, { game: Poker; hostId: string }>();

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('poker')
    .setDescription('Start a Texas Hold\'em poker game! (2-8 players)'),

  async execute(interaction: ChatInputCommandInteraction) {
    const gameId = `poker_${interaction.channelId}`;
    
    if (activeGames.has(gameId)) {
      await interaction.reply({
        content: '❌ There\'s already an active poker game in this channel!',
        ephemeral: true
      });
      return;
    }

    const game = new Poker();
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
        case 'join_poker':
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

        case 'leave_poker':
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

        case 'start_poker':
          if (i.user.id !== hostId) {
            await i.reply({
              content: '❌ Only the host can start the game!',
              ephemeral: true
            });
            return;
          }

          if (currentGame.startGame()) {
            collector.stop();
            await startPokerGame(i, currentGame, gameId);
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
              .setDescription('The poker game lobby timed out.')
              .setColor(0xFF0000)
          ],
          components: []
        });
      }
    });
  },
};

function createLobbyEmbed(game: Poker, host: User): EmbedBuilder {
  const state = game.getState();
  const playerList = state.players.map((p, i) => `${i + 1}. <@${p.id}> (${p.chips} chips)`).join('\n');

  return new EmbedBuilder()
    .setTitle('♠️ Texas Hold\'em Poker - Lobby')
    .setDescription(`Host: ${host}\n\n**Players (${state.players.length}/8):**\n${playerList}`)
    .addFields(
      { name: 'Starting Chips', value: STARTING_CHIPS.toString(), inline: true },
      { name: 'Blinds', value: `${SMALL_BLIND}/${BIG_BLIND}`, inline: true }
    )
    .setColor(0x2F3136)
    .setFooter({ text: 'Click Join to play! • Host clicks Start when ready' })
    .setTimestamp();
}

function createLobbyButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('join_poker')
        .setLabel('Join Game')
        .setEmoji('♠️')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('leave_poker')
        .setLabel('Leave')
        .setEmoji('➖')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('start_poker')
        .setLabel('Start Game')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Primary)
    );
}

async function startPokerGame(interaction: any, game: Poker, gameId: string) {
  const updateDisplay = async () => {
    const state = game.getState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    const embed = createGameEmbed(game);
    const components = state.phase !== 'showdown' ? createGameButtons(game, currentPlayer.id) : createNewRoundButton();

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
    
    // Handle new round button
    if (i.customId === 'new_round' && state.phase === 'showdown') {
      if (game.canStartNewRound()) {
        game.newRound();
        await updateDisplay();
      }
      return;
    }

    // Handle game actions
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (i.user.id !== currentPlayer.id && i.customId !== 'view_cards') {
      await i.reply({
        content: '❌ It\'s not your turn!',
        ephemeral: true
      });
      return;
    }

    let success = false;

    switch (i.customId) {
      case 'check':
        success = game.check(i.user.id);
        break;
      case 'call':
        success = game.call(i.user.id);
        break;
      case 'fold':
        success = game.fold(i.user.id);
        break;
      case 'all_in':
        success = game.allIn(i.user.id);
        break;
      case 'view_cards':
        const cards = game.renderPlayerCards(i.user.id);
        await i.reply({
          content: `Your cards: **${cards}**`,
          ephemeral: true
        });
        return;
    }

    if (success) {
      await updateDisplay();
      
      // Check if game is over
      if (state.phase === 'showdown' && state.winners.length === 1) {
        const winner = state.players.find(p => p.id === state.winners[0]);
        if (winner && winner.chips === STARTING_CHIPS * state.players.length) {
          await endGame(interaction, game, gameId);
          return;
        }
      }
    } else {
      await i.reply({
        content: '❌ Invalid action!',
        ephemeral: true
      });
    }
  });

  gameCollector.on('end', async (_collected, reason) => {
    if (reason === 'time') {
      activeGames.delete(gameId);
      await interaction.followUp({
        content: '⏱️ Poker game timed out due to inactivity!'
      });
    }
  });
}

function createGameEmbed(game: Poker): EmbedBuilder {
  const state = game.getState();
  const currentPlayer = state.players[state.currentPlayerIndex];
  
  const embed = new EmbedBuilder()
    .setTitle('♠️ Texas Hold\'em Poker')
    .setColor(0x2F3136)
    .addFields(
      { name: '🎴 Community Cards', value: game.renderCommunityCards() || 'None yet', inline: false },
      { name: '💰 Pot', value: `${state.pot} chips`, inline: true },
      { name: '🎯 Current Bet', value: `${state.currentBet} chips`, inline: true },
      { name: '📍 Phase', value: state.phase.charAt(0).toUpperCase() + state.phase.slice(1), inline: true }
    );

  // Player info
  const playerInfo = state.players.map(p => {
    let status = '';
    if (p.folded) status = '❌ Folded';
    else if (p.allIn) status = '💎 All-in';
    else if (p.chips === 0) status = '💸 Bust';
    
    let position = '';
    if (p.isDealer) position = '🎯';
    if (p.isSmallBlind) position += 'SB';
    if (p.isBigBlind) position += 'BB';
    
    const isCurrent = state.phase !== 'showdown' && p.id === currentPlayer.id;
    
    return `${isCurrent ? '▶️' : '  '} <@${p.id}> ${position}: ${p.chips} chips ${status}`;
  }).join('\n');

  embed.addFields({ name: '👥 Players', value: playerInfo, inline: false });

  if (state.phase === 'showdown') {
    const winnerText = state.winners.map(w => `<@${w}>`).join(', ');
    embed.addFields(
      { name: '🏆 Winner(s)', value: winnerText, inline: true },
      { name: '🎴 Winning Hand', value: state.winningHand, inline: true }
    );
  } else if (currentPlayer) {
    embed.setDescription(`**Current Turn:** <@${currentPlayer.id}>`);
  }

  if (state.lastAction) {
    embed.setFooter({ text: `Last action: ${state.lastAction}` });
  }

  return embed;
}

function createGameButtons(game: Poker, playerId: string): ActionRowBuilder<ButtonBuilder>[] {
  const state = game.getState();
  const player = state.players.find(p => p.id === playerId);
  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  if (player && state.phase !== 'showdown') {
    const actionRow = new ActionRowBuilder<ButtonBuilder>();

    // Check/Call button
    if (state.currentBet === player.currentBet) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId('check')
          .setLabel('Check')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success)
      );
    } else {
      const callAmount = Math.min(state.currentBet - player.currentBet, player.chips);
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId('call')
          .setLabel(`Call ${callAmount}`)
          .setEmoji('📞')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(player.chips === 0)
      );
    }

    // Fold button
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId('fold')
        .setLabel('Fold')
        .setEmoji('🏳️')
        .setStyle(ButtonStyle.Danger)
    );

    // All-in button
    if (player.chips > 0) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId('all_in')
          .setLabel(`All-in (${player.chips})`)
          .setEmoji('💎')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    components.push(actionRow);
  }

  // View cards button (always available)
  const viewRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('view_cards')
        .setLabel('View Cards')
        .setEmoji('👀')
        .setStyle(ButtonStyle.Secondary)
    );

  components.push(viewRow);

  return components;
}

function createNewRoundButton(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('new_round')
          .setLabel('New Round')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('view_cards')
          .setLabel('View Cards')
          .setEmoji('👀')
          .setStyle(ButtonStyle.Secondary)
      )
  ];
}

async function endGame(interaction: any, game: Poker, gameId: string) {
  const state = game.getState();
  const winner = state.players.find(p => p.chips > 0);

  const embed = new EmbedBuilder()
    .setTitle('🏆 Poker Game Over!')
    .setDescription(`**<@${winner!.id}> wins the game!**`)
    .setColor(0x00FF00)
    .addFields(
      { name: 'Final Chips', value: `${winner!.chips}`, inline: true },
      { name: 'Total Pot', value: `${STARTING_CHIPS * state.players.length}`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
    components: []
  });

  // Save stats
  for (const player of state.players) {
    await saveGameStats(player.id, player.id === winner!.id, player.chips);
  }

  activeGames.delete(gameId);
}

async function saveGameStats(userId: string, won: boolean, finalChips: number) {
  try {
    const stats = await database.getGameStats(userId, 'poker');
    
    await database.updateGameStats(userId, 'poker', {
      wins: (stats?.wins || 0) + (won ? 1 : 0),
      losses: (stats?.losses || 0) + (won ? 0 : 1),
      highScore: Math.max(finalChips, stats?.highScore || 0)
    });
  } catch (error) {
    logger.error('Error saving poker stats:', error);
  }
}

export default command;