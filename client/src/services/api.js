const API_BASE_URL = `${import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '')}/api`;

function formatErrorMessage(status, rawText) {
  if (status === 502) {
    return 'Server Error (502 Bad Gateway): The backend server is currently starting up or unavailable. Please try again in a few seconds.';
  }
  if (status === 504) {
    return 'Server Error (504 Gateway Timeout): The repository analysis request took too long to complete. Please try again.';
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

/**
 * Safely parses response body as JSON if possible, handling non-JSON text/HTML errors gracefully.
 */
async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let data = null;
  let rawText = '';

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }
  } else {
    rawText = await response.text();
  }

  if (!response.ok) {
    let errorMsg = data?.message || data?.error;
    if (!errorMsg) {
      errorMsg = formatErrorMessage(response.status, rawText);
    }
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

/**
 * Fetch the health status of the Express server API.
 * @returns {Promise<object>} JSON response from the health endpoint.
 */
export const fetchHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await parseJsonResponse(response);
  } catch (error) {
    console.error('API health check failed:', error);
    throw error;
  }
};

/**
 * Sends a GitHub URL to the server for analysis and returns the reading list.
 * @param {string} url - The GitHub repository URL.
 * @param {number} fileCount - Number of files requested in the reading order.
 * @returns {Promise<object>} JSON response containing the analysis details.
 */
export const analyzeRepository = async (url, fileCount = 10) => {
  try {
    const response = await fetch(`${API_BASE_URL}/repo/structure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, fileCount }),
    });

    return await parseJsonResponse(response);
  } catch (error) {
    console.error('Repository analysis failed:', error);
    throw error;
  }
};

/**
 * Sends code content to the server to get a beginner-friendly markdown explanation.
 * @param {string} path - The relative file path.
 * @param {string} code - The source code text.
 * @returns {Promise<object>} The server response containing the markdown explanation.
 */
export const fetchFileExplanation = async (path, code) => {
  try {
    const response = await fetch(`${API_BASE_URL}/repo/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, code }),
    });

    return await parseJsonResponse(response);
  } catch (error) {
    console.error('Failed to fetch file explanation:', error);
    throw error;
  }
};

/**
 * Fetches file raw code and range-block explanations from the backend.
 * @param {string} repoOwner - Owner of the repository.
 * @param {string} repoName - Name of the repository.
 * @param {string} filePath - Path of the file inside the repo.
 * @param {boolean} simplify - Whether to use the simplified analogies prompt.
 * @returns {Promise<object>} Response with { rawContent, language, explanation }
 */
export const explainFileWithBlocks = async (repoOwner, repoName, filePath, simplify = false) => {
  try {
    const response = await fetch(`${API_BASE_URL}/file/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repoOwner, repoName, filePath, simplify }),
    });

    return await parseJsonResponse(response);
  } catch (error) {
    console.error('Failed to fetch file block explanation:', error);
    throw error;
  }
};

/**
 * Fetches only raw file content from the backend.
 */
export const fetchRawFileContent = async (repoOwner, repoName, filePath) => {
  try {
    const response = await fetch(`${API_BASE_URL}/file/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repoOwner, repoName, filePath }),
    });

    return await parseJsonResponse(response);
  } catch (error) {
    console.error('Failed to fetch raw file content:', error);
    throw error;
  }
};

/**
 * Generates line-block explanations from raw file content.
 */
export const explainFileWithBlocksOnly = async (filePath, rawContent, simplify = false) => {
  try {
    const response = await fetch(`${API_BASE_URL}/file/explain-only`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filePath, rawContent, simplify }),
    });

    return await parseJsonResponse(response);
  } catch (error) {
    console.error('Failed to explain file blocks:', error);
    throw error;
  }
};

/**
 * Find all import/require usages of a file in the repository.
 */
export const fetchFileUsages = async (repoOwner, repoName, filePath) => {
  try {
    const response = await fetch(`${API_BASE_URL}/file/usages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repoOwner, repoName, filePath }),
    });

    return await parseJsonResponse(response);
  } catch (error) {
    console.error('Failed to fetch file usages:', error);
    throw error;
  }
};




