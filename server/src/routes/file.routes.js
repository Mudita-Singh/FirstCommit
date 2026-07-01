const express = require('express');
const router = express.Router();
const { fetchFileContent } = require('../services/github.service');
const { generateBlockExplanation } = require('../services/ai.service');

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
    console.error('Error in POST /api/file/explain:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch and explain the code file.'
    });
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
    console.error('Error in POST /api/file/content:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch the file content.'
    });
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
    console.error('Error in POST /api/file/explain-only:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to explain the code content.'
    });
  }
});

module.exports = router;
