import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './shared/schema';

// Required for Neon serverless
neonConfig.webSocketConstructor = ws;

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  console.log('Creating connection pool...');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  console.log('Running migrations...');
  
  try {
    await db.execute(/* sql */`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS bookmakers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        active BOOLEAN NOT NULL DEFAULT true,
        last_scrape TIMESTAMP,
        next_scrape TIMESTAMP,
        events_scraped INTEGER DEFAULT 0,
        file_size TEXT DEFAULT '0 KB'
      );
      
      CREATE TABLE IF NOT EXISTS sports (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        active BOOLEAN NOT NULL DEFAULT true
      );
      
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        external_id TEXT NOT NULL UNIQUE,
        teams TEXT NOT NULL,
        league TEXT NOT NULL,
        sport_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        odds_data JSONB NOT NULL,
        best_odds JSONB NOT NULL,
        last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Database tables created successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  await pool.end();
  console.log('Migration completed!');
}

runMigration().catch(console.error);