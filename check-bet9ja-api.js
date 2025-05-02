import axios from 'axios';

// Function to check for potential API endpoints
async function checkBet9jaAPI() {
  console.log('Analyzing bet9ja.com for potential API endpoints...');
  
  // Common API endpoint patterns to try
  const potentialEndpoints = [
    'https://sports.bet9ja.com/api/events',
    'https://sports.bet9ja.com/api/matches',
    'https://sports.bet9ja.com/api/sports',
    'https://sports.bet9ja.com/api/schedule',
    'https://sports.bet9ja.com/api/football',
    'https://api.bet9ja.com/events',
    'https://api.sports.bet9ja.com/events',
    'https://sports.bet9ja.com/events/api',
    'https://sports.bet9ja.com/feed/events',
    'https://sports.bet9ja.com/feed/odds'
  ];
  
  // Try to access the website first
  try {
    console.log('Checking main website access...');
    const mainResponse = await axios.get('https://sports.bet9ja.com/', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    console.log(`Main website HTTP status: ${mainResponse.status}`);
    
    // Look for API references in the HTML
    const apiUrlMatches = mainResponse.data.match(/["'](https?:\/\/[^"']*api[^"']*)['"]/g) || [];
    const jsonUrlMatches = mainResponse.data.match(/["'](https?:\/\/[^"']*\.json[^"']*)['"]/g) || [];
    
    console.log('\nPotential API endpoints found in HTML:');
    
    const foundUrls = [...apiUrlMatches, ...jsonUrlMatches]
      .map(url => url.replace(/["']/g, ''))
      .filter((url, index, self) => self.indexOf(url) === index); // Remove duplicates
    
    foundUrls.forEach(url => {
      console.log(`- ${url}`);
    });
    
    // Find any JavaScript files that might contain API endpoints
    const scriptMatches = mainResponse.data.match(/<script[^>]*src=["']([^"']*\.js[^"']*)["'][^>]*>/g) || [];
    const scripts = scriptMatches.map(tag => {
      const urlMatch = tag.match(/src=["']([^"']*)["']/);
      return urlMatch ? urlMatch[1] : null;
    }).filter(Boolean);
    
    console.log('\nJavaScript files to check for API endpoints:');
    scripts.forEach(script => {
      // Convert relative URLs to absolute URLs
      if (script.startsWith('/')) {
        script = `https://sports.bet9ja.com${script}`;
      } else if (!script.startsWith('http')) {
        script = `https://sports.bet9ja.com/${script}`;
      }
      console.log(`- ${script}`);
    });
    
  } catch (error) {
    console.log(`Error accessing main website: ${error.message}`);
  }
  
  // Test common API endpoint patterns
  console.log('\nTesting potential API endpoints:');
  
  for (const endpoint of potentialEndpoints) {
    try {
      const response = await axios.get(endpoint, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      console.log(`✅ ${endpoint} - HTTP ${response.status}`);
      
      // Check response type
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('json')) {
        console.log(`   Response is JSON (${contentType})`);
        // Print a sample of the response
        const responseData = JSON.stringify(response.data).slice(0, 200) + '...';
        console.log(`   Sample data: ${responseData}`);
      } else {
        console.log(`   Response is not JSON (${contentType})`);
      }
    } catch (error) {
      const statusCode = error.response ? error.response.status : 'No response';
      console.log(`❌ ${endpoint} - ${statusCode} - ${error.message}`);
    }
  }
}

// Run the analysis
checkBet9jaAPI().catch(console.error);