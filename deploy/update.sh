#!/usr/bin/env bash
# Deploy a new version: run after uploading new files (or `git pull`) into /opt/classic-friends
set -e
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
[ -d .git ] && git pull --ff-only
npm install --omit=dev
"$APP_DIR/deploy/backup.sh" || true
pm2 restart classic-friends --update-env
pm2 save
echo "updated and restarted ✔"
