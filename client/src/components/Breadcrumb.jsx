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
      backgroundColor: '#E8EAFF',
      borderBottom: '1px solid rgba(30, 27, 75, 0.12)',
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
          color: '#1E1B4B',
          fontWeight: '700'
        }}
      >
        FirstCommit
      </span>

      {/* Separator 1 */}
      <span style={{ color: 'rgba(30, 27, 75, 0.4)', margin: '0 0.4rem' }}>&rsaquo;</span>

      {/* Repo Link */}
      {filePath ? (
        <span 
          onClick={onRepoClick} 
          className="breadcrumb-link"
          style={{ 
            color: '#4F46E5', 
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          {repoName}
        </span>
      ) : (
        <span style={{ 
          color: '#1E1B4B', 
          fontWeight: '600'
        }}>
          {repoName}
        </span>
      )}

      {/* Optional File path link */}
      {filePath && (
        <>
          <span style={{ color: 'rgba(30, 27, 75, 0.4)', margin: '0 0.4rem' }}>&rsaquo;</span>
          <span 
            title={filePath}
            style={{ 
              color: 'rgba(30, 27, 75, 0.7)', 
              fontWeight: '500',
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
