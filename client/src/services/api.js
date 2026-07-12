const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'https://firstcommit-4y9h.onrender.com'}/api`;

/**
 * Fetch the health status of the Express server API.
 * @returns {Promise<object>} JSON response from the health endpoint.
 */
export const fetchHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API health check failed:', error);
    throw error;
  }
};

/**
 * Sends a GitHub URL to the server for analysis and returns the reading list.
 * @param {string} url - The GitHub repository URL.
 * @returns {Promise<object>} JSON response containing the analysis details.
 */
export const analyzeRepository = async (url) => {
  try {
    const response = await fetch(`${API_BASE_URL}/repo/structure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    const result = await response.json();

    if (!response.ok) {
      const err = new Error(result.message || `Server returned error status: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    return result;
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

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || `Server returned error status: ${response.status}`);
    }

    return result;
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

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || `Server returned error status: ${response.status}`);
    }

    return result;
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

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || `Server returned error status: ${response.status}`);
    }

    return result;
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

    const result = await response.json();

    if (!response.ok) {
      const err = new Error(result.message || `Server returned error status: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    return result;
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
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `Server returned error status: ${response.status}`);
    }
    return result;
  } catch (error) {
    console.error('Failed to fetch file usages:', error);
    throw error;
  }
};




