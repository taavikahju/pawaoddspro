import { db, pool } from '../server/db';
import { sql } from 'drizzle-orm';

async function updateHeartbeatStatsTable() {
  try {
    console.log('Updating timestamp column to BIGINT in heartbeat_stats table...');
    
    // Alter the table to change the timestamp column to BIGINT
    await db.execute(sql`
      ALTER TABLE heartbeat_stats 
      ALTER COLUMN timestamp TYPE BIGINT
    `);
    
    console.log('Successfully updated heartbeat_stats table timestamp column to BIGINT');
    process.exit(0);
  } catch (error) {
    console.error('Failed to update heartbeat_stats table:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateHeartbeatStatsTable();