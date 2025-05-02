#!/bin/bash
# Script to install the crontab entry on the production server

# Make the run-scrapers.sh script executable
chmod +x /var/www/pawaodds/current/scripts/run-scrapers.sh

# Add crontab entry (appends to existing crontab)
(crontab -l 2>/dev/null; cat /var/www/pawaodds/current/scripts/crontab-entry.txt) | crontab -

echo "Crontab entry installed. Current crontab entries:"
crontab -l