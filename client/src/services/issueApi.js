const API_BASE_URL = `${import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '')}/api`;

function formatErrorMessage(status, rawText) {
  if (status === 502) {
    return 'Server Error (502 Bad Gateway): The backend server is currently starting up or unavailable. Please try again in a few seconds.';
  }
  if (status === 504) {
    return 'Server Error (504 Gateway Timeout): The request took too long to complete. Please try again.';
  }
  if (rawText) {
    const titleMatch = rawText.match(/<title>(.*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return `Server Error (${status}): ${titleMatch[1].trim()}`;
    }
    const cleanText = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanText) {
      return `Server Error (${status}): ${cleanText.slice(0, 150)}`;
    }
  }
  return `Server error status: ${status}`;
}

async function parseJsonResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  let data = null;
  let rawText = '';

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
  } else {
    rawText = await res.text();
  }

  if (!res.ok) {
    let errorMsg = data?.message || data?.error;
    if (!errorMsg) {
      errorMsg = formatErrorMessage(res.status, rawText);
    }
    const err = new Error(errorMsg);
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

