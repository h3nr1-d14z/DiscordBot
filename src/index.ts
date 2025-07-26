import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config, validateConfig } from './config/config';
import { CommandHandler } from './handlers/commandHandler';
import { EventHandler } from './handlers/eventHandler';
import { database } from './services/database';
import { HealthCheckServer } from './services/healthCheck';
import { logger } from './utils/logger';

class DiscordBot {
  private client: Client;
  private commandHandler: CommandHandler;
  private eventHandler: EventHandler;
  private healthCheckServer: HealthCheckServer;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
      ],
    });

    this.commandHandler = new CommandHandler();
    this.eventHandler = new EventHandler();
    this.healthCheckServer = new HealthCheckServer(this.client);
  }

  async start(): Promise<void> {
    try {
      // Validate configuration
      validateConfig();

      // Initialize database
      await database.initialize();

      // Load handlers
      await this.commandHandler.loadCommands(this.client);
      await this.eventHandler.loadEvents(this.client);

      // Register commands
      await this.commandHandler.registerCommands();

      // Login to Discord
      await this.client.login(config.token);
      
      // Start health check server
      this.healthCheckServer.start();
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down bot...');
    
    try {
      // Stop health check server
      this.healthCheckServer.stop();
      
      // Close database connection
      await database.close();
      
      // Destroy client connection
      this.client.destroy();
      
      logger.info('Bot shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}

// Create and start bot
const bot = new DiscordBot();

// Handle process events
process.on('SIGINT', async () => {
  await bot.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await bot.shutdown();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Start the bot
bot.start().catch((error) => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
});