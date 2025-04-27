// Simple test script for the SportyBet wrapper
const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Testing SportyBet wrapper...');
  const output = execSync('node ./server/scrapers/custom/sporty_scraper_wrapper.cjs', { 
    timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  const data = JSON.parse(output.toString());
  console.log(`✅ SportyBet wrapper returned ${data.length} events`);
  
  // Check if it's sample data or real data
  if (data.length > 0 && data[0].id && data[0].id.startsWith('sporty-event')) {
    console.log('⚠️ Using sample fallback data');
  } else if (data.length > 0) {
    console.log('✅ Using real SportyBet data');
  } else {
    console.log('❌ No events returned');
  }
  
  // Sample the first 3 events to understand the data
  if (data.length > 0) {
    console.log('\nFirst 3 events:');
    for (let i = 0; i < Math.min(3, data.length); i++) {
      console.log(`Event ${i+1}:`, JSON.stringify(data[i], null, 2));
    }
  }
} catch (error) {
  console.error('❌ Error running the SportyBet wrapper:', error.message);
}