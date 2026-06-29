const API_BASE_URL = 'http://localhost:5000/api';

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
      throw new Error(result.message || `Server returned error status: ${response.status}`);
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


