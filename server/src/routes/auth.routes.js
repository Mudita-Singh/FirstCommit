const express = require('express')
const passport = require('passport')
const GitHubStrategy = require('passport-github2').Strategy
const jwt = require('jsonwebtoken')
const User = require('../models/User.model')
const { requireAuth } = require('../middleware/auth.middleware')

const router = express.Router()

const CLIENT_URL = process.env.CLIENT_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://firstcommit-6fpzndyg8-smudita900-8475s-projects.vercel.app' 
    : 'http://localhost:5173');

// Configure GitHub strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL || 
    (process.env.NODE_ENV === 'production' 
      ? 'https://firstcommit-4y9h.onrender.com/api/auth/github/callback' 
      : 'http://localhost:5000/api/auth/github/callback'),
  scope: ['user:email', 'public_repo']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ 
      githubId: profile.id 
    })
    if (user) {
      user.accessToken = accessToken
      user.lastLoginAt = new Date()
      user.avatarUrl = profile.photos?.[0]?.value
      await user.save()
    } else {
      user = await User.create({
        githubId: profile.id,
        username: profile.username,
        displayName: profile.displayName || profile.username,
        avatarUrl: profile.photos?.[0]?.value,
        githubUrl: profile.profileUrl,
        accessToken
      })
    }
    return done(null, user)
  } catch (error) {
    return done(error)
  }
}))

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id)
    done(null, user)
  } catch (error) {
    done(error)
  }
})

// Routes

// GET /api/auth/github
// Initiates GitHub OAuth flow
router.get('/github', (req, res, next) => {
  const { redirect } = req.query;
  if (redirect) {
    res.cookie('auth_redirect', redirect, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 10 * 60 * 1000 // 10 minutes
    });
  }

  const statePayload = redirect ? JSON.stringify({ redirect }) : undefined;
  passport.authenticate('github', { 
    scope: ['user:email'],
    ...(statePayload ? { state: statePayload } : {})
  })(req, res, next);
})

// GET /api/auth/github/callback
// GitHub redirects here after authorization
router.get('/github/callback',
  passport.authenticate('github', { 
    failureRedirect: `${CLIENT_URL}/?error=auth_failed`,
    session: false
  }),
  async (req, res) => {
    try {
      const token = jwt.sign(
        { userId: req.user._id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      )
      
      res.cookie('fc_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' 
          ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })

      let savedRedirect = req.cookies?.auth_redirect;
      if (!savedRedirect && req.query.state) {
        try {
          const parsedState = JSON.parse(req.query.state);
          savedRedirect = parsedState.redirect;
        } catch (e) {
          console.warn('Could not parse OAuth state:', e.message);
        }
      }

      res.clearCookie('auth_redirect', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      });

      let redirectUrl = CLIENT_URL;
      if (savedRedirect && typeof savedRedirect === 'string' && savedRedirect.startsWith('/')) {
        redirectUrl = `${CLIENT_URL}${savedRedirect}`;
      }
      
      res.redirect(redirectUrl)
    } catch (error) {
      res.redirect(
        `${CLIENT_URL}/?error=auth_failed`
      )
    }
  }
)

// GET /api/auth/me
// Returns current logged in user
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      displayName: req.user.displayName,
      avatarUrl: req.user.avatarUrl,
      githubUrl: req.user.githubUrl,
      savedRepos: req.user.savedRepos,
      createdAt: req.user.createdAt
    }
  })
})

// POST /api/auth/logout
// Clears the cookie
router.post('/logout', (req, res) => {
  res.clearCookie('fc_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' 
      ? 'none' : 'lax'
  })
  res.json({ message: 'Logged out successfully' })
})

// POST /api/auth/save-repo
// Saves a repo to user's account
router.post('/save-repo', requireAuth, async (req, res) => {
  try {
    const { owner, repo, description, language, 
            stars } = req.body
    
    const fullName = `${owner}/${repo}`
    const alreadySaved = req.user.savedRepos
      .find(r => r.fullName === fullName)
    
    if (alreadySaved) {
      return res.json({ 
        message: 'Already saved',
        saved: true 
      })
    }

    req.user.savedRepos.unshift({
      owner, repo, fullName,
      description, language, stars
    })

    // Keep max 10 saved repos
    if (req.user.savedRepos.length > 10) {
      req.user.savedRepos = req.user.savedRepos.slice(0, 10)
    }

    await req.user.save()
    res.json({ 
      message: 'Repo saved',
      saved: true,
      savedRepos: req.user.savedRepos
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/auth/save-repo/:fullName
// Removes a saved repo
router.delete('/save-repo/:owner/:repo', 
  requireAuth, 
  async (req, res) => {
    try {
      const fullName = `${req.params.owner}/${req.params.repo}`
      req.user.savedRepos = req.user.savedRepos
        .filter(r => r.fullName !== fullName)
      await req.user.save()
      res.json({ 
        message: 'Repo removed',
        savedRepos: req.user.savedRepos
      })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
)

module.exports = { router, passport }
