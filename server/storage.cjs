const { db } = require('./db.cjs');
const { eq, and, or, isNull, desc } = require('drizzle-orm');

// Define sample data for in-memory fallback
const sampleBookmakers = [
  { id: 1, name: "betpawa_ke", displayName: "BetPawa Kenya", country: "KE", status: "active" },
  { id: 2, name: "betpawa_gh", displayName: "BetPawa Ghana", country: "GH", status: "active" },
  { id: 3, name: "sportybet", displayName: "SportyBet", country: "NG", status: "active" }
];

const sampleEvents = [
  { 
    id: 101, 
    name: "Manchester United vs Arsenal", 
    tournament: "Premier League",
    country: "England",
    startTime: new Date(Date.now() + 3600000).toISOString(),
    odds: { 
      betpawa_ke: { home: 2.1, draw: 3.5, away: 2.7 },
      betpawa_gh: { home: 2.15, draw: 3.4, away: 2.75 }
    } 
  },
  { 
    id: 102, 
    name: "Barcelona vs Real Madrid", 
    tournament: "La Liga",
    country: "Spain",
    startTime: new Date(Date.now() + 7200000).toISOString(),
    odds: { 
      betpawa_ke: { home: 1.8, draw: 3.9, away: 3.2 },
      sportybet: { home: 1.85, draw: 3.85, away: 3.25 }
    } 
  },
  { 
    id: 103, 
    name: "Bayern Munich vs Dortmund", 
    tournament: "Bundesliga",
    country: "Germany",
    startTime: new Date(Date.now() + 10800000).toISOString(),
    odds: { 
      betpawa_gh: { home: 1.6, draw: 4.2, away: 4.5 },
      sportybet: { home: 1.65, draw: 4.1, away: 4.6 }
    } 
  }
];

const sampleTournamentMargins = [
  {
    id: 1,
    country: "England",
    tournament: "Premier League",
    margins: {
      betpawa_ke: { value: 0.058, timestamp: new Date(Date.now() - 3600000).toISOString() },
      betpawa_gh: { value: 0.064, timestamp: new Date(Date.now() - 1800000).toISOString() },
      sportybet: { value: 0.052, timestamp: new Date(Date.now() - 900000).toISOString() }
    }
  },
  {
    id: 2,
    country: "Spain",
    tournament: "La Liga",
    margins: {
      betpawa_ke: { value: 0.061, timestamp: new Date(Date.now() - 3600000).toISOString() },
      betpawa_gh: { value: 0.068, timestamp: new Date(Date.now() - 1800000).toISOString() },
      sportybet: { value: 0.055, timestamp: new Date(Date.now() - 900000).toISOString() }
    }
  },
  {
    id: 3,
    country: "Germany",
    tournament: "Bundesliga",
    margins: {
      betpawa_ke: { value: 0.059, timestamp: new Date(Date.now() - 3600000).toISOString() },
      betpawa_gh: { value: 0.093, timestamp: new Date(Date.now() - 1800000).toISOString() },
      sportybet: { value: 0.054, timestamp: new Date(Date.now() - 900000).toISOString() }
    }
  }
];

// Storage class that handles database operations
class Storage {
  constructor() {
    this.db = db;
    // Use in-memory data if database is not available
    this.useInMemory = !this.db;
    
    if (this.useInMemory) {
      console.warn('Using in-memory storage as database is not available');
      this.inMemoryBookmakers = sampleBookmakers;
      this.inMemoryEvents = sampleEvents;
      this.inMemoryTournamentMargins = sampleTournamentMargins;
    }
  }
  
  // Bookmaker operations
  async getBookmakers() {
    if (this.useInMemory) {
      return this.inMemoryBookmakers;
    }
    
    try {
      // This would use the actual database in the full application
      // const bookmakers = await this.db.select().from(tables.bookmakers);
      // return bookmakers;
      
      // For now, return sample data
      return sampleBookmakers;
    } catch (error) {
      console.error('Database error in getBookmakers:', error);
      return this.inMemoryBookmakers;
    }
  }
  
  // Events operations
  async getEvents(filters = {}) {
    if (this.useInMemory) {
      let filteredEvents = [...this.inMemoryEvents];
      
      // Apply filters
      if (filters.bookmaker) {
        filteredEvents = filteredEvents.filter(event => 
          event.odds[filters.bookmaker]
        );
      }
      
      if (filters.tournament) {
        filteredEvents = filteredEvents.filter(event => 
          event.tournament === filters.tournament
        );
      }
      
      if (filters.country) {
        filteredEvents = filteredEvents.filter(event => 
          event.country === filters.country
        );
      }
      
      return filteredEvents;
    }
    
    try {
      // This would use the actual database in the full application
      // const query = this.db.select().from(tables.events);
      // 
      // // Apply filters
      // if (filters.bookmaker) {
      //   // Filter logic for bookmaker
      // }
      // 
      // if (filters.tournament) {
      //   query.where(eq(tables.events.tournament, filters.tournament));
      // }
      // 
      // if (filters.country) {
      //   query.where(eq(tables.events.country, filters.country));
      // }
      // 
      // const events = await query;
      // return events;
      
      // For now, return filtered sample data
      let filteredEvents = [...sampleEvents];
      
      // Apply filters
      if (filters.bookmaker) {
        filteredEvents = filteredEvents.filter(event => 
          event.odds[filters.bookmaker]
        );
      }
      
      if (filters.tournament) {
        filteredEvents = filteredEvents.filter(event => 
          event.tournament === filters.tournament
        );
      }
      
      if (filters.country) {
        filteredEvents = filteredEvents.filter(event => 
          event.country === filters.country
        );
      }
      
      return filteredEvents;
    } catch (error) {
      console.error('Database error in getEvents:', error);
      return this.inMemoryEvents;
    }
  }
  
  // Tournament margins operations
  async getTournamentMargins() {
    if (this.useInMemory) {
      return this.inMemoryTournamentMargins;
    }
    
    try {
      // This would use the actual database in the full application
      // const margins = await this.db.select().from(tables.tournamentMargins);
      // return margins;
      
      // For now, return sample data
      return sampleTournamentMargins;
    } catch (error) {
      console.error('Database error in getTournamentMargins:', error);
      return this.inMemoryTournamentMargins;
    }
  }
  
  // Countries operations
  async getCountries() {
    if (this.useInMemory) {
      // Extract unique countries from events
      const countries = [...new Set(this.inMemoryEvents.map(event => event.country))];
      return countries.map(country => ({ name: country }));
    }
    
    try {
      // This would use the actual database in the full application
      // const countries = await this.db
      //   .select({ name: tables.countries.name })
      //   .from(tables.countries);
      // return countries;
      
      // For now, extract unique countries from sample data
      const countries = [...new Set(sampleEvents.map(event => event.country))];
      return countries.map(country => ({ name: country }));
    } catch (error) {
      console.error('Database error in getCountries:', error);
      // Fallback to extracting countries from events
      const countries = [...new Set(sampleEvents.map(event => event.country))];
      return countries.map(country => ({ name: country }));
    }
  }
  
  // Tournaments operations
  async getTournaments(country) {
    if (this.useInMemory) {
      // Filter tournaments by country if provided
      let tournaments = this.inMemoryEvents;
      
      if (country) {
        tournaments = tournaments.filter(event => event.country === country);
      }
      
      // Extract unique tournaments
      const uniqueTournaments = [...new Set(tournaments.map(event => event.tournament))];
      return uniqueTournaments.map(tournament => ({ 
        name: tournament,
        country: country || tournaments.find(event => event.tournament === tournament).country
      }));
    }
    
    try {
      // This would use the actual database in the full application
      // let query = this.db
      //   .select({ 
      //     name: tables.tournaments.name,
      //     country: tables.tournaments.country
      //   })
      //   .from(tables.tournaments);
      // 
      // if (country) {
      //   query = query.where(eq(tables.tournaments.country, country));
      // }
      // 
      // const tournaments = await query;
      // return tournaments;
      
      // For now, extract unique tournaments from sample data
      let tournaments = sampleEvents;
      
      if (country) {
        tournaments = tournaments.filter(event => event.country === country);
      }
      
      // Extract unique tournaments
      const uniqueTournaments = [...new Set(tournaments.map(event => event.tournament))];
      return uniqueTournaments.map(tournament => ({ 
        name: tournament,
        country: country || tournaments.find(event => event.tournament === tournament).country
      }));
    } catch (error) {
      console.error('Database error in getTournaments:', error);
      // Fallback to extracting tournaments from events
      let tournaments = sampleEvents;
      
      if (country) {
        tournaments = tournaments.filter(event => event.country === country);
      }
      
      // Extract unique tournaments
      const uniqueTournaments = [...new Set(tournaments.map(event => event.tournament))];
      return uniqueTournaments.map(tournament => ({ 
        name: tournament,
        country: country || tournaments.find(event => event.tournament === tournament).country
      }));
    }
  }
}

// Create and export storage instance
const storage = new Storage();

module.exports = { storage };