import express from 'express';
import cors from 'cors';
import path from 'path';
import { logger } from '../utils/logger';
import http from 'http';

export class EmbeddedAppServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Simple CORS for Discord activities
    this.app.use(cors({
      origin: true, // Allow all origins for now
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    
    this.app.use(express.json());
    
    // Temporarily disable static serving to debug
    // const publicPath = path.join(process.cwd(), 'public');
    // this.app.use(express.static(publicPath));
  }

  private setupRoutes() {
    // Request logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} from ${req.headers.origin || 'unknown'}`);
      next();
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Game endpoints
    this.app.get('/games/:gameId', (req, res) => {
      const { gameId } = req.params;
      const gamePath = path.join(process.cwd(), 'public/games', `${gameId}.html`);
      
      logger.info(`Serving game: ${gameId} from ${gamePath}`);
      
      // Check if file exists
      const fs = require('fs');
      if (!fs.existsSync(gamePath)) {
        logger.error(`Game file not found: ${gamePath}`);
        res.status(404).send('Game not found');
        return;
      }
      
      res.sendFile(gamePath, (err) => {
        if (err) {
          logger.error(`Error serving game file:`, err);
          res.status(500).send('Error loading game');
        }
      });
    });

    // Discord SDK configuration endpoint
    this.app.get('/discord-sdk-config', (req, res) => {
      const clientId = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
      logger.info(`Serving Discord SDK config with client ID: ${clientId}`);
      
      res.json({
        clientId: clientId,
        scope: ['identify', 'guilds', 'applications.commands']
      });
    });
    
    // Catch-all for debugging
    this.app.get('*', (req, res) => {
      logger.warn(`Unhandled request: ${req.path}`);
      res.status(404).send('Not found');
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`Embedded app server running on port ${this.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
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
    // Use PUBLIC_URL if set (for production), otherwise use localhost
    return process.env.PUBLIC_URL || `http://localhost:${this.port}`;
  }
}

// Singleton instance - temporarily disabled for debugging
// export const embeddedAppServer = new EmbeddedAppServer(
//   parseInt(process.env.EMBEDDED_APP_PORT || '3000')
// );

// Temporary export to prevent import errors
export const embeddedAppServer = {
  start: async () => console.log('Embedded app server disabled'),
  stop: async () => {},
  getUrl: () => 'http://localhost:3000'
};