// Database schema definition for pawaodds app
// This file uses ES Module format

import { 
  pgTable, 
  serial, 
  varchar, 
  integer, 
  timestamp, 
  json, 
  text,
  boolean,
  primaryKey,
  bigint,
  real
} from 'drizzle-orm/pg-core';

// Bookmakers table
export const bookmakers = pgTable('bookmakers', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  url: varchar('url', { length: 255 }),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Events table
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  externalId: varchar('external_id', { length: 100 }).notNull(),
  bookmaker: varchar('bookmaker', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  home: varchar('home', { length: 255 }),
  away: varchar('away', { length: 255 }),
  sportId: integer('sport_id').notNull(),
  country: varchar('country', { length: 100 }),
  tournament: varchar('tournament', { length: 255 }),
  date: varchar('date', { length: 50 }),
  time: varchar('time', { length: 50 }),
  status: varchar('status', { length: 50 }).default('active'),
  oddsData: json('odds_data'),
  originalData: json('original_data'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Tournament margins table
export const tournamentMargins = pgTable('tournament_margins', {
  id: serial('id').primaryKey(),
  country: varchar('country', { length: 100 }).notNull(),
  tournament: varchar('tournament', { length: 255 }).notNull(),
  bookmaker: varchar('bookmaker', { length: 50 }).notNull(),
  marginValue: real('margin_value').notNull(),
  eventCount: integer('event_count').default(0),
  timestamp: timestamp('timestamp').defaultNow()
});

// Live heartbeat table for tracking market availability
export const liveHeartbeat = pgTable('live_heartbeat', {
  id: serial('id').primaryKey(),
  eventId: varchar('event_id', { length: 100 }).notNull(),
  bookmaker: varchar('bookmaker', { length: 50 }).notNull(),
  isMarketAvailable: boolean('is_market_available').notNull(),
  timestamp: timestamp('timestamp').defaultNow()
});

// Heartbeat stats table for aggregated statistics
export const heartbeatStats = pgTable('heartbeat_stats', {
  id: serial('id').primaryKey(),
  eventId: varchar('event_id', { length: 100 }).notNull(),
  bookmaker: varchar('bookmaker', { length: 50 }).notNull(),
  uptime: real('uptime').notNull(),
  downtime: real('downtime').notNull(),
  totalChecks: bigint('total_checks').notNull(),
  lastUpdated: timestamp('last_updated').notNull()
});

// Join table for mapping events across bookmakers
export const eventMappings = pgTable('event_mappings', {
  id: serial('id').primaryKey(),
  primaryEventId: varchar('primary_event_id', { length: 100 }).notNull(),
  primaryBookmaker: varchar('primary_bookmaker', { length: 50 }).notNull(),
  mappedEventId: varchar('mapped_event_id', { length: 100 }).notNull(),
  mappedBookmaker: varchar('mapped_bookmaker', { length: 50 }).notNull(),
  confidence: real('confidence').default(1.0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});