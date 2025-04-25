export interface Event {
  id: number;
  externalId: string;
  eventId: string;
  name: string;
  country: string;
  tournament: string;
  sportId: number;
  startTime: string;
  oddsData: Record<string, {
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    margin: number;
  }>;
}