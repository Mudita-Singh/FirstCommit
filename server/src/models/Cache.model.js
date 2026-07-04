const mongoose = require('mongoose');

const cacheSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true },
  model: { type: String, required: true },  
  type: { type: String, enum: ['readOrder', 'fileExplanation', 'fileUsages'] },
  ttl: { type: Number, default: 604800 },
  response: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, expires: 604800 }
});

// Compound unique index so the same cacheKey + same model = one cache entry.
cacheSchema.index({ cacheKey: 1, model: 1 }, { unique: true });

const Cache = mongoose.model('Cache', cacheSchema);

module.exports = Cache;
