import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';

interface SlotMachine {
  balance: number;
  bet: number;
  reels: string[][];
  spinning: boolean;
  lastWin: number;
  totalSpins: number;
  totalWon: number;
  totalLost: number;
}

const SYMBOLS = {
  seven: { emoji: '7️⃣', value: 100, name: 'Seven' },
  diamond: { emoji: '💎', value: 50, name: 'Diamond' },
  bell: { emoji: '🔔', value: 30, name: 'Bell' },
  bar: { emoji: '🍫', value: 20, name: 'Bar' },
  cherry: { emoji: '🍒', value: 15, name: 'Cherry' },
  lemon: { emoji: '🍋', value: 10, name: 'Lemon' },
  watermelon: { emoji: '🍉', value: 5, name: 'Watermelon' }
};

const SYMBOL_WEIGHTS = [
  { symbol: 'watermelon', weight: 30 },
  { symbol: 'lemon', weight: 25 },
  { symbol: 'cherry', weight: 20 },
  { symbol: 'bar', weight: 12 },
  { symbol: 'bell', weight: 8 },
  { symbol: 'diamond', weight: 4 },
  { symbol: 'seven', weight: 1 }
];

const PAYLINES = [
  [[0, 0], [0, 1], [0, 2]], // Top row
  [[1, 0], [1, 1], [1, 2]], // Middle row
  [[2, 0], [2, 1], [2, 2]], // Bottom row
  [[0, 0], [1, 1], [2, 2]], // Diagonal top-left to bottom-right
  [[2, 0], [1, 1], [0, 2]]  // Diagonal bottom-left to top-right
];

class Slots {
  private machine: SlotMachine;
  private readonly STARTING_BALANCE = 1000;
  private readonly MIN_BET = 10;
  private readonly MAX_BET = 100;

  constructor(balance?: number) {
    this.machine = {
      balance: balance || this.STARTING_BALANCE,
      bet: this.MIN_BET,
      reels: this.generateReels(),
      spinning: false,
      lastWin: 0,
      totalSpins: 0,
      totalWon: 0,
      totalLost: 0
    };
  }

  private generateReels(): string[][] {
    const reels: string[][] = [];
    for (let col = 0; col < 3; col++) {
      const reel: string[] = [];
      for (let row = 0; row < 3; row++) {
        reel.push(this.getRandomSymbol());
      }
      reels.push(reel);
    }
    return reels;
  }

  private getRandomSymbol(): string {
    const totalWeight = SYMBOL_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of SYMBOL_WEIGHTS) {
      random -= item.weight;
      if (random <= 0) {
        return item.symbol;
      }
    }
    
    return 'cherry'; // Fallback
  }

  setBet(amount: number): boolean {
    if (amount < this.MIN_BET || amount > this.MAX_BET || amount > this.machine.balance) {
      return false;
    }
    this.machine.bet = amount;
    return true;
  }

  spin(): { win: number; winningLines: number[][] } {
    if (this.machine.balance < this.machine.bet) {
      return { win: 0, winningLines: [] };
    }

    this.machine.balance -= this.machine.bet;
    this.machine.totalSpins++;
    this.machine.totalLost += this.machine.bet;
    
    // Generate new reels
    this.machine.reels = this.generateReels();
    
    // Check for wins
    const { win, winningLines } = this.checkWins();
    
    if (win > 0) {
      this.machine.balance += win;
      this.machine.totalWon += win;
      this.machine.lastWin = win;
    } else {
      this.machine.lastWin = 0;
    }
    
    return { win, winningLines };
  }

  private checkWins(): { win: number; winningLines: number[][] } {
    let totalWin = 0;
    const winningLines: number[][] = [];
    
    for (let i = 0; i < PAYLINES.length; i++) {
      const payline = PAYLINES[i];
      const symbols = payline.map(([row, col]) => this.machine.reels[col][row]);
      
      // Check if all symbols match
      if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
        const symbol = SYMBOLS[symbols[0] as keyof typeof SYMBOLS];
        const lineWin = Math.floor(this.machine.bet * (symbol.value / 10));
        totalWin += lineWin;
        winningLines.push(payline);
      }
      
      // Check for partial matches (2 symbols)
      else if (symbols[0] === symbols[1] || symbols[1] === symbols[2]) {
        const matchSymbol = symbols[1];
        const symbol = SYMBOLS[matchSymbol as keyof typeof SYMBOLS];
        const lineWin = Math.floor(this.machine.bet * (symbol.value / 50));
        totalWin += lineWin;
      }
    }
    
    // Jackpot: All sevens
    const allSymbols = this.machine.reels.flat();
    if (allSymbols.every(s => s === 'seven')) {
      totalWin = this.machine.bet * 1000; // Mega jackpot!
    }
    
    return { win: totalWin, winningLines };
  }

  renderMachine(spinning: boolean = false, step: number = 0): string {
    let display = '```\n🎰 SLOT MACHINE 🎰\n\n';
    display += '╔═══╦═══╦═══╗\n';
    
    for (let row = 0; row < 3; row++) {
      display += '║';
      for (let col = 0; col < 3; col++) {
        if (spinning && step < 3) {
          // Animated spinning effect
          if (col <= step) {
            const symbol = SYMBOLS[this.machine.reels[col][row] as keyof typeof SYMBOLS];
            display += ` ${symbol.emoji} `;
          } else {
            // Show spinning animation
            const spinSymbols = ['🔄', '🔃', '🔄'];
            display += ` ${spinSymbols[row]} `;
          }
        } else {
          const symbol = SYMBOLS[this.machine.reels[col][row] as keyof typeof SYMBOLS];
          display += ` ${symbol.emoji} `;
        }
        display += '║';
      }
      display += '\n';
      if (row < 2) {
        display += '╠═══╬═══╬═══╣\n';
      }
    }
    
    display += '╚═══╩═══╩═══╝\n```';
    return display;
  }

  getState(): SlotMachine {
    return this.machine;
  }

  addCredits(amount: number): void {
    this.machine.balance += amount;
  }
}

const activeMachines = new Map<string, Slots>();

const command: BotCommand = {
  category: CommandCategory.Games,
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Play the slot machine! 🎰')
    .addIntegerOption(option =>
      option.setName('bet')
        .setDescription('Amount to bet (10-100 credits)')
        .setMinValue(10)
        .setMaxValue(100)),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const machineId = `slots_${userId}`;
    
    let machine = activeMachines.get(machineId);
    if (!machine) {
      const stats = await database.getGameStats(userId, 'slots');
      const savedBalance = stats?.highScore || 1000;
      machine = new Slots(savedBalance);
      activeMachines.set(machineId, machine);
    }
    
    const betAmount = interaction.options.getInteger('bet');
    if (betAmount) {
      machine.setBet(betAmount);
    }
    
    const embed = createMachineEmbed(machine, false);
    const buttons = createButtons(machine.getState());
    
    const response = await interaction.reply({
      embeds: [embed],
      components: buttons
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000 // 5 minutes
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== userId) {
        await i.reply({
          content: '❌ This is not your slot machine!',
          ephemeral: true
        });
        return;
      }

      const currentMachine = activeMachines.get(machineId)!;
      
      switch (i.customId) {
        case 'spin':
          // Show spinning animation
          await i.deferUpdate();
          
          // Animate reels one by one
          for (let step = 0; step < 4; step++) {
            const animEmbed = createMachineEmbed(currentMachine, true, step);
            await interaction.editReply({
              embeds: [animEmbed],
              components: []
            });
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          // Execute spin
          const { win, winningLines } = currentMachine.spin();
          
          // Show final result
          const resultEmbed = createMachineEmbed(currentMachine, false, 0, win, winningLines);
          const newButtons = createButtons(currentMachine.getState());
          
          await interaction.editReply({
            embeds: [resultEmbed],
            components: newButtons
          });
          
          // Save stats
          await saveGameStats(userId, currentMachine.getState());
          break;
          
        case 'bet_10':
          currentMachine.setBet(10);
          await updateDisplay(i, currentMachine);
          break;
          
        case 'bet_25':
          currentMachine.setBet(25);
          await updateDisplay(i, currentMachine);
          break;
          
        case 'bet_50':
          currentMachine.setBet(50);
          await updateDisplay(i, currentMachine);
          break;
          
        case 'bet_100':
          currentMachine.setBet(100);
          await updateDisplay(i, currentMachine);
          break;
          
        case 'cashout':
          const finalState = currentMachine.getState();
          await saveGameStats(userId, finalState);
          
          const cashoutEmbed = new EmbedBuilder()
            .setTitle('💰 Cashed Out!')
            .setDescription(`You cashed out with **${finalState.balance}** credits!`)
            .addFields(
              { name: 'Total Spins', value: finalState.totalSpins.toString(), inline: true },
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
          
          activeMachines.delete(machineId);
          collector.stop();
          break;
      }
    });

    collector.on('end', async (_collected, reason) => {
      if (reason === 'time') {
        const finalMachine = activeMachines.get(machineId);
        if (finalMachine) {
          await saveGameStats(userId, finalMachine.getState());
        }
        
        activeMachines.delete(machineId);
        
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏱️ Session Timed Out!')
          .setDescription('Your slot machine session has ended due to inactivity.')
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

async function updateDisplay(interaction: any, machine: Slots) {
  const embed = createMachineEmbed(machine, false);
  const buttons = createButtons(machine.getState());
  await interaction.update({
    embeds: [embed],
    components: buttons
  });
}

function createMachineEmbed(machine: Slots, spinning: boolean = false, step: number = 0, lastWin: number = 0, winningLines: number[][] = []): EmbedBuilder {
  const state = machine.getState();
  
  const embed = new EmbedBuilder()
    .setTitle('🎰 Slot Machine')
    .setDescription(machine.renderMachine(spinning, step))
    .setColor(spinning ? 0xFFFF00 : (lastWin > 0 ? 0x00FF00 : 0x0099FF))
    .setTimestamp();
  
  if (!spinning) {
    embed.addFields(
      { name: '💰 Balance', value: `${state.balance} credits`, inline: true },
      { name: '🎲 Current Bet', value: `${state.bet} credits`, inline: true },
      { name: '🏆 Last Win', value: lastWin > 0 ? `${lastWin} credits` : 'No win', inline: true }
    );
    
    if (lastWin > 0) {
      let winText = `🎉 **You won ${lastWin} credits!**`;
      if (lastWin >= state.bet * 100) {
        winText = `🎰 **JACKPOT! ${lastWin} credits!** 🎰`;
      } else if (lastWin >= state.bet * 50) {
        winText = `💎 **BIG WIN! ${lastWin} credits!** 💎`;
      }
      embed.setDescription(machine.renderMachine() + '\n\n' + winText);
    }
    
    if (state.balance < state.bet) {
      embed.setFooter({ text: '⚠️ Insufficient balance! Lower your bet or cash out.' });
    }
  } else {
    embed.setFooter({ text: 'Spinning...' });
  }
  
  return embed;
}

function createButtons(state: SlotMachine): ActionRowBuilder<ButtonBuilder>[] {
  const betRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('bet_10')
        .setLabel('10')
        .setEmoji('🪙')
        .setStyle(state.bet === 10 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('bet_25')
        .setLabel('25')
        .setEmoji('🪙')
        .setStyle(state.bet === 25 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('bet_50')
        .setLabel('50')
        .setEmoji('🪙')
        .setStyle(state.bet === 50 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('bet_100')
        .setLabel('100')
        .setEmoji('🪙')
        .setStyle(state.bet === 100 ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
  
  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('spin')
        .setLabel('SPIN!')
        .setEmoji('🎰')
        .setStyle(ButtonStyle.Success)
        .setDisabled(state.balance < state.bet),
      new ButtonBuilder()
        .setCustomId('cashout')
        .setLabel('Cash Out')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Danger)
    );
  
  return [betRow, actionRow];
}

async function saveGameStats(userId: string, state: SlotMachine) {
  try {
    const stats = await database.getGameStats(userId, 'slots');
    
    await database.updateGameStats(userId, 'slots', {
      wins: (stats?.wins || 0) + (state.totalWon > state.totalLost ? 1 : 0),
      losses: (stats?.losses || 0) + (state.totalWon < state.totalLost ? 1 : 0),
      highScore: state.balance
    });
  } catch (error) {
    logger.error('Error saving slots stats:', error);
  }
}

export default command;