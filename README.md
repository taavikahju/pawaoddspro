# pawaodds.pro - Sports Betting Odds Comparison Platform

A sophisticated sports betting odds comparison platform that provides real-time tracking of odds across multiple bookmakers. The platform automatically scrapes data at regular intervals, maps events by ID, and presents the information in a clean, user-friendly interface.

## Features

- **Automatic Data Collection**: Scrapes data from multiple bookmakers every 15 minutes
- **Event Mapping**: Intelligently maps events across bookmakers by ID
- **PostgreSQL Storage**: Stores all data in a robust PostgreSQL database
- **Odds History**: Tracks and visualizes historical odds movements
- **Interactive Interface**: Filter by country, tournament, and margin range
- **WebSocket Updates**: Real-time updates when new data is available
- **Admin Interface**: Protected admin section for managing scrapers and bookmakers
- **Responsive Design**: Mobile-friendly interface

## Tech Stack

- **Frontend**: React, TailwindCSS, Recharts, Tanstack Query
- **Backend**: Node.js, Express, WebSockets
- **Database**: PostgreSQL with Drizzle ORM
- **Scrapers**: Custom scrapers in JavaScript and Python
- **Automation**: Cron jobs for regular scraping
- **Deployment**: PM2, Nginx, GitHub Actions

## Project Structure

```
├── client/              # Frontend React application
├── server/              # Backend Express application
│   ├── scrapers/        # Scraper modules for different bookmakers
│   ├── utils/           # Utility functions for data processing
│   └── middleware/      # Express middleware
├── shared/              # Shared code between client and server
├── scripts/             # Deployment and utility scripts
└── data/                # Data storage directory
```

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- Python 3.8 or higher
- PostgreSQL database

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/pawaodds.git
   cd pawaodds
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL connection details and admin key
   ```

4. Push the database schema:
   ```bash
   npm run db:push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

The repository includes:
- GitHub Actions workflow for CI/CD
- PM2 ecosystem configuration
- Nginx configuration template
- Server setup script

## Custom Bookmakers

The system currently supports the following custom bookmaker scrapers:
- betPawa Ghana (bp GH)
- betPawa Kenya (bp KE)
- Sportybet (sporty)
- Betika Kenya (betika KE)

To add a new bookmaker, create a scraper in the server/scrapers/custom directory and register it in the admin interface.

## License

This project is proprietary and confidential.

## Contact

For support or inquiries, please contact the project maintainer.