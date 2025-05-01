#!/usr/bin/env node
const axios = require('axios');

const BASE_URL = 'https://api.betika.com/v1/uo/matches';
const QUERY_PARAMS = {
  limit: 50,
  tab: 'upcoming',
  sub_type_id: '1,186,340',
  sport_id: 14,
  sort_id: 2,
  period_id: 9,
  esports: false
};

let allEvents = [];
let currentPage = 1;

function formatDateTime(dateTimeStr) {
  const date = new Date(dateTimeStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

async function fetchPage(page) {
  try {
    const url = `${BASE_URL}?page=${page}&${new URLSearchParams(QUERY_PARAMS).toString()}`;
    const { data } = await axios.get(url);
    return data.data;
  } catch (error) {
    // Silently log errors
    return [];
  }
}

(async () => {
  try {
    // Silently fetch all events
    while (true) {
      const events = await fetchPage(currentPage);
      if (!events || events.length === 0) break;

      const formattedEvents = events.map(event => {
        return {
          eventId: event.parent_match_id,
          country: event.category,
          tournament: event.competition_name,
          event: `${event.home_team} - ${event.away_team}`,
          market: "1X2",
          home_odds: event.home_odd,
          draw_odds: event.neutral_odd,
          away_odds: event.away_odd,
          start_time: formatDateTime(event.start_time)
        };
      });

      allEvents.push(...formattedEvents);
      currentPage++;
    }

    // Output to stdout for the integration system
    console.log(JSON.stringify(allEvents));
  } catch (error) {
    // Silently handle errors and output empty array
    console.log('[]');
  }
})();