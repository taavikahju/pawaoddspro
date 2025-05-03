import axios from 'axios';

const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * This module runs a self-pinging mechanism to keep the server alive
 * It's an extra layer of protection alongside UptimeRobot
 */
export function startKeepalive(appUrl: string = '') {
  // Get the server URL - if running locally, use localhost
  // if running on Replit, use the Replit URL from environment
  const baseUrl = appUrl || process.env.REPLIT_URL || 'http://localhost:5000';
  const pingUrl = `${baseUrl}/ping`;

  console.log(`[${new Date().toISOString()}] Starting internal keepalive service - will ping ${pingUrl} every ${PING_INTERVAL/1000/60} minutes`);
  
  // Initial ping
  sendPing(pingUrl);
  
  // Set up regular pinging
  setInterval(() => {
    sendPing(pingUrl);
  }, PING_INTERVAL);
}

/**
 * Send a ping request to the server
 */
async function sendPing(url: string) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Internal-Keepalive-Service'
      }
    });
    
    if (response.status === 200) {
      console.log(`[${new Date().toISOString()}] Internal keepalive ping successful`);
    } else {
      console.error(`[${new Date().toISOString()}] Internal keepalive ping failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Internal keepalive ping error:`, error);
  }
}