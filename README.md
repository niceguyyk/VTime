# VTime

A minimal time zone converter inspired by the dark VyronHosting interface. Choose a date and time, select two time zones, and see the converted time immediately.

## Features

- City time zones adjust for daylight saving time on the selected date.
- Fixed UTC offsets and abbreviations stay constant.
- Swap zones and copy the result.
- Runs entirely in the browser; no account, build step, or dependencies.

**Example:** 01:00 EDT (UTC−4) is 06:00 at fixed UTC+1. In Berlin during summer time (UTC+2), it is 07:00.

## Run locally

Open `dist/index.html` in a browser, or serve the `dist` directory with any static file server. For example:

```bash
python -m http.server 4173 --directory dist
```

Then visit `http://localhost:4173`.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes `dist/` when changes are pushed to `main`. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** if it is not already selected.
