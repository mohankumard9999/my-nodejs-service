require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DEBUG = process.env.DEBUG === 'true';
const debug = (...args) => { if (DEBUG) console.debug(...args); };

const client = new MongoClient(process.env.MONGODB_URI);
let favoritesCollection;
const mongoDbName = process.env.MONGODB_DB_NAME || 'HW3';
const collectionName = process.env.MONGODB_COLLECTION || 'favorites';

async function connectDB() {
  try {
    await client.connect();
    const db = client.db(mongoDbName);
    favoritesCollection = db.collection(collectionName);
    app.locals.db = db;
    console.info('✅ MongoDB connected', mongoDbName ? `db=${mongoDbName}` : '');
    console.info('📦 Using collection', collectionName);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message || error);
  }
}
connectDB();

// Root route will be handled by SPA fallback if a client build is present.
// Otherwise, we expose a simple text root endpoint after static setup below.
app.get('/api/test', (_req, res) => res.json({ message: 'Backend is working!', timestamp: new Date() }));

app.get('/api/favorites', async (_req, res) => {
  try {
    if (!favoritesCollection) return res.status(503).json({ error: 'Database not connected' });
    const favorites = await favoritesCollection.find({}).sort({ createdAt: 1 }).toArray();
    res.json(favorites);
  } catch (error) {
    console.error('Error fetching favorites:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

app.post('/api/favorites', async (req, res) => {
  try {
    if (!favoritesCollection) return res.status(503).json({ error: 'Database not connected' });
    const raw = req.body || {}; const ev = raw.event || raw;
    if (!ev || !ev.id || !ev.name) return res.status(400).json({ error: 'Invalid event payload' });
    const eventId = ev.id;
    const existing = await favoritesCollection.findOne({ eventId });
    if (existing) return res.status(409).json({ error: 'Event already in favorites' });
    const date = ev?.dates?.start?.localDate || null;
    let image = null;
    if (Array.isArray(ev.images) && ev.images.length > 0) {
      const pick = ev.images.find(img => (img.ratio || '').toLowerCase() === '16_9') || ev.images[0];
      image = pick?.url || null;
    }
    const venue = ev?._embedded?.venues?.[0]?.name || null;
    const doc = { eventId, createdAt: new Date(), date, image, name: ev.name, venue, snapshot: ev };
    const result = await favoritesCollection.insertOne(doc);
    res.status(201).json({ message: 'Event added to favorites', id: result.insertedId, doc });
  } catch (error) {
    console.error('Error adding favorite:', error.message || error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

app.delete('/api/favorites/:id', async (req, res) => {
  try {
    if (!favoritesCollection) return res.status(503).json({ error: 'Database not connected' });
    const { id } = req.params;
    const result = await favoritesCollection.deleteOne({ eventId: id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Favorite not found' });
    res.json({ message: 'Event removed from favorites' });
  } catch (error) {
    console.error('Error removing favorite:', error.message || error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

app.get('/api/suggest', async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ error: 'Keyword is required' });
    const url = `https://app.ticketmaster.com/discovery/v2/suggest?apikey=${process.env.TICKETMASTER_API_KEY}&keyword=${encodeURIComponent(keyword)}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching suggestions:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const { keyword, category, location, distance, autoDetect } = req.query;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    const IPINFO_TOKEN = process.env.IPINFO_TOKEN;
    const geoCache = app.locals._geoCache || (app.locals._geoCache = new Map());

    async function geocodeAddress(address) {
      try {
        if (!address || !GOOGLE_MAPS_API_KEY) { debug('Geocode skipped: missing address or key'); return null; }
        const key = address.trim().toLowerCase();
        if (geoCache.has(key)) { debug('Geocode cache hit:', key); return geoCache.get(key); }
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
        debug('Geocode call:', address);
        const r = await fetch(url);
        if (!r.ok) { console.warn('Geocode HTTP error', r.status, r.statusText); return null; }
        const gj = await r.json();
        debug('Geocode status:', gj.status);
        if (gj.status === 'ZERO_RESULTS') { console.warn('Geocode zero results:', address); return null; }
        if (gj.status !== 'OK') { console.warn('Geocode failure:', gj.status, gj.error_message || ''); return null; }
        const first = gj?.results?.[0]?.geometry?.location;
        if (first && typeof first.lat === 'number' && typeof first.lng === 'number') {
          const coords = { lat: first.lat, lng: first.lng, ts: Date.now() };
            debug('Geocode success:', address, coords);
          geoCache.set(key, coords); return coords;
        }
      } catch (e) { console.warn('Geocode exception:', e?.message || e); }
      return null;
    }

    async function ipLocate() {
      try {
        if (!IPINFO_TOKEN) { debug('IP locate skipped: no token'); return null; }
        const url = `https://ipinfo.io/?token=${IPINFO_TOKEN}`; debug('IPinfo call');
        const r = await fetch(url);
        if (!r.ok) { console.warn('IPinfo HTTP error', r.status, r.statusText); return null; }
        const ipData = await r.json(); debug('IPinfo data:', ipData);
        if (ipData && ipData.loc) {
          const [lat, lng] = ipData.loc.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lng)) return { lat, lng, city: ipData.city || '', region: ipData.region || '' };
          console.warn('Invalid IPinfo loc', ipData.loc);
        } else { console.warn('IPinfo missing loc field'); }
      } catch (e) { console.warn('IPinfo exception:', e?.message || e); }
      return null;
    }

    const categoryMap = {
      all: null,
      music: 'KZFzniwnSyZfZ7v7nJ',
      sports: 'KZFzniwnSyZfZ7v7nE',
      arts: 'KZFzniwnSyZfZ7v7na',
      film: 'KZFzniwnSyZfZ7v7nn',
      miscellaneous: 'KZFzniwnSyZfZ7v7n1'
    };

    let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}`;
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    const segmentId = categoryMap[category?.toLowerCase()];
    if (segmentId) url += `&segmentId=${segmentId}`;

    let coords = null;
    if (autoDetect === 'true') {
      debug('Auto-detect enabled');
      coords = await ipLocate();
      if (!coords) console.warn('IP geo failed; continuing without location');
    } else if (location) {
      coords = await geocodeAddress(location);
    }

    if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
      url += `&latlong=${coords.lat},${coords.lng}`; debug('Added latlong');
    } else if (location && autoDetect !== 'true') {
      console.warn('Using city fallback for location filter');
      url += `&city=${encodeURIComponent(location)}`;
    } else {
      debug('Global search (no location)');
    }

    if (distance) url += `&radius=${distance}&unit=miles`;
    debug('Ticketmaster URL:', url); debug('Category:', category, 'Segment:', segmentId);

    const response = await fetch(url);
    const data = await response.json();

    if (segmentId && data._embedded?.events) {
      const before = data._embedded.events.length;
      data._embedded.events = data._embedded.events.filter(ev => ev.classifications?.some(c => c.segment?.id === segmentId));
      debug('Filtered events count:', before, '->', data._embedded.events.length);
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching events:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.get('/api/event/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const url = `https://app.ticketmaster.com/discovery/v2/events/${id}?apikey=${process.env.TICKETMASTER_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching event details:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch event details' });
  }
});

app.get('/api/spotify/artist', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Artist name is required' });

    const authResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });
    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`;
    const searchResponse = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const searchData = await searchResponse.json();

    if (searchData.artists?.items?.length) {
      const artist = searchData.artists.items[0];
      const artistId = artist.id;
      const albumParams = new URLSearchParams({ limit: '50', offset: '0', include_groups: 'album', market: 'US' });
      const albumsUrl = `https://api.spotify.com/v1/artists/${artistId}/albums?${albumParams.toString()}`;
      const albumsResponse = await fetch(albumsUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      const albumsData = await albumsResponse.json();
      res.json({ artist, albums: Array.isArray(albumsData.items) ? albumsData.items : [] });
    } else {
      res.json({ artist: null, albums: [] });
    }
  } catch (error) {
    console.error('Error fetching Spotify data:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch Spotify data' });
  }
});

// Return JSON 404 for unknown API routes (kept after all known API handlers)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---- SPA static hosting (production) ----
// If a built client exists at ../client/dist, serve it and fall back to index.html for non-API routes
try {
  // Try common build output locations; first match wins.
  const candidates = [
    path.resolve(__dirname, '../client/dist'), // monorepo-style: sibling client
    path.resolve(__dirname, './client-dist'),  // copied into server directory
    path.resolve(__dirname, './public'),       // conventional static folder
  ];
  const CLIENT_DIST = candidates.find(p => fs.existsSync(p));
  if (CLIENT_DIST) {
    app.locals.serveSpa = true;
    app.use(express.static(CLIENT_DIST));
    // Any non-API route should return the SPA index.html
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
    console.info('🧩 SPA static files served from', CLIENT_DIST);
  } else {
    app.locals.serveSpa = false;
    console.info('ℹ️ No SPA build folder found (checked: ', candidates.join(', '), ')');
  }
} catch (e) {
  console.warn('SPA static hosting setup failed:', e?.message || e);
}

// If SPA is not served, provide a simple root endpoint for sanity
if (!app.locals.serveSpa) {
  app.get('/', (_req, res) => res.send('Hello from App Engine!'));
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.info(`🚀 Server listening on port ${PORT}`));
