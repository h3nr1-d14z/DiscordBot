import { 
  ChatInputCommandInteraction,
  Collection
} from 'discord.js';

export interface BotCommand {
  data: any; // Using any for now due to Discord.js type complexities
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  cooldown?: number;
  category: CommandCategory;
}

export interface BotEvent {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => void | Promise<void>;
}

export enum CommandCategory {
  Fun = 'fun',
  Games = 'games',
  Moderation = 'moderation',
}

export interface User {
  userId: string;
  username: string;
  xp: number;
  level: number;
  createdAt: Date;
}

export interface GameStats {
  id?: number;
  userId: string;
  gameType: string;
  wins: number;
  losses: number;
  draws: number;
  highScore: number;
}

export interface ActiveGame {
  gameId: string;
  gameType: GameType;
  channelId: string;
  players: string[];
  gameState: any;
  createdAt: Date;
}

export enum GameType {
  TicTacToe = 'tictactoe',
  RockPaperScissors = 'rps',
  ConnectFour = 'connect4',
  NumberGuess = 'numberguess',
  WordChain = 'wordchain',
  TwoZeroFourEight = '2048',
  Hangman = 'hangman',
  Memory = 'memory',
  Snake = 'snake',
}

export interface GameResult {
  winner?: string;
  loser?: string;
  isDraw?: boolean;
  score?: number;
  xpReward: number;
}

export interface CooldownData {
  timestamps: Collection<string, number>;
  defaultCooldown: number;
}
export interface Config {
  token: string;
  clientId: string;
  guildId?: string;
  guildIds: string[];
  databasePath: string;
  weatherApiKey?: string;
  tunnelToken?: string;
  enableLeveling: boolean;
  defaultPrefix: string;
  port: number;
  webhookPath: string;
}