# Geocoding Integration

The `/api/events` endpoint now uses the Google Maps Geocoding API to convert a user-entered location string into latitude/longitude coordinates and passes them to Ticketmaster's Discovery API via the `latlong` parameter for more accurate proximity searching.

## Environment Variable

Set the following in your `.env` file (not committed) or deployment environment:

```
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

Existing required vars:
```
TICKETMASTER_API_KEY=...
MONGODB_URI=...
MONGODB_DB_NAME=...
MONGODB_COLLECTION=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

## Behavior
1. User supplies `location` in search form (not auto-detect).
2. Server attempts to geocode the `location` string.
3. If successful, adds `latlong=lat,lng` to Ticketmaster request; else falls back to `city=location`.
4. Radius still controlled by `distance` query param (miles).
5. Simple in-memory cache (Map) reduces repeated geocode calls during the server lifetime.

## Fallbacks & Errors
- If Google Geocoding API key is missing or geocode fails, the server quietly falls back to `&city=` behavior.
- Geocode errors are logged with `Geocoding failed:` but do not break the request flow.

## Testing Locally
1. Add your key to `server/.env`.
2. Restart server: `npm start`.
3. Query:
   ```
   curl 'http://localhost:8080/api/events?keyword=rock&category=music&distance=25&location=Boston&autoDetect=false'
   ```
4. Observe console log for `Ticketmaster API URL:` containing either `latlong=` if geocode succeeded or `city=` if not.

## Notes
- Cache does not expire; restart clears it. For production you may want TTL eviction.
- For addresses with full street info, Ticketmaster may narrow results significantly. Consider adjusting radius or offering user feedback.
