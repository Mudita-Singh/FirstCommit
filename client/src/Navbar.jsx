import React from 'react';

/**
 * Shared Navbar Component
 * Renders identical top navigation headers for both Home and Workspace pages.
 * 
 * Props:
 * @param {boolean} isHome - True if rendering on the home page.
 * @param {function} onLogoClick - Callback when the logo button is clicked (workspace back to home).
 */
export default function Navbar({ isHome, onLogoClick }) {
  return (
    <header className={`site-header-shared ${isHome ? 'is-home' : 'is-workspace'}`}>
      <div className="navbar-container">
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
      </div>
    </header>
  );
}
