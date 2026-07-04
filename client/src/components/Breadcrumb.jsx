import React from 'react';

/**
 * Breadcrumb Component
 * Senders a top navigation path for hierarchical tracking of repos/files.
 */
export default function Breadcrumb({ repoName, filePath, onHomeClick, onRepoClick }) {
  if (!repoName) return null;

  return (
    <nav className="breadcrumb-nav" style={{
      display: 'flex',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderBottom: '1px solid #E5E7EB',
      padding: '0.6rem 2rem',
      fontSize: '0.82rem',
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Home Link (logo part) */}
      <span 
        onClick={onHomeClick} 
        style={{ 
          cursor: 'pointer', 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.25rem' 
        }}
      >
        <span style={{ 
          color: '#3B82F6', 
          fontFamily: 'monospace', 
          fontWeight: '700',
          fontSize: '0.95rem'
        }}>&lt;&gt;</span>
        <span style={{ 
          color: '#111827', 
          fontWeight: '600',
          textDecoration: 'none'
        }} className="breadcrumb-link-hover">FirstCommit</span>
      </span>

      {/* Separator 1 */}
      <span style={{ color: '#9CA3AF', margin: '0 0.4rem' }}>&rsaquo;</span>

      {/* Repo Link */}
      {filePath ? (
        <span 
          onClick={onRepoClick} 
          style={{ 
            color: '#3B82F6', 
            cursor: 'pointer',
            fontWeight: '500'
          }}
          className="breadcrumb-link-hover"
        >
          {repoName}
        </span>
      ) : (
        <span style={{ 
          color: '#374151', 
          fontWeight: '500'
        }}>
          {repoName}
        </span>
      )}

      {/* Optional File path link */}
      {filePath && (
        <>
          <span style={{ color: '#9CA3AF', margin: '0 0.4rem' }}>&rsaquo;</span>
          <span 
            title={filePath}
            style={{ 
              color: '#374151', 
              fontWeight: '500',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '300px'
            }}
          >
            {filePath}
          </span>
        </>
      )}
    </nav>
  );
}
