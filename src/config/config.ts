import { Config } from '../types';
import dotenv from 'dotenv';

dotenv.config();

export const config: Config = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID,
  databasePath: process.env.DATABASE_PATH || './data/bot.db',
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