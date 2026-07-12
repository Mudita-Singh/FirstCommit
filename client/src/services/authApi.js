const API_BASE = import.meta.env.VITE_API_URL 
  || 'https://firstcommit-4y9h.onrender.com'

export const getMe = async () => {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    credentials: 'include' // ← sends cookies
  })
  if (!res.ok) return null
  return res.json()
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
  return res.json()
}

export const unsaveRepo = async (owner, repo) => {
  const res = await fetch(
    `${API_BASE}/api/auth/save-repo/${owner}/${repo}`, 
    {
      method: 'DELETE',
      credentials: 'include'
    }
  )
  return res.json()
}
