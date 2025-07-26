import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { User, GameStats, ActiveGame } from '../types';

export class Database {
  private db: sqlite3.Database;
  private run: (sql: string, params?: any[]) => Promise<void>;
  private get: (sql: string, params?: any[]) => Promise<any>;
  private all: (sql: string, params?: any[]) => Promise<any[]>;

  constructor() {
    const dbPath = path.resolve(config.databasePath);
    this.db = new sqlite3.Database(dbPath);
    
    this.run = promisify(this.db.run.bind(this.db));
    this.get = promisify(this.db.get.bind(this.db));
    this.all = promisify(this.db.all.bind(this.db));
  }

  async initialize(): Promise<void> {
    try {
      await this.createTables();
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const queries = [
      `CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        balance INTEGER DEFAULT 100,
        daily_streak INTEGER DEFAULT 0,
        last_daily DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS game_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        game_type TEXT NOT NULL,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        high_score INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS active_games (
        game_id TEXT PRIMARY KEY,
        game_type TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        players TEXT NOT NULL,
        game_state TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )`,

      'CREATE INDEX IF NOT EXISTS idx_user_id ON game_stats(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_game_type ON game_stats(game_type)',
      'CREATE INDEX IF NOT EXISTS idx_channel_id ON active_games(channel_id)',
    ];

    for (const query of queries) {
      await this.run(query);
    }
  }

  async getUser(userId: string): Promise<User | null> {
    const row = await this.get('SELECT * FROM users WHERE user_id = ?', [userId]);
    return row ? this.mapRowToUser(row) : null;
  }

  async createUser(userId: string, username: string): Promise<User> {
    await this.run(
      'INSERT INTO users (user_id, username) VALUES (?, ?)',
      [userId, username]
    );
    return this.getUser(userId) as Promise<User>;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const fields = Object.keys(updates)
      .map(key => `${this.camelToSnake(key)} = ?`)
      .join(', ');
    const values = Object.values(updates);
    values.push(userId);
    
    await this.run(
      `UPDATE users SET ${fields} WHERE user_id = ?`,
      values
    );
  }

  async getGameStats(userId: string, gameType: string): Promise<GameStats | null> {
    const row = await this.get(
      'SELECT * FROM game_stats WHERE user_id = ? AND game_type = ?',
      [userId, gameType]
    );
    return row ? this.mapRowToGameStats(row) : null;
  }

  async updateGameStats(userId: string, gameType: string, stats: Partial<GameStats>): Promise<void> {
    const existing = await this.getGameStats(userId, gameType);
    
    if (existing) {
      const fields = Object.keys(stats)
        .map(key => `${this.camelToSnake(key)} = ?`)
        .join(', ');
      const values = Object.values(stats);
      values.push(userId, gameType);
      
      await this.run(
        `UPDATE game_stats SET ${fields} WHERE user_id = ? AND game_type = ?`,
        values
      );
    } else {
      await this.run(
        'INSERT INTO game_stats (user_id, game_type, wins, losses, draws, high_score) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, gameType, stats.wins || 0, stats.losses || 0, stats.draws || 0, stats.highScore || 0]
      );
    }
  }

  async getActiveGame(gameId: string): Promise<ActiveGame | null> {
    const row = await this.get('SELECT * FROM active_games WHERE game_id = ?', [gameId]);
    return row ? this.mapRowToActiveGame(row) : null;
  }

  async createActiveGame(game: ActiveGame): Promise<void> {
    await this.run(
      'INSERT INTO active_games (game_id, game_type, channel_id, players, game_state) VALUES (?, ?, ?, ?, ?)',
      [game.gameId, game.gameType, game.channelId, JSON.stringify(game.players), JSON.stringify(game.gameState)]
    );
  }

  async updateActiveGame(gameId: string, gameState: any): Promise<void> {
    await this.run(
      'UPDATE active_games SET game_state = ? WHERE game_id = ?',
      [JSON.stringify(gameState), gameId]
    );
  }

  async deleteActiveGame(gameId: string): Promise<void> {
    await this.run('DELETE FROM active_games WHERE game_id = ?', [gameId]);
  }

  async getLeaderboard(limit: number = 10): Promise<User[]> {
    const rows = await this.all(
      'SELECT * FROM users ORDER BY level DESC, xp DESC LIMIT ?',
      [limit]
    );
    return rows.map(row => this.mapRowToUser(row));
  }

  async addTransaction(userId: string, amount: number, type: string, description: string): Promise<void> {
    await this.run(
      'INSERT INTO transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
      [userId, amount, type, description]
    );
  }

  private mapRowToUser(row: any): User {
    return {
      userId: row.user_id,
      username: row.username,
      xp: row.xp,
      level: row.level,
      balance: row.balance,
      dailyStreak: row.daily_streak,
      lastDaily: row.last_daily ? new Date(row.last_daily) : null,
      createdAt: new Date(row.created_at),
    };
  }

  private mapRowToGameStats(row: any): GameStats {
    return {
      id: row.id,
      userId: row.user_id,
      gameType: row.game_type,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      highScore: row.high_score,
    };
  }

  private mapRowToActiveGame(row: any): ActiveGame {
    return {
      gameId: row.game_id,
      gameType: row.game_type,
      channelId: row.channel_id,
      players: JSON.parse(row.players),
      gameState: JSON.parse(row.game_state),
      createdAt: new Date(row.created_at),
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export const database = new Database();