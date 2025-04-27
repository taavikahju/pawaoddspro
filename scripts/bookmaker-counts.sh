#!/bin/bash
# Script to get bookmaker event counts directly from PostgreSQL database

echo "======================================="
echo "     Bookmaker Events Report"
echo "======================================="
echo ""

# Run query to count events by bookmaker
echo "Event Count by Bookmaker:"
echo "----------------------------------------"
psql "$DATABASE_URL" -c "SELECT bookmaker, COUNT(*) as count FROM events GROUP BY bookmaker ORDER BY count DESC;"

echo ""
echo "======================================="
echo "     SportyBet Events by Country"
echo "======================================="
echo ""

# Run query to count SportyBet events by country
psql "$DATABASE_URL" -c "SELECT country, COUNT(*) as count FROM events WHERE bookmaker = 'sporty' GROUP BY country ORDER BY count DESC;"

echo ""
echo "======================================="
echo "     Top Leagues with Most Events"
echo "======================================="
echo ""

# Run query to count events by league
psql "$DATABASE_URL" -c "SELECT league, COUNT(*) as count FROM events GROUP BY league ORDER BY count DESC LIMIT 10;"