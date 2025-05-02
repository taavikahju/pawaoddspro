import axios from 'axios';

async function scrapeBet9jaData() {
  console.log('Attempting to scrape Bet9ja football data...');
  
  // Potential API endpoints to test
  const endpoints = [
    // Main website
    { 
      url: 'https://sports.bet9ja.com/', 
      method: 'GET',
      description: 'Main website (checking for XHR requests in HTML)'
    },
    
    // Direct API attempts
    { 
      url: 'https://sports.bet9ja.com/api/sports', 
      method: 'GET',
      description: 'Sports API endpoint'
    },
    { 
      url: 'https://sports.bet9ja.com/api/football/events', 
      method: 'GET',
      description: 'Football events API endpoint'
    },
    { 
      url: 'https://sports.bet9ja.com/api/upcoming', 
      method: 'GET',
      description: 'Upcoming events API endpoint'
    },
    { 
      url: 'https://sports.bet9ja.com/api/prematch', 
      method: 'GET',
      description: 'Prematch events API endpoint'
    },
    
    // Trying different domains
    { 
      url: 'https://api.bet9ja.com/sports', 
      method: 'GET',
      description: 'API subdomain - sports'
    },
    { 
      url: 'https://api.bet9ja.com/events', 
      method: 'GET',
      description: 'API subdomain - events'
    },
    
    // Trying internal URLs found in the bundle
    { 
      url: 'https://sports.bet9ja.com/feed/odds', 
      method: 'GET',
      description: 'Feed odds endpoint'
    },
    { 
      url: 'https://sports.bet9ja.com/feed/events', 
      method: 'GET',
      description: 'Feed events endpoint'
    },
    { 
      url: 'https://sports.bet9ja.com/events/api', 
      method: 'GET',
      description: 'Events API endpoint'
    },
    
    // Trying common patterns for betting sites
    { 
      url: 'https://sports.bet9ja.com/sports/football', 
      method: 'GET',
      description: 'Football section - checking for XHR requests'
    },
    {
      url: 'https://sports.bet9ja.com/mobile-api/sports', 
      method: 'GET',
      description: 'Mobile API - sports'
    },
    {
      url: 'https://sports.bet9ja.com/mobile-api/events', 
      method: 'GET',
      description: 'Mobile API - events'
    },
    
    // Third-party APIs they might be using
    {
      url: 'https://feed-api.bet9ja.com/events',
      method: 'GET',
      description: 'External feed API for events'
    },
    {
      url: 'https://feed.bet9ja.com/odds',
      method: 'GET',
      description: 'External feed for odds' 
    }
  ];
  
  // Headers to mimic a browser
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://sports.bet9ja.com/',
    'Origin': 'https://sports.bet9ja.com'
  };
  
  // Try each endpoint
  for (const endpoint of endpoints) {
    try {
      console.log(`\nTesting endpoint: ${endpoint.url} (${endpoint.description})`);
      
      const response = await axios({
        method: endpoint.method,
        url: endpoint.url,
        headers,
        timeout: 10000 // 10 seconds timeout
      });
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`Content-Type: ${response.headers['content-type'] || 'Not specified'}`);
      
      // Check if response is JSON
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('json')) {
        console.log('Response is JSON');
        // Print a sample of the response
        console.log('Sample data:', JSON.stringify(response.data).substring(0, 150) + '...');
        
        // Check if the response contains useful data
        if (typeof response.data === 'object') {
          const hasEvents = JSON.stringify(response.data).includes('event') || 
                           JSON.stringify(response.data).includes('match');
          const hasOdds = JSON.stringify(response.data).includes('odd') || 
                         JSON.stringify(response.data).includes('price');
          const hasFootball = JSON.stringify(response.data).includes('football') || 
                             JSON.stringify(response.data).includes('soccer');
          
          if (hasEvents || hasOdds || hasFootball) {
            console.log('✨ Endpoint contains useful data (events, odds, or football references)');
          }
        }
      } else if (contentType.includes('html')) {
        console.log('Response is HTML');
        
        // Check for interesting elements in the HTML
        const hasAjaxCalls = response.data.includes('ajax(') || 
                            response.data.includes('fetch(') || 
                            response.data.includes('axios');
        const hasApiUrls = response.data.includes('/api/') || 
                          response.data.includes('apiUrl') || 
                          response.data.includes('endpoint');
        const hasWebsocket = response.data.includes('WebSocket') || 
                            response.data.includes('socket.io');
        
        if (hasAjaxCalls) console.log('✨ HTML contains AJAX/fetch calls');
        if (hasApiUrls) console.log('✨ HTML contains API URLs or endpoints');
        if (hasWebsocket) console.log('✨ HTML contains WebSocket references');
        
        // Extract scripts that might contain API calls
        const scriptRegex = /<script[^>]*src=["']([^"']*\.js[^"']*)["'][^>]*>/g;
        const scripts = [];
        let match;
        
        while ((match = scriptRegex.exec(response.data)) !== null) {
          scripts.push(match[1]);
        }
        
        if (scripts.length > 0) {
          console.log(`Found ${scripts.length} script files that might contain API calls:`);
          scripts.forEach(script => {
            // Handle relative URLs
            if (script.startsWith('/')) {
              script = new URL(script, endpoint.url).toString();
            } else if (!script.startsWith('http')) {
              script = new URL(script, endpoint.url).toString();
            }
            console.log(`- ${script}`);
          });
        }
      } else {
        console.log(`Response has unknown format: ${contentType}`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`Status: ${error.response.status}`);
      }
    }
  }
}

scrapeBet9jaData().catch(console.error);