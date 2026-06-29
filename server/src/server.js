// Load environment variables from .env file
require('dotenv').config();

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

// Mount routes
app.use('/api/health', healthRouter);
app.use('/api/repo', repoRouter);

// Start listening for incoming network requests
app.listen(PORT, () => {
  console.log(`Server is running in development mode on http://localhost:${PORT}`);
});

// Auto-trigger reload 3

