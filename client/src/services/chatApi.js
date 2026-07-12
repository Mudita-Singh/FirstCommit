const API_BASE = import.meta.env.VITE_API_URL || 
  'https://firstcommit-4y9h.onrender.com'

export const sendChatMessage = async (
  message, history, context
) => {
  const res = await fetch(`${API_BASE}/api/chat/message`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, context })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.message || 'Chat failed')
  }
  return res.json()
}

export const indexRepo = async (owner, repo, files) => {
  const res = await fetch(`${API_BASE}/api/chat/index`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo, files })
  })
  return res.json()
}

export const checkIndexStatus = async (owner, repo) => {
  const res = await fetch(
    `${API_BASE}/api/chat/status/${owner}/${repo}`,
    { credentials: 'include' }
  )
  return res.json()
}
