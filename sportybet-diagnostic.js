import fs from 'fs';

async function analyzeData() {
  try {
    // Load the Sportybet data file
    console.log('Loading sportybet_output.json for analysis...');
    const rawData = await fs.promises.readFile('sportybet_output.json', 'utf8');
    const sportyData = JSON.parse(rawData);
    
    if (!Array.isArray(sportyData)) {
      console.error('ERROR: Data is not an array. Format:', typeof sportyData);
      return;
    }
    
    console.log(`Total events in file: ${sportyData.length}`);
    
    // Check for valid events with odds
    const eventsWithOdds = sportyData.filter(event => {
      // Check direct odds property
      if (event.odds && (event.odds.home > 0 || event.odds.draw > 0 || event.odds.away > 0)) {
        return true;
      }
      
      // Check separate odds properties
      if ((event.home_odds && parseFloat(event.home_odds) > 0) || 
          (event.draw_odds && parseFloat(event.draw_odds) > 0) || 
          (event.away_odds && parseFloat(event.away_odds) > 0)) {
        return true;
      }
      
      // Check raw data
      if (event.raw && 
          ((event.raw.home_odds && parseFloat(event.raw.home_odds) > 0) || 
           (event.raw.draw_odds && parseFloat(event.raw.draw_odds) > 0) || 
           (event.raw.away_odds && parseFloat(event.raw.away_odds) > 0))) {
        return true;
      }
      
      return false;
    });
    
    console.log(`Events with valid odds: ${eventsWithOdds.length}`);
    
    // Check for event uniqueness by ID
    const eventIds = new Set();
    const eventsByEventId = {};
    
    sportyData.forEach(event => {
      const eventId = event.eventId || event.id;
      
      if (eventId) {
        if (!eventsByEventId[eventId]) {
          eventsByEventId[eventId] = [];
        }
        eventsByEventId[eventId].push(event);
        eventIds.add(eventId);
      }
    });
    
    console.log(`Unique event IDs: ${eventIds.size}`);
    
    // Check for duplicate events
    const duplicateEvents = Object.keys(eventsByEventId).filter(id => eventsByEventId[id].length > 1);
    
    if (duplicateEvents.length > 0) {
      console.log(`Found ${duplicateEvents.length} event IDs with duplicates`);
      
      // Show a sample of duplicate events
      const sampleId = duplicateEvents[0];
      console.log(`\nSample of duplicate events for ID ${sampleId}:`);
      eventsByEventId[sampleId].forEach((event, index) => {
        console.log(`Duplicate ${index + 1}:`, event);
      });
    }
    
    // Check if the data is being modified or corrupted
    console.log('\nChecking for data corruption or modification...');
    
    // Make a temporary copy to isolate potential issues
    const tempFile = 'sportybet_temp_copy.json';
    await fs.promises.writeFile(tempFile, JSON.stringify(sportyData));
    
    // Load it back and compare
    const reloadedData = JSON.parse(await fs.promises.readFile(tempFile, 'utf8'));
    const reloadedEventsWithOdds = reloadedData.filter(event => {
      // Check direct odds property
      if (event.odds && (event.odds.home > 0 || event.odds.draw > 0 || event.odds.away > 0)) {
        return true;
      }
      
      // Check separate odds properties
      if ((event.home_odds && parseFloat(event.home_odds) > 0) || 
          (event.draw_odds && parseFloat(event.draw_odds) > 0) || 
          (event.away_odds && parseFloat(event.away_odds) > 0)) {
        return true;
      }
      
      // Check raw data
      if (event.raw && 
          ((event.raw.home_odds && parseFloat(event.raw.home_odds) > 0) || 
           (event.raw.draw_odds && parseFloat(event.raw.draw_odds) > 0) || 
           (event.raw.away_odds && parseFloat(event.raw.away_odds) > 0))) {
        return true;
      }
      
      return false;
    });
    
    // Delete the temporary file
    await fs.promises.unlink(tempFile);
    
    if (reloadedEventsWithOdds.length === eventsWithOdds.length) {
      console.log('✓ Data integrity check passed: Same number of events with odds after reload');
    } else {
      console.log(`⚠ Data integrity issue: Original had ${eventsWithOdds.length} events with odds, reloaded has ${reloadedEventsWithOdds.length}`);
    }
    
    // Sample some events
    console.log('\nSample of 3 events with valid odds:');
    eventsWithOdds.slice(0, 3).forEach((event, i) => {
      console.log(`Event ${i + 1}:`, JSON.stringify(event, null, 2));
    });
    
  } catch (error) {
    console.error('Error analyzing data:', error);
  }
}

analyzeData();