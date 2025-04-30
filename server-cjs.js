// Main server entry point for Replit deployment
// This file uses CommonJS module format for compatibility

// Load environment variables if not in production
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (error) {
    console.warn('dotenv not available, skipping .env loading');
  }
}

// Import server
try {
  require('./server/index.cjs');
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}