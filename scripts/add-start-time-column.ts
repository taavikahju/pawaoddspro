import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Adding start_time column to events table...');

  try {
    // Check if column already exists to avoid errors
    const columnExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'start_time'
      );
    `);

    if (columnExists.rows?.[0]?.exists === true) {
      console.log('Column start_time already exists in events table. Skipping...');
    } else {
      // Add the column
      await db.execute(sql`
        ALTER TABLE events 
        ADD COLUMN start_time TIMESTAMP;
      `);
      
      console.log('Column start_time added successfully.');
      
      // Update existing records to populate start_time based on date and time fields
      console.log('Updating existing records...');
      await db.execute(sql`
        UPDATE events
        SET start_time = (date || ' ' || time)::TIMESTAMP
        WHERE start_time IS NULL;
      `);
      
      console.log('Existing records updated with start_time values.');
    }
    
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();