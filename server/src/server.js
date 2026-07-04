// Load environment variables from .env file
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
console.log('API Key loaded:', !!process.env.GEMINI_API_KEY);
console.log('Model:', process.env.GEMINI_MODEL);
console.log('GitHub token loaded:', !!process.env.GITHUB_TOKEN);
const mongoose = require('mongoose');

if (process.env.MONGODB_URI) {
  console.log('Attempting MongoDB connection to:', process.env.MONGODB_URI?.slice(0, 30) + '...');
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected to Atlas'))
    .catch(err => {
      console.error('MongoDB connection FAILED:', err.message);
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

// Enable JSON middleware to parse incoming JSON request bodies (10mb for large file contents)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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