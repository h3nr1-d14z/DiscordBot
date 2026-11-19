import express from 'express';
import cors from 'cors';
import path from 'path';
import { logger } from '../utils/logger';
import { attachHexZap } from './hexzapServer';
import http from 'http';

export class EmbeddedAppServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private port: number;
  private gameSessions: Map<string, { game: string; timestamp: number }> = new Map();

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.setupServer();
    
    // Clean up old sessions every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, session] of this.gameSessions.entries()) {
        if (now - session.timestamp > 3600000) { // 1 hour
          this.gameSessions.delete(key);
        }
      }
    }, 300000);
  }
  
  createGameSession(channelId: string, game: string): void {
    this.gameSessions.set(channelId, { game, timestamp: Date.now() });
    logger.info(`Created game session for channel ${channelId}: ${game}`);
  }

  private setupServer() {
    // Basic middleware
    this.app.use(cors({
      origin: true,
      credentials: true
    }));
    
    this.app.use(express.json());

    // Main route for Discord activities - serves the router
    this.app.get('/', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'public/games/activity-router.html'));
    });
    
    // Static game assets — covers embed pages and doom/ (wasm engine + WAD)
    this.app.use('/games', express.static(path.join(process.cwd(), 'public/games')));

    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok' });
    });
    
    // API endpoint to get game session
    this.app.get('/api/game-session', (req, res) => {
      // Try to get channel ID from referer
      const referer = req.headers.referer || '';
      const channelMatch = referer.match(/channels\/\d+\/(\d+)/);
      
      if (channelMatch) {
        const channelId = channelMatch[1];
        const session = this.gameSessions.get(channelId);
        if (session) {
          res.json({ game: session.game });
          return;
        }
      }
      
      res.json({ game: null });
    });

    // Config endpoint
    this.app.get('/discord-sdk-config', (_req, res) => {
      const clientId = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
      res.json({
        clientId: clientId,
        scope: ['identify', 'guilds', 'applications.commands']
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          attachHexZap(this.server!);
          logger.info(`Embedded app server running on port ${this.port}`);
          resolve();
        });
      } catch (error) {
        logger.error('Failed to start embedded app server:', error);
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Embedded app server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getUrl(): string {
    return process.env.PUBLIC_URL || `http://localhost:${this.port}`;
  }
}

// Create singleton instance
export const embeddedAppServer = new EmbeddedAppServer(
  parseInt(process.env.EMBEDDED_APP_PORT || '3000')
);