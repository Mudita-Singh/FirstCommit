const API_BASE = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:5000' : '')

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
  return `Request failed with status ${status}`;
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
    throw new Error(errorMsg);
  }

  return data;
}

export const sendChatMessage = async (
  message, history, context
) => {
  const res = await fetch(`${API_BASE}/api/chat/message`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, context })
  })
  return await parseJsonResponse(res);
}

export const indexRepo = async (owner, repo, files) => {
  const res = await fetch(`${API_BASE}/api/chat/index`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo, files })
  })
  return await parseJsonResponse(res);
}

export const checkIndexStatus = async (owner, repo) => {
  const res = await fetch(
    `${API_BASE}/api/chat/status/${owner}/${repo}`,
    { credentials: 'include' }
  )
  return await parseJsonResponse(res);
}

