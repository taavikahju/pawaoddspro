#!/usr/bin/env node

// Use built-in fetch from Node.js

async function createTestSuspendedEvent() {
  try {
    // Create a test event with all odds as 0.0 that will be marked as suspended
    const testEvent = {
      eventId: "55555555", // Clear ID divisible by 5
      country: "Test Country",
      tournament: "Test Tournament",
      event: "Test Home vs Test Away",
      market: "1X2",
      home_odds: "0.0",
      draw_odds: "0.0",
      away_odds: "0.0",
      start_time: new Date().toISOString(),
      gameMinute: "45",
      suspended: true,
      homeTeam: "Test Home",
      awayTeam: "Test Away"
    };

    // Send the event to the live heartbeat endpoint
    const response = await fetch('http://localhost:3000/api/live-heartbeat/event-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEvent),
    });

    if (response.ok) {
      console.log('Test suspended event created successfully!');
      console.log('Event ID:', testEvent.eventId);
      console.log('This event should show up with red lines in the heartbeat visualization.');
    } else {
      console.error('Failed to create test event:', await response.text());
    }
  } catch (error) {
    console.error('Error creating test event:', error);
  }
}

createTestSuspendedEvent();