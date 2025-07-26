import { createServer, Server } from 'http';
import { Client } from 'discord.js';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class HealthCheckServer {
  private server: Server | null = null;
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  start(): void {
    this.server = createServer((req, res) => {
      if (req.url === '/health') {
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          discord: {
            connected: this.client.ws.status === 0,
            ping: this.client.ws.ping,
            guilds: this.client.guilds.cache.size,
            users: this.client.users.cache.size,
          }
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health, null, 2));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.server.listen(config.port, () => {
      logger.info(`Health check server listening on port ${config.port}`);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close(() => {
        logger.info('Health check server stopped');
      });
    }
  }
}