import axios from 'axios';
import fs from 'fs/promises';

async function downloadAndAnalyzeBundle() {
  console.log('Downloading and analyzing Bet9ja JavaScript bundle...');
  
  const bundleUrl = 'https://cnt.bet9ja.com/cdn/bet9ja/sportsbook/js/desktop/bundle_1.274.3.min.js';
  let bundleContent = '';
  
  try {
    // Download the bundle
    console.log(`Downloading bundle from ${bundleUrl}...`);
    const response = await axios.get(bundleUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    bundleContent = response.data;
    console.log(`Downloaded ${bundleContent.length} bytes of JavaScript`);
    
    // Save the bundle for future analysis
    await fs.writeFile('bet9ja-bundle.js', bundleContent);
    console.log('Bundle saved to bet9ja-bundle.js');
    
    // Look for API endpoints in the bundle
    console.log('\nSearching for API endpoints in the bundle...');
    
    // Define patterns to search for
    const patterns = [
      '/api/',
      'endpoint',
      'fetch(',
      'axios',
      '.get(',
      '.post(',
      'xhr',
      'XHR',
      'WebSocket',
      'ws://',
      'wss://',
      'http://',
      'https://',
      'json',
      'JSON',
      'events',
      'odds',
      'football',
      'soccer',
      'matches',
      'games',
      'sports',
      'upcoming',
      'live'
    ];
    
    // Search for each pattern
    for (const pattern of patterns) {
      const regex = new RegExp(`['"](https?://[^'"]*${pattern}[^'"]*)['"](,|})`, 'g');
      const matches = bundleContent.match(regex) || [];
      
      if (matches.length > 0) {
        console.log(`\nFound ${matches.length} URLs containing "${pattern}":`);
        const uniqueMatches = [...new Set(matches)].slice(0, 10); // Limit to 10 unique matches
        uniqueMatches.forEach(match => {
          console.log(`- ${match.replace(/['"](,|})$/, '')}`);
        });
        
        if (matches.length > 10) {
          console.log(`  ... and ${matches.length - 10} more`);
        }
      }
    }
    
    // Look for specific API patterns
    console.log('\nSearching for specific API patterns...');
    
    // Look for configurations or endpoints
    const configRegex = /api[_\-.]config|apiConfig|endpointConfig|apiUrl|baseUrl|apiBase|baseApi|config\.api/gi;
    const configMatches = bundleContent.match(configRegex) || [];
    
    if (configMatches.length > 0) {
      console.log(`\nFound ${configMatches.length} potential API configuration variables:`);
      const uniqueConfigMatches = [...new Set(configMatches)].slice(0, 20);
      uniqueConfigMatches.forEach(match => {
        console.log(`- ${match}`);
      });
    }
    
    // Look for API function calls
    console.log('\nSearching for function calls related to fetching data...');
    
    const functionPatterns = [
      'getEvents', 
      'getMatches', 
      'getOdds', 
      'fetchEvents', 
      'fetchMatches', 
      'loadEvents', 
      'loadMatches', 
      'getSports',
      'getFootball',
      'fetchLeagues',
      'getLeagues',
      'fetchTournaments',
      'getTournaments'
    ];
    
    for (const pattern of functionPatterns) {
      // Look for function definitions or calls
      const functionRegex = new RegExp(`(function\\s+${pattern}|${pattern}\\s*=\\s*function|${pattern}\\s*:\\s*function|${pattern}\\([^)]*\\))`, 'g');
      const functionMatches = bundleContent.match(functionRegex) || [];
      
      if (functionMatches.length > 0) {
        console.log(`\nFound ${functionMatches.length} matches for "${pattern}" function:`);
        const uniqueFunctionMatches = [...new Set(functionMatches)].slice(0, 5);
        uniqueFunctionMatches.forEach(match => {
          console.log(`- ${match}`);
        });
      }
    }
    
    // Finally, look for any URLs with typical API patterns
    console.log('\nSearching for URLs with typical API patterns...');
    
    const apiUrlPatterns = [
      /['"](https?:\/\/[^'"]*\/api\/[^'"]*)['"]/g,
      /['"](https?:\/\/api\.[^'"]*)['"]/g,
      /['"](https?:\/\/[^'"]*\/v1\/[^'"]*)['"]/g,
      /['"](https?:\/\/[^'"]*\/v2\/[^'"]*)['"]/g,
      /['"](https?:\/\/[^'"]*\/data\/[^'"]*)['"]/g,
      /['"](https?:\/\/[^'"]*\/feed\/[^'"]*)['"]/g,
      /['"](https?:\/\/[^'"]*\/json\/[^'"]*)['"]/g,
      /['"](https?:\/\/[^'"]*\/football\/[^'"]*)['"]/g,
      /['"](https?:\/\/[^'"]*\/soccer\/[^'"]*)['"]/g,
      /['"](https?:\/\/[^'"]*\/odds\/[^'"]*)['"]/g,
      /['"](https?:\/\/[^'"]*\/events\/[^'"]*)['"]/g,
      /['"](https?:\/\/[^'"]*\/matches\/[^'"]*)['"]/g,
      /['"](https?:\/\/[^'"]*\/upcoming\/[^'"]*)['"]/g,
      /['"](https?:\/\/[^'"]*\/live\/[^'"]*)['"]/g,
      /['"](https?:\/\/[^'"]*\/sports\/[^'"]*)['"]/g,
    ];
    
    const foundUrls = new Set();
    
    for (const regex of apiUrlPatterns) {
      let match;
      while ((match = regex.exec(bundleContent)) !== null) {
        foundUrls.add(match[1]);
      }
    }
    
    if (foundUrls.size > 0) {
      console.log(`\nFound ${foundUrls.size} potential API URLs:`);
      [...foundUrls].slice(0, 30).forEach(url => {
        console.log(`- ${url}`);
      });
      
      if (foundUrls.size > 30) {
        console.log(`  ... and ${foundUrls.size - 30} more`);
      }
    }
    
  } catch (error) {
    console.error('Error during bundle analysis:', error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Headers: ${JSON.stringify(error.response.headers)}`);
    }
  }
}

downloadAndAnalyzeBundle().catch(console.error);