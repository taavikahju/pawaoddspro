const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents';
const QUERY = 'sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100&pageSize=100&option=1';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'application/json'
};

const fetchAllPages = async () => {
  let allTournaments = [];
  let pageNum = 1;
  let totalPages = 1;

  while (pageNum <= totalPages) {
    const url = `${BASE_URL}?${QUERY}&pageNum=${pageNum}&_t=${Date.now()}`;
    console.log(`📥 Fetching page ${pageNum}...`);

    try {
      const res = await axios.get(url, { headers: HEADERS });
      const data = res.data?.data;

      if (!data || !data.tournaments) {
        console.error('❌ No tournaments found');
        break;
      }

      if (pageNum === 1) {
        const totalNum = data.totalNum || 0;
        totalPages = Math.ceil(totalNum / 100);
      }

      allTournaments = allTournaments.concat(data.tournaments);
      pageNum++;
    } catch (err) {
      console.error(`❌ Failed on page ${pageNum}:`, err.message);
      break;
    }
  }

  return allTournaments;
};

const run = async () => {
  const tournaments = await fetchAllPages();

  const formatted = tournaments.map(tournament => {
    const country = tournament.events?.[0]?.sport?.category?.name || 'Unknown';
    const tournamentName = tournament.name;

    const events = tournament.events.map(event => {
      const market = event.markets?.find(m => m.id === "1");
      const outcomes = market?.outcomes?.map(o => ({
        desc: o?.desc?.toString(),
        odds: o?.odds ?? null,
        name: o?.name,
        outcome: o?.outcome
      })) || [];

      console.log(outcomes);

      return {
        fixture: `${event.homeTeamName} - ${event.awayTeamName}`,
        eventId: event.eventId,
        marketName: market?.name || null,
        marketOutcomes: outcomes,
        startTimeUTC: event.estimateStartTime
          ? new Date(event.estimateStartTime).toISOString().slice(0, 16).replace('T', ' ')
          : null
      };
    });

    return {
      country,
      tournament: tournamentName,
      events
    };
  });

  const flatEvents = formatted.flatMap(t => 
    t.events.map(e => ({
      eventId: e.eventId.replace(/\D/g, ''),
      country: t.country,
      tournament: t.tournament,
      event: e.fixture,
      market: e.marketName,
      home_odds: e.marketOutcomes?.find(o => o.desc?.toLowerCase() === 'home')?.odds ?? null,
      draw_odds: e.marketOutcomes?.find(o => o.desc?.toLowerCase() === 'draw')?.odds ?? null,
      away_odds: e.marketOutcomes?.find(o => o.desc?.toLowerCase() === 'away')?.odds ?? null,
      start_time: e.startTimeUTC
    }))
  );

  // Output to stdout for the integration system
  console.log(JSON.stringify(flatEvents));
};

run().catch(error => {
  console.error('Error fetching SportyBet data:', error.message);
});