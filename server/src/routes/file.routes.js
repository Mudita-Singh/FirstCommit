const express = require('express');
const router = express.Router();
const path = require('path').posix;
const { fetchFileContent, fetchRepoStructure } = require('../services/github.service');
const { generateBlockExplanation } = require('../services/ai.service');

/**
 * Returns a properly structured JSON error response for a caught error.
 * Detects Gemini 429/quota errors and surfaces them with a specific status code.
 */
function handleRouteError(res, error, context) {
  console.error(`File explain error [${context}]:`, error.message);
  const isGithubLimit =
    error.githubRateLimit ||
    error.status === 403 ||
    error.status === 429 ||
    error.message?.toLowerCase().includes('rate limit') ||
    error.message?.toLowerCase().includes('github api returned status 403') ||
    error.message?.toLowerCase().includes('github api returned status 429');

  if (isGithubLimit) {
    return res.status(403).json({
      error: 'GitHub rate limit exceeded',
      message: 'Too many requests to GitHub. Add a GitHub token to increase limit to 5000/hour.',
      retryAfter: 3600
    });
  }

  const isQuota =
    error.message?.includes('429') ||
    error.message?.includes('quota') ||
    error.message?.includes('Too Many Requests') ||
    error.message?.toLowerCase().includes('resource has been exhausted');
  if (isQuota) {
    return res.status(429).json({
      error: 'AI quota exceeded',
      message: 'Daily AI limit reached. Please try again tomorrow or open a different file.',
      retryAfter: 30
    });
  }
  return res.status(500).json({
    error: 'Failed to explain file',
    message: error.message || 'An unexpected error occurred.'
  });
}

// Map file extensions to languages for syntax highlighting compatibility
function getLanguageFromExtension(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const map = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'md': 'markdown',
    'html': 'html',
    'css': 'css',
    'py': 'python',
    'sh': 'bash',
    'yml': 'yaml',
    'yaml': 'yaml',
  };
  return map[ext] || 'text';
}

/**
 * @route   POST /api/file/explain
 * @desc    Fetch a file's raw content from GitHub and return a line-range block explanation.
 * @access  Public
 */
router.post('/explain', async (req, res) => {
  const { repoOwner, repoName, filePath, simplify } = req.body;

  if (!repoOwner || !repoName || !filePath) {
    return res.status(400).json({
      status: 'error',
      message: 'Please provide repoOwner, repoName, and filePath in the request body.'
    });
  }

  try {
    // 1. Fetch raw code
    const rawContent = await fetchFileContent(repoOwner, repoName, filePath);
    
    // 2. Identify language
    const language = getLanguageFromExtension(filePath);
    
    // 3. Generate block-level explanations (regular or simplified)
    const result = await generateBlockExplanation(filePath, rawContent, !!simplify);

    const explanation = Array.isArray(result) ? result : (result.explanation || []);
    const summary = result.summary || '';
    const concepts = result.concepts || [];
    const difficulty = result.difficulty || 'Beginner';

    return res.status(200).json({
      status: 'success',
      data: {
        rawContent,
        language,
        summary,
        concepts,
        difficulty,
        explanation
      }
    });
  } catch (error) {
    return handleRouteError(res, error, 'POST /api/file/explain');
  }
});

/**
 * @route   POST /api/file/content
 * @desc    Fetch only a file's raw content from GitHub without explaining it.
 * @access  Public
 */
router.post('/content', async (req, res) => {
  const { repoOwner, repoName, filePath } = req.body;

  if (!repoOwner || !repoName || !filePath) {
    return res.status(400).json({
      status: 'error',
      message: 'Please provide repoOwner, repoName, and filePath in the request body.'
    });
  }

  try {
    const rawContent = await fetchFileContent(repoOwner, repoName, filePath);
    const language = getLanguageFromExtension(filePath);

    return res.status(200).json({
      status: 'success',
      data: {
        rawContent,
        language
      }
    });
  } catch (error) {
    return handleRouteError(res, error, 'POST /api/file/content');
  }
});

/**
 * @route   POST /api/file/explain-only
 * @desc    Generate explanations given the raw code.
 * @access  Public
 */
router.post('/explain-only', async (req, res) => {
  const { filePath, rawContent, simplify } = req.body;

  if (!filePath || rawContent === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'Please provide filePath and rawContent in the request body.'
    });
  }

  try {
    const result = await generateBlockExplanation(filePath, rawContent, !!simplify);

    const explanation = Array.isArray(result) ? result : (result.explanation || []);
    const summary = result.summary || '';
    const concepts = result.concepts || [];
    const difficulty = result.difficulty || 'Beginner';

    return res.status(200).json({
      status: 'success',
      data: {
        summary,
        concepts,
        difficulty,
        explanation
      }
    });
  } catch (error) {
    return handleRouteError(res, error, 'POST /api/file/explain-only');
  }
});

/**
 * Helper to search for imports/requires referencing a target file.
 */
function checkImport(fileContent, otherPath, targetFilePath) {
  const otherDir = path.dirname(otherPath);
  let relPath = path.relative(otherDir, targetFilePath);
  if (!relPath.startsWith('.')) {
    relPath = './' + relPath;
  }
  
  // Strip extension
  const relPathNoExt = relPath.replace(/\.(js|ts|jsx|tsx|json)$/i, '');
  
  const escapedRelPath = relPath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const escapedRelPathNoExt = relPathNoExt.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  
  const regex = new RegExp(
    `\\b(require|import|from)\\s*\\(\\s*['"\`](${escapedRelPath}|${escapedRelPathNoExt})['"\`]\\s*\\)|` +
    `\\b(from|import)\\s*['"\`](${escapedRelPath}|${escapedRelPathNoExt})['"\`]`,
    'g'
  );
  
  const lines = fileContent.split('\n');
  const matches = [];
  for (let i = 0; i < lines.length; i++) {
    const lineContent = lines[i];
    regex.lastIndex = 0;
    if (regex.test(lineContent)) {
      matches.push({
        line: i + 1,
        snippet: lineContent.trim()
      });
    }
  }
  return matches;
}

/**
 * @route   POST /api/file/usages
 * @desc    Find files that reference (import/require) the current filePath.
 * @access  Public
 */
router.post('/usages', async (req, res) => {
  const { repoOwner, repoName, filePath } = req.body;

  if (!repoOwner || !repoName || !filePath) {
    return res.status(400).json({
      status: 'error',
      message: 'Please provide repoOwner, repoName, and filePath in the request body.'
    });
  }

  try {
    const rawTree = await fetchRepoStructure(repoOwner, repoName);
    const candidateFiles = rawTree.filter(file => {
      if (file.type !== 'blob') return false;
      const lowerPath = file.path.toLowerCase();
      if (file.path === filePath) return false;
      if (lowerPath.includes('node_modules/') || 
          lowerPath.includes('__tests__/') || 
          lowerPath.includes('/test/') || 
          lowerPath.startsWith('test/') ||
          lowerPath.includes('/tests/') ||
          lowerPath.startsWith('tests/') ||
          lowerPath.includes('.test.') || 
          lowerPath.includes('.spec.')) {
        return false;
      }
      const ext = file.path.split('.').pop().toLowerCase();
      return ['js', 'ts', 'jsx', 'tsx'].includes(ext);
    });

    const filesToSearch = candidateFiles.slice(0, 50);
    const usages = [];

    await Promise.all(filesToSearch.map(async (file) => {
      try {
        const content = await fetchFileContent(repoOwner, repoName, file.path);
        const matches = checkImport(content, file.path, filePath);
        matches.forEach(match => {
          usages.push({
            filePath: file.path,
            line: match.line,
            snippet: match.snippet
          });
        });
      } catch (err) {
        console.error(`Error searching usages in ${file.path}:`, err.message);
      }
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        usages,
        searchedFiles: filesToSearch.length,
        totalFound: usages.length
      }
    });
  } catch (error) {
    return handleRouteError(res, error, 'POST /api/file/usages');
  }
});

module.exports = router;
