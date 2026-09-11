/**
 * Parses a GitHub repository URL to extract owner and repository name.
 * 
 * Supports:
 * - https://github.com/owner/repo
 * - http://github.com/owner/repo/
 * - github.com/owner/repo
 * - git@github.com:owner/repo.git
 * 
 * @param {string} url - The URL string to parse.
 * @returns {{ owner: string, repo: string } | null} The owner and repository name, or null if invalid.
 */
function parseGithubUrl(url) {
  if (!url || typeof url !== 'string') return null;

  try {
    const trimmed = url.trim();

    // 1. Standard GitHub URL or SSH URL (handles sub-paths like /tree/main, /issues, etc.)
    const githubRegex = /github\.com[\/|:]([^\/]+)\/([^\/\?\s#]+)/i;
    const match = trimmed.match(githubRegex);

    if (match && match[1] && match[2]) {
      const owner = match[1];
      const repo = match[2].replace(/\.git$/i, '');
      return { owner, repo };
    }

    // 2. GitHub Pages URL (e.g., https://owner.github.io/repo/ or owner.github.io)
    const pagesRegex = /(?:https?:\/\/)?([a-zA-Z0-9_\-\.]+)\.github\.io(?:\/([^\/\?\s#]+))?/i;
    const pagesMatch = trimmed.match(pagesRegex);
    if (pagesMatch && pagesMatch[1]) {
      const owner = pagesMatch[1];
      const repoPath = pagesMatch[2] ? pagesMatch[2].replace(/\.git$/i, '') : '';
      const repo = repoPath || `${owner}.github.io`;
      return { owner, repo };
    }

    // 3. Fallback for shorthand "owner/repo" input (e.g., "expressjs/express")
    const shorthandRegex = /^([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+?)(?:\.git)?$/;
    const shortMatch = trimmed.match(shorthandRegex);
    if (shortMatch && shortMatch[1] && shortMatch[2]) {
      return {
        owner: shortMatch[1],
        repo: shortMatch[2].replace(/\.git$/i, '')
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing GitHub URL:', error);
    return null;
  }
}

module.exports = parseGithubUrl;
