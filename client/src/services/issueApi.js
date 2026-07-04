const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Fetch issues for a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<object>} JSON response from server
 */
export const fetchIssues = async (owner, repo) => {
  try {
    const response = await fetch(`${API_BASE_URL}/issues/${owner}/${repo}`);
    const result = await response.json();
    if (!response.ok) {
      const err = new Error(result.message || `Server error status: ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return result;
  } catch (error) {
    console.error('fetchIssues failed:', error);
    throw error;
  }
};

/**
 * Analyze a specific issue using Gemini AI
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {string} issueTitle - Issue title
 * @param {string} issueBody - Issue description
 * @param {Array<string>} fileTree - List of file paths
 * @returns {Promise<object>} JSON response from server
 */
export const analyzeIssue = async (owner, repo, issueNumber, issueTitle, issueBody, fileTree) => {
  try {
    const response = await fetch(`${API_BASE_URL}/issues/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner,
        repo,
        issueNumber,
        issueTitle,
        issueBody,
        fileTree
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      const err = new Error(result.message || `Server error status: ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return result;
  } catch (error) {
    console.error('analyzeIssue failed:', error);
    throw error;
  }
};
