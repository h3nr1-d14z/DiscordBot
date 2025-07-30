import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';
import { createCanvas } from 'canvas';

interface DiceGame {
  balance: number;
  currentBet: number;
  betType: 'odd' | 'even' | 'high' | 'low' | 'specific' | null;
  specificNumber: number | null;
  lastRoll: number[];
  lastWin: number;
  totalRolls: number;
  totalWon: number;
  totalLost: number;
  streak: number;
}

class Dice {
  private game: DiceGame;
  private readonly STARTING_BALANCE = 500;
  private readonly DICE_COUNT = 2;

  constructor(balance?: number) {
    this.game = {
      balance: balance || this.STARTING_BALANCE,
      currentBet: 10,
      betType: null,
      specificNumber: null,
      lastRoll: [],
      lastWin: 0,
      totalRolls: 0,
      totalWon: 0,
      totalLost: 0,
      streak: 0
    };
  }

  setBet(amount: number): boolean {
    if (amount <= 0 || amount > this.game.balance) return false;
    this.game.currentBet = amount;
    return true;
  }

  setBetType(type: DiceGame['betType'], specific?: number): void {
    this.game.betType = type;
    if (type === 'specific' && specific) {
      this.game.specificNumber = specific;
    }
  }

  roll(): { dice: number[], total: number, won: boolean, payout: number } {
    if (!this.game.betType || this.game.currentBet > this.game.balance) {
      return { dice: [], total: 0, won: false, payout: 0 };
    }

    // Deduct bet
    this.game.balance -= this.game.currentBet;
    this.game.totalLost += this.game.currentBet;
    this.game.totalRolls++;

    // Roll dice
    const dice: number[] = [];
    for (let i = 0; i < this.DICE_COUNT; i++) {
      dice.push(Math.floor(Math.random() * 6) + 1);
    }
    const total = dice.reduce((sum, die) => sum + die, 0);

    this.game.lastRoll = dice;

    // Check win
    let won = false;
    let multiplier = 0;

    switch (this.game.betType) {
      case 'odd':
        won = total % 2 === 1;
        multiplier = 2;
        break;
      case 'even':
        won = total % 2 === 0;
        multiplier = 2;
        break;
      case 'high': // 7-12
        won = total >= 7;
        multiplier = 2;
        break;
      case 'low': // 2-6
        won = total <= 6;
        multiplier = 2;
        break;
      case 'specific':
        won = total === this.game.specificNumber;
        multiplier = 10; // Higher payout for specific number
        break;
    }

    let payout = 0;
    if (won) {
      payout = this.game.currentBet * multiplier;
      this.game.balance += payout;
      this.game.totalWon += payout;
      this.game.lastWin = payout - this.game.currentBet; // Net win
      this.game.streak++;
    } else {
      this.game.lastWin = 0;
      this.game.streak = 0;
    }

    return { dice, total, won, payout };
  }

  renderDice(dice: number[]): Buffer {
    const canvas = createCanvas(300, 150);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#2b2d31';
    ctx.fillRect(0, 0, 300, 150);

    // Draw dice
    const diceSize = 80;
    const spacing = 20;
    const startX = (300 - (dice.length * diceSize + (dice.length - 1) * spacing)) / 2;
    const y = 35;

    dice.forEach((value, index) => {
      const x = startX + index * (diceSize + spacing);
      
      // Dice background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, diceSize, diceSize);
      
      // Dice border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, diceSize, diceSize);
      
      // Draw dots
      ctx.fillStyle = '#000000';
      const dotSize = 12;
      const positions = {
        1: [[40, 40]],
        2: [[20, 20], [60, 60]],
        3: [[20, 20], [40, 40], [60, 60]],
        4: [[20, 20], [60, 20], [20, 60], [60, 60]],
        5: [[20, 20], [60, 20], [40, 40], [20, 60], [60, 60]],
        6: [[20, 20], [60, 20], [20, 40], [60, 40], [20, 60], [60, 60]]
      };
      
      const dots = positions[value as keyof typeof positions] || [];
      dots.forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, dotSize / 2, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    return canvas.toBuffer();
  }

  getState(): DiceGame {
    return this.game;
  }
}

const activeGames = new Map<string, Dice>();

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Roll the dice and bet on the outcome! 🎲'),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const gameId = `dice_${userId}`;
    
    let game = activeGames.get(gameId);
    if (!game) {
      const stats = await database.getGameStats(userId, 'dice');
      const savedBalance = stats?.highScore || 500;
      game = new Dice(savedBalance);
      activeGames.set(gameId, game);
    }
    
    const embed = createGameEmbed(game);
    const components = createComponents(game.getState());
    
    const response = await interaction.reply({
      embeds: [embed],
      components
    });

    const collector = response.createMessageComponentCollector({
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
      const state = currentGame.getState();
      
      // Handle bet amount buttons
      if (i.customId.startsWith('bet_')) {
        const amount = parseInt(i.customId.split('_')[1]);
        currentGame.setBet(amount);
        await updateDisplay(i, currentGame);
        return;
      }
      
      // Handle bet type selection
      if (i.customId.startsWith('type_')) {
        const type = i.customId.split('_')[1] as DiceGame['betType'];
        currentGame.setBetType(type);
        await updateDisplay(i, currentGame);
        return;
      }
      
      // Handle specific number selection
      if (i.customId.startsWith('num_')) {
        const num = parseInt(i.customId.split('_')[1]);
        currentGame.setBetType('specific', num);
        await updateDisplay(i, currentGame);
        return;
      }
      
      // Handle roll
      if (i.customId === 'roll') {
        await i.deferUpdate();
        
        // Roll animation
        for (let frame = 0; frame < 3; frame++) {
          const animDice = [
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1
          ];
          const animBuffer = currentGame.renderDice(animDice);
          const animAttachment = new AttachmentBuilder(animBuffer, { name: 'dice-anim.png' });
          
          const animEmbed = new EmbedBuilder()
            .setTitle('🎲 Rolling Dice...')
            .setImage('attachment://dice-anim.png')
            .setColor(0xFFFF00);
          
          await interaction.editReply({
            embeds: [animEmbed],
            files: [animAttachment],
            components: []
          });
          
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Execute roll
        const result = currentGame.roll();
        
        // Show result
        const diceBuffer = currentGame.renderDice(result.dice);
        const attachment = new AttachmentBuilder(diceBuffer, { name: 'dice-result.png' });
        
        const resultEmbed = createResultEmbed(currentGame, result);
        const newComponents = createComponents(currentGame.getState());
        
        await interaction.editReply({
          embeds: [resultEmbed],
          files: [attachment],
          components: newComponents
        });
        
        await saveGameStats(userId, currentGame.getState());
      }
      
      // Handle cash out
      if (i.customId === 'cashout') {
        const finalState = currentGame.getState();
        await saveGameStats(userId, finalState);
        
        const cashoutEmbed = new EmbedBuilder()
          .setTitle('💰 Cashed Out!')
          .setDescription(`You cashed out with **${finalState.balance}** credits!`)
          .addFields(
            { name: 'Total Rolls', value: finalState.totalRolls.toString(), inline: true },
            { name: 'Total Won', value: finalState.totalWon.toString(), inline: true },
            { name: 'Total Lost', value: finalState.totalLost.toString(), inline: true },
            { name: 'Net Profit', value: (finalState.totalWon - finalState.totalLost).toString(), inline: true }
          )
          .setColor(0x00FF00)
          .setTimestamp();
        
        await i.update({
          embeds: [cashoutEmbed],
          components: []
        });
        
        activeGames.delete(gameId);
        collector.stop();
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
          .setTitle('⏱️ Session Timed Out!')
          .setDescription('Your dice game session has ended due to inactivity.')
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

async function updateDisplay(interaction: any, game: Dice) {
  const embed = createGameEmbed(game);
  const components = createComponents(game.getState());
  await interaction.update({
    embeds: [embed],
    components
  });
}

function createGameEmbed(game: Dice): EmbedBuilder {
  const state = game.getState();
  
  const embed = new EmbedBuilder()
    .setTitle('🎲 Dice Game')
    .setDescription('Select your bet type and amount, then roll the dice!')
    .setColor(0x0099FF)
    .addFields(
      { name: '💰 Balance', value: `${state.balance} credits`, inline: true },
      { name: '🎯 Current Bet', value: `${state.currentBet} credits`, inline: true },
      { name: '🎲 Bet Type', value: getBetTypeDisplay(state), inline: true }
    )
    .setTimestamp();
  
  if (state.streak > 2) {
    embed.addFields({ name: '🔥 Win Streak', value: `${state.streak} wins in a row!`, inline: true });
  }
  
  if (state.balance < state.currentBet) {
    embed.setFooter({ text: '⚠️ Insufficient balance! Lower your bet.' });
  } else if (!state.betType) {
    embed.setFooter({ text: '💡 Select a bet type to start playing!' });
  }
  
  return embed;
}

function createResultEmbed(game: Dice, result: { dice: number[], total: number, won: boolean, payout: number }): EmbedBuilder {
  const state = game.getState();
  
  const embed = new EmbedBuilder()
    .setTitle('🎲 Dice Result')
    .setImage('attachment://dice-result.png')
    .setColor(result.won ? 0x00FF00 : 0xFF0000)
    .addFields(
      { name: '🎲 Roll', value: `${result.dice.join(' + ')} = **${result.total}**`, inline: true },
      { name: '🎯 Your Bet', value: getBetTypeDisplay(state), inline: true },
      { name: result.won ? '🎉 Result' : '💀 Result', value: result.won ? `Won ${result.payout} credits!` : 'Lost', inline: true },
      { name: '💰 Balance', value: `${state.balance} credits`, inline: true }
    )
    .setTimestamp();
  
  if (result.won) {
    embed.setDescription(`🎉 **You won ${result.payout} credits!**`);
  } else {
    embed.setDescription(`💀 Better luck next time!`);
  }
  
  return embed;
}

function getBetTypeDisplay(state: DiceGame): string {
  if (!state.betType) return 'None';
  
  switch (state.betType) {
    case 'odd': return 'Odd (1:1)';
    case 'even': return 'Even (1:1)';
    case 'high': return 'High 7-12 (1:1)';
    case 'low': return 'Low 2-6 (1:1)';
    case 'specific': return `Exactly ${state.specificNumber} (9:1)`;
    default: return 'None';
  }
}

function createComponents(state: DiceGame): ActionRowBuilder<ButtonBuilder>[] {
  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  
  // Bet amount row
  const betRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('bet_10')
        .setLabel('10')
        .setEmoji('🪙')
        .setStyle(state.currentBet === 10 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('bet_25')
        .setLabel('25')
        .setEmoji('🪙')
        .setStyle(state.currentBet === 25 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('bet_50')
        .setLabel('50')
        .setEmoji('🪙')
        .setStyle(state.currentBet === 50 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('bet_100')
        .setLabel('100')
        .setEmoji('🪙')
        .setStyle(state.currentBet === 100 ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(state.balance < 100)
    );
  
  // Bet type row 1
  const typeRow1 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('type_odd')
        .setLabel('Odd')
        .setStyle(state.betType === 'odd' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('type_even')
        .setLabel('Even')
        .setStyle(state.betType === 'even' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('type_high')
        .setLabel('High (7-12)')
        .setStyle(state.betType === 'high' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('type_low')
        .setLabel('Low (2-6)')
        .setStyle(state.betType === 'low' ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
  
  // Specific numbers row
  const numbersRow = new ActionRowBuilder<ButtonBuilder>();
  for (let i = 2; i <= 6; i++) {
    numbersRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`num_${i}`)
        .setLabel(i.toString())
        .setStyle(state.betType === 'specific' && state.specificNumber === i ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
  }
  
  // Action row
  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('roll')
        .setLabel('Roll Dice!')
        .setEmoji('🎲')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!state.betType || state.balance < state.currentBet),
      new ButtonBuilder()
        .setCustomId('cashout')
        .setLabel('Cash Out')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Danger)
    );
  
  components.push(betRow, typeRow1, numbersRow, actionRow);
  
  return components;
}

async function saveGameStats(userId: string, state: DiceGame) {
  try {
    const stats = await database.getGameStats(userId, 'dice');
    
    await database.updateGameStats(userId, 'dice', {
      wins: (stats?.wins || 0) + (state.totalWon > state.totalLost ? 1 : 0),
      losses: (stats?.losses || 0) + (state.totalWon < state.totalLost ? 1 : 0),
      highScore: state.balance
    });
  } catch (error) {
    logger.error('Error saving dice stats:', error);
  }
}

export default command;