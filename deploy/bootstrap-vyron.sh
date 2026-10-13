#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git nginx
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/vtime-nodesource-setup.sh
bash /tmp/vtime-nodesource-setup.sh
apt-get install -y -qq nodejs

if [ -d /opt/vtime/.git ]; then
  git -C /opt/vtime pull --ff-only
else
  git clone --depth 1 https://github.com/niceguyyk/VTime.git /opt/vtime
fi
cd /opt/vtime
npm ci --omit=dev

if ! id -u vtime >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin vtime
fi
install -d -m 700 -o root -g root /etc/vtime
install -m 644 deploy/vtime.service /etc/systemd/system/vtime.service
install -m 644 deploy/vtime.nginx.conf /etc/nginx/sites-available/vtime
ln -sfn /etc/nginx/sites-available/vtime /etc/nginx/sites-enabled/vtime
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable --now nginx
systemctl reload nginx

echo "VTime bootstrap complete. Node $(node --version), npm $(npm --version)."
