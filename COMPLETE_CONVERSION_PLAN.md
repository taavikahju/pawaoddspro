# Complete Conversion Plan for Replit Deployment

## Overview
This plan outlines the step-by-step process to convert the original PawaOdds application to run properly on Replit, maintaining all original functionality while addressing the module format issues.

## Step 1: Convert ESM to CommonJS - Critical Server Files

### 1.1 Server Index File
Create CommonJS version of `server/index.ts`:
- Replace ESM imports with require()
- Convert export statements 
- Replace import.meta.env with process.env

### 1.2 Server Routes
Create CommonJS version of `server/routes.ts`:
- Convert route handling logic to CommonJS format
- Ensure all imports are CommonJS compatible

### 1.3 Database Connection
Create CommonJS version of `server/db.ts`:
- Convert connection code to CommonJS format
- Ensure Drizzle ORM works with CommonJS

### 1.4 Storage Interface
Create CommonJS version of `server/storage.ts`:
- Convert interface and implementation to CommonJS format
- Ensure data persistence works correctly

## Step 2: Convert Vital Utility Modules

### 2.1 Scraper Integration
Create CommonJS version of scraper integration modules:
- Convert integration points for scraper modules
- Ensure API call formats are preserved

### 2.2 Auth System
Create CommonJS version of authentication system:
- Convert auth middleware to CommonJS format
- Ensure session management works correctly

## Step 3: Frontend Build System Adjustments

### 3.1 Vite Configuration
Create CommonJS version of vite.config.ts:
- Convert ESM vite config to CommonJS format
- Ensure all paths and aliases are correctly set

### 3.2 PostCSS Configuration
Create CommonJS version of postcss.config.js:
- Ensure CSS processing pipeline works correctly
- Fix any path resolution issues

## Step 4: Create Main Server Wrapper (CommonJS)

Create a new `server-cjs.js` file that:
- Uses CommonJS format
- Imports and configures all converted modules
- Serves the correct frontend build
- Uses the exact routes/endpoints as the original

## Step 5: Update Package Configuration

Modify `package.json` to:
- Set "type": "commonjs" 
- Update scripts to use CommonJS entry points
- Ensure all dependencies are compatible

## Step 6: Database Configuration

Ensure PostgreSQL connection works:
- Update connection string handling for Replit
- Set correct environment variables for DB access

## Step 7: Final Integration and Testing

- Test all API endpoints
- Verify database connectivity
- Ensure frontend functionality matches original
- Test bookmaker scraper functionality
- Verify tournament margin display

## Deployment

Once all conversions are complete:
1. Deploy using Replit deployment system
2. Verify application works in production environment
3. Confirm all original functionality is preserved

This plan addresses module format issues while preserving the exact functionality of your original application.