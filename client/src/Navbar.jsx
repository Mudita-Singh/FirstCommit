import React from 'react';

/**
 * Shared Navbar Component
 * Renders identical top navigation headers for both Home and Workspace pages.
 * 
 * Props:
 * @param {boolean} isHome - True if rendering on the home page.
 * @param {function} onLogoClick - Callback when the logo button is clicked (workspace back to home).
 */
export default function Navbar({ isHome, onLogoClick, user, authLoading, onLogout, hasActiveFile }) {
  return (
    <header className={`site-header-shared ${isHome ? 'is-home' : 'is-workspace'}`}>
      <div className="navbar-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <button 
          className="header-logo-btn" 
          onClick={isHome ? undefined : onLogoClick}
          style={{ cursor: isHome ? 'default' : 'pointer' }}
          disabled={isHome}
          aria-label="FirstCommit Logo"
        >
          <svg className="logo-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span className="logo-text">FirstCommit</span>
        </button>

        {!authLoading && (
          user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img 
                src={user.avatarUrl} 
                alt={user.username}
                style={{ width: 32, height: 32, borderRadius: '50%', border: hasActiveFile ? '2px solid #30363d' : '2px solid #E5E7EB' }}
              />
              <span style={{ fontSize: '0.85rem', color: hasActiveFile ? 'white' : '#374151', fontWeight: 500 }}>
                @{user.username}
              </span>
              <button 
                onClick={onLogout}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: 'white',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  backgroundColor: '#24292f',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1f2327';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#24292f';
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <a 
              href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/github`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500, textDecoration: 'none', backgroundColor: '#24292f' }}
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              <span>Sign in with GitHub</span>
            </a>
          )
        )}
      </div>
    </header>
  );
}
