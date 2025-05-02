const puppeteer = require('puppeteer');

async function analyzeBet9ja() {
  console.log('Starting browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set up network request interception
    await page.setRequestInterception(true);
    
    const apiRequests = [];
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/api/') || url.includes('.json') || url.includes('/v1/') || url.includes('/v2/')) {
        apiRequests.push({
          url,
          method: req.method(),
          resourceType: req.resourceType()
        });
      }
      req.continue();
    });
    
    // Navigate to the website
    console.log('Navigating to bet9ja...');
    await page.goto('https://sports.bet9ja.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait a bit for JavaScript-loaded content
    await page.waitForTimeout(5000);
    
    // Click on the football section if possible
    try {
      const footballLink = await page.$('a[href*="football"], a:contains("Football"), .sport-name:contains("Football")');
      if (footballLink) {
        console.log('Clicking on Football section...');
        await footballLink.click();
        await page.waitForTimeout(3000);
      }
    } catch (e) {
      console.log('Could not find Football section, continuing...');
    }
    
    // Get page content
    const pageContent = await page.content();
    
    // Check for network requests that might be API calls
    console.log('API-like requests intercepted:');
    console.log(JSON.stringify(apiRequests, null, 2));
    
    // Look for potential API endpoints in the page source
    console.log('\nPotential API endpoints in HTML:');
    
    // Extract URLs from the page content
    const urlRegex = /"(https?:\/\/[^"]*api[^"]*)"/g;
    const matches = pageContent.match(urlRegex);
    
    if (matches && matches.length > 0) {
      matches.forEach(match => {
        console.log(match.replace(/"/g, ''));
      });
    } else {
      console.log('No explicit API endpoints found in HTML');
    }
    
    // Check for XHR/fetch calls in JavaScript
    console.log('\nJS files that might contain API calls:');
    const scripts = await page.$$eval('script[src]', scripts => 
      scripts.map(script => script.src).filter(src => 
        src.includes('.js') && !src.includes('google') && !src.includes('facebook')
      )
    );
    
    scripts.forEach(script => {
      console.log(script);
    });
    
    // Check for potential WebSocket connections
    console.log('\nChecking for WebSocket connections...');
    const wsConnections = await page.evaluate(() => {
      return Object.keys(window).filter(key => 
        key.includes('socket') || key.includes('ws') || key.includes('Socket')
      );
    });
    
    if (wsConnections.length > 0) {
      console.log('Potential WebSocket-related variables:');
      console.log(wsConnections);
    } else {
      console.log('No obvious WebSocket connections found');
    }
    
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await browser.close();
    console.log('Analysis complete');
  }
}

analyzeBet9ja();