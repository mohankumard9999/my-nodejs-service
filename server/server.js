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
    process.exit(1);
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
    const favorites = await favoritesCollection.find({}).toArray();
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
    const { keyword, radius, segmentId, geoPoint } = req.query;
    
    // Build URL with parameters
    let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}`;
    
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    if (radius) url += `&radius=${radius}`;
    if (segmentId && segmentId !== 'Default') url += `&segmentId=${segmentId}`;
    if (geoPoint) url += `&geoPoint=${geoPoint}`;
    
    url += `&unit=miles`;
    
    const response = await fetch(url);
    const data = await response.json();
    
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
      
      // Get artist's albums
      const albumsUrl = `https://api.spotify.com/v1/artists/${artistId}/albums?limit=3`;
      const albumsResponse = await fetch(albumsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const albumsData = await albumsResponse.json();
      
      res.json({
        artist: artist,
        albums: albumsData.items
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
    const event = req.body;
    
    // Check if event already exists
    const existing = await favoritesCollection.findOne({ id: event.id });
    if (existing) {
      return res.status(409).json({ error: 'Event already in favorites' });
    }
    
    const result = await favoritesCollection.insertOne(event);
    res.status(201).json({ message: 'Event added to favorites', id: result.insertedId });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove event from favorites
app.delete('/api/favorites/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await favoritesCollection.deleteOne({ id: id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    
    res.json({ message: 'Event removed from favorites' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});