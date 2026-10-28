#!/usr/bin/env bash
# Copies the member snapshot to backups/ with a timestamp and keeps the last 30.
# Daily at 03:00:  crontab -e  →  0 3 * * * /opt/classic-friends/deploy/backup.sh
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$APP_DIR/backups"
[ -f "$APP_DIR/server/data/users.json" ] && cp "$APP_DIR/server/data/users.json" "$APP_DIR/backups/users-$(date +%Y%m%d-%H%M).json"
ls -1t "$APP_DIR"/backups/users-*.json 2>/dev/null | tail -n +31 | xargs -r rm --
echo "backup done: $(ls "$APP_DIR/backups" | wc -l) files"
