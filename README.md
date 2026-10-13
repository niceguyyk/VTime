# VTime

A minimal, dark time zone converter with a private staff meeting planner. The public converter handles city time zones, daylight saving time, fixed UTC offsets, and quick sharing. The staff panel opens from the database icon in the bottom right.

## Staff planner

The password protected panel at `/admin` stores a staff member's name, Discord ID, time zone, and usual availability in Supabase Postgres. Hours default to **13:00–21:00 in each person's local time** and can be edited per person. It shows everyone's current local time and finds the times when all staff members' usual hours overlap on a selected date, displayed in your chosen time zone. It suggests a one-hour meeting when a full overlap lasts at least one hour and shows the best partial overlap otherwise. These are estimates from saved hours, not live calendar or Discord presence.

The browser never receives the database connection string or admin password. The Node server owns sessions, validates input, and queries the private `vtime` database schema.

## Run locally

Requires Node.js 22 or newer and a Supabase Postgres connection string.

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to the connection string from your Supabase project and `ADMIN_PASSWORD` to your private password. Keep `.env` out of Git.
2. Install dependencies with `npm ci`.
3. Run the schema with `node --env-file=.env scripts/setup-db.js`.
4. Start the server with `node --env-file=.env server.js`.
5. Open `http://localhost:3000` and use the bottom-right database icon to open the staff panel.

For a shell or hosting platform that supplies environment variables directly, use `npm run db:setup` once and `npm start` to launch. `GET /healthz` checks the database connection. Run `npm test` for the meeting calculation tests.

## Deploy on a Node server

The intended host name is **`vtime.vyrontechnologies.com`** and the Supabase project is **`https://dfselfzlatvlqqycdcsk.supabase.co`**. The project URL identifies the project, but it is not a Postgres connection string. Copy the Postgres URI from that project's **Connect** panel and use it as `DATABASE_URL`. Keep `ADMIN_PASSWORD` and `DATABASE_URL` only in server environment variables.

### VyronHosting node `vtime`

The `vtime` VyronHosting node is an Ubuntu VPS with a managed hostname, `vtime.vyronhosting.com`. It runs this repository from `/opt/vtime` with the [systemd unit](deploy/vtime.service) and [Nginx proxy](deploy/vtime.nginx.conf). The service binds Node to `127.0.0.1:3000`; Nginx serves HTTP on port 80 inside the guest while Vyron handles the public HTTPS route. Set `ADMIN_PASSWORD` in `/etc/vtime/vtime.env` and add `DATABASE_URL` there when ready. Restart `vtime.service` after editing the environment file. Its startup step applies the Supabase schema whenever `DATABASE_URL` is configured.

The public converter can start before `DATABASE_URL` is set. The staff panel then shows a database configuration error until the connection is added. For the custom domain, connect `vtime.vyrontechnologies.com` to this node in VyronHosting and add the DNS verification and routing records shown by the domain panel. DNS must resolve before the custom URL can work.

### Other Linux VPS

This repository includes a [systemd unit](deploy/vtime.service) and [Caddy configuration](deploy/Caddyfile) for a Linux VPS. With Node.js 22+, Git, and Caddy installed:

1. Point the domain's `A` record (and `AAAA` if using IPv6) to the server. Confirm it resolves before starting Caddy.
2. Clone the repository to `/opt/vtime` and run `npm ci --omit=dev` there.
3. Create a system user `vtime` with read access to `/opt/vtime`.
4. Create `/etc/vtime/vtime.env` readable only by root. Set `NODE_ENV=production`, `HOST=127.0.0.1`, `PORT=3000`, `ADMIN_PASSWORD`, and `DATABASE_URL`. Use the requested panel password as `ADMIN_PASSWORD`; keep the actual value out of the repository. URL-encode special characters in the database password if needed.
5. Copy `deploy/vtime.service` to `/etc/systemd/system/vtime.service`, then run `sudo systemctl daemon-reload && sudo systemctl enable --now vtime`. The service creates or updates the private `vtime` schema before starting Node.
6. Add `deploy/Caddyfile` to your Caddy configuration and reload Caddy. It terminates HTTPS and proxies the full site, including `/admin` and `/api/*`, to Node on localhost.
7. Check `https://vtime.vyrontechnologies.com/healthz` for `{"ok":true}`, then sign in at `/admin` and add staff.

If the server already uses another HTTPS reverse proxy, configure it to forward all paths to `127.0.0.1:3000` instead of installing Caddy. Do not expose port 3000 publicly. On a container host, set `HOST=0.0.0.0` and use the host's HTTPS routing.

This app needs a persistent Node process and PostgreSQL. A static host such as GitHub Pages cannot run its admin API. The Supabase connection string is available in the Supabase dashboard under **Connect**; a session pooler URL is suitable when a host has IPv4-only networking.
