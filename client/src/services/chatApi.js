const API_BASE = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:5000' : '')

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
    throw new Error(data?.message || data?.error || `Request failed with status ${res.status}`);
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

