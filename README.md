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

Deploy this repository to a Node.js 22+ host, run `npm ci --omit=dev`, and set `DATABASE_URL`, `ADMIN_PASSWORD`, `NODE_ENV=production`, and `PORT` as **server-side environment variables**. Run `npm run db:setup` once, then run `npm start` under the host's process manager. Put the app behind HTTPS and forward all paths, including `/admin` and `/api/*`, to the Node port. Do not put the password or database URL in public files or client-side build settings.

This app needs a persistent Node process and PostgreSQL. A static host such as GitHub Pages cannot run its admin API. The Supabase connection string is available in the Supabase dashboard under **Connect**; a session pooler URL is suitable when a host has IPv4-only networking.
