import { 
  users, 
  type User, 
  type InsertUser, 
  type Bookmaker, 
  type InsertBookmaker, 
  type Sport,
  type InsertSport,
  type Event,
  type InsertEvent,
  type StatsData,
  type ScraperStatus
} from "@shared/schema";
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

const mkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

export interface IStorage {
  // Original user methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Bookmaker methods
  getBookmakers(): Promise<Bookmaker[]>;
  getBookmaker(id: number): Promise<Bookmaker | undefined>;
  getBookmakerByCode(code: string): Promise<Bookmaker | undefined>;
  createBookmaker(bookmaker: InsertBookmaker): Promise<Bookmaker>;
  updateBookmaker(id: number, data: Partial<Bookmaker>): Promise<Bookmaker | undefined>;
  
  // Sport methods
  getSports(): Promise<Sport[]>;
  getSport(id: number): Promise<Sport | undefined>;
  createSport(sport: InsertSport): Promise<Sport>;
  updateSport(id: number, data: Partial<Sport>): Promise<Sport | undefined>;
  
  // Event methods
  getEvents(): Promise<Event[]>;
  getEventsByIds(ids: number[]): Promise<Event[]>;
  getEventsBySportId(sportId: number): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  getEventByExternalId(externalId: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, data: Partial<Event>): Promise<Event | undefined>;
  
  // Storage methods for scraped data
  saveBookmakerData(bookmakerCode: string, data: any): Promise<void>;
  getBookmakerData(bookmakerCode: string): Promise<any>;
  getAllBookmakersData(): Promise<Record<string, any>>;
  
  // Stats methods
  getStats(): Promise<StatsData>;
  getScraperStatuses(): Promise<ScraperStatus[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private bookmakers: Map<number, Bookmaker>;
  private sports: Map<number, Sport>;
  private events: Map<number, Event>;
  private dataDir: string;
  
  currentUserId: number;
  currentBookmakerId: number;
  currentSportId: number;
  currentEventId: number;
  lastStats: StatsData | null;
  
  constructor() {
    this.users = new Map();
    this.bookmakers = new Map();
    this.sports = new Map();
    this.events = new Map();
    this.currentUserId = 1;
    this.currentBookmakerId = 1;
    this.currentSportId = 1;
    this.currentEventId = 1;
    this.dataDir = path.join(process.cwd(), 'data');
    this.lastStats = null;
    
    // Initialize with default data
    this.initializeData();
  }
  
  private async initializeData() {
    try {
      // Create data directory if it doesn't exist
      if (!fs.existsSync(this.dataDir)) {
        await mkdir(this.dataDir, { recursive: true });
      }
      
      // Add default bookmakers
      this.createBookmaker({ name: 'Bet365', code: 'bet365', active: true });
      this.createBookmaker({ name: 'William Hill', code: 'williamhill', active: true });
      this.createBookmaker({ name: 'Betfair', code: 'betfair', active: true });
      this.createBookmaker({ name: 'Paddy Power', code: 'paddypower', active: true });
      
      // Add default sports
      this.createSport({ name: 'Football', code: 'football', active: true });
      this.createSport({ name: 'Basketball', code: 'basketball', active: true });
      this.createSport({ name: 'Tennis', code: 'tennis', active: true });
      this.createSport({ name: 'Horse Racing', code: 'horseracing', active: true });
      
      // Initialize stats
      this.lastStats = {
        totalEvents: 0,
        eventsChange: 0,
        bookmarkersActive: '4/4',
        bestOddsCount: 0,
        bestOddsChange: 0,
        lastScrapeTime: this.formatTime(new Date()),
        timeToNextUpdate: 15
      };
    } catch (error) {
      console.error('Error initializing data:', error);
    }
  }
  
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Bookmaker methods
  async getBookmakers(): Promise<Bookmaker[]> {
    return Array.from(this.bookmakers.values());
  }
  
  async getBookmaker(id: number): Promise<Bookmaker | undefined> {
    return this.bookmakers.get(id);
  }
  
  async getBookmakerByCode(code: string): Promise<Bookmaker | undefined> {
    return Array.from(this.bookmakers.values()).find(
      (bookmaker) => bookmaker.code === code
    );
  }
  
  async createBookmaker(insertBookmaker: InsertBookmaker): Promise<Bookmaker> {
    const id = this.currentBookmakerId++;
    const now = new Date();
    const nextScrape = new Date(now.getTime() + 15 * 60 * 1000);
    
    const bookmaker: Bookmaker = { 
      ...insertBookmaker, 
      id,
      lastScrape: now,
      nextScrape,
      eventsScraped: 0,
      fileSize: '0 KB'
    };
    
    this.bookmakers.set(id, bookmaker);
    return bookmaker;
  }
  
  async updateBookmaker(id: number, data: Partial<Bookmaker>): Promise<Bookmaker | undefined> {
    const bookmaker = this.bookmakers.get(id);
    if (!bookmaker) return undefined;
    
    const updatedBookmaker = { ...bookmaker, ...data };
    this.bookmakers.set(id, updatedBookmaker);
    return updatedBookmaker;
  }
  
  // Sport methods
  async getSports(): Promise<Sport[]> {
    return Array.from(this.sports.values());
  }
  
  async getSport(id: number): Promise<Sport | undefined> {
    return this.sports.get(id);
  }
  
  async createSport(insertSport: InsertSport): Promise<Sport> {
    const id = this.currentSportId++;
    const sport: Sport = { ...insertSport, id };
    this.sports.set(id, sport);
    return sport;
  }
  
  async updateSport(id: number, data: Partial<Sport>): Promise<Sport | undefined> {
    const sport = this.sports.get(id);
    if (!sport) return undefined;
    
    const updatedSport = { ...sport, ...data };
    this.sports.set(id, updatedSport);
    return updatedSport;
  }
  
  // Event methods
  async getEvents(): Promise<Event[]> {
    return Array.from(this.events.values());
  }
  
  async getEventsByIds(ids: number[]): Promise<Event[]> {
    return Array.from(this.events.values()).filter(
      (event) => ids.includes(event.id)
    );
  }
  
  async getEventsBySportId(sportId: number): Promise<Event[]> {
    return Array.from(this.events.values()).filter(
      (event) => event.sportId === sportId
    );
  }
  
  async getEvent(id: number): Promise<Event | undefined> {
    return this.events.get(id);
  }
  
  async getEventByExternalId(externalId: string): Promise<Event | undefined> {
    return Array.from(this.events.values()).find(
      (event) => event.externalId === externalId
    );
  }
  
  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = this.currentEventId++;
    const now = new Date();
    
    const event: Event = {
      ...insertEvent,
      id,
      lastUpdated: now
    };
    
    this.events.set(id, event);
    return event;
  }
  
  async updateEvent(id: number, data: Partial<Event>): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;
    
    const updatedEvent = { ...event, ...data, lastUpdated: new Date() };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }
  
  // Storage methods for scraped data
  async saveBookmakerData(bookmakerCode: string, data: any): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, `${bookmakerCode}.json`);
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      
      // Update bookmaker stats
      const bookmaker = await this.getBookmakerByCode(bookmakerCode);
      if (bookmaker) {
        const stats = await stat(filePath);
        const fileSize = `${Math.round(stats.size / 1024)} KB`;
        const eventsCount = Array.isArray(data) ? data.length : 0;
        
        const now = new Date();
        const nextScrape = new Date(now.getTime() + 15 * 60 * 1000);
        
        await this.updateBookmaker(bookmaker.id, {
          lastScrape: now,
          nextScrape,
          eventsScraped: eventsCount,
          fileSize
        });
      }
    } catch (error) {
      console.error(`Error saving ${bookmakerCode} data:`, error);
      throw error;
    }
  }
  
  async getBookmakerData(bookmakerCode: string): Promise<any> {
    try {
      const filePath = path.join(this.dataDir, `${bookmakerCode}.json`);
      if (!fs.existsSync(filePath)) return null;
      
      const data = await readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading ${bookmakerCode} data:`, error);
      return null;
    }
  }
  
  async getAllBookmakersData(): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    const bookmakers = await this.getBookmakers();
    
    for (const bookmaker of bookmakers) {
      result[bookmaker.code] = await this.getBookmakerData(bookmaker.code);
    }
    
    return result;
  }
  
  // Stats methods
  async getStats(): Promise<StatsData> {
    const events = await this.getEvents();
    const bookmakers = await this.getBookmakers();
    const activeBookmakers = bookmakers.filter(b => b.active).length;
    
    let bestOddsCount = 0;
    events.forEach(event => {
      const bestOdds = event.bestOdds as any;
      if (bestOdds && Object.keys(bestOdds).length > 0) {
        bestOddsCount++;
      }
    });
    
    const now = new Date();
    let nextScrapeTime = now.getTime() + 15 * 60 * 1000;
    
    bookmakers.forEach(bookmaker => {
      if (bookmaker.nextScrape && bookmaker.nextScrape.getTime() < nextScrapeTime) {
        nextScrapeTime = bookmaker.nextScrape.getTime();
      }
    });
    
    const timeToNextUpdate = Math.max(1, Math.round((nextScrapeTime - now.getTime()) / 60000));
    
    let lastScrapeTime = this.formatTime(now);
    if (bookmakers.length > 0 && bookmakers[0].lastScrape) {
      lastScrapeTime = this.formatTime(bookmakers[0].lastScrape);
    }
    
    const eventsChange = this.lastStats ? events.length - this.lastStats.totalEvents : 0;
    const bestOddsChange = this.lastStats ? bestOddsCount - this.lastStats.bestOddsCount : 0;
    
    const stats: StatsData = {
      totalEvents: events.length,
      eventsChange,
      bookmarkersActive: `${activeBookmakers}/${bookmakers.length}`,
      bestOddsCount,
      bestOddsChange,
      lastScrapeTime,
      timeToNextUpdate
    };
    
    this.lastStats = stats;
    return stats;
  }
  
  async getScraperStatuses(): Promise<ScraperStatus[]> {
    const bookmakers = await this.getBookmakers();
    
    return bookmakers.map(bookmaker => ({
      name: `${bookmaker.name} Scraper`,
      status: bookmaker.active ? 'Running' : 'Stopped',
      lastRun: bookmaker.lastScrape ? this.formatTime(bookmaker.lastScrape) : 'N/A',
      nextRun: bookmaker.nextScrape ? this.formatTime(bookmaker.nextScrape) : 'N/A',
      eventCount: bookmaker.eventsScraped ?? 0,
      fileSize: bookmaker.fileSize ?? '0 KB'
    }));
  }
}

export const storage = new MemStorage();
