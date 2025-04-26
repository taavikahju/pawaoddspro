import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model with role-based access control
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // Possible values: "admin", "user"
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Bookmaker model
export const bookmakers = pgTable("bookmakers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  active: boolean("active").notNull().default(true),
  lastScrape: timestamp("last_scrape"),
  nextScrape: timestamp("next_scrape"),
  eventsScraped: integer("events_scraped").default(0),
  fileSize: text("file_size").default("0 KB"),
});

export const insertBookmakerSchema = createInsertSchema(bookmakers).pick({
  name: true,
  code: true,
  active: true,
});

export type InsertBookmaker = z.infer<typeof insertBookmakerSchema>;
export type Bookmaker = typeof bookmakers.$inferSelect;

// Sport model
export const sports = pgTable("sports", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  active: boolean("active").notNull().default(true),
});

export const insertSportSchema = createInsertSchema(sports).pick({
  name: true,
  code: true,
  active: true,
});

export type InsertSport = z.infer<typeof insertSportSchema>;
export type Sport = typeof sports.$inferSelect;

// Event model
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  eventId: text("event_id").notNull().unique(), // Added field for consistent eventId across bookmakers
  teams: text("teams").notNull(),
  league: text("league").notNull(),
  country: text("country"),
  tournament: text("tournament"),
  sportId: integer("sport_id").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  oddsData: json("odds_data").notNull(),
  bestOdds: json("best_odds").notNull(),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(events).pick({
  externalId: true,
  eventId: true,   // Added to schema
  teams: true,
  league: true,
  country: true,   // Added country field
  tournament: true, // Added tournament field
  sportId: true,
  date: true,
  time: true,
  oddsData: true,
  bestOdds: true,
});

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Schemas for API responses
export const statsSchema = z.object({
  totalEvents: z.number(),
  eventsChange: z.number(),
  bookmarkersActive: z.string(),
  bestOddsCount: z.number(),
  bestOddsChange: z.number(),
  lastScrapeTime: z.string(),
  timeToNextUpdate: z.number(),
});

export type StatsData = z.infer<typeof statsSchema>;

export const oddsSchema = z.object({
  home: z.number().optional(),
  draw: z.number().optional(),
  away: z.number().optional(),
});

export type OddsData = z.infer<typeof oddsSchema>;

export const bookmakerOddsSchema = z.record(z.string(), oddsSchema);

export const eventDataSchema = z.object({
  id: z.number(),
  externalId: z.string(),
  eventId: z.string(),  // Added field
  teams: z.string(),
  league: z.string(),
  country: z.string().nullish(),
  tournament: z.string().nullish(),
  sportId: z.number(),
  date: z.string(),
  time: z.string(),
  odds: bookmakerOddsSchema,
  bestOdds: oddsSchema,
  lastUpdated: z.string(),
});

export type EventData = z.infer<typeof eventDataSchema>;

export const scraperStatusSchema = z.object({
  name: z.string(),
  status: z.string(),
  lastRun: z.string(),
  nextRun: z.string(),
  eventCount: z.number(),
  fileSize: z.string(),
});

export type ScraperStatus = z.infer<typeof scraperStatusSchema>;

// Heartbeat statistics schema for tracking market availability
export const heartbeatStatsSchema = z.object({
  id: z.number().optional(),
  eventId: z.string(),
  timestamp: z.number(),
  uptimePercentage: z.number(),
  availableDurationMinutes: z.number(),
  suspendedDurationMinutes: z.number(),
  totalDurationMinutes: z.number(),
  day: z.string().nullable(), // YYYY-MM-DD format for daily aggregation
  week: z.string().nullable(), // YYYY-WW format for weekly aggregation
  month: z.string().nullable(), // YYYY-MM format for monthly aggregation
  createdAt: z.date().nullable()
});

export type HeartbeatStats = z.infer<typeof heartbeatStatsSchema>;

// Database table for storing heartbeat statistics
export const heartbeatStats = pgTable("heartbeat_stats", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull(),
  timestamp: integer("timestamp").notNull(),
  uptimePercentage: integer("uptime_percentage").notNull(),
  availableDurationMinutes: integer("available_duration_minutes").notNull(),
  suspendedDurationMinutes: integer("suspended_duration_minutes").notNull(),
  totalDurationMinutes: integer("total_duration_minutes").notNull(),
  day: text("day"), // YYYY-MM-DD format
  week: text("week"), // YYYY-WW format
  month: text("month"), // YYYY-MM format
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHeartbeatStatsSchema = createInsertSchema(heartbeatStats).omit({
  id: true,
  createdAt: true,
});

export type InsertHeartbeatStats = z.infer<typeof insertHeartbeatStatsSchema>;

// Odds history table to track odds changes over time
export const oddsHistory = pgTable("odds_history", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull(), // The eventId field from events table
  externalId: text("external_id").notNull(), // The externalId field from events table
  bookmakerCode: text("bookmaker_code").notNull(),
  homeOdds: text("home_odds"),
  drawOdds: text("draw_odds"),
  awayOdds: text("away_odds"),
  margin: text("margin").notNull(), // Calculated margin percentage for these odds
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertOddsHistorySchema = createInsertSchema(oddsHistory).pick({
  eventId: true,
  externalId: true,
  bookmakerCode: true,
  homeOdds: true,
  drawOdds: true,
  awayOdds: true,
  margin: true,
});

export type InsertOddsHistory = z.infer<typeof insertOddsHistorySchema>;
export type OddsHistory = typeof oddsHistory.$inferSelect;
