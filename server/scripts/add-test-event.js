import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

// Function to add a test event for testing HT functionality
async function addTestHalftimeEvent() {
  try {
    // Path to the heartbeat state file
    const heartbeatFile = join('/home/runner/workspace/data', 'heartbeat-state.json');
    
    // Check if file exists
    if (!existsSync(heartbeatFile)) {
      console.error('Heartbeat state file not found');
      return;
    }
    
    // Read the current state
    const data = JSON.parse(readFileSync(heartbeatFile, 'utf8'));
    
    // Check if the event already exists
    const existingEvent = data.events.find(e => e.id === '26970588');
    if (existingEvent) {
      console.log('Event already exists, updating to HT...');
      existingEvent.gameMinute = 'HT';
      existingEvent.currentlyAvailable = true;
      existingEvent.suspended = false;
    } else {
      // Add a test event with halftime status
      const testEvent = {
        id: '26970588',
        name: 'Test Match - Halftime',
        country: 'International',
        tournament: 'Test Tournament',
        isInPlay: true,
        startTime: new Date().toISOString(),
        currentlyAvailable: true,
        marketAvailability: 'ACTIVE',
        recordCount: 1,
        gameMinute: 'HT',
        widgetId: '26970588',
        homeTeam: 'Home Team',
        awayTeam: 'Away Team',
        homeScore: 1,
        awayScore: 1,
        totalMarketCount: 1,
        suspended: false,
        lastSeen: Date.now()
      };
      
      // Add to the events array
      data.events.push(testEvent);
      console.log('Added test event with ID 26970588 and gameMinute HT');
    }
    
    // Write the updated state back to the file
    writeFileSync(heartbeatFile, JSON.stringify(data, null, 2));
    console.log('Successfully updated heartbeat state');
    
  } catch (error) {
    console.error('Error adding test event:', error);
  }
}

// Run the function
addTestHalftimeEvent();