const mongoose = require('mongoose')

const savedRepoSchema = new mongoose.Schema({
  owner: String,
  repo: String,
  fullName: String,
  description: String,
  language: String,
  stars: Number,
  savedAt: { type: Date, default: Date.now }
})

const userSchema = new mongoose.Schema({
  githubId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  username: { 
    type: String, 
    required: true 
  },
  displayName: String,
  avatarUrl: String,
  githubUrl: String,
  accessToken: String,
  savedRepos: [savedRepoSchema],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastLoginAt: {
    type: Date,
    default: Date.now
  }
})

module.exports = mongoose.model('User', userSchema)
