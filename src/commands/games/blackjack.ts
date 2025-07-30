import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, User } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';

interface Card {
  suit: '♠' | '♥' | '♦' | '♣';
  rank: string;
  value: number;
}

interface Hand {
  cards: Card[];
  value: number;
  soft: boolean;
}

interface BlackjackGame {
  deck: Card[];
  playerHand: Hand;
  dealerHand: Hand;
  bet: number;
  balance: number;
  gameState: 'betting' | 'playing' | 'dealer' | 'finished';
  result: 'win' | 'lose' | 'push' | 'blackjack' | null;
  doubledDown: boolean;
  split: boolean;
  insurance: boolean;
}

class Blackjack {
  private game: BlackjackGame;
  private readonly STARTING_BALANCE = 1000;

  constructor(balance?: number) {
    this.game = {
      deck: this.createDeck(),
      playerHand: { cards: [], value: 0, soft: false },
      dealerHand: { cards: [], value: 0, soft: false },
      bet: 0,
      balance: balance || this.STARTING_BALANCE,
      gameState: 'betting',
      result: null,
      doubledDown: false,
      split: false,
      insurance: false
    };
    
    this.shuffleDeck();
  }

  private createDeck(): Card[] {
    const suits: Card['suit'][] = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck: Card[] = [];
    
    for (const suit of suits) {
      for (const rank of ranks) {
        let value = 0;
        if (rank === 'A') {
          value = 11;
        } else if (['J', 'Q', 'K'].includes(rank)) {
          value = 10;
        } else {
          value = parseInt(rank);
        }
        
        deck.push({ suit, rank, value });
      }
    }
    
    return deck;
  }

  private shuffleDeck(): void {
    for (let i = this.game.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.game.deck[i], this.game.deck[j]] = [this.game.deck[j], this.game.deck[i]];
    }
  }

  placeBet(amount: number): boolean {
    if (this.game.gameState !== 'betting') return false;
    if (amount > this.game.balance || amount <= 0) return false;
    
    this.game.bet = amount;
    this.game.balance -= amount;
    this.game.gameState = 'playing';
    
    // Deal initial cards
    this.dealInitialCards();
    
    // Check for blackjack
    if (this.game.playerHand.value === 21) {
      if (this.game.dealerHand.value === 21) {
        this.game.result = 'push';
        this.game.balance += this.game.bet;
      } else {
        this.game.result = 'blackjack';
        this.game.balance += Math.floor(this.game.bet * 2.5);
      }
      this.game.gameState = 'finished';
    }
    
    return true;
  }

  private dealInitialCards(): void {
    this.game.playerHand.cards.push(this.drawCard());
    this.game.dealerHand.cards.push(this.drawCard());
    this.game.playerHand.cards.push(this.drawCard());
    this.game.dealerHand.cards.push(this.drawCard());
    
    this.updateHandValue(this.game.playerHand);
    this.updateHandValue(this.game.dealerHand);
  }

  private drawCard(): Card {
    if (this.game.deck.length === 0) {
      this.game.deck = this.createDeck();
      this.shuffleDeck();
    }
    
    return this.game.deck.pop()!;
  }

  private updateHandValue(hand: Hand): void {
    let value = 0;
    let aces = 0;
    
    for (const card of hand.cards) {
      if (card.rank === 'A') {
        aces++;
      }
      value += card.value;
    }
    
    hand.soft = false;
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }
    
    if (aces > 0) {
      hand.soft = true;
    }
    
    hand.value = value;
  }

  hit(): boolean {
    if (this.game.gameState !== 'playing') return false;
    
    this.game.playerHand.cards.push(this.drawCard());
    this.updateHandValue(this.game.playerHand);
    
    if (this.game.playerHand.value > 21) {
      this.game.result = 'lose';
      this.game.gameState = 'finished';
    }
    
    return true;
  }

  stand(): boolean {
    if (this.game.gameState !== 'playing') return false;
    
    this.game.gameState = 'dealer';
    this.playDealer();
    
    return true;
  }

  doubleDown(): boolean {
    if (this.game.gameState !== 'playing') return false;
    if (this.game.playerHand.cards.length !== 2) return false;
    if (this.game.bet > this.game.balance) return false;
    
    this.game.balance -= this.game.bet;
    this.game.bet *= 2;
    this.game.doubledDown = true;
    
    this.hit();
    if (this.game.gameState === 'playing') {
      this.stand();
    }
    
    return true;
  }

  private playDealer(): void {
    while (this.game.dealerHand.value < 17 || 
           (this.game.dealerHand.value === 17 && this.game.dealerHand.soft)) {
      this.game.dealerHand.cards.push(this.drawCard());
      this.updateHandValue(this.game.dealerHand);
    }
    
    this.determineResult();
  }

  private determineResult(): void {
    const playerValue = this.game.playerHand.value;
    const dealerValue = this.game.dealerHand.value;
    
    if (playerValue > 21) {
      this.game.result = 'lose';
    } else if (dealerValue > 21) {
      this.game.result = 'win';
      this.game.balance += this.game.bet * 2;
    } else if (playerValue > dealerValue) {
      this.game.result = 'win';
      this.game.balance += this.game.bet * 2;
    } else if (playerValue < dealerValue) {
      this.game.result = 'lose';
    } else {
      this.game.result = 'push';
      this.game.balance += this.game.bet;
    }
    
    this.game.gameState = 'finished';
  }

  newGame(): void {
    if (this.game.balance <= 0) {
      this.game.balance = this.STARTING_BALANCE;
    }
    
    this.game = {
      deck: this.game.deck,
      playerHand: { cards: [], value: 0, soft: false },
      dealerHand: { cards: [], value: 0, soft: false },
      bet: 0,
      balance: this.game.balance,
      gameState: 'betting',
      result: null,
      doubledDown: false,
      split: false,
      insurance: false
    };
    
    if (this.game.deck.length < 20) {
      this.game.deck = this.createDeck();
      this.shuffleDeck();
    }
  }

  renderHand(hand: Hand, hideSecondCard: boolean = false): string {
    let display = '';
    
    for (let i = 0; i < hand.cards.length; i++) {
      if (i === 1 && hideSecondCard) {
        display += '[??] ';
      } else {
        const card = hand.cards[i];
        const color = ['♥', '♦'].includes(card.suit) ? '🟥' : '⬛';
        display += `[${card.rank}${card.suit}] `;
      }
    }
    
    if (!hideSecondCard) {
      display += `(${hand.value}${hand.soft ? ' soft' : ''})`;
    }
    
    return display;
  }

  getState(): BlackjackGame {
    return this.game;
  }
}

const activeGames = new Map<string, Blackjack>();

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play Blackjack against the dealer!'),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const gameId = `blackjack_${userId}`;
    
    let game = activeGames.get(gameId);
    if (!game) {
      // Load saved balance if exists
      const stats = await database.getGameStats(userId, 'blackjack');
      const savedBalance = stats?.highScore || 1000;
      game = new Blackjack(savedBalance);
      activeGames.set(gameId, game);
    }
    
    const embed = createGameEmbed(game, interaction.user);
    const components = createGameComponents(game.getState());
    
    const response = await interaction.reply({
      embeds: [embed],
      components
    });

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

      const currentGame = activeGames.get(gameId)!;
      
      switch (i.customId) {
        case 'bet_10':
          currentGame.placeBet(10);
          break;
        case 'bet_50':
          currentGame.placeBet(50);
          break;
        case 'bet_100':
          currentGame.placeBet(100);
          break;
        case 'bet_all':
          currentGame.placeBet(currentGame.getState().balance);
          break;
        case 'hit':
          currentGame.hit();
          break;
        case 'stand':
          currentGame.stand();
          break;
        case 'double':
          currentGame.doubleDown();
          break;
        case 'new_game':
          currentGame.newGame();
          break;
      }
      
      const newEmbed = createGameEmbed(currentGame, interaction.user);
      const newComponents = createGameComponents(currentGame.getState());
      
      await i.update({
        embeds: [newEmbed],
        components: newComponents
      });
      
      // Save balance after each game
      if (currentGame.getState().gameState === 'finished') {
        await saveGameStats(userId, currentGame.getState());
      }
    });

    collector.on('end', async (_collected, reason) => {
      if (reason === 'time') {
        const finalGame = activeGames.get(gameId);
        if (finalGame) {
          await saveGameStats(userId, finalGame.getState());
        }
        
        activeGames.delete(gameId);
        
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏱️ Game Timed Out!')
          .setDescription('Your Blackjack game has ended due to inactivity.')
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

function createGameEmbed(game: Blackjack, player: User): EmbedBuilder {
  const state = game.getState();
  
  const embed = new EmbedBuilder()
    .setTitle('🃏 Blackjack')
    .setColor(0x2F3136)
    .setFooter({ text: `Player: ${player.username}` })
    .setTimestamp();
  
  if (state.gameState === 'betting') {
    embed.setDescription('Place your bet to start the game!')
      .addFields(
        { name: '💰 Balance', value: `$${state.balance}`, inline: true },
        { name: '🎰 Minimum Bet', value: '$10', inline: true }
      );
  } else {
    const hideDealerCard = state.gameState === 'playing';
    
    embed.addFields(
      { name: '🎴 Dealer\'s Hand', value: game.renderHand(state.dealerHand, hideDealerCard) },
      { name: '🎯 Your Hand', value: game.renderHand(state.playerHand) },
      { name: '💵 Bet', value: `$${state.bet}`, inline: true },
      { name: '💰 Balance', value: `$${state.balance}`, inline: true }
    );
    
    if (state.gameState === 'finished') {
      let resultText = '';
      let resultColor = 0x2F3136;
      
      switch (state.result) {
        case 'win':
          resultText = '🎉 You Win!';
          resultColor = 0x00FF00;
          break;
        case 'lose':
          resultText = '💀 You Lose!';
          resultColor = 0xFF0000;
          break;
        case 'push':
          resultText = '🤝 Push!';
          resultColor = 0xFFFF00;
          break;
        case 'blackjack':
          resultText = '🎰 BLACKJACK!';
          resultColor = 0xFFD700;
          break;
      }
      
      embed.addFields({ name: '📊 Result', value: resultText })
        .setColor(resultColor);
    }
  }
  
  return embed;
}

function createGameComponents(state: BlackjackGame): ActionRowBuilder<ButtonBuilder>[] {
  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  
  if (state.gameState === 'betting') {
    const betRow1 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('bet_10')
          .setLabel('Bet $10')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(state.balance < 10),
        new ButtonBuilder()
          .setCustomId('bet_50')
          .setLabel('Bet $50')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(state.balance < 50),
        new ButtonBuilder()
          .setCustomId('bet_100')
          .setLabel('Bet $100')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(state.balance < 100),
        new ButtonBuilder()
          .setCustomId('bet_all')
          .setLabel('All In')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(state.balance <= 0)
      );
    
    components.push(betRow1);
  } else if (state.gameState === 'playing') {
    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('hit')
          .setLabel('Hit')
          .setEmoji('🎴')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('stand')
          .setLabel('Stand')
          .setEmoji('✋')
          .setStyle(ButtonStyle.Secondary)
      );
    
    if (state.playerHand.cards.length === 2 && state.bet <= state.balance) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId('double')
          .setLabel('Double Down')
          .setEmoji('💎')
          .setStyle(ButtonStyle.Success)
      );
    }
    
    components.push(actionRow);
  } else if (state.gameState === 'finished') {
    const newGameRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('new_game')
          .setLabel('New Game')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Success)
      );
    
    components.push(newGameRow);
  }
  
  return components;
}

async function saveGameStats(userId: string, state: BlackjackGame) {
  try {
    const stats = await database.getGameStats(userId, 'blackjack');
    
    await database.updateGameStats(userId, 'blackjack', {
      wins: (stats?.wins || 0) + (state.result === 'win' || state.result === 'blackjack' ? 1 : 0),
      losses: (stats?.losses || 0) + (state.result === 'lose' ? 1 : 0),
      highScore: state.balance // Store balance as high score
    });
  } catch (error) {
    logger.error('Error saving blackjack stats:', error);
  }
}

export default command;