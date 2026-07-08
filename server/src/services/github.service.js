/**
 * GitHub API Service
 * Handles all direct communication with the GitHub REST API.
 */

/**
 * Fetches the recursive repository tree from GitHub.
 * Attempts branch 'main' first, and falls back to 'master' if main is not found.
 * 
 * @param {string} owner - Repository owner (username or organization).
 * @param {string} repo - Repository name.
 * @returns {Promise<Array>} List of file objects in the repository tree.
 */
async function fetchRepoStructure(owner, repo) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'FirstCommit-Dev-Application',
    ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {})
  };

  // Attempt to fetch from 'main' first, and fallback to 'master' if it fails
  const branchesToTry = ['main', 'master'];
  let lastError = null;

  for (const branch of branchesToTry) {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
      const response = await fetch(url, { headers });

      if (response.status === 403 || response.status === 429) {
        const err = new Error('GitHub rate limit exceeded');
        err.status = response.status;
        err.githubRateLimit = true;
        throw err;
      }

      if (response.status === 404) {
        // If 404, it might mean the branch doesn't exist, we will try the next branch
        continue;
      }

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Git Tree response contains a 'tree' array of files and folders
      if (data && Array.isArray(data.tree)) {
        return data.tree;
      }
      
      throw new Error('Invalid response structure received from GitHub.');
    } catch (error) {
      lastError = error;
    }
  }

  // If we reach here, both branches failed or threw an error
  throw lastError || new Error(`Repository not found. If this is a private repository, please check that your GitHub token has permissions to access private repositories.`);
}

/**
 * Fetches repository metadata (stars count and primary programming language).
 * Returns default values on failure to prevent crashing the main analysis path.
 * 
 * @param {string} owner - Repository owner.
 * @param {string} repo - Repository name.
 * @returns {Promise<object>} Metadata object { stars, language }.
 */
async function fetchRepoMetadata(owner, repo) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'FirstCommit-Dev-Application',
    ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {})
  };

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await fetch(url, { headers });

    if (response.status === 403 || response.status === 429) {
      const err = new Error('GitHub rate limit exceeded');
      err.status = response.status;
      err.githubRateLimit = true;
      throw err;
    }

    if (!response.ok) {
      throw new Error(`GitHub metadata returned status ${response.status}`);
    }

    const data = await response.json();
    return {
      stars: data.stargazers_count || 0,
      language: data.language || 'JavaScript' // fallback default
    };
  } catch (error) {
    console.error(`⚠️ Failed to fetch metadata for ${owner}/${repo}:`, error.message);
    // If it's a rate limit error, propagate it rather than falling back
    if (error.githubRateLimit) {
      throw error;
    }
    // Return graceful fallback so the main analysis flow doesn't fail
    return {
      stars: 0,
      language: 'Unknown'
    };
  }
}

/**
 * Fetches raw file content from GitHub repository.
 * Uses repository contents API with the vnd.github.v3.raw media type.
 * 
 * @param {string} owner - Repository owner.
 * @param {string} repo - Repository name.
 * @param {string} filePath - Path to the file.
 * @returns {Promise<string>} Raw code content.
 */
async function fetchFileContent(owner, repo, filePath) {
  const headers = {
    'Accept': 'application/vnd.github.v3.raw',
    'User-Agent': 'FirstCommit-Dev-Application',
    ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {})
  };

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const response = await fetch(url, { headers });

  if (response.status === 403 || response.status === 429) {
    const err = new Error('GitHub rate limit exceeded');
    err.status = response.status;
    err.githubRateLimit = true;
    throw err;
  }

  if (!response.ok) {
    throw new Error(`GitHub API returned status ${response.status} when fetching file content: ${response.statusText}`);
  }

  return await response.text();
}

module.exports = {
  fetchRepoStructure,
  fetchRepoMetadata,
  fetchFileContent
};

