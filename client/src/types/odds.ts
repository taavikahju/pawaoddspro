// Shared type definitions for odds data

// Type for chart data points
export interface OddsChartPoint {
  x: number;  // timestamp
  y: number;  // odds value
}

// Type for odds history data format as required by the chart component
export interface BookmakerOddsData {
  homeOdds: OddsChartPoint[];
  drawOdds: OddsChartPoint[];
  awayOdds: OddsChartPoint[];
  margins: OddsChartPoint[];
}