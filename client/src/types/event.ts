export interface Event {
  id: number;
  externalId: string;
  eventId: string;
  teams?: string; // Original database field
  name?: string; // Friendly alias for teams
  country: string;
  tournament: string;
  sportId: number;
  startTime?: string; // Make optional since there might be a naming issue
  start_time?: string; // Alternative field name from DB
  date?: string; // Fallback fields
  time?: string; // Fallback fields
  oddsData: Record<string, {
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    margin: number;
  }>;
}