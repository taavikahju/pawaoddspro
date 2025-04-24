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

### Role-Based Access Control

The application implements role-based access control with two user roles:
- **User**: Can view odds and comparison data
- **Admin**: Can manage bookmakers, run scrapers manually, upload scraper scripts, etc.

### Setting Up Admin User

An admin user is automatically created when running the `create-admin-user.ts` script with the following default credentials:

- Username: `admin`
- Password: `adminpassword`

**Important:** Change the admin password after the first login for security reasons.

### Securing Admin Routes

All admin-related API endpoints are protected with the `isAdmin` middleware that checks for:
1. User authentication (valid session)
2. Admin role assignment

### Frontend Protection

The frontend implements protected routes that verify user roles before allowing access to admin pages. This provides an additional layer of security beyond the backend API restrictions.

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