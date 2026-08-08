// Load environment variables from .env file
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
console.log('API Key loaded:', !!process.env.GEMINI_API_KEY);
console.log('Model:', process.env.GEMINI_MODEL);
console.log('GitHub token loaded:', !!process.env.GITHUB_TOKEN);
const mongoose = require('mongoose');

const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI;
if (mongoUrl) {
  console.log('Attempting MongoDB connection to:', mongoUrl?.slice(0, 30) + '...');
  mongoose.connect(mongoUrl)
    .then(() => console.log('MongoDB connected to Atlas'))
    .catch(err => {
      console.error('MongoDB connection FAILED:', err.message);
      console.log('Continuing without database caching...');
    });
} else {
  console.log('MONGODB_URL not found in env, continuing without database caching...');
}

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const { router: authRouter, passport } = require('./routes/auth.routes');

// Initialize the Express application
const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Define the port to listen on
const PORT = process.env.PORT || 5000;

// Enable Cross-Origin Resource Sharing (CORS)
// This permits our frontend (on another port) to send requests to this server
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true  // ← THIS IS CRITICAL for cookies
}));

app.use(cookieParser());
app.use(session({
  secret: process.env.JWT_SECRET || 'firstcommit-session-secret',
  resave: false,
  saveUninitialized: false,
  store: mongoUrl ? MongoStore.create({ mongoUrl }) : undefined,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Enable JSON middleware to parse incoming JSON request bodies (10mb for large file contents)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Import routes
const healthRouter = require('./routes/health.routes');
const repoRouter = require('./routes/repo.routes');
const fileRouter = require('./routes/file.routes');
const issueRouter = require('./routes/issue.routes');
const chatRouter = require('./routes/chat.routes');

// Mount routes
app.use('/api/health', healthRouter);
app.use('/api/repo', repoRouter);
app.use('/api/file', fileRouter);
app.use('/api/issues', issueRouter);
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);

// Start listening for incoming network requests
app.listen(PORT, () => {
  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  console.log(`Server is running in ${mode} mode on http://localhost:${PORT}`);
});

// Auto-trigger reload 3