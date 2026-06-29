const express = require('express');
const router = express.Router();

/**
 * @route   GET /api/health
 * @desc    Check if the API is running and returns basic info
 * @access  Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'FirstCommit Server API is up and running!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
