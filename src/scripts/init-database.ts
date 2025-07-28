import { database } from '../services/database';
import { logger } from '../utils/logger';

async function initDatabase() {
  try {
    logger.info('Initializing database...');
    
    // This will create all tables if they don't exist
    await database.initialize();
    
    logger.info('✅ Database initialized successfully!');
    logger.info('All tables have been created or verified.');
    
    process.exit(0);
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

// Run initialization
initDatabase().catch(error => {
  logger.error('Unexpected error:', error);
  process.exit(1);
});