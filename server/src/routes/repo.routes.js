const express = require('express');
const router = express.Router();
const parseGithubUrl = require('../utils/githubParser');
const { fetchRepoStructure, fetchRepoMetadata } = require('../services/github.service');
const { generateReadingList, generateFileExplanation } = require('../services/ai.service');

/**
 * Returns a properly structured JSON error response for a caught error.
 * Detects Gemini 429/quota errors and surfaces them with a specific status code.
 */
function handleRouteError(res, error, context) {
  console.error(`Repo route error [${context}]:`, error.message);
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
      message: 'Daily AI limit reached. Please try again tomorrow.',
      retryAfter: 30
    });
  }
  return res.status(500).json({
    status: 'error',
    message: error.message || 'An unexpected error occurred.'
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE FILTER
// Shared between the pre-AI filter AND the post-AI sanity check (defence-in-depth).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if a file path segment is a dot-directory that should be excluded.
 * Catches: .agents, .vscode, .github, .husky, .circleci, .idea, .cursor, etc.
 */
function hasDotDirectory(filePath) {
  // Split on / and check each segment — a dot-directory starts with '.' and is not '.' or '..'
  return filePath.split('/').some(segment => segment.startsWith('.') && segment.length > 1);
}

/**
 * Returns true if the file should be KEPT for contributor reading.
 * Returns false if it is noise (tooling, generated, config, test infra, etc.)
 */
function isAllowedPath(filePath) {
  const lower = filePath.toLowerCase();

  // 1. Reject any dot-directory at any depth (.agents/, .github/, .vscode/, .husky/, etc.)
  if (hasDotDirectory(filePath)) return false;

  // 2. Reject dependency / build / generated directories
  const noiseDirs = [
    'node_modules/', '__pycache__/', '.cache/', 'dist/', 'build/', 'out/',
    'coverage/', '.nyc_output/', 'storybook-static/', '.next/', '.nuxt/',
    'vendor/', 'bower_components/', '.turbo/', '.vercel/',
  ];
  if (noiseDirs.some(dir => lower.startsWith(dir) || lower.includes('/' + dir))) return false;

  // 3. Reject test-only directories and fixtures
  const testDirs = ['__tests__/', '__mocks__/', '__fixtures__/', 'e2e/', 'cypress/', 'playwright/'];
  if (testDirs.some(dir => lower.includes(dir))) return false;

  // 4. Reject binary / media / font / archive files
  const binaryExts = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
    '.woff', '.woff2', '.eot', '.ttf', '.otf',
    '.mp3', '.mp4', '.wav', '.mov', '.avi',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.pdf', '.epub', '.psd', '.sketch', '.fig',
    '.db', '.sqlite', '.so', '.dylib', '.dll', '.exe',
    '.map',                             // source maps — generated
  ];
  if (binaryExts.some(ext => lower.endsWith(ext))) return false;

  // 5. Reject lock files and generated manifests (by exact filename)
  const exactNoiseFiles = [
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
    'composer.lock', 'gemfile.lock', 'cargo.lock', 'poetry.lock',
    '.ds_store', 'thumbs.db',
    'changelog.md', 'changes.md', 'license', 'licence',       // contributor-unfriendly files
    'codeowners', '.mailmap',
  ];
  const basename = lower.split('/').pop();
  if (exactNoiseFiles.includes(basename)) return false;

  // 6. Reject pure tooling / CI / linter config files (no contributor value)
  const toolingExts = [
    '.eslintrc', '.prettierrc', '.babelrc', '.editorconfig',
    '.stylelintrc', '.nycrc', '.mocharc',
  ];
  if (toolingExts.some(ext => lower.endsWith(ext))) return false;

  // Also reject .yml/.yaml that live at root config level (CI, Docker Compose, etc.)
  // but keep them if they're inside a meaningful source folder
  if ((lower.endsWith('.yml') || lower.endsWith('.yaml')) && !lower.includes('/src/')) {
    return false;
  }

  return true;
}

/**
 * Adapter for the .filter() call — also enforces blob-only (no directory entries).
 */
function isCodeFileOrDoc(file) {
  if (file.type !== 'blob') return false;
  return isAllowedPath(file.path);
}

/**
 * @route   POST /api/repo/structure
 * @desc    Receive a GitHub URL, parse it, fetch directory tree, filter files, analyze with AI, and return reading list
 * @access  Public
 */
router.post('/structure', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ status: 'error', message: 'Please provide a GitHub repository URL.' });
  }

  // 1. Parse the URL
  const repoInfo = parseGithubUrl(url);
  if (!repoInfo) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid GitHub repository URL format. Please paste a valid repository link.'
    });
  }

  const { owner, repo } = repoInfo;

  try {
    // 2. Fetch structure and metadata in parallel
    const [rawTree, metadata] = await Promise.all([
      fetchRepoStructure(owner, repo),
      fetchRepoMetadata(owner, repo)
    ]);

    // 3. Filter — remove all noise BEFORE sending to the AI
    const cleanFiles = rawTree
      .filter(isCodeFileOrDoc)
      .map(file => ({
        path: file.path,
        size: file.size,
        url: `https://raw.githubusercontent.com/${owner}/${repo}/main/${file.path}`
      }));

    console.log(`[filter] ${rawTree.length} raw → ${cleanFiles.length} clean files for ${owner}/${repo}`);

    // 4. Generate the ordered reading list with AI
    const rawReadingList = await generateReadingList(repo, cleanFiles);

    // 5. DEFENCE-IN-DEPTH: drop any file the AI returned that wasn't in our clean list.
    //    This guards against the model hallucinating paths from the unfiltered tree.
    const cleanPaths = new Set(cleanFiles.map(f => f.path));
    const readingList = rawReadingList.filter(entry => {
      if (!cleanPaths.has(entry.path)) {
        console.warn(`[sanity] Dropping AI-returned path not in clean list: ${entry.path}`);
        return false;
      }
      return true;
    });

    // 6. Return results
    return res.status(200).json({
      status: 'success',
      data: {
        owner,
        repo,
        stars: metadata.stars,
        language: metadata.language,
        filesCount: cleanFiles.length,
        readingList,
        files: cleanFiles
      }
    });
  } catch (error) {
    return handleRouteError(res, error, '/repo/structure');
  }
});


/**
 * @route   POST /api/repo/explain
 * @desc    Receive file path and source code content, return junior-level explanation using AI
 * @access  Public
 */
router.post('/explain', async (req, res) => {
  const { path, code } = req.body;

  if (!path || code === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'Please provide both the file path and code content to explain.'
    });
  }

  try {
    const explanation = await generateFileExplanation(path, code);
    return res.status(200).json({
      status: 'success',
      data: {
        path,
        explanation
      }
    });
  } catch (error) {
    return handleRouteError(res, error, '/repo/explain');
  }
});

module.exports = router;
