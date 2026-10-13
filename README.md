# VTime

A minimal, dark time zone converter with a private staff meeting planner. The public converter supports city time zones, daylight saving time, fixed UTC offsets, and quick sharing. The database icon in the bottom right opens the staff panel.

## Staff planner

The password-protected panel at `/admin` stores each staff member's name, Discord ID, time zone, and usual hours in a **SQLite database on the VTime server**. Hours default to **13:00–21:00 in each person's local time** and can be edited. The panel shows current local times and finds meeting windows when all staff members' usual hours overlap on a selected date, displayed in your chosen time zone. These are estimates from saved hours, not live calendar or Discord presence.

The browser never receives the database file or admin password. The Node server owns sessions, validates input, and writes to the local database.

## Run locally

Requires Node.js 22 or newer.

1. Copy `.env.example` to `.env` and set `ADMIN_PASSWORD`. Keep `.env` out of Git.
2. Run `npm ci`.
3. Run `node --env-file=.env server.js`.
4. Open `http://localhost:3000`. Use the database icon to open the staff panel.

The database is created automatically at `DB_PATH` (default: `./data/vtime.sqlite`). Back up this file to preserve staff data. `GET /healthz` checks the local database. Run `npm test` for the planner and storage tests.

## VyronHosting deployment

The live site is **[vtime.vyronhosting.com](https://vtime.vyronhosting.com)**. The existing Ubuntu node `vtime` runs this repository from `/opt/vtime` with the [systemd unit](deploy/vtime.service) and [Nginx proxy](deploy/vtime.nginx.conf). Node binds to `127.0.0.1:3000`; Nginx listens on port 80 inside the guest. A dedicated Cloudflare Tunnel connects the hostname to Nginx using the [tunnel service](deploy/vtime-cloudflared.service).

The database lives at `/var/lib/vtime/vtime.sqlite`. Systemd creates that writable directory for the `vtime` service. Keep `/etc/vtime/vtime.env` readable only by root and set `ADMIN_PASSWORD` there. The SQLite database and tunnel token stay on the server and are never committed to Git.

To update the deployed app, pull `main` in `/opt/vtime`, run `npm ci --omit=dev`, install the latest `deploy/vtime.service` to `/etc/systemd/system/vtime.service`, then run `sudo systemctl daemon-reload && sudo systemctl restart vtime`. Check `https://vtime.vyronhosting.com/healthz` for `{"ok":true,"database":"local"}`.

For another Linux VPS, the repository also includes a [Caddy configuration](deploy/Caddyfile). Change its placeholder hostname to your domain, configure the systemd service and environment file, and point DNS to the server.
