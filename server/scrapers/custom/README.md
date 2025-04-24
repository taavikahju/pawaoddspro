# Custom Bookmaker Scrapers Integration Guide

This guide explains how to integrate your own custom bookmaker scraper scripts with the OddsCompare platform.

## Overview

The system is designed to run external scraper scripts to fetch odds data from various bookmakers. These scripts can be written in any language (Node.js, Python, etc.) as long as they output data in the expected JSON format.

## Getting Started

1. Place your scraper scripts in this directory (`server/scrapers/custom/`).
2. Update the `SCRIPT_CONFIG` in `integration.ts` to point to your script paths.
3. Make your scripts executable if needed (`chmod +x your_script.js`).

## Script Requirements

Your scraper scripts need to:

1. Run as independent processes when executed
2. Output valid JSON to stdout
3. Follow the expected data format (see below)
4. Handle their own errors and output empty arrays rather than failing

## Expected Output Format

Your scripts must output JSON in the following format:

```json
[
  {
    "id": "unique_id",
    "teams": "Team A vs Team B",
    "league": "League Name",
    "sport": "sport_name",
    "date": "Date string",
    "time": "Time string",
    "odds": {
      "home": 1.5,
      "draw": 3.5,
      "away": 5.0
    }
  },
  ...
]
```

### Field Descriptions

- `id`: A unique identifier for the event in the bookmaker's system
- `teams`: The teams/participants in the format "Team A vs Team B"
- `league`: The competition/league name
- `sport`: The sport code (e.g., "football", "basketball", "tennis")
- `date`: Date of the event (format flexible, but consistent)
- `time`: Time of the event (format flexible, but consistent)
- `odds`: An object containing the odds:
  - `home`: Home team odds (decimal format)
  - `draw`: Draw odds (decimal format, optional for some sports)
  - `away`: Away team odds (decimal format)

## Configuring Your Scripts

Edit the `SCRIPT_CONFIG` in `integration.ts` to point to your scripts:

```typescript
const SCRIPT_CONFIG: Record<string, ScraperConfig> = {
  'bet365': {
    scriptPath: './server/scrapers/custom/your_bet365_scraper.js',
    command: 'node', // or 'python', etc.
    outputFormat: 'json',
  },
  // Add configurations for other bookmakers
};
```

## Script Execution

The system will:

1. Try to use your custom scraper first
2. If your custom scraper fails or doesn't exist, it will fall back to the mock scrapers
3. Data from all scrapers will be collected, mapped, and stored in the database

## Example Script

See `example_scraper.js` for a basic template of how to structure your scraper script.

## Debugging

If your scraper is not working:

1. Check the console logs for error messages
2. Test your script manually to ensure it runs and outputs the correct format
3. Verify the script paths in `SCRIPT_CONFIG` are correct
4. Make sure your script has executable permissions

## Adding New Bookmakers

To add a new bookmaker:

1. Create your scraper script following the format above
2. Add the bookmaker to the database using the Admin interface
3. Update the `SCRIPT_CONFIG` to include your new bookmaker
4. Restart the application

## Scheduling

Scrapers run automatically every 15 minutes. You can adjust this schedule in `scheduler.ts` by modifying the `SCRAPE_SCHEDULE` constant (uses cron syntax).