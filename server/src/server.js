// Load environment variables from .env file
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => {
      console.error('MongoDB connection error:', err);
      console.log('Continuing without database caching...');
    });
} else {
  console.log('MONGODB_URI not found in env, continuing without database caching...');
}

const express = require('express');
const cors = require('cors');

// Initialize the Express application
const app = express();

// Define the port to listen on
const PORT = process.env.PORT || 5000;

// Enable Cross-Origin Resource Sharing (CORS)
// This permits our frontend (on another port) to send requests to this server
app.use(cors());

// Enable JSON middleware to parse incoming JSON request bodies
app.use(express.json());

// Import routes
const healthRouter = require('./routes/health.routes');
const repoRouter = require('./routes/repo.routes');
const fileRouter = require('./routes/file.routes');

// Mount routes
app.use('/api/health', healthRouter);
app.use('/api/repo', repoRouter);
app.use('/api/file', fileRouter);

// Start listening for incoming network requests
app.listen(PORT, () => {
  console.log(`Server is running in development mode on http://localhost:${PORT}`);
});

// Auto-trigger reload 3