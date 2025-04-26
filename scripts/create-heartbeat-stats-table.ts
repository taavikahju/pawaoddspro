import { db, pool } from '../server/db';
import { heartbeatStats } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function createHeartbeatStatsTable() {
  try {
    console.log('Creating heartbeat_stats table...');
    
    // Use SQL directly to ensure the table is created with our schema
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS heartbeat_stats (
        id SERIAL PRIMARY KEY,
        event_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        uptime_percentage INTEGER NOT NULL,
        available_duration_minutes INTEGER NOT NULL,
        suspended_duration_minutes INTEGER NOT NULL,
        total_duration_minutes INTEGER NOT NULL,
        day TEXT,
        week TEXT,
        month TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('Successfully created heartbeat_stats table');
    process.exit(0);
  } catch (error) {
    console.error('Failed to create heartbeat_stats table:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createHeartbeatStatsTable();