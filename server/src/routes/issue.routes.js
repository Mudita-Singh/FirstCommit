/**
 * Issue Routes
 * Defines endpoints for fetching github issues and analyzing them.
 */
const express = require('express');
const router = express.Router();
const { fetchRepoIssues, analyzeIssue } = require('../services/issue.service');
const { getCached, setCached } = require('../services/cache.service');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/**
 * @route   GET /api/issues/:owner/:repo
 * @desc    Fetch open issues for a repository, utilizing cache.
 */
router.get('/:owner/:repo', async (req, res) => {
  const { owner, repo } = req.params;

  if (!owner || !repo) {
    return res.status(400).json({
      error: 'Invalid parameters',
      message: 'Please provide owner and repo.'
    });
  }

  const cacheKey = `issues:v2:${owner}:${repo}`;

  try {
    // 1. Check Cache
    const cachedData = await getCached(cacheKey, 'github');
    if (cachedData) {
      console.log('CACHE HIT (issues):', cacheKey);
      return res.status(200).json({
        issues: cachedData.issues || [],
        total: cachedData.total || 0,
        fromCache: true
      });
    }

    console.log('CACHE MISS (issues):', cacheKey);

    // 2. Fetch from GitHub
    const data = await fetchRepoIssues(owner, repo);

    const issues = data.rawIssues;
    const filtered = data.filteredIssues;

    console.log('GitHub API URL:', data.url);
    console.log('Total issues fetched:', issues.length);
    console.log('After PR filter:', filtered.length);
    console.log('Sample labels:', issues[0]?.labels?.slice(0,3));

    // 3. Save to Cache
    await setCached(cacheKey, 'github', 'issueList', data, 3600);

    return res.status(200).json({
      issues: data.issues,
      total: data.total,
      fromCache: false
    });
  } catch (error) {
    console.error('Error fetching repo issues route:', error.message);
    if (error.message === 'GITHUB_RATE_LIMIT') {
      return res.status(429).json({
        error: 'GitHub rate limit exceeded',
        message: 'Please wait a moment and try again'
      });
    }
    if (error.message === 'REPO_NOT_FOUND') {
      return res.status(404).json({
        error: 'Repository not found',
        message: 'Could not find issues for this repo'
      });
    }
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred.'
    });
  }
});

/**
 * @route   POST /api/issues/analyze
 * @desc    Analyze a specific GitHub issue to identify files to change.
 */
router.post('/analyze', async (req, res) => {
  const { owner, repo, issueNumber, issueTitle, issueBody, fileTree } = req.body;

  if (!owner || !repo || !issueNumber || !issueTitle || !Array.isArray(fileTree)) {
    return res.status(400).json({
      error: 'Invalid request body',
      message: 'Please provide owner, repo, issueNumber, issueTitle, and fileTree in the body.'
    });
  }

  const cacheKey = `issueAnalysis:v4:${owner}:${repo}:${issueNumber}`;

  try {
    // 1. Check Cache
    const cachedData = await getCached(cacheKey, GEMINI_MODEL);
    if (cachedData) {
      console.log('CACHE HIT (issue analysis):', cacheKey);
      return res.status(200).json({
        analysis: cachedData,
        fromCache: true
      });
    }

    console.log('CACHE MISS (issue analysis):', cacheKey);

    // 2. Analyze with Gemini AI
    let analysis;
    try {
      console.log('Analyzing issue:', issueNumber, issueTitle)
      analysis = await analyzeIssue(
        owner,
        repo,
        { number: issueNumber, title: issueTitle, body: issueBody },
        fileTree
      )
      console.log('Analysis success:', !!analysis)
    } catch (error) {
      console.error('Analysis failed reason:', error.message)
      console.error('Error type:', error.constructor.name)
      throw error;
    }

    // 3. Save to Cache
    await setCached(cacheKey, GEMINI_MODEL, 'issueAnalysis', analysis, 86400);

    return res.status(200).json({
      analysis,
      fromCache: false
    });
  } catch (error) {
    console.error('Error analyzing issue route:', error.message);
    
    const isQuota =
      error.message?.includes('429') ||
      error.message?.includes('quota') ||
      error.message?.includes('Too Many Requests') ||
      error.message?.toLowerCase().includes('resource has been exhausted');

    if (isQuota) {
      return res.status(429).json({
        error: 'AI quota exceeded',
        message: 'Daily AI limit reached. Try again tomorrow.'
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred.'
    });
  }
});

module.exports = router;
