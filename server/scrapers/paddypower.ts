import axios from 'axios';

// Example event data for simulation
const SAMPLE_EVENTS = [
  {
    id: 'paddypower_4001',
    teams: 'Manchester City vs Arsenal',
    league: 'Premier League',
    sport: 'football',
    date: 'Today',
    time: '19:45',
    odds: {
      home: 2.05,
      draw: 3.60,
      away: 3.60
    }
  },
  {
    id: 'paddypower_4002',
    teams: 'Liverpool vs Chelsea',
    league: 'Premier League',
    sport: 'football',
    date: 'Tomorrow',
    time: '17:30',
    odds: {
      home: 1.73,
      draw: 3.80,
      away: 4.60
    }
  },
  {
    id: 'paddypower_4003',
    teams: 'Tottenham vs Newcastle',
    league: 'Premier League',
    sport: 'football',
    date: 'Tomorrow',
    time: '15:00',
    odds: {
      home: 1.91,
      draw: 3.75,
      away: 4.00
    }
  },
  {
    id: 'paddypower_4004',
    teams: 'Paris SG vs Marseille',
    league: 'Ligue 1',
    sport: 'football',
    date: 'Sunday',
    time: '20:00',
    odds: {
      home: 1.45,
      draw: 4.50,
      away: 6.50
    }
  },
  {
    id: 'paddypower_4005',
    teams: 'Chicago Bulls vs LA Lakers',
    league: 'NBA',
    sport: 'basketball',
    date: 'Today',
    time: '01:30',
    odds: {
      home: 2.25,
      away: 1.65
    }
  }
];

/**
 * Scrape data from Paddy Power
 * In a real implementation, this would access the Paddy Power API or website
 */
export async function scrape(): Promise<any[]> {
  try {
    console.log('Scraping Paddy Power data...');
    
    // In a real implementation, this would make API calls to fetch data
    // For demonstration, we'll simulate a delay and return mock data
    
    // Add some variance to the odds
    const variance = (Math.random() * 0.1) - 0.05; // Random value between -0.05 and 0.05
    
    return SAMPLE_EVENTS.map(event => ({
      ...event,
      odds: {
        home: event.odds.home ? Math.round((event.odds.home + variance) * 100) / 100 : undefined,
        draw: event.odds.draw ? Math.round((event.odds.draw + variance) * 100) / 100 : undefined,
        away: event.odds.away ? Math.round((event.odds.away + variance) * 100) / 100 : undefined
      }
    }));
    
  } catch (error) {
    console.error('Error scraping Paddy Power:', error);
    throw error;
  }
}
