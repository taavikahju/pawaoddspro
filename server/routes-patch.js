// This is a temporary file to store the modified API endpoint code
// We'll later apply this patch with sed

const eventsApiEndpoint = `  app.get('/api/events', async (req, res) => {
    try {
      const sportIdParam = req.query.sportId as string | undefined;
      const minBookmakers = req.query.minBookmakers ? parseInt(req.query.minBookmakers as string, 10) : 3;
      const pastOnly = req.query.past_only === 'true';
      const futureOnly = req.query.future_only === 'true';
      const country = req.query.country as string | undefined;
      const tournament = req.query.tournament as string | undefined;
      
      let events;

      if (sportIdParam) {
        const sportId = parseInt(sportIdParam, 10);
        if (isNaN(sportId)) {
          return res.status(400).json({ message: 'Invalid sport ID' });
        }
        events = await storage.getEventsBySportId(sportId);
      } else {
        events = await storage.getEvents();
      }
      
      // Filter events to only include those with at least the minimum number of bookmakers
      let filteredEvents = events.filter(event => {
        // Count bookmakers with odds for this event
        if (!event.oddsData) return false;
        
        const bookmakerCount = Object.keys(event.oddsData).length;
        return bookmakerCount >= minBookmakers;
      });
      
      // Apply time-based filters (past/future)
      if (pastOnly || futureOnly) {
        const now = new Date();
        filteredEvents = filteredEvents.filter(event => {
          const startTime = new Date(event.startTime);
          if (pastOnly) return startTime <= now;
          if (futureOnly) return startTime > now;
          return true;
        });
      }
      
      // Apply country filter
      if (country && country !== 'all') {
        filteredEvents = filteredEvents.filter(event => 
          event.country && event.country.toLowerCase() === country.toLowerCase()
        );
      }
      
      // Apply tournament filter
      if (tournament && tournament !== 'all') {
        filteredEvents = filteredEvents.filter(event => 
          event.tournament && event.tournament.toLowerCase() === tournament.toLowerCase()
        );
      }

      console.log(\`Filtered \${events.length} events down to \${filteredEvents.length} with at least \${minBookmakers} bookmakers and applied filters\`);
      
      res.json(filteredEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });`;