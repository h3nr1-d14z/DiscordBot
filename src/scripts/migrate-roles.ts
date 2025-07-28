import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { config } from '../config/config';
import { logger } from '../utils/logger';

async function migrateRoles() {
  const dbPath = path.resolve(config.databasePath);
  const db = new sqlite3.Database(dbPath);
  
  const run = promisify(db.run.bind(db));
  const all = promisify(db.all.bind(db));
  
  try {
    // Check if we have any roles without guild_id
    const oldRoles = await all(`
      SELECT * FROM redeemable_roles 
      WHERE guild_id IS NULL OR guild_id = ''
    `) as any[];
    
    if (oldRoles.length === 0) {
      logger.info('No roles to migrate. All roles already have guild_id.');
      return;
    }
    
    logger.info(`Found ${oldRoles.length} roles to migrate.`);
    
    // Get the default guild ID from environment or prompt user
    const defaultGuildId = process.env.DEFAULT_GUILD_ID;
    
    if (!defaultGuildId) {
      logger.error('Please set DEFAULT_GUILD_ID environment variable to migrate roles.');
      logger.error('Example: DEFAULT_GUILD_ID=1234567890 npm run migrate-roles');
      process.exit(1);
    }
    
    logger.info(`Migrating roles to guild ID: ${defaultGuildId}`);
    
    // Update all roles with the default guild ID
    await run(`
      UPDATE redeemable_roles 
      SET guild_id = ? 
      WHERE guild_id IS NULL OR guild_id = ''
    `, [defaultGuildId]);
    
    logger.info('✅ Role migration completed successfully!');
    
    // Also migrate user_roles
    const userRoles = await all(`
      SELECT * FROM user_roles 
      WHERE guild_id IS NULL OR guild_id = ''
    `) as any[];
    
    if (userRoles.length > 0) {
      logger.info(`Found ${userRoles.length} user roles to migrate.`);
      
      await run(`
        UPDATE user_roles 
        SET guild_id = ? 
        WHERE guild_id IS NULL OR guild_id = ''
      `, [defaultGuildId]);
      
      logger.info('✅ User role migration completed successfully!');
    }
    
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run migration
migrateRoles().catch(error => {
  logger.error('Unexpected error:', error);
  process.exit(1);
});