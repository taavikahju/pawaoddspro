import fs from 'fs/promises';

async function analyzeBundle() {
  try {
    console.log('Analyzing Bet9ja Bundle...');
    
    // Read the saved bundle
    const bundleContent = await fs.readFile('bet9ja-bundle.js', 'utf8');
    console.log(`Loaded ${bundleContent.length} bytes of JavaScript`);
    
    // Look for API endpoints
    console.log('\nSearching for potential API endpoints...');
    
    // Define patterns for API endpoints
    const apiPatterns = [
      /https?:\/\/[^"'\s]+\.bet9ja\.com\/[^"'\s]*api[^"'\s]*/g,
      /https?:\/\/api\.[^"'\s]+\.bet9ja\.com[^"'\s]*/g,
      /https?:\/\/[^"'\s]+\.bet9ja\.com\/[^"'\s]*\/v[0-9]+\/[^"'\s]*/g,
      /https?:\/\/[^"'\s]+\.bet9ja\.com\/[^"'\s]*\/feed[^"'\s]*/g,
      /https?:\/\/[^"'\s]+\.bet9ja\.com\/[^"'\s]*\/data[^"'\s]*/g,
      /https?:\/\/[^"'\s]+\.bet9ja\.com\/[^"'\s]*football[^"'\s]*/g,
      /https?:\/\/[^"'\s]+\.bet9ja\.com\/[^"'\s]*soccer[^"'\s]*/g,
      /https?:\/\/[^"'\s]+\.bet9ja\.com\/[^"'\s]*sports[^"'\s]*/g,
      /https?:\/\/[^"'\s]+\.bet9ja\.com\/[^"'\s]*odds[^"'\s]*/g,
      /https?:\/\/[^"'\s]+\.bet9ja\.com\/[^"'\s]*events[^"'\s]*/g,
      /https?:\/\/[^"'\s]+\.bet9ja\.com\/[^"'\s]*matches[^"'\s]*/g,
      /https?:\/\/[^"'\s]+\.bet9ja\.com\/[^"'\s]*live[^"'\s]*/g,
      /https?:\/\/[^"'\s]+\.bet9ja\.com\/[^"'\s]*upcoming[^"'\s]*/g,
      /https?:\/\/[^"'\s]+\.bet9ja\.com\/[^"'\s]*prematch[^"'\s]*/g,
    ];
    
    const allMatches = new Set();
    
    for (const pattern of apiPatterns) {
      const matches = [...bundleContent.matchAll(pattern)].map(match => match[0]);
      matches.forEach(match => allMatches.add(match));
    }
    
    if (allMatches.size > 0) {
      console.log(`Found ${allMatches.size} potential API endpoints:`);
      [...allMatches].forEach(url => {
        console.log(`- ${url}`);
      });
    } else {
      console.log('No direct API endpoints found');
    }
    
    // Look for function calls that might reference API endpoints
    console.log('\nSearching for API-related function calls...');
    
    const functionPatterns = [
      /(?:function|const|let|var)\s+(\w+(?:get|fetch|load|retrieve)(?:Events|Matches|Odds|Sports|Games|Football|Soccer|Data))/g,
      /\.(get|post|put|delete)\(['"]([^'"]+)['"]/g,
      /fetch\(['"]([^'"]+)['"]/g,
      /axios\.(get|post)\(['"]([^'"]+)['"]/g,
      /apiUrl\s*=\s*["']([^"']+)["']/g,
      /baseUrl\s*=\s*["']([^"']+)["']/g,
      /apiEndpoint\s*=\s*["']([^"']+)["']/g,
    ];
    
    const functionMatches = new Set();
    
    for (const pattern of functionPatterns) {
      const matches = [...bundleContent.matchAll(pattern)].map(match => match[0]);
      matches.forEach(match => functionMatches.add(match));
    }
    
    if (functionMatches.size > 0) {
      console.log(`Found ${functionMatches.size} potential API-related functions or URLs:`);
      [...functionMatches].slice(0, 50).forEach(func => {
        console.log(`- ${func}`);
      });
      
      if (functionMatches.size > 50) {
        console.log(`  ... and ${functionMatches.size - 50} more`);
      }
    } else {
      console.log('No API-related functions found');
    }
    
    // Look for websocket connections
    console.log('\nSearching for WebSocket connections...');
    
    const wsPatterns = [
      /wss?:\/\/[^"'\s]+\.bet9ja\.com[^"'\s]*/g,
      /WebSocket\(["']([^"']+)["']\)/g,
      /new\s+WebSocket\(["']([^"']+)["']\)/g,
    ];
    
    const wsMatches = new Set();
    
    for (const pattern of wsPatterns) {
      const matches = [...bundleContent.matchAll(pattern)].map(match => match[0]);
      matches.forEach(match => wsMatches.add(match));
    }
    
    if (wsMatches.size > 0) {
      console.log(`Found ${wsMatches.size} potential WebSocket connections:`);
      [...wsMatches].forEach(ws => {
        console.log(`- ${ws}`);
      });
    } else {
      console.log('No WebSocket connections found');
    }
    
  } catch (error) {
    console.error('Error analyzing bundle:', error.message);
  }
}

analyzeBundle().catch(console.error);