import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function resetDatabase() {
  const dbPath = path.resolve(config.databasePath);
  const db = new sqlite3.Database(dbPath);
  
  const run = promisify(db.run.bind(db));
  const all = promisify(db.all.bind(db));
  
  try {
    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will DELETE ALL DATA in the database!');
    console.log('This action cannot be undone.\n');
    
    const answer = await question('Are you sure you want to continue? Type "yes" to confirm: ');
    
    if (answer.toLowerCase() !== 'yes') {
      logger.info('Database reset cancelled.');
      process.exit(0);
    }
    
    logger.info('Starting database reset...');
    
    // Get all table names
    const tables = await all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `) as any[];
    
    // Drop all tables
    for (const table of tables) {
      logger.info(`Dropping table: ${table.name}`);
      await run(`DROP TABLE IF EXISTS ${table.name}`);
    }
    
    logger.info('✅ All tables dropped successfully!');
    logger.info('Run "npm run db:init" to recreate the tables.');
    
  } catch (error) {
    logger.error('Reset failed:', error);
    process.exit(1);
  } finally {
    rl.close();
    db.close();
  }
}

// Run reset
resetDatabase().catch(error => {
  logger.error('Unexpected error:', error);
  process.exit(1);
});