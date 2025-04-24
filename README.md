# pawaodds.pro - Bookmaker Scraper and Odds Comparison Tool

A comprehensive odds comparison platform that allows you to track betting opportunities across multiple bookmakers in real-time.

## Features

- Multi-bookmaker odds scraping every 15 minutes
- Dynamic odds comparison with margin calculations
- Real-time bookmaker selection and filtering
- Historical odds tracking and visualization
- Responsive design for mobile and desktop
- Role-based access control for admin features
- Interactive odds visualization with price movement history

## System Requirements

- Node.js 18+ 
- PostgreSQL database
- Python 3.8+ (for some custom scrapers)

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see below)
4. Set up the database: `npm run db:push`
5. Create an admin user: `npx tsx scripts/create-admin-user.ts`
6. Start the application: `npm run dev`

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
DATABASE_URL=postgresql://username:password@localhost:5432/pawaodds
SESSION_SECRET=your-session-secret-here
```

## Security Considerations

### Simple Admin Protection

The application uses a lightweight approach to protect admin functionality without requiring user registration or login. This is done through a simple API key-based protection:

1. Admin routes are protected by the `simpleAdminAuth` middleware
2. The middleware checks for the presence of an `x-admin-key` HTTP header
3. The value in this header must match the `ADMIN_KEY` environment variable

### Setting Up Admin Protection

Add the following to your `.env` file:

```
ADMIN_KEY=your-secure-admin-key-here
```

Without this key, access to admin routes will be denied.

### Securing Admin Routes

All admin-related API endpoints are protected with the `simpleAdminAuth` middleware that:
1. Extracts the `x-admin-key` HTTP header from the request
2. Compares it with the `ADMIN_KEY` environment variable
3. Allows or denies access based on the comparison

### Frontend Protection

When accessing the admin section of the frontend, you'll need to ensure your API client sends the correct `x-admin-key` header with every admin API request. This can be accomplished through browser extensions or within your frontend code.

## Deployment

When deploying to production:

1. Update `SESSION_SECRET` to a strong, unique value
2. Set up HTTPS using your hosting provider's tools or a reverse proxy
3. Change the default admin password
4. Configure database backups

## Customizing Bookmakers

The system supports adding custom scrapers for different bookmakers:

1. Go to the Admin interface after logging in as admin
2. Add a new bookmaker with a unique code
3. Upload a custom scraper script (JavaScript/TypeScript/Python)
4. The system will automatically use your custom scraper for that bookmaker

## Support

For support, please contact the development team.

## License

All rights reserved. Unauthorized use, reproduction, or distribution of this software is prohibited.