import fs from 'fs/promises';

async function findBet9jaAPIs() {
  try {
    console.log('Examining Bet9ja JavaScript bundle for API endpoints...');
    
    // Read the saved bundle
    const bundleContent = await fs.readFile('bet9ja-bundle.js', 'utf8');
    
    // Create a simpler version without most whitespace for better pattern matching
    const simplifiedContent = bundleContent
      .replace(/\\n/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\r/g, ' ');
    
    console.log(`Loaded and simplified ${bundleContent.length} bytes of JavaScript`);
    
    // Search for URL patterns
    console.log('\nSearching for URL patterns...');
    
    // Look for URLs with specific keywords
    const urlKeywords = [
      'api', 'feed', 'data', 'json', 'events', 'sports', 'football', 'soccer', 
      'matches', 'odds', 'live', 'upcoming', 'prematch', 'fixture'
    ];
    
    const urlMatches = new Set();
    
    for (const keyword of urlKeywords) {
      // Look for URLs containing the keyword
      const pattern = new RegExp(`["']https?://[^"']+${keyword}[^"']*["']`, 'g');
      const matches = simplifiedContent.match(pattern) || [];
      
      matches.forEach(match => {
        // Clean up the match
        const url = match.replace(/^["']|["']$/g, '');
        urlMatches.add(url);
      });
    }
    
    if (urlMatches.size > 0) {
      console.log(`Found ${urlMatches.size} URLs with API-related keywords:`);
      [...urlMatches].forEach(url => {
        console.log(`- ${url}`);
      });
    } else {
      console.log('No direct API URLs found');
    }
    
    // Look for specific strings related to API data
    console.log('\nSearching for specific API-related strings...');
    
    const apiStrings = [
      'apiURL', 'API_URL', 'api_url', 'apiUrl', 'baseUrl', 'BASE_URL', 'base_url',
      'endpoint', 'ENDPOINT', 'apiEndpoint', 'API_ENDPOINT', 'data_source', 'DATA_SOURCE',
      'oddsApi', 'ODDS_API', 'eventsApi', 'EVENTS_API', 'matchesApi', 'MATCHES_API',
      'sportsApi', 'SPORTS_API', 'footballApi', 'FOOTBALL_API'
    ];
    
    for (const apiString of apiStrings) {
      // Look for assignments to these variables
      const pattern = new RegExp(`${apiString}\\s*=\\s*["'][^"']+["']`, 'g');
      const matches = simplifiedContent.match(pattern) || [];
      
      if (matches.length > 0) {
        console.log(`\nFound ${matches.length} assignments to "${apiString}":`);
        matches.forEach(match => {
          console.log(`- ${match}`);
        });
      }
    }
    
    // Look for JSON data structures that might contain API info
    console.log('\nSearching for JSON structures with API information...');
    
    // Extract potential JSON objects containing API URLs
    const jsonPatterns = [
      /{[^{}]*url[^{}]*:[^{}]*http[^{}]*}/gi,
      /{[^{}]*api[^{}]*:[^{}]*http[^{}]*}/gi,
      /{[^{}]*endpoint[^{}]*:[^{}]*http[^{}]*}/gi
    ];
    
    const jsonMatches = new Set();
    
    for (const pattern of jsonPatterns) {
      const matches = simplifiedContent.match(pattern) || [];
      matches.forEach(match => jsonMatches.add(match));
    }
    
    if (jsonMatches.size > 0) {
      console.log(`Found ${jsonMatches.size} JSON structures that might contain API information:`);
      [...jsonMatches].slice(0, 20).forEach(json => {
        console.log(`- ${json}`);
      });
      
      if (jsonMatches.size > 20) {
        console.log(`  ... and ${jsonMatches.size - 20} more`);
      }
    }
    
    // Check for specific API client initialization
    console.log('\nLooking for API client initialization...');
    
    const clientPatterns = [
      /new\s+ApiClient\([^)]*\)/g,
      /createApiClient\([^)]*\)/g,
      /initApi\([^)]*\)/g,
      /setupApi\([^)]*\)/g,
      /configureApi\([^)]*\)/g
    ];
    
    const clientMatches = new Set();
    
    for (const pattern of clientPatterns) {
      const matches = simplifiedContent.match(pattern) || [];
      matches.forEach(match => clientMatches.add(match));
    }
    
    if (clientMatches.size > 0) {
      console.log(`Found ${clientMatches.size} API client initializations:`);
      [...clientMatches].forEach(client => {
        console.log(`- ${client}`);
      });
    }
    
    // Extract all URLs with full domain names
    console.log('\nLooking for all URLs in the bundle...');
    
    const domains = ['bet9ja.com', 'betagy.com', 'betgames.tv', 'lsports.eu', 'sportty.io', 'sportradar.com'];
    const domainMatches = new Set();
    
    for (const domain of domains) {
      const pattern = new RegExp(`https?://[^"'\\s]+\\.${domain.replace('.', '\\.')}[^"'\\s]*`, 'g');
      const matches = simplifiedContent.match(pattern) || [];
      matches.forEach(match => domainMatches.add(match));
    }
    
    if (domainMatches.size > 0) {
      console.log(`Found ${domainMatches.size} URLs with relevant domains:`);
      [...domainMatches].forEach(url => {
        console.log(`- ${url}`);
      });
    } else {
      console.log('No URLs with relevant domains found');
    }
    
  } catch (error) {
    console.error('Error analyzing bundle:', error.message);
  }
}

findBet9jaAPIs().catch(console.error);