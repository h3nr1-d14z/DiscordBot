import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice with various formats')
    .addStringOption(option =>
      option
        .setName('dice')
        .setDescription('Dice to roll (e.g., d20, 2d6, 3d6+2)')
        .setRequired(false)
    ),
  
  category: CommandCategory.Fun,
  cooldown: 2,
  
  async execute(interaction: ChatInputCommandInteraction) {
    const diceInput = interaction.options.getString('dice') || 'd6';
    
    // Parse dice notation
    const diceRegex = /^(\d*)d(\d+)([+-]\d+)?$/i;
    const match = diceInput.match(diceRegex);
    
    if (!match) {
      await interaction.reply({
        content: '❌ Invalid dice format! Use formats like: d20, 2d6, 3d6+2',
        ephemeral: true
      });
      return;
    }
    
    const count = parseInt(match[1] || '1');
    const sides = parseInt(match[2]);
    const modifier = parseInt(match[3] || '0');
    
    // Validate input
    if (count > 100 || count < 1) {
      await interaction.reply({
        content: '❌ You can only roll between 1 and 100 dice at once!',
        ephemeral: true
      });
      return;
    }
    
    if (sides > 1000 || sides < 2) {
      await interaction.reply({
        content: '❌ Dice must have between 2 and 1000 sides!',
        ephemeral: true
      });
      return;
    }
    
    // Roll the dice
    const rolls: number[] = [];
    let total = 0;
    
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }
    
    total += modifier;
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setTitle('🎲 Dice Roll')
      .addFields({
        name: 'Roll',
        value: diceInput,
        inline: true
      });
    
    if (count <= 10) {
      embed.addFields({
        name: 'Results',
        value: rolls.join(', '),
        inline: true
      });
    } else {
      embed.addFields({
        name: 'Sum of Rolls',
        value: (total - modifier).toString(),
        inline: true
      });
    }
    
    if (modifier !== 0) {
      embed.addFields({
        name: 'Modifier',
        value: modifier > 0 ? `+${modifier}` : modifier.toString(),
        inline: true
      });
    }
    
    embed.addFields({
      name: 'Total',
      value: `**${total}**`,
      inline: false
    });
    
    embed.setFooter({ 
      text: `Rolled by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL()
    });
    
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;