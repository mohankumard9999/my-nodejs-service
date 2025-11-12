# HW3 Event Search – Deployment & SPA Verification

This repository contains a React (Vite) SPA in `client/` and an Express backend in `server/`. The backend proxies Ticketmaster and other APIs, persists Favorites to MongoDB, and can serve the built SPA with a catch‑all route for deep linking.

## What graders need to verify

- No direct Ticketmaster calls from the frontend (frontend only calls `/api/*`).
- Favorites come from the backend and persist across browser restarts (MongoDB).
- SPA behavior: No full page reloads for data; deep links like `/event/:id` render the app (server returns `index.html` for non‑API routes).
- Deployed on GCP with a live API link returning JSON.

## Local development

- Client dev server (with proxy to backend):
  - From `client/` run: `npm run dev`
- Backend dev server:
  - From `server/` run: `npm start`
- Vite dev server proxies `/api/*` to `http://localhost:8080` (see `client/vite.config.js`).

## Production-like local test (SPA served by backend)

1. Build the client and copy assets into the server folder:
   - From `server/`: `npm run build:spa`
   - This runs `npm --prefix ../client run build` and copies `../client/dist` into `server/client-dist`.
2. Start the server: `npm start`
3. Visit:
   - `http://localhost:8080/` (SPA)
   - `http://localhost:8080/search` and `http://localhost:8080/favorites` (deep links)
   - `http://localhost:8080/api/test` (JSON health check)
4. Refresh on any SPA route. The page should render the React app (no server 404 HTML).

## GCP deployment (App Engine)

1. Ensure environment variables are set in your App Engine service:
   - `TICKETMASTER_API_KEY`
   - `MONGODB_URI`
   - `MONGODB_DB_NAME`
   - `MONGODB_COLLECTION`
   - `GOOGLE_MAPS_API_KEY` (or `GOOGLE_API_KEY`)
   - `IPINFO_TOKEN`
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
2. Build the SPA into the server folder (so Express can find it):
   - From `server/`: `npm run build:spa`
3. Deploy from the `server/` directory (contains `app.yaml`):
   - `gcloud app deploy`
4. Verification links to include in your submission:
   - Live API: `https://YOUR_APP_URL/api/test` (returns JSON)
   - SPA root: `https://YOUR_APP_URL/`
   - Deep link examples: `https://YOUR_APP_URL/search`, `https://YOUR_APP_URL/favorites`, `https://YOUR_APP_URL/event/EXAMPLE_ID`

## Notes on compliance

- Frontend never calls Ticketmaster directly; all requests go through `/api/*` on the backend.
- Favorites list is loaded from `/api/favorites` and stored in MongoDB, so it persists across browser restarts.
- The server includes a catch‑all route that serves `index.html` for any non‑API path and a JSON 404 for unknown `/api/*` routes.

## Troubleshooting

- If deep links 404 in production, ensure you ran `npm run build:spa` before deploying, so the server has `client-dist` assets.
- If geocoding or suggestions return errors, confirm the corresponding API keys are set in the deployment environment.
- During local dev, keep both client and server running; the Vite dev server proxies `/api/*` to avoid CORS.
