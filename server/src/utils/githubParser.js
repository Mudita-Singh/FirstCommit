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
    // Regex splits the URL after github.com/ or github.com: into owner and repository name
    const regex = /github\.com[\/|:]([^\/]+)\/([^\/]+?)(?:\.git|\/)?$/i;
    const match = url.trim().match(regex);

    if (match && match[1] && match[2]) {
      return {
        owner: match[1],
        repo: match[2]
      };
    }
    return null;
  } catch (error) {
    console.error('Error parsing GitHub URL:', error);
    return null;
  }
}

module.exports = parseGithubUrl;
