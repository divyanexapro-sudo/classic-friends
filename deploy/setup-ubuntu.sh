#!/usr/bin/env bash
# ============================================================
# Classic Friends — one-shot server setup for Ubuntu 22.04 / 24.04
# Installs Node.js 20, pm2, Nginx, Certbot and a firewall, then
# starts the app with pm2. Run as root on a fresh server:
#
#   curl -fsSL https://raw.githubusercontent.com/<you>/classic-friends/main/deploy/setup-ubuntu.sh -o setup.sh
#   bash setup.sh app.yourdomain.com yourdomain.com you@email.com
#
# or, if you uploaded the folder to /opt/classic-friends already:
#   bash /opt/classic-friends/deploy/setup-ubuntu.sh app.yourdomain.com yourdomain.com you@email.com
# ============================================================
set -euo pipefail
APP_DOMAIN="${1:-}"; SITE_DOMAIN="${2:-}"; EMAIL="${3:-}"
APP_DIR="/opt/classic-friends"
if [ -z "$APP_DOMAIN" ] || [ -z "$EMAIL" ]; then echo "Usage: bash setup-ubuntu.sh app.yourdomain.com [yourdomain.com] you@email.com"; exit 1; fi
if [ "$(id -u)" -ne 0 ]; then echo "Please run as root (sudo bash setup-ubuntu.sh ...)"; exit 1; fi

echo "==> 1/7  System packages"
apt-get update -y && apt-get install -y curl git ufw nginx unzip

echo "==> 2/7  Node.js 20 + pm2"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
fi
npm install -g pm2 >/dev/null

echo "==> 3/7  App folder at $APP_DIR"
mkdir -p "$APP_DIR"
if [ ! -f "$APP_DIR/package.json" ]; then
  echo "    Upload the project to $APP_DIR (scp / SFTP / git clone), then run this script again."; exit 1
fi
cd "$APP_DIR" && npm install --omit=dev
mkdir -p "$APP_DIR/server/data" "$APP_DIR/backups"

echo "==> 4/7  Environment (.env)"
if [ ! -f "$APP_DIR/.env" ]; then
  TOKEN="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 28)"
  cat > "$APP_DIR/.env" <<ENV
PORT=3000
ADMIN_TOKEN=$TOKEN
BOTS=10
START_COINS=200
ENV
  echo "    Created .env with a random ADMIN_TOKEN: $TOKEN   (keep it safe!)"
fi

echo "==> 5/7  Start with pm2"
pm2 start "$APP_DIR/deploy/ecosystem.config.js" --update-env >/dev/null
pm2 save >/dev/null
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

echo "==> 6/7  Nginx"
sed "s/APP_DOMAIN/$APP_DOMAIN/g" "$APP_DIR/deploy/nginx-app.conf" > /etc/nginx/sites-available/classic-friends-app
ln -sf /etc/nginx/sites-available/classic-friends-app /etc/nginx/sites-enabled/classic-friends-app
if [ -n "$SITE_DOMAIN" ]; then
  sed "s/SITE_DOMAIN/$SITE_DOMAIN/g; s#APP_DIR#$APP_DIR#g" "$APP_DIR/deploy/nginx-site.conf" > /etc/nginx/sites-available/classic-friends-site
  ln -sf /etc/nginx/sites-available/classic-friends-site /etc/nginx/sites-enabled/classic-friends-site
fi
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> 7/7  Firewall + HTTPS"
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null
apt-get install -y certbot python3-certbot-nginx >/dev/null
DOMAINS="-d $APP_DOMAIN"; [ -n "$SITE_DOMAIN" ] && DOMAINS="$DOMAINS -d $SITE_DOMAIN -d www.$SITE_DOMAIN"
certbot --nginx $DOMAINS --non-interactive --agree-tos -m "$EMAIL" --redirect || echo "    Certbot could not issue a certificate yet — check that DNS points to this server, then run: certbot --nginx $DOMAINS"

echo
echo "All done 🎉"
echo "  App     → https://$APP_DOMAIN"
echo "  Admin   → https://$APP_DOMAIN/admin/   token: $(grep ADMIN_TOKEN "$APP_DIR/.env" | cut -d= -f2)"
[ -n "$SITE_DOMAIN" ] && echo "  Website → https://$SITE_DOMAIN"
echo "  Logs    → pm2 logs classic-friends"
