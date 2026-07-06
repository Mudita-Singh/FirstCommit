const jwt = require('jsonwebtoken')
const User = require('../models/User.model')

const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies.fc_token
    if (!token) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'Please sign in to use this feature'
      })
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId)
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found' 
      })
    }
    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ 
      error: 'Invalid token' 
    })
  }
}

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies.fc_token
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId)
      req.user = user || null
    } else {
      req.user = null
    }
  } catch {
    req.user = null
  }
  next()
}

module.exports = { requireAuth, optionalAuth }
