const API_BASE = import.meta.env.VITE_API_URL 
  || (import.meta.env.DEV ? 'http://localhost:5000' : '')

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

export const getMe = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: 'include' // ← sends cookies
    })
    if (!res.ok) return null
    return await parseJsonResponse(res)
  } catch (e) {
    return null
  }
}

export const logout = async () => {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  })
}

export const saveRepo = async (repoData) => {
  const res = await fetch(`${API_BASE}/api/auth/save-repo`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(repoData)
  })
  return await parseJsonResponse(res)
}

export const unsaveRepo = async (owner, repo) => {
  const res = await fetch(
    `${API_BASE}/api/auth/save-repo/${owner}/${repo}`, 
    {
      method: 'DELETE',
      credentials: 'include'
    }
  )
  return await parseJsonResponse(res)
}

