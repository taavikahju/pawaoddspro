#!/bin/bash
# Automated database backup script for pawaodds.pro
# Set up as a cron job: 0 3 * * * /path/to/backup-db.sh

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/home/deploy/backups"
BACKUP_FILE="$BACKUP_DIR/pawaodds_$TIMESTAMP.sql"
DATABASE="pawaodds"
USER="pawauser"
RETENTION_DAYS=7  # How many days to keep backups

# Ensure backup directory exists
mkdir -p $BACKUP_DIR

# Create the backup
echo "Creating database backup at $BACKUP_FILE"
pg_dump -U $USER $DATABASE > $BACKUP_FILE
if [ $? -eq 0 ]; then
    echo "Database backup successful."
else
    echo "Database backup failed!"
    exit 1
fi

# Compress the backup
echo "Compressing backup..."
gzip $BACKUP_FILE
if [ $? -eq 0 ]; then
    echo "Compression successful: ${BACKUP_FILE}.gz"
else
    echo "Compression failed!"
    exit 1
fi

# Delete old backups
echo "Removing backups older than $RETENTION_DAYS days..."
find $BACKUP_DIR -name "pawaodds_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
echo "Cleanup complete."

# Print summary
echo "Backup completed at $(date)"
echo "Total backups: $(find $BACKUP_DIR -name "pawaodds_*.sql.gz" | wc -l)"
echo "Disk usage: $(du -sh $BACKUP_DIR | cut -f1)"