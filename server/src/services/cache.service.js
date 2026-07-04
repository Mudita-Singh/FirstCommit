const Cache = require('../models/Cache.model');
const mongoose = require('mongoose');

/**
 * Check if the MongoDB connection is open and active.
 */
function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Fetch a cached response if it exists for the given cacheKey and model.
 * Returns null if not found or if the database is disconnected.
 */
async function getCached(cacheKey, model) {
  if (!isDbConnected()) {
    return null;
  }
  try {
    const cachedEntry = await Cache.findOne({ cacheKey, model });
    if (cachedEntry) {
      return cachedEntry.response;
    }
  } catch (error) {
    console.error('Error fetching from cache:', error);
  }
  return null;
}

/**
 * Cache a response for the given cacheKey, model, and type.
 * Uses findOneAndUpdate with upsert to prevent unique key constraint violations.
 */
async function setCached(cacheKey, model, type, response, ttl = 604800) {
  if (!isDbConnected()) {
    return null;
  }
  console.log('Attempting to write to cache:', cacheKey);
  try {
    await Cache.findOneAndUpdate(
      { cacheKey, model },
      { type, response, ttl, createdAt: new Date() },
      { upsert: true, returnDocument: 'after' }
    );
    console.log('Cache write successful:', cacheKey);
  } catch (error) {
    console.error('Cache write FAILED:', error.message);
  }
}

module.exports = {
  getCached,
  setCached
};
