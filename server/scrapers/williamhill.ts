import axios from 'axios';

// Example event data for simulation
const SAMPLE_EVENTS = [
  {
    id: 'williamhill_2001',
    teams: 'Manchester City vs Arsenal',
    league: 'Premier League',
    sport: 'football',
    date: 'Today',
    time: '19:45',
    odds: {
      home: 2.00,
      draw: 3.50,
      away: 3.75
    }
  },
  {
    id: 'williamhill_2002',
    teams: 'Liverpool vs Chelsea',
    league: 'Premier League',
    sport: 'football',
    date: 'Tomorrow',
    time: '17:30',
    odds: {
      home: 1.75,
      draw: 3.80,
      away: 4.50
    }
  },
  {
    id: 'williamhill_2003',
    teams: 'Tottenham vs Newcastle',
    league: 'Premier League',
    sport: 'football',
    date: 'Tomorrow',
    time: '15:00',
    odds: {
      home: 1.95,
      draw: 3.60,
      away: 4.00
    }
  },
  {
    id: 'williamhill_2004',
    teams: 'Chicago Bulls vs LA Lakers',
    league: 'NBA',
    sport: 'basketball',
    date: 'Today',
    time: '01:30',
    odds: {
      home: 2.20,
      away: 1.70
    }
  },
  {
    id: 'williamhill_2005',
    teams: 'Real Madrid vs Barcelona',
    league: 'La Liga',
    sport: 'football',
    date: 'Saturday',
    time: '20:00',
    odds: {
      home: 2.10,
      draw: 3.50,
      away: 3.30
    }
  }
];

/**
 * Scrape data from William Hill
 * In a real implementation, this would access the William Hill API or website
 */
export async function scrape(): Promise<any[]> {
  try {
    console.log('Scraping William Hill data...');
    
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
    console.error('Error scraping William Hill:', error);
    throw error;
  }
}
