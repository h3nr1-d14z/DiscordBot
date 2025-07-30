import { Config } from '../types';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

// Get current git branch name
function getCurrentBranch(): string {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    return branch || 'main';
  } catch (error) {
    // Fallback if not in git repo or git not available
    return 'main';
  }
}

// Determine database path based on branch
function getDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  
  const currentBranch = getCurrentBranch();
  
  // Dev branch always uses bot.db
  if (currentBranch === 'dev') {
    return './data/bot.db';
  }
  
  // Other branches use branch-specific databases
  return `./data/bot-${currentBranch}.db`;
}

export const config: Config = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID,
  guildIds: process.env.GUILD_IDS ? process.env.GUILD_IDS.split(',').map(id => id.trim()) : (process.env.GUILD_ID ? [process.env.GUILD_ID] : []),
  databasePath: getDatabasePath(),
  weatherApiKey: process.env.WEATHER_API_KEY,
  tunnelToken: process.env.TUNNEL_TOKEN,
  enableEconomy: process.env.ENABLE_ECONOMY === 'true',
  enableLeveling: process.env.ENABLE_LEVELING === 'true',
  defaultPrefix: process.env.DEFAULT_PREFIX || '!',
  port: parseInt(process.env.PORT || '8736'),
  webhookPath: process.env.WEBHOOK_PATH || '/webhook',
};

export const validateConfig = (): void => {
  if (!config.token) {
    throw new Error('DISCORD_TOKEN is required in environment variables');
  }
  
  if (!config.clientId) {
    throw new Error('CLIENT_ID is required in environment variables');
  }
};