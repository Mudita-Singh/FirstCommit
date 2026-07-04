import React from 'react';

/**
 * Breadcrumb Component
 * Renders a top navigation path for hierarchical tracking of repos/files.
 */
export default function Breadcrumb({ repoName, filePath, onHomeClick, onRepoClick }) {
  if (!repoName) return null;

  return (
    <nav className="breadcrumb-nav" style={{
      display: 'flex',
      alignItems: 'center',
      backgroundColor: '#0d1117',
      borderBottom: '1px solid #30363d',
      padding: '0.5rem 1.5rem',
      fontSize: '0.8rem',
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Home Link (logo part) */}
      <span 
        onClick={onHomeClick} 
        className="breadcrumb-link"
        style={{ 
          cursor: 'pointer', 
          display: 'inline-flex', 
          alignItems: 'center', 
          color: '#58a6ff',
          fontWeight: '600'
        }}
      >
        FirstCommit
      </span>

      {/* Separator 1 */}
      <span style={{ color: '#484f58', margin: '0 0.4rem' }}>&rsaquo;</span>

      {/* Repo Link */}
      {filePath ? (
        <span 
          onClick={onRepoClick} 
          className="breadcrumb-link"
          style={{ 
            color: '#58a6ff', 
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          {repoName}
        </span>
      ) : (
        <span style={{ 
          color: '#8b949e', 
          fontWeight: '500'
        }}>
          {repoName}
        </span>
      )}

      {/* Optional File path link */}
      {filePath && (
        <>
          <span style={{ color: '#484f58', margin: '0 0.4rem' }}>&rsaquo;</span>
          <span 
            title={filePath}
            style={{ 
              color: '#8b949e', 
              fontWeight: '400',
              fontFamily: 'Menlo, Monaco, Consolas, monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '250px'
            }}
          >
            {filePath}
          </span>
        </>
      )}
    </nav>
  );
}
