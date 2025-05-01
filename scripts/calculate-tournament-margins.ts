import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { storage } from '../server/storage';
import { calculateAndStoreTournamentMargins } from '../server/utils/tournamentMargins';

async function main() {
  try {
    console.log('Starting manual tournament margin calculation...');
    
    // Clear existing tournament margins
    console.log('Clearing existing tournament margins...');
    await db.execute(sql`DELETE FROM tournament_margins`);
    
    // Calculate new tournament margins
    console.log('Calculating tournament margins...');
    await calculateAndStoreTournamentMargins(storage);
    
    console.log('Tournament margins calculation completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error calculating tournament margins:', error);
    process.exit(1);
  }
}

main();