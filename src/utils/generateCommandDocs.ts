import { readdirSync, writeFileSync } from 'fs';
import path from 'path';
import { BotCommand, CommandCategory } from '../types';

const categoryEmojis: Record<CommandCategory, string> = {
  [CommandCategory.Fun]: '🎉',
  [CommandCategory.Games]: '🎮',
  [CommandCategory.Music]: '🎵',
  [CommandCategory.Utility]: '🛠️',
  [CommandCategory.Economy]: '💰',
  [CommandCategory.Moderation]: '👮',
};

const categoryOrder = [
  CommandCategory.Utility,
  CommandCategory.Music,
  CommandCategory.Games,
  CommandCategory.Fun,
  CommandCategory.Economy,
  CommandCategory.Moderation,
];

interface CommandInfo {
  name: string;
  description: string;
  category: CommandCategory;
  options: Array<{
    name: string;
    description: string;
    required: boolean;
    choices?: Array<{ name: string; value: string }>;
  }>;
  cooldown?: number;
}

async function loadCommands(): Promise<Map<CommandCategory, CommandInfo[]>> {
  const commands = new Map<CommandCategory, CommandInfo[]>();
  
  // Initialize categories
  for (const category of categoryOrder) {
    commands.set(category, []);
  }

  const commandsPath = path.join(__dirname, '../commands');
  const commandFolders = readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const commandFiles = readdirSync(path.join(commandsPath, folder)).filter(
      file => file.endsWith('.ts') || file.endsWith('.js')
    );

    for (const file of commandFiles) {
      try {
        const filePath = path.join(commandsPath, folder, file);
        const command: BotCommand = (await import(filePath)).default;
        
        if ('data' in command && 'execute' in command) {
          const commandInfo: CommandInfo = {
            name: command.data.name,
            description: command.data.description,
            category: command.category,
            options: command.data.options?.map(opt => ({
              name: opt.name,
              description: opt.description,
              required: opt.required || false,
              choices: (opt as any).choices,
            })) || [],
            cooldown: command.cooldown,
          };
          
          const categoryCommands = commands.get(command.category) || [];
          categoryCommands.push(commandInfo);
          commands.set(command.category, categoryCommands);
        }
      } catch (error) {
        console.error(`Failed to load command from ${file}:`, error);
      }
    }
  }

  // Sort commands alphabetically within each category
  for (const [category, cmds] of commands) {
    commands.set(category, cmds.sort((a, b) => a.name.localeCompare(b.name)));
  }

  return commands;
}

function generateMarkdown(commands: Map<CommandCategory, CommandInfo[]>): string {
  const lines: string[] = [];
  
  // Header
  lines.push('# Discord Fun Bot - Command Reference');
  lines.push('');
  lines.push('> 📝 This documentation is auto-generated. Last updated: ' + new Date().toISOString());
  lines.push('');
  lines.push('## Table of Contents');
  lines.push('');
  
  // Generate TOC
  for (const category of categoryOrder) {
    const cmds = commands.get(category);
    if (cmds && cmds.length > 0) {
      const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
      lines.push(`- [${categoryEmojis[category]} ${categoryName} Commands](#${category}-commands)`);
    }
  }
  
  lines.push('');
  lines.push('## Command List');
  lines.push('');
  
  // Generate command details by category
  for (const category of categoryOrder) {
    const cmds = commands.get(category);
    if (!cmds || cmds.length === 0) continue;
    
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    lines.push(`### ${categoryEmojis[category]} ${categoryName} Commands`);
    lines.push('');
    
    for (const cmd of cmds) {
      // Command header
      lines.push(`#### \`/${cmd.name}\``);
      lines.push('');
      lines.push(`**Description:** ${cmd.description}`);
      lines.push('');
      
      if (cmd.cooldown) {
        lines.push(`**Cooldown:** ${cmd.cooldown} seconds`);
        lines.push('');
      }
      
      // Options
      if (cmd.options.length > 0) {
        lines.push('**Options:**');
        lines.push('');
        
        for (const option of cmd.options) {
          const required = option.required ? ' *(required)*' : ' *(optional)*';
          lines.push(`- \`${option.name}\`${required}: ${option.description}`);
          
          if (option.choices && option.choices.length > 0) {
            lines.push(`  - Choices: ${option.choices.map(c => `\`${c.name}\``).join(', ')}`);
          }
        }
        lines.push('');
      }
      
      // Usage example
      lines.push('**Usage:**');
      lines.push('```');
      
      if (cmd.options.length === 0) {
        lines.push(`/${cmd.name}`);
      } else {
        const requiredOptions = cmd.options.filter(o => o.required);
        const optionalOptions = cmd.options.filter(o => !o.required);
        
        let usage = `/${cmd.name}`;
        for (const opt of requiredOptions) {
          usage += ` [${opt.name}]`;
        }
        for (const opt of optionalOptions) {
          usage += ` (${opt.name})`;
        }
        lines.push(usage);
      }
      
      lines.push('```');
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }
  
  // Footer
  lines.push('## Command Statistics');
  lines.push('');
  
  let totalCommands = 0;
  const stats: string[] = [];
  
  for (const [category, cmds] of commands) {
    if (cmds.length > 0) {
      totalCommands += cmds.length;
      const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
      stats.push(`- ${categoryEmojis[category]} ${categoryName}: ${cmds.length} commands`);
    }
  }
  
  lines.push(`**Total Commands:** ${totalCommands}`);
  lines.push('');
  lines.push('**By Category:**');
  lines.push('');
  stats.forEach(stat => lines.push(stat));
  lines.push('');
  
  // Legend
  lines.push('## Legend');
  lines.push('');
  lines.push('- `[option]` - Required parameter');
  lines.push('- `(option)` - Optional parameter');
  lines.push('');
  
  return lines.join('\n');
}

export async function generateCommandDocs(): Promise<void> {
  console.log('🔍 Scanning commands...');
  const commands = await loadCommands();
  
  console.log('📝 Generating documentation...');
  const markdown = generateMarkdown(commands);
  
  const outputPath = path.join(process.cwd(), 'COMMANDS.md');
  writeFileSync(outputPath, markdown);
  
  console.log(`✅ Command documentation generated at: ${outputPath}`);
  
  // Also generate a summary
  let totalCommands = 0;
  for (const cmds of commands.values()) {
    totalCommands += cmds.length;
  }
  console.log(`📊 Total commands documented: ${totalCommands}`);
}

// Run if called directly
if (require.main === module) {
  generateCommandDocs().catch(console.error);
}