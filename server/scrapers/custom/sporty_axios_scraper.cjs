const axios = require('axios');

const BASE_URL = 'https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents';
const QUERY = 'sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100&pageSize=100&option=1';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'application/json'
};

// Countries supported by SportyBet
const REGIONS = [
  { code: 'gh', name: 'Ghana' },
  { code: 'ke', name: 'Kenya' },
  { code: 'ng', name: 'Nigeria' },
  { code: 'tz', name: 'Tanzania' },
  { code: 'ug', name: 'Uganda' },
  { code: 'za', name: 'South Africa' }
];

const fetchAllPages = async (region) => {
  const baseUrl = BASE_URL.replace('/gh/', `/${region}/`);
  let allTournaments = [];
  let pageNum = 1;
  let totalPages = 1;

  console.error(`📥 Fetching data for ${region}...`);

  while (pageNum <= totalPages) {
    const url = `${baseUrl}?${QUERY}&pageNum=${pageNum}&_t=${Date.now()}`;
    console.error(`📥 Fetching page ${pageNum} for ${region}...`);

    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
      const data = res.data?.data;

      if (!data || !data.tournaments) {
        console.error(`❌ No tournaments found for ${region}`);
        break;
      }

      if (pageNum === 1) {
        const totalNum = data.totalNum || 0;
        totalPages = Math.ceil(totalNum / 100);
        console.error(`📊 Found ${totalNum} events in ${totalPages} pages for ${region}`);
      }

      allTournaments = allTournaments.concat(data.tournaments);
      pageNum++;
    } catch (err) {
      console.error(`❌ Failed on page ${pageNum} for ${region}:`, err.message);
      break;
    }
  }

  return allTournaments;
};

const processRegionData = (tournaments, region) => {
  const flatEvents = [];

  tournaments.forEach(tournament => {
    const country = tournament.events?.[0]?.sport?.category?.name || 'Unknown';
    const tournamentName = tournament.name;

    tournament.events.forEach(event => {
      const market = event.markets?.find(m => m.id === "1");
      const outcomes = market?.outcomes?.map(o => ({
        desc: o?.desc?.toString(),
        odds: o?.odds ?? null,
        name: o?.name,
        outcome: o?.outcome
      })) || [];

      const homeOdds = outcomes.find(o => o.desc?.toLowerCase() === 'home')?.odds ?? null;
      const drawOdds = outcomes.find(o => o.desc?.toLowerCase() === 'draw')?.odds ?? null;
      const awayOdds = outcomes.find(o => o.desc?.toLowerCase() === 'away')?.odds ?? null;

      // Only add events that have all three odds
      if (homeOdds && drawOdds && awayOdds) {
        // Format using the EXACT format expected by the integration.ts parser
        // This matches the format in line 77-84 of integration.ts
        flatEvents.push({
          eventId: event.eventId.replace(/\D/g, ''),
          event: `${event.homeTeamName} - ${event.awayTeamName}`,
          country: country,
          tournament: tournamentName,
          sport: 'football',
          start_time: event.estimateStartTime 
            ? new Date(event.estimateStartTime).toISOString().replace('T', ' ').substring(0, 16)
            : null,
          home_odds: homeOdds,
          draw_odds: drawOdds,
          away_odds: awayOdds,
          bookmaker: 'sporty',
          region: region
        });
      }
    });
  });

  return flatEvents;
};

const run = async () => {
  let allEvents = [];

  // Try each region in sequence
  for (const region of REGIONS) {
    try {
      console.error(`📊 Processing ${region.name} (${region.code})...`);
      const tournaments = await fetchAllPages(region.code);
      const events = processRegionData(tournaments, region.code);
      console.error(`✅ Processed ${events.length} events from ${region.name}`);
      allEvents = allEvents.concat(events);
    } catch (err) {
      console.error(`❌ Error processing ${region.name}:`, err.message);
    }
  }

  console.error(`✅ Total events collected: ${allEvents.length}`);
  console.log(JSON.stringify(allEvents));
};

run();