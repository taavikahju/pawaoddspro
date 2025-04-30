const express = require('express');
const path = require('path');
const { createServer } = require('http');

// Mock storage for deployment
const storage = {
  getEvents: async () => [],
  getStats: async () => ({ totalEvents: 0, eventsChange: 0, bookmakers: [] }),
  getBookmakers: async () => []
};

const app = express();
app.use(express.json());

// Setup basic middlewares
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} in ${duration}ms`);
  });
  next();
});

// Error handling
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// API Routes
app.get('/api/events', async (req, res) => {
  try {
    const events = await storage.getEvents();
    res.json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ message: 'Failed to fetch events' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await storage.getStats();
    res.json(stats);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

app.get('/api/bookmakers', async (req, res) => {
  try {
    const bookmakers = await storage.getBookmakers();
    res.json(bookmakers);
  } catch (err) {
    console.error('Error fetching bookmakers:', err);
    res.status(500).json({ message: 'Failed to fetch bookmakers' });
  }
});

// Always serve our simple index file for demonstration
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'simple-index.html'));
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
const server = createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
