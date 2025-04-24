import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model (keeping original model)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
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
  teams: text("teams").notNull(),
  league: text("league").notNull(),
  sportId: integer("sport_id").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  oddsData: json("odds_data").notNull(),
  bestOdds: json("best_odds").notNull(),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(events).pick({
  externalId: true,
  teams: true,
  league: true,
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
  teams: z.string(),
  league: z.string(),
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
