import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { config } from '../config/config';
import { logger } from '../utils/logger';

async function addGuildColumns() {
  const dbPath = path.resolve(config.databasePath);
  const db = new sqlite3.Database(dbPath);
  
  const run = promisify(db.run.bind(db));
  const all = promisify(db.all.bind(db));
  
  try {
    logger.info('Checking and adding guild_id columns...');
    
    // Check if guild_id column exists in redeemable_roles
    const rolesColumns = await all(`PRAGMA table_info(redeemable_roles)`) as any[];
    const hasGuildIdInRoles = rolesColumns.some((col: any) => col.name === 'guild_id');
    
    if (!hasGuildIdInRoles) {
      logger.info('Adding guild_id column to redeemable_roles table...');
      
      // Create a new table with the correct schema
      await run(`
        CREATE TABLE IF NOT EXISTS redeemable_roles_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          role_id TEXT NOT NULL,
          role_name TEXT NOT NULL,
          role_type TEXT NOT NULL CHECK(role_type IN ('band', 'team')),
          description TEXT,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(guild_id, role_id)
        )
      `);
      
      // Copy data from old table if it exists (with a default guild_id)
      const defaultGuildId = process.env.DEFAULT_GUILD_ID || 'default';
      await run(`
        INSERT OR IGNORE INTO redeemable_roles_new (guild_id, role_id, role_name, role_type, description, is_active, created_at)
        SELECT '${defaultGuildId}', role_id, role_name, role_type, description, is_active, created_at
        FROM redeemable_roles
      `).catch(() => {
        logger.info('No existing data to migrate in redeemable_roles');
      });
      
      // Drop old table and rename new one
      await run(`DROP TABLE IF EXISTS redeemable_roles`);
      await run(`ALTER TABLE redeemable_roles_new RENAME TO redeemable_roles`);
      
      logger.info('✅ Added guild_id to redeemable_roles table');
    } else {
      logger.info('guild_id column already exists in redeemable_roles');
    }
    
    // Check if guild_id column exists in user_roles
    const userRolesColumns = await all(`PRAGMA table_info(user_roles)`) as any[];
    const hasGuildIdInUserRoles = userRolesColumns.some((col: any) => col.name === 'guild_id');
    
    if (!hasGuildIdInUserRoles) {
      logger.info('Adding guild_id column to user_roles table...');
      
      // Create a new table with the correct schema
      await run(`
        CREATE TABLE IF NOT EXISTS user_roles_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role_id TEXT NOT NULL,
          redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id),
          UNIQUE(guild_id, user_id, role_id)
        )
      `);
      
      // Copy data from old table if it exists
      const defaultGuildId = process.env.DEFAULT_GUILD_ID || 'default';
      await run(`
        INSERT OR IGNORE INTO user_roles_new (guild_id, user_id, role_id, redeemed_at)
        SELECT '${defaultGuildId}', user_id, role_id, redeemed_at
        FROM user_roles
      `).catch(() => {
        logger.info('No existing data to migrate in user_roles');
      });
      
      // Drop old table and rename new one
      await run(`DROP TABLE IF EXISTS user_roles`);
      await run(`ALTER TABLE user_roles_new RENAME TO user_roles`);
      
      logger.info('✅ Added guild_id to user_roles table');
    } else {
      logger.info('guild_id column already exists in user_roles');
    }
    
    logger.info('✅ Database migration completed successfully!');
    
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run migration
addGuildColumns().catch(error => {
  logger.error('Unexpected error:', error);
  process.exit(1);
});