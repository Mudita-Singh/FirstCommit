import { useState, useEffect, useRef } from 'react';
import { fetchIssues, analyzeIssue } from '../services/issueApi';

/**
 * Helper to calculate "opened X days ago"
 */
function getDaysAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
}

/**
 * Helper to get extension/path dot color for square icons
 */
const getDotColor = (filePath) => {
  const ext = filePath.split('.').pop().toLowerCase();
  const lower = filePath.toLowerCase();
  if (lower.includes('examples/') && (ext === 'js' || ext === 'jsx')) return '#F43F5E';
  if (lower.includes('examples/')) return '#F59E0B';
  if (ext === 'md') return '#3B82F6';
  if (ext === 'json') return '#10B981';
  if (ext === 'js' || ext === 'jsx') return '#F59E0B';
  if (ext === 'ts' || ext === 'tsx') return '#3B82F6';
  if (ext === 'css') return '#7C3AED';
  return '#6B7280';
};

export default function IssueExplorer({ owner, repo, fileTree, onFileOpen }) {
  // State variables
  const [issues, setIssues] = useState([]);
  const [filteredIssues, setFilteredIssues] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  
  const issueListScrollPos = useRef(0);
  
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [error, setError] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  // Filters
  const [labelFilter, setLabelFilter] = useState('good first issue');
  const [assignmentFilter, setAssignmentFilter] = useState('unassigned');
  const [sortBy, setSortBy] = useState('newest');
  const [showLabelNotice, setShowLabelNotice] = useState(false);

  // Hover states for issue cards
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [btnHoveredIndex, setBtnHoveredIndex] = useState(null);
  const [backBtnHovered, setBackBtnHovered] = useState(false);

  // Fetch issues on mount
  useEffect(() => {
    let active = true;
    const loadIssues = async () => {
      setIsLoadingIssues(true);
      setError(null);
      try {
        const res = await fetchIssues(owner, repo);
        if (active) {
          setIssues(res.issues || []);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to load issues. Please check GitHub connectivity.');
        }
      } finally {
        if (active) {
          setIsLoadingIssues(false);
        }
      }
    };
    loadIssues();
    return () => {
      active = false;
    };
  }, [owner, repo]);

  // Client-side filtering logic
  useEffect(() => {
    let result = [...issues];
    let labelFilterMatched = true;

    // 1. Label filter
    if (labelFilter !== 'all') {
      let labelFiltered = [...issues];
      if (labelFilter === 'good first issue') {
        const easyKeywords = ['good first issue', 'easy', 'beginner', 'starter', 'good-first-issue', 'low hanging fruit'];
        labelFiltered = labelFiltered.filter(issue => 
          (issue.labels || []).some(l => easyKeywords.includes(l.toLowerCase()))
        );
      } else if (labelFilter === 'help wanted') {
        labelFiltered = labelFiltered.filter(issue => 
          (issue.labels || []).some(l => l.toLowerCase() === 'help wanted' || l.toLowerCase() === 'help-wanted')
        );
      } else if (labelFilter === 'bug') {
        labelFiltered = labelFiltered.filter(issue => 
          (issue.labels || []).some(l => l.toLowerCase() === 'bug')
        );
      } else if (labelFilter === 'enhancement') {
        labelFiltered = labelFiltered.filter(issue => 
          (issue.labels || []).some(l => l.toLowerCase() === 'enhancement' || l.toLowerCase() === 'feature')
        );
      } else if (labelFilter === 'documentation') {
        labelFiltered = labelFiltered.filter(issue => 
          (issue.labels || []).some(l => l.toLowerCase() === 'documentation' || l.toLowerCase() === 'docs')
        );
      }

      if (labelFiltered.length === 0) {
        labelFilterMatched = false;
      } else {
        if (labelFilter === 'good first issue') {
          const easyKeywords = ['good first issue', 'easy', 'beginner', 'starter', 'good-first-issue', 'low hanging fruit'];
          result = result.filter(issue => 
            issue.difficulty === 'Easy' || 
            (issue.labels || []).some(l => easyKeywords.includes(l.toLowerCase()))
          );
        } else {
          result = labelFiltered;
        }
      }
    }

    setShowLabelNotice(!labelFilterMatched);

    // 2. Assignment filter
    if (assignmentFilter === 'unassigned') {
      result = result.filter(issue => issue.isUnassigned);
    } else if (assignmentFilter === 'assigned') {
      result = result.filter(issue => !issue.isUnassigned);
    }

    // 3. Sorting
    if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortBy === 'least-commented') {
      result.sort((a, b) => a.commentsCount - b.commentsCount);
    }

    setFilteredIssues(result);
  }, [issues, labelFilter, assignmentFilter, sortBy]);

  // Trigger analysis when selectedIssue is set
  const handleSelectIssue = async (issue) => {
    issueListScrollPos.current = window.scrollY;
    setSelectedIssue(issue);
    setIsLoadingAnalysis(true);
    setAnalysisError(null);
    setAnalysis(null);

    // Scroll the page so that the tab bar is at the top of the viewport
    requestAnimationFrame(() => {
      const tabEl = document.querySelector('.ws-tabs-new');
      if (tabEl) {
        const rect = tabEl.getBoundingClientRect();
        const targetY = rect.top + window.scrollY;
        window.scrollTo({ top: targetY, behavior: 'instant' });
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    });

    try {
      const res = await analyzeIssue(
        owner,
        repo,
        issue.number,
        issue.title,
        issue.body,
        fileTree
      );
      setAnalysis(res.analysis);
    } catch (err) {
      setAnalysisError(err.message || 'An error occurred while analyzing the issue.');
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const handleBackToIssues = () => {
    setSelectedIssue(null);
    setAnalysis(null);
    requestAnimationFrame(() => {
      window.scrollTo({ 
        top: issueListScrollPos.current, 
        behavior: 'instant' 
      });
    });
  };

  // Helper to format result count line text
  const getResultsText = () => {
    const labelText = labelFilter === 'good first issue' ? 'good first issues' : 
                      labelFilter === 'help wanted' ? 'help wanted issues' :
                      labelFilter === 'bug' ? 'bugs' :
                      labelFilter === 'enhancement' ? 'enhancements' :
                      labelFilter === 'documentation' ? 'documentation issues' : 'issues';
    const assignText = assignmentFilter === 'all' ? '' : assignmentFilter;
    return `Showing ${filteredIssues.length} ${assignText} ${labelText}`.replace(/\s+/g, ' ').trim();
  };

  // Helper to render difficulty badge
  const renderDifficultyBadge = (difficulty, difficultySource) => {
    const diff = difficulty || 'Unknown';
    let styles = {};
    if (diff === 'Easy') {
      styles = { backgroundColor: '#DCFCE7', color: '#166534', borderColor: '#BBF7D0' };
    } else if (diff === 'Medium') {
      styles = { backgroundColor: '#FEF9C3', color: '#854D0E', borderColor: '#FDE68A' };
    } else if (diff === 'Hard') {
      styles = { backgroundColor: '#FEE2E2', color: '#991B1B', borderColor: '#FECACA' };
    } else {
      styles = { backgroundColor: '#F3F4F6', color: '#6B7280', borderColor: '#E5E7EB' };
    }

    const isEstimated = difficultySource === 'estimated';
    const displayText = isEstimated ? `~${diff}` : diff;

    return (
      <span 
        title={isEstimated ? "Difficulty estimated by AI" : undefined}
        style={{
          fontSize: '0.68rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          padding: '0.15rem 0.5rem',
          borderRadius: '9999px',
          border: '1px solid',
          display: 'inline-block',
          fontFamily: 'monospace',
          cursor: isEstimated ? 'help' : 'default',
          ...styles
        }}
      >
        {displayText}
      </span>
    );
  };

  // Helper to render availability text
  const renderAvailability = (isUnassigned) => {
    if (isUnassigned) {
      return (
        <span style={{ color: '#16A34A', fontSize: '0.75rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ color: '#16A34A' }}>●</span> Available
        </span>
      );
    }
    return (
      <span style={{ color: '#DC2626', fontSize: '0.75rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        <span style={{ color: '#DC2626' }}>●</span> Assigned
      </span>
    );
  };

  return (
    <div className="issue-explorer-container" style={{ width: '100%' }}>
      {/* ────────────────── SUB-VIEW A: ISSUE LIST ────────────────── */}
      {selectedIssue === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#111827', margin: 0 }}>Issues</h3>
            <span className="ws-count-badge">{filteredIssues.length} issues</span>
          </div>

          {/* Filters Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            {/* Dropdown 1 — Label */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: '500' }}>Label</label>
              <select
                value={labelFilter}
                onChange={(e) => setLabelFilter(e.target.value)}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  padding: '0.4rem 1.75rem 0.4rem 0.75rem',
                  fontSize: '0.82rem',
                  color: '#374151',
                  cursor: 'pointer',
                  outline: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.5rem center',
                  backgroundSize: '1rem'
                }}
              >
                <option value="good first issue">Good First Issues</option>
                <option value="help wanted">Help Wanted</option>
                <option value="bug">Bug</option>
                <option value="enhancement">Enhancement</option>
                <option value="documentation">Documentation</option>
                <option value="all">All Issues</option>
              </select>
            </div>

            {/* Dropdown 2 — Assignment */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: '500' }}>Assignment</label>
              <select
                value={assignmentFilter}
                onChange={(e) => setAssignmentFilter(e.target.value)}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  padding: '0.4rem 1.75rem 0.4rem 0.75rem',
                  fontSize: '0.82rem',
                  color: '#374151',
                  cursor: 'pointer',
                  outline: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.5rem center',
                  backgroundSize: '1rem'
                }}
              >
                <option value="unassigned">Unassigned</option>
                <option value="assigned">Assigned</option>
                <option value="all">All</option>
              </select>
            </div>

            {/* Dropdown 3 — Sort */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: '500' }}>Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  padding: '0.4rem 1.75rem 0.4rem 0.75rem',
                  fontSize: '0.82rem',
                  color: '#374151',
                  cursor: 'pointer',
                  outline: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.5rem center',
                  backgroundSize: '1rem'
                }}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="least-commented">Least Commented</option>
              </select>
            </div>
          </div>

          {/* Results Count Line */}
          <div style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: '0.75rem' }}>
            {getResultsText()}
          </div>

          {/* Amber Notice Bar */}
          {!isLoadingIssues && !error && showLabelNotice && (
            <div style={{
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              color: '#92400E',
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              marginBottom: '0.75rem',
              fontWeight: '500'
            }}>
              This repo doesn't use '{labelFilter}' labels. Showing all unassigned issues instead.
            </div>
          )}

          {/* Loading state */}
          {isLoadingIssues && (
            <div className="ws-loading" style={{ padding: '3rem 0' }}>
              <div className="spin-logo" style={{ fontSize: '32px', marginBottom: '1rem' }}>&lt;&gt;</div>
              <p style={{ color: '#6B7280', fontSize: '0.9rem' }}>Fetching issues...</p>
            </div>
          )}

          {/* Error state */}
          {error && !isLoadingIssues && (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
              color: '#991B1B',
              fontSize: '0.88rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <strong>Error Loading Issues:</strong>
              <div>{error}</div>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingIssues && !error && filteredIssues.length === 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4rem 1.5rem',
              textAlign: 'center',
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '10px'
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
              <div style={{ fontSize: '0.875rem', color: '#9CA3AF', fontWeight: '500', marginBottom: '0.25rem' }}>
                No issues found with current filters
              </div>
              <div style={{ fontSize: '0.8rem', color: '#D1D5DB' }}>
                Try changing the label or assignment filter
              </div>
            </div>
          )}

          {/* Issues List */}
          {!isLoadingIssues && !error && filteredIssues.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {filteredIssues.map((issue, idx) => (
                <div
                  key={issue.number}
                  onClick={() => handleSelectIssue(issue)}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderLeft: hoveredIndex === idx ? '3px solid #3B82F6' : '3px solid transparent',
                    borderRadius: '10px',
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: hoveredIndex === idx ? '0 2px 8px rgba(59, 130, 246, 0.08)' : 'none',
                    transform: hoveredIndex === idx ? 'translateY(-1px)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  {/* Row 1 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 0 }}>
                      <span style={{
                        fontFamily: 'monospace',
                        color: '#9CA3AF',
                        fontSize: '0.78rem',
                        marginRight: '0.5rem',
                        marginTop: '0.1rem',
                        flexShrink: 0
                      }}>
                        #{issue.number}
                      </span>
                      <span style={{
                        color: '#111827',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        wordBreak: 'break-word',
                        lineHeight: '1.4'
                      }}>
                        {issue.title}
                      </span>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {renderDifficultyBadge(issue.difficulty, issue.difficultySource)}
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#9CA3AF' }}>
                      <span>opened {getDaysAgo(issue.createdAt)}</span>
                      <span>·</span>
                      <span>{issue.commentsCount} comments</span>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {renderAvailability(issue.isUnassigned)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ────────────────── SUB-VIEW B: ISSUE DETAIL VIEW ────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Back Button */}
          <div
            onClick={handleBackToIssues}
            onMouseEnter={() => setBackBtnHovered(true)}
            onMouseLeave={() => setBackBtnHovered(false)}
            style={{
              color: '#3B82F6',
              fontSize: '0.85rem',
              cursor: 'pointer',
              textDecoration: backBtnHovered ? 'underline' : 'none',
              marginBottom: '1.25rem',
              alignSelf: 'flex-start',
              fontWeight: '500',
              display: 'inline-flex',
              alignItems: 'center'
            }}
          >
            ← Back to issues
          </div>

          {/* Issue Header Card */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 0 }}>
                <span style={{
                  fontFamily: 'monospace',
                  color: '#6B7280',
                  fontSize: '0.85rem',
                  marginRight: '0.5rem',
                  marginTop: '0.15rem',
                  flexShrink: 0
                }}>
                  #{selectedIssue.number}
                </span>
                <h2 style={{
                  fontSize: '1rem',
                  fontWeight: '700',
                  color: '#111827',
                  margin: 0,
                  lineHeight: '1.4'
                }}>
                  {selectedIssue.title}
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                {renderDifficultyBadge(selectedIssue.difficulty, selectedIssue.difficultySource)}
                <a
                  href={selectedIssue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#3B82F6',
                    fontSize: '0.8,px',
                    fontSize: '0.8rem',
                    textDecoration: 'none',
                    fontWeight: '500'
                  }}
                  className="breadcrumb-link"
                >
                  View on GitHub ↗
                </a>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '0.5rem' }}>
              {renderAvailability(selectedIssue.isUnassigned)}
            </div>
          </div>

          {/* Analysis Loading */}
          {isLoadingAnalysis && (
            <div className="ws-loading" style={{ padding: '4rem 0' }}>
              <div className="spin-logo" style={{ fontSize: '32px', marginBottom: '1rem' }}>&lt;&gt;</div>
              <p style={{ color: '#6B7280', fontSize: '0.9rem' }}>Analyzing issue with AI...</p>
            </div>
          )}

          {/* Analysis Error */}
          {analysisError && !isLoadingAnalysis && (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
              color: '#991B1B',
              fontSize: '0.88rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div>
                <strong>Analysis Failed:</strong> {analysisError}
              </div>
              <button
                onClick={() => handleSelectIssue(selectedIssue)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #EF4444',
                  color: '#EF4444',
                  borderRadius: '6px',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                Retry Analysis
              </button>
            </div>
          )}

          {/* Analysis Content */}
          {!isLoadingAnalysis && !analysisError && analysis && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* SECTION 1 — WHAT NEEDS TO CHANGE */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                padding: '1.25rem',
                marginBottom: '0.75rem'
              }}>
                <div style={{
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#6B7280',
                  marginBottom: '0.5rem'
                }}>
                  📋 WHAT NEEDS TO CHANGE
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  lineHeight: '1.6'
                }}>
                  {analysis.summary}
                </div>
              </div>

              {/* SECTION 2 — FILES TO TOUCH */}
              {Array.isArray(analysis.filesToTouch) && (
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#6B7280',
                    marginBottom: '0.75rem'
                  }}>
                    📁 FILES TO TOUCH ({analysis.filesToTouch.length})
                  </div>
                  {analysis.filesToTouch.length > 0 ? (
                    analysis.filesToTouch.map((file, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: '#F9FAFB',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: idx === analysis.filesToTouch.length - 1 ? 0 : '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                          <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '3px',
                            backgroundColor: getDotColor(file.path),
                            flexShrink: 0
                          }}></div>
                          <span style={{
                            fontFamily: 'monospace',
                            color: '#111827',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            wordBreak: 'break-all'
                          }}>
                            {file.path}
                          </span>
                          {file.lines && (
                            <span style={{
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              fontWeight: '600',
                              flexShrink: 0
                            }}>
                              lines {file.lines}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => onFileOpen(file.path)}
                          onMouseEnter={() => setBtnHoveredIndex(idx)}
                          onMouseLeave={() => setBtnHoveredIndex(null)}
                          style={{
                            backgroundColor: btnHoveredIndex === idx ? '#2563EB' : '#3B82F6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.78rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Open in CodeViewer →
                        </button>
                      </div>

                      <div style={{
                        fontSize: '0.82rem',
                        color: '#6B7280',
                        marginTop: '0.4rem',
                        marginBottom: file.codeSnippet ? '0.5rem' : 0
                      }}>
                        → {file.reason}
                      </div>

                      {file.codeSnippet && (
                        <pre style={{
                          backgroundColor: '#0d1117',
                          borderRadius: '6px',
                          padding: '0.75rem 1rem',
                          marginTop: '0.5rem',
                          fontFamily: 'monospace',
                          fontSize: '0.78rem',
                          color: '#c9d1d9',
                          whiteSpace: 'pre',
                          overflowX: 'auto',
                          margin: 0
                        }}>{file.codeSnippet}</pre>
                      )}
                    </div>
                  ))
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '0.75rem'
                    }}>
                      <div style={{ fontSize: '0.85rem', color: '#4B5563', lineHeight: '1.5' }}>
                        Open the issue on GitHub to see if specific files are mentioned in the description.
                      </div>
                      <a
                        href={selectedIssue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          backgroundColor: 'white',
                          border: '1px solid #D1D5DB',
                          color: '#374151',
                          borderRadius: '6px',
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.78rem',
                          fontWeight: '500',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        View on GitHub →
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 3 — WHERE TO START */}
              {analysis.firstStep && (
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#6B7280',
                    marginBottom: '0.5rem'
                  }}>
                    👉 START HERE
                  </div>
                  <div style={{
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '8px',
                    padding: '1rem',
                    color: '#1D4ED8',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    lineHeight: '1.5'
                  }}>
                    {analysis.firstStep}
                  </div>
                </div>
              )}

              {/* SECTION 4 — ESTIMATED EFFORT */}
              {analysis.estimatedEffort && (
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#6B7280',
                    marginBottom: '0.5rem'
                  }}>
                    ⏱ ESTIMATED EFFORT
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#374151'
                  }}>
                    {analysis.estimatedEffort}
                  </div>
                </div>
              )}

              {/* SECTION 5 — SAFE TO IGNORE */}
              {Array.isArray(analysis.filesToIgnore) && analysis.filesToIgnore.length > 0 && (
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#6B7280',
                    marginBottom: '0.5rem'
                  }}>
                    🚫 SAFE TO IGNORE
                  </div>
                  <div style={{
                    fontSize: '0.82rem',
                    color: '#9CA3AF'
                  }}>
                    {analysis.filesToIgnore.join('  ·  ')}
                  </div>
                </div>
              )}

              {/* SECTION 6 — DIFFICULTY */}
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                padding: '1.25rem'
              }}>
                <div style={{
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#6B7280',
                  marginBottom: '0.5rem'
                }}>
                  DIFFICULTY
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                  {renderDifficultyBadge(analysis.difficulty)}
                  {analysis.difficultyReason && (
                    <div style={{
                      fontSize: '0.82rem',
                      color: '#6B7280',
                      lineHeight: '1.4'
                    }}>
                      {analysis.difficultyReason}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
