require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Setup
const client = new MongoClient(process.env.MONGODB_URI);
let db;
let favoritesCollection;
const mongoDbName = process.env.MONGODB_DB_NAME || 'HW3';

async function connectDB() {
  try {
    await client.connect();
    db = client.db(process.env.MONGODB_DB_NAME);
    favoritesCollection = db.collection(process.env.MONGODB_COLLECTION);
    app.locals.db = db;
    console.log('[mongo] connected', mongoDbName ? `db=${mongoDbName}` : '');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    // Do NOT exit the process — keep the server available for endpoints that don't require DB
    // favoritesCollection will remain undefined until a successful connection is made.
  }
}

// Connect to database before starting server
connectDB();

// Test route
app.get('/', (req, res) => {
  res.send('Hello from App Engine!');
});

// ============ API ROUTES ============

// Test API endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!', timestamp: new Date() });
});

// Get all favorites
app.get('/api/favorites', async (req, res) => {
  try {
    if (!favoritesCollection) {
      return res.status(503).json({ error: 'Database not connected' })
    }
    let favorites = await favoritesCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // Enrich any legacy docs missing snapshot/image/venue/date
    const needsEnrichment = favorites.filter(f => !(f && f.snapshot && (f.image || (f.snapshot.images && f.snapshot.images.length)) && (f.venue || (f.snapshot._embedded && f.snapshot._embedded.venues)) && (f.date || (f.snapshot.dates && f.snapshot.dates.start))))
    if (needsEnrichment.length > 0) {
      const enriched = await Promise.all(needsEnrichment.map(async (doc) => {
        try {
          const url = `https://app.ticketmaster.com/discovery/v2/events/${doc.eventId}?apikey=${process.env.TICKETMASTER_API_KEY}`;
          const r = await fetch(url)
          if (!r.ok) return null
          const ev = await r.json()
          const imgPick = Array.isArray(ev.images) && (ev.images.find(i => (i.ratio || '').toLowerCase() === '16_9') || ev.images[0])
          const patch = {
            snapshot: ev,
            image: doc.image || imgPick?.url || null,
            venue: doc.venue || ev?._embedded?.venues?.[0]?.name || null,
            date: doc.date || ev?.dates?.start?.localDate || null,
          }
          await favoritesCollection.updateOne({ _id: doc._id }, { $set: patch })
          return { id: doc._id, patch }
        } catch {
          return null
        }
      }))
      const map = new Map(enriched.filter(Boolean).map(e => [String(e.id), e.patch]))
      favorites = favorites.map(f => {
        const p = map.get(String(f._id))
        return p ? { ...f, ...p } : f
      })
    }

    res.json(favorites);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}...`);
});

// Ticketmaster Autocomplete/Suggest API
app.get('/api/suggest', async (req, res) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    const url = `https://app.ticketmaster.com/discovery/v2/suggest?apikey=${process.env.TICKETMASTER_API_KEY}&keyword=${encodeURIComponent(keyword)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// Ticketmaster Event Search API
app.get('/api/events', async (req, res) => {
  try {
    const { keyword, category, location, distance, autoDetect } = req.query;
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    const IPINFO_TOKEN = process.env.IPINFO_TOKEN;

    // Simple in-memory cache for geocoding results to reduce API calls
    // key: normalized address string, value: { lat, lng, ts }
    const geoCache = app.locals._geoCache || (app.locals._geoCache = new Map());

    async function geocodeAddress(address) {
      try {
        if (!address || !GOOGLE_MAPS_API_KEY) {
          console.log('Geocoding skipped: missing address or API key');
          return null;
        }
        const key = address.trim().toLowerCase();
        if (geoCache.has(key)) {
          console.log('Geocoding cache hit for:', key);
          return geoCache.get(key);
        }
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
        console.log('Calling Google Geocoding API for:', address);
        const r = await fetch(url);
        if (!r.ok) {
          console.warn('Geocoding HTTP error:', r.status, r.statusText);
          return null;
        }
        const gj = await r.json();
        console.log('Geocoding response status:', gj.status);
        
        if (gj.status === 'ZERO_RESULTS') {
          console.warn('Geocoding returned no results for:', address);
          return null;
        }
        if (gj.status !== 'OK') {
          console.warn('Geocoding failed with status:', gj.status, gj.error_message || '');
          return null;
        }
        
        const first = gj?.results?.[0]?.geometry?.location;
        if (first && typeof first.lat === 'number' && typeof first.lng === 'number') {
          const coords = { lat: first.lat, lng: first.lng, ts: Date.now() };
          console.log('Geocoded successfully:', address, '->', coords.lat, coords.lng);
          geoCache.set(key, coords);
          return coords;
        }
      } catch (e) {
        console.warn('Geocoding exception:', e?.message || e);
      }
      return null;
    }
    
    async function getLocationFromIP() {
      try {
        if (!IPINFO_TOKEN) {
          console.log('⚠ IPinfo token not available in environment, skipping IP geolocation');
          return null;
        }
        
        // Simply call ipinfo.io without IP parameter - it automatically detects the requesting client's IP
        const url = `https://ipinfo.io/?token=${IPINFO_TOKEN}`;
        console.log('Calling IPinfo API to auto-detect location');
        const r = await fetch(url);
        if (!r.ok) {
          console.warn('IPinfo HTTP error:', r.status, r.statusText);
          const errorText = await r.text().catch(() => '');
          console.warn('IPinfo error response:', errorText);
          return null;
        }
        const ipData = await r.json();
        console.log('IPinfo response:', JSON.stringify(ipData, null, 2));
        
        // IPinfo returns loc as "lat,lng"
        if (ipData && ipData.loc) {
          const [lat, lng] = ipData.loc.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            const coords = { lat, lng, city: ipData.city || '', region: ipData.region || '' };
            console.log('✓ IP geolocation successful:', coords);
            return coords;
          } else {
            console.warn('Invalid lat/lng from IPinfo:', ipData.loc);
          }
        } else {
          console.warn('No "loc" field in IPinfo response');
        }
      } catch (e) {
        console.warn('IP geolocation exception:', e?.message || e);
      }
      return null;
    }
    
    // Map category names to Ticketmaster segment IDs
    const categoryMap = {
      'all': null,
      'music': 'KZFzniwnSyZfZ7v7nJ', // Music
      'sports': 'KZFzniwnSyZfZ7v7nE', // Sports
      'arts': 'KZFzniwnSyZfZ7v7na', // Arts & Theatre
      'film': 'KZFzniwnSyZfZ7v7nn', // Film
      'miscellaneous': 'KZFzniwnSyZfZ7v7n1'  // Miscellaneous
    };
    
  // Build URL with parameters
    let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}`;
    
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    
    // Add category filter if not "all"
    const segmentId = categoryMap[category?.toLowerCase()];
    if (segmentId) {
      // Use segmentId parameter to filter by primary segment/category
      url += `&segmentId=${segmentId}`;
    }
    
    // Add location and distance for geographic filtering
    let locationCoords = null;
    
    if (autoDetect === 'true') {
      // Use IP-based geolocation when auto-detect is enabled
      console.log('Auto-detect enabled, using IPinfo to detect location');
      locationCoords = await getLocationFromIP();
      
      if (locationCoords) {
        console.log('IP geolocation succeeded:', locationCoords);
      } else {
        console.warn('IP geolocation failed, will proceed without location filter');
      }
    } else if (location && location !== '') {
      // Use manual location with geocoding
      console.log('Manual location provided:', location);
      locationCoords = await geocodeAddress(location);
    }
    
    if (locationCoords && typeof locationCoords.lat === 'number' && typeof locationCoords.lng === 'number') {
      url += `&latlong=${locationCoords.lat},${locationCoords.lng}`;
      console.log('✓ Added latlong to Ticketmaster URL:', locationCoords.lat, locationCoords.lng);
    } else if (location && location !== '' && autoDetect !== 'true') {
      // Fallback: if geocode failed and we have a manual location, use city filter
      console.log('Geocoding failed, falling back to city parameter:', location);
      url += `&city=${encodeURIComponent(location)}`;
    } else {
      console.warn('⚠ No location parameters added - search will be global');
    }
    
    if (distance) {
      url += `&radius=${distance}&unit=miles`;
    }
    
    console.log('Ticketmaster API URL:', url);
    console.log('Category filter:', category, '-> Segment ID:', segmentId);
    
    const response = await fetch(url);
    const data = await response.json();
    
    // If we have a category filter, also defensively filter the results on backend
    if (segmentId && data._embedded && data._embedded.events) {
      const beforeCount = data._embedded.events.length;
      data._embedded.events = data._embedded.events.filter(event => {
        if (!event.classifications || event.classifications.length === 0) return false;
        // Some events may have multiple classification entries — accept if any match the segment
        return event.classifications.some(c => c && c.segment && c.segment.id === segmentId);
      });
      const afterCount = data._embedded.events.length;
      console.log(`Filtered events by segmentId=${segmentId}: before=${beforeCount} after=${afterCount}`);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Ticketmaster Event Details API
app.get('/api/event/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const url = `https://app.ticketmaster.com/discovery/v2/events/${id}?apikey=${process.env.TICKETMASTER_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching event details:', error);
    res.status(500).json({ error: 'Failed to fetch event details' });
  }
});

// Spotify Artist Search API
app.get('/api/spotify/artist', async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    // Get Spotify access token
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

    // Search for artist
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const searchData = await searchResponse.json();
    
    if (searchData.artists && searchData.artists.items.length > 0) {
      const artist = searchData.artists.items[0];
      const artistId = artist.id;
      
      // Get artist's albums - show up to 20 items
      // Build query with URLSearchParams to avoid encoding issues
      const albumParams = new URLSearchParams({
        limit: '20',
        offset: '0',
        include_groups: 'album,single',
        market: 'US',
      });
      const albumsUrl = `https://api.spotify.com/v1/artists/${artistId}/albums?${albumParams.toString()}`;
      const albumsResponse = await fetch(albumsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const albumsData = await albumsResponse.json();
      // Return items as-is (max 20); some artists may have fewer available in the set/market
      res.json({
        artist: artist,
        albums: Array.isArray(albumsData.items) ? albumsData.items : []
      });
    } else {
      res.json({ artist: null, albums: [] });
    }
  } catch (error) {
    console.error('Error fetching Spotify data:', error);
    res.status(500).json({ error: 'Failed to fetch Spotify data' });
  }
});

// Add event to favorites
app.post('/api/favorites', async (req, res) => {
  try {
    if (!favoritesCollection) {
      return res.status(503).json({ error: 'Database not connected' })
    }
    // Accept either { event: <tm-event> } or raw Ticketmaster event payload
    const raw = req.body || {};
    const ev = raw.event || raw;

    if (!ev || !ev.id || !ev.name) {
      return res.status(400).json({ error: 'Invalid event payload' })
    }

    // Derive fields for storage to match required shape
    const eventId = ev.id;
    const date = ev?.dates?.start?.localDate || null;
    // Prefer a 16:9 image if available, else first image
    let image = null;
    if (Array.isArray(ev.images) && ev.images.length > 0) {
      const pick = ev.images.find(img => (img.ratio || '').toLowerCase() === '16_9') || ev.images[0];
      image = pick?.url || null;
    }
    const venue = ev?._embedded?.venues?.[0]?.name || null;

    // Check if event already exists (by eventId)
    const existing = await favoritesCollection.findOne({ eventId });
    if (existing) {
      return res.status(409).json({ error: 'Event already in favorites' });
    }

    const doc = {
      eventId,
      createdAt: new Date(),
      date,
      image,
      name: ev.name,
      venue,
      snapshot: ev,
    };

    const result = await favoritesCollection.insertOne(doc);
    res.status(201).json({ message: 'Event added to favorites', id: result.insertedId, doc });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove event from favorites (by eventId)
app.delete('/api/favorites/:id', async (req, res) => {
  try {
    if (!favoritesCollection) {
      return res.status(503).json({ error: 'Database not connected' })
    }
    const { id } = req.params;
    
    const result = await favoritesCollection.deleteOne({ eventId: id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    
    res.json({ message: 'Event removed from favorites' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});