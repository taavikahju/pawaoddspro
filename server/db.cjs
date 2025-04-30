const { Pool } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const ws = require('ws');
const schema = require('../shared/schema.cjs');

// Configure Neon DB to use websockets
if (typeof neonConfig !== 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

// Check for database connection string
if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL not set, database features will not work');
}

// Create connection pool
const pool = process.env.DATABASE_URL 
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

// Create drizzle instance
const db = pool 
  ? drizzle({ client: pool, schema })
  : null;

module.exports = { 
  pool,
  db
};