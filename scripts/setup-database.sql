-- PostgreSQL Initial Setup Script for pawaodds.pro
-- Run as postgres user: sudo -u postgres psql -f setup-database.sql

-- Create database
CREATE DATABASE pawaodds;

-- Create user with password (change this to a secure password)
CREATE USER pawauser WITH ENCRYPTED PASSWORD 'your_strong_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE pawaodds TO pawauser;

-- Connect to the new database
\c pawaodds

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant superuser temporarily for initial setup
ALTER USER pawauser WITH SUPERUSER;

-- Note: After initialization and running the application once,
-- you should revoke superuser privileges for security:
-- ALTER USER pawauser WITH NOSUPERUSER;