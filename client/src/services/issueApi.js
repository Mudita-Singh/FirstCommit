const API_BASE_URL = `${import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '')}/api`;

async function parseJsonResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  let data = null;

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
  } else {
    const text = await res.text();
    data = { message: text.slice(0, 200) || `Server error status: ${res.status}` };
  }

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Server error status: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

/**
 * Fetch issues for a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<object>} JSON response from server
 */
export const fetchIssues = async (owner, repo) => {
  try {
    const response = await fetch(`${API_BASE_URL}/issues/${owner}/${repo}`);
    return await parseJsonResponse(response);
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
    return await parseJsonResponse(response);
  } catch (error) {
    console.error('analyzeIssue failed:', error);
    throw error;
  }
};

