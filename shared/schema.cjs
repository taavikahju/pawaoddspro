const {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  jsonb,
  boolean,
  index
} = require('drizzle-orm/pg-core');

// Bookmakers table
const bookmakers = pgTable('bookmakers', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull().unique(),
  displayName: varchar('display_name').notNull(),
  country: varchar('country').notNull(),
  status: varchar('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Events table
const events = pgTable('events', {
  id: serial('id').primaryKey(),
  externalId: varchar('external_id'),
  name: varchar('name').notNull(),
  slug: varchar('slug'),
  tournament: varchar('tournament').notNull(),
  country: varchar('country').notNull(),
  startTime: timestamp('start_time'),
  status: varchar('status').notNull().default('upcoming'),
  odds: jsonb('odds'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Tournament margins table
const tournamentMargins = pgTable('tournament_margins', {
  id: serial('id').primaryKey(),
  country: varchar('country').notNull(),
  tournament: varchar('tournament').notNull(),
  margins: jsonb('margins').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Countries table
const countries = pgTable('countries', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull().unique(),
  code: varchar('code'),
  flagUrl: varchar('flag_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Tournaments table
const tournaments = pgTable('tournaments', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  country: varchar('country').notNull(),
  sport: varchar('sport').default('football'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => {
  return {
    uniqueTournamentCountry: index('unique_tournament_country').on(table.name, table.country).unique()
  };
});

// Market status tracking table
const marketStatusTracking = pgTable('market_status_tracking', {
  id: serial('id').primaryKey(),
  eventId: varchar('event_id').notNull(),
  bookmaker: varchar('bookmaker').notNull(),
  marketType: varchar('market_type').notNull().default('1x2'),
  isOpen: boolean('is_open').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  gameMinute: varchar('game_minute')
});

// Export all tables
module.exports = {
  bookmakers,
  events,
  tournamentMargins,
  countries,
  tournaments,
  marketStatusTracking
};