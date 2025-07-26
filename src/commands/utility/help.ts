import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ComponentType
} from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';

const categoryEmojis: Record<CommandCategory, string> = {
  [CommandCategory.Fun]: '🎉',
  [CommandCategory.Games]: '🎮',
  [CommandCategory.Utility]: '🛠️',
  [CommandCategory.Economy]: '💰',
  [CommandCategory.Moderation]: '👮',
};

const categoryDescriptions: Record<CommandCategory, string> = {
  [CommandCategory.Fun]: 'Fun and entertainment commands',
  [CommandCategory.Games]: 'Interactive games to play',
  [CommandCategory.Utility]: 'Useful utility commands',
  [CommandCategory.Economy]: 'Economy and currency system',
  [CommandCategory.Moderation]: 'Server moderation tools',
};

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('Get detailed help for a specific command')
        .setRequired(false)
    ),
  
  category: CommandCategory.Utility,
  cooldown: 5,
  
  async execute(interaction: ChatInputCommandInteraction) {
    const commandName = interaction.options.getString('command');
    const commands = (interaction.client as any).commands;
    
    if (commandName) {
      // Show specific command help
      const command = commands.get(commandName);
      
      if (!command) {
        await interaction.reply({
          content: `❌ Command \`${commandName}\` not found!`,
          ephemeral: true
        });
        return;
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`Command: /${command.data.name}`)
        .setDescription(command.data.description)
        .addFields(
          { name: 'Category', value: categoryEmojis[command.category as CommandCategory] + ' ' + command.category, inline: true },
          { name: 'Cooldown', value: `${command.cooldown || 3} seconds`, inline: true }
        );
      
      // Add options if any
      if (command.data.options && command.data.options.length > 0) {
        const options = command.data.options.map((opt: any) => 
          `**${opt.name}** ${opt.required ? '(required)' : '(optional)'}: ${opt.description}`
        ).join('\n');
        embed.addFields({ name: 'Options', value: options });
      }
      
      await interaction.reply({ embeds: [embed] });
      return;
    }
    
    // Show category selection
    const categories = Object.values(CommandCategory);
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Select a category')
      .addOptions(
        categories.map(category => ({
          label: category.charAt(0).toUpperCase() + category.slice(1),
          description: categoryDescriptions[category],
          value: category,
          emoji: categoryEmojis[category],
        }))
      );
    
    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📚 Bot Commands')
      .setDescription(
        'Welcome to the Discord Fun Bot! Select a category below to view commands.\n\n' +
        'You can also use `/help [command]` to get detailed information about a specific command.'
      )
      .addFields(
        categories.map(category => ({
          name: categoryEmojis[category] + ' ' + category.charAt(0).toUpperCase() + category.slice(1),
          value: categoryDescriptions[category],
          inline: true,
        }))
      )
      .setFooter({ 
        text: 'Use the dropdown menu to browse commands by category',
        iconURL: interaction.client.user?.displayAvatarURL()
      });
    
    const response = await interaction.reply({ 
      embeds: [embed], 
      components: [row],
      fetchReply: true 
    });
    
    // Handle category selection
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000, // 1 minute
    });
    
    collector.on('collect', async (i: StringSelectMenuInteraction) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ 
          content: 'This menu is not for you!', 
          ephemeral: true 
        });
        return;
      }
      
      const selectedCategory = i.values[0] as CommandCategory;
      const categoryCommands = Array.from(commands.values())
        .filter((cmd) => (cmd as BotCommand).category === selectedCategory) as BotCommand[];
      
      const categoryEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`${categoryEmojis[selectedCategory]} ${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Commands`)
        .setDescription(categoryDescriptions[selectedCategory])
        .addFields(
          categoryCommands.map((cmd: BotCommand) => ({
            name: `/${cmd.data.name}`,
            value: cmd.data.description,
            inline: true,
          }))
        )
        .setFooter({ 
          text: `Total commands in category: ${categoryCommands.length}`,
          iconURL: interaction.client.user?.displayAvatarURL()
        });
      
      await i.update({ embeds: [categoryEmbed] });
    });
    
    collector.on('end', async () => {
      await response.edit({ components: [] }).catch(() => {});
    });
  },
};

export default command;