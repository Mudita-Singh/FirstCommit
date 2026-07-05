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

/**
 * Helper to get issue category tag based on title and labels
 */
function getIssueCategoryTag(title, labels = []) {
  const lowerTitle = (title || '').toLowerCase();
  const lowerLabels = (labels || []).map(l => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  
  const isFeature = lowerTitle.includes('feat') || lowerTitle.includes('feature') || lowerTitle.includes('fr') || lowerLabels.some(l => l.includes('feat') || l.includes('feature'));
  const isBug = lowerTitle.includes('bug') || lowerTitle.includes('fix') || lowerTitle.includes('error') || lowerTitle.includes('typeerror') || lowerTitle.includes('throws') || lowerLabels.some(l => l.includes('bug') || l.includes('fix'));
  const isDocs = lowerTitle.includes('doc') || lowerTitle.includes('readme') || lowerTitle.includes('typo') || lowerLabels.some(l => l.includes('doc') || l.includes('readme'));
  const isTest = lowerTitle.includes('test') || lowerTitle.includes('coverage') || lowerLabels.some(l => l.includes('test'));
  
  if (isFeature) {
    return { text: 'Feature', bg: '#EEF2FF', color: '#4338CA' };
  }
  if (isBug) {
    return { text: 'Bug', bg: '#FEF2F2', color: '#991B1B' };
  }
  if (isDocs) {
    return { text: 'Documentation', bg: '#F0FDF4', color: '#166534' };
  }
  if (isTest) {
    return { text: 'Tests', bg: '#FFF7ED', color: '#92400E' };
  }
  return { text: 'Issue', bg: '#F3F4F6', color: '#374151' };
}

/**
 * Helper to get issue icon settings based on difficulty
 */
const getIssueIcon = (difficulty) => {
  if (difficulty === 'Easy') 
    return { bg: '#10B981', letter: 'E' }
  if (difficulty === 'Medium') 
    return { bg: '#F59E0B', letter: 'M' }
  if (difficulty === 'Hard') 
    return { bg: '#EF4444', letter: 'H' }
  return { bg: '#6B7280', letter: '?' }
}

export default function IssueExplorer({ owner, repo, fileTree, onFileOpen, tabBarRef }) {
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

  // Dropdown UI states
  const [labelHover, setLabelHover] = useState(false);
  const [labelFocus, setLabelFocus] = useState(false);
  const [assignHover, setAssignHover] = useState(false);
  const [assignFocus, setAssignFocus] = useState(false);
  const [sortHover, setSortHover] = useState(false);
  const [sortFocus, setSortFocus] = useState(false);

  // Hover states for issue cards
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [btnHoveredIndex, setBtnHoveredIndex] = useState(null);
  const [backBtnHovered, setBackBtnHovered] = useState(false);
  const [resetHover, setResetHover] = useState(false);
  const [dismissedNotice, setDismissedNotice] = useState(false);

  // Fetch issues on mount
  useEffect(() => {
    setSelectedIssue(null);
    setDismissedNotice(false);
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

  // Always scroll to tab bar when an issue is selected/opened, when loading state changes, or when analysis loads
  useEffect(() => {
    if (selectedIssue && tabBarRef?.current) {
      const performScroll = () => {
        let element = tabBarRef.current;
        let absoluteTop = 0;
        while (element) {
          absoluteTop += element.offsetTop;
          element = element.offsetParent;
        }
        const scrollTarget = absoluteTop - 16;
        window.scrollTo({ 
          top: scrollTarget, 
          behavior: 'instant' 
        });
      };
      performScroll();
      const t1 = setTimeout(performScroll, 50);
      const t2 = setTimeout(performScroll, 150);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [selectedIssue, isLoadingAnalysis, analysis, tabBarRef]);

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

  const handleResetFilters = () => {
    setLabelFilter('good first issue');
    setAssignmentFilter('unassigned');
    setSortBy('newest');
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

          {/* Polished Filters Container */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
            marginBottom: '1.25rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.25rem'
            }}>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', flexGrow: 1 }}>
                {/* Dropdown 1 — Label */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '180px', flexGrow: 1 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.72rem',
                    fontWeight: '600',
                    color: '#4B5563',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                      <line x1="7" y1="7" x2="7.01" y2="7"/>
                    </svg>
                    Label
                  </span>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5" style={{ position: 'absolute', left: '0.75rem', pointerEvents: 'none' }}>
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                      <line x1="7" y1="7" x2="7.01" y2="7"/>
                    </svg>
                    <select
                      value={labelFilter}
                      onChange={(e) => setLabelFilter(e.target.value)}
                      onMouseEnter={() => setLabelHover(true)}
                      onMouseLeave={() => setLabelHover(false)}
                      onFocus={() => setLabelFocus(true)}
                      onBlur={() => setLabelFocus(false)}
                      style={{
                        backgroundColor: 'white',
                        border: '1px solid',
                        borderColor: labelFocus ? '#3B82F6' : labelHover ? '#CBD5E1' : '#E5E7EB',
                        borderRadius: '8px',
                        padding: '0.5rem 1.8rem 0.5rem 2.2rem',
                        fontSize: '0.82rem',
                        color: '#374151',
                        fontWeight: '500',
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234B5563' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.6rem center',
                        backgroundSize: '0.8rem',
                        boxShadow: labelFocus ? '0 0 0 3px rgba(59, 130, 246, 0.12), 0 1px 2px 0 rgba(0,0,0,0.05)' : '0 1px 2px 0 rgba(0,0,0,0.05)',
                        outline: 'none',
                        transition: 'all 0.15s ease-in-out',
                        width: '100%'
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
                </div>

                {/* Dropdown 2 — Assignment */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '180px', flexGrow: 1 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.72rem',
                    fontWeight: '600',
                    color: '#4B5563',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    Assignment
                  </span>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5" style={{ position: 'absolute', left: '0.75rem', pointerEvents: 'none' }}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <select
                      value={assignmentFilter}
                      onChange={(e) => setAssignmentFilter(e.target.value)}
                      onMouseEnter={() => setAssignHover(true)}
                      onMouseLeave={() => setAssignHover(false)}
                      onFocus={() => setAssignFocus(true)}
                      onBlur={() => setAssignFocus(false)}
                      style={{
                        backgroundColor: 'white',
                        border: '1px solid',
                        borderColor: assignFocus ? '#3B82F6' : assignHover ? '#CBD5E1' : '#E5E7EB',
                        borderRadius: '8px',
                        padding: '0.5rem 1.8rem 0.5rem 2.2rem',
                        fontSize: '0.82rem',
                        color: '#374151',
                        fontWeight: '500',
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234B5563' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.6rem center',
                        backgroundSize: '0.8rem',
                        boxShadow: assignFocus ? '0 0 0 3px rgba(59, 130, 246, 0.12), 0 1px 2px 0 rgba(0,0,0,0.05)' : '0 1px 2px 0 rgba(0,0,0,0.05)',
                        outline: 'none',
                        transition: 'all 0.15s ease-in-out',
                        width: '100%'
                      }}
                    >
                      <option value="unassigned">Unassigned</option>
                      <option value="assigned">Assigned</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                </div>

                {/* Dropdown 3 — Sort */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '180px', flexGrow: 1 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.72rem',
                    fontWeight: '600',
                    color: '#4B5563',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <polyline points="19 12 12 19 5 12"/>
                    </svg>
                    Sort by
                  </span>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5" style={{ position: 'absolute', left: '0.75rem', pointerEvents: 'none' }}>
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <polyline points="19 12 12 19 5 12"/>
                    </svg>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      onMouseEnter={() => setSortHover(true)}
                      onMouseLeave={() => setSortHover(false)}
                      onFocus={() => setSortFocus(true)}
                      onBlur={() => setSortFocus(false)}
                      style={{
                        backgroundColor: 'white',
                        border: '1px solid',
                        borderColor: sortFocus ? '#3B82F6' : sortHover ? '#CBD5E1' : '#E5E7EB',
                        borderRadius: '8px',
                        padding: '0.5rem 1.8rem 0.5rem 2.2rem',
                        fontSize: '0.82rem',
                        color: '#374151',
                        fontWeight: '500',
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234B5563' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.6rem center',
                        backgroundSize: '0.8rem',
                        boxShadow: sortFocus ? '0 0 0 3px rgba(59, 130, 246, 0.12), 0 1px 2px 0 rgba(0,0,0,0.05)' : '0 1px 2px 0 rgba(0,0,0,0.05)',
                        outline: 'none',
                        transition: 'all 0.15s ease-in-out',
                        width: '100%'
                      }}
                    >
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                      <option value="least-commented">Least Commented</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Reset filters button */}
              <button
                onClick={handleResetFilters}
                onMouseEnter={() => setResetHover(true)}
                onMouseLeave={() => setResetHover(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'white',
                  border: '1px solid',
                  borderColor: resetHover ? '#CBD5E1' : '#E5E7EB',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: '550',
                  color: '#374151',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.15s ease',
                  height: '38px',
                  alignSelf: 'flex-end',
                  flexShrink: 0
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2.5" style={{ transition: 'transform 0.25s ease', transform: resetHover ? 'rotate(180deg)' : 'none' }}>
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
                Reset filters
              </button>
            </div>
          </div>

          {/* Blue Alert Notice Bar (with close button) */}
          {!isLoadingIssues && !error && showLabelNotice && !dismissedNotice && (
            <div
              style={{
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                color: '#1E40AF',
                borderRadius: '8px',
                padding: '0.75rem 1.25rem',
                fontSize: '0.85rem',
                marginBottom: '0.75rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                boxShadow: '0 1px 2px 0 rgba(59, 130, 246, 0.05)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span>This repo doesn't use '{labelFilter}' labels. Showing all unassigned issues instead.</span>
              </div>
              <button
                onClick={() => setDismissedNotice(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1E40AF',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: '0 0.25rem',
                  lineHeight: 1,
                  opacity: 0.7,
                  transition: 'opacity 0.15s ease'
                }}
                onMouseEnter={(e) => e.target.style.opacity = 1}
                onMouseLeave={(e) => e.target.style.opacity = 0.7}
              >
                ×
              </button>
            </div>
          )}

          {/* Polished Results Title Bar with List Icon */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '1rem',
            marginTop: '0.5rem'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <circle cx="3" cy="6" r="1" fill="#4F46E5"/>
              <circle cx="3" cy="12" r="1" fill="#4F46E5"/>
              <circle cx="3" cy="18" r="1" fill="#4F46E5"/>
            </svg>
            <span>
              Showing <span style={{ color: '#4F46E5', fontWeight: '700' }}>{filteredIssues.length}</span> {assignmentFilter === 'all' ? '' : assignmentFilter} issues
            </span>
          </div>

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
              padding: '3rem',
              textAlign: 'center',
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '12px'
            }}>
              <div style={{ position: 'relative', width: '48px', height: '48px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg 
                  width="40" 
                  height="40" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#D1D5DB" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#3B82F6" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  style={{
                    position: 'absolute',
                    bottom: '0px',
                    right: '0px',
                    background: 'white',
                    borderRadius: '50%',
                    padding: '2px',
                    boxShadow: '0 0 0 2px white'
                  }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
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
            <div className="ws-timeline-container" style={{ paddingLeft: '3rem', position: 'relative' }}>
              <div className="ws-timeline-line" style={{ position: 'absolute', left: '15px', top: '30px', bottom: '30px', width: '2px', backgroundColor: '#BFDBFE', zIndex: 1 }}></div>
              <div className="ws-list-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredIssues.map((issue, idx) => {
                  const category = getIssueCategoryTag(issue.title, issue.labels);
                  return (
                    <div key={issue.number} className="ws-timeline-item" style={{ position: 'relative', width: '100%' }}>
                      {/* Number badge per issue */}
                      <div style={{
                        position: 'absolute',
                        left: '-3rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        backgroundColor: '#3B82F6',
                        color: 'white',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        border: '2px solid white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                        boxShadow: '0 0 0 1px #BFDBFE',
                        fontFamily: 'var(--font)'
                      }}>
                        {idx + 1}
                      </div>

                      {/* Issue Card */}
                      <div
                        onClick={() => handleSelectIssue(issue)}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        style={{
                          backgroundColor: 'white',
                          border: hoveredIndex === idx ? '1px solid #BFDBFE' : '1px solid #E5E7EB',
                          borderLeft: hoveredIndex === idx ? '3px solid #3B82F6' : '3px solid transparent',
                          borderRadius: '12px',
                          padding: '1.25rem 1.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1.5rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: hoveredIndex === idx ? '0 2px 8px rgba(59, 130, 246, 0.08)' : 'none',
                          transform: hoveredIndex === idx ? 'translateY(-1px)' : 'none',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      >
                        {/* Left side difficulty icon square */}
                        {(() => {
                          const icon = getIssueIcon(issue.difficulty);
                          return (
                            <div style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '10px',
                              backgroundColor: icon.bg,
                              color: 'white',
                              fontSize: '1rem',
                              fontWeight: '700',
                              fontFamily: 'monospace',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }} title={issue.difficulty}>
                              {icon.letter}
                            </div>
                          );
                        })()}

                        {/* Middle info column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexGrow: 1, minWidth: 0 }}>
                          {/* Row 1 */}
                          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, width: '100%' }}>
                            <span style={{
                              fontFamily: 'monospace',
                              color: '#4B5563',
                              fontSize: '0.78rem',
                              fontWeight: '500',
                              marginRight: '0.5rem',
                              flexShrink: 0
                            }}>
                              #{issue.number}
                            </span>
                            <span style={{
                              color: '#111827',
                              fontWeight: 600,
                              fontSize: '0.92rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              minWidth: 0,
                              flexGrow: 1
                            }}>
                              {issue.title}
                            </span>
                            <span className="ws-category-pill" style={{
                              backgroundColor: category.bg,
                              color: category.color,
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              marginLeft: 'auto',
                              flexShrink: 0
                            }}>
                              {category.text}
                            </span>
                          </div>

                          {/* Row 2 */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#4B5563', fontWeight: 400 }}>
                              <span>opened {getDaysAgo(issue.createdAt)}</span>
                              <span>·</span>
                              <span>{issue.commentsCount} {issue.commentsCount === 1 ? 'comment' : 'comments'}</span>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                              {issue.isUnassigned ? (
                                <span style={{ color: '#16A34A', fontSize: '0.75rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ color: '#16A34A' }}>●</span> Available
                                </span>
                              ) : (
                                <span style={{ color: '#DC2626', fontSize: '0.75rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ color: '#DC2626' }}>●</span> Assigned
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back to issues</span>
          </div>

          {/* Issue Header Card */}
          {(() => {
            const category = getIssueCategoryTag(selectedIssue.title, selectedIssue.labels);
            let typeBg = '#F3F4F6';
            let typeIcon = (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            );

            if (category.text === 'Bug') {
              typeBg = '#FEE2E2';
              typeIcon = (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="10" rx="2"></rect>
                  <path d="M12 2v3M7.5 4l1.5 2.5M16.5 4L15 6.5M4 12H2M22 12h-2M6 21H4M18 21h2"></path>
                </svg>
              );
            } else if (category.text === 'Feature') {
              typeBg = '#EEF2FF';
              typeIcon = (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              );
            } else if (category.text === 'Documentation') {
              typeBg = '#F0FDF4';
              typeIcon = (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              );
            } else if (category.text === 'Tests') {
              typeBg = '#FFF7ED';
              typeIcon = (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5h20c0-2.31-1-4.24-2.5-5.5"></path>
                  <path d="M12 2v10M9 8l3 4 3-4"></path>
                </svg>
              );
            }

            const diff = selectedIssue.difficulty || 'Unknown';
            let diffStyle = { backgroundColor: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF', border: '1px solid #E5E7EB' };
            if (diff === 'Easy') {
              diffStyle = { backgroundColor: '#F0FDF4', color: '#166534', dot: '#10B981', border: '1px solid #BBF7D0' };
            } else if (diff === 'Medium') {
              diffStyle = { backgroundColor: '#FFFBEB', color: '#854D0E', dot: '#F59E0B', border: '1px solid #FDE68A' };
            } else if (diff === 'Hard') {
              diffStyle = { backgroundColor: '#FEF2F2', color: '#991B1B', dot: '#EF4444', border: '1px solid #FECACA' };
            }

            return (
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                padding: '1.25rem 1.5rem',
                marginBottom: '1rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: typeBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {typeIcon}
                </div>
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 0, flexGrow: 1 }}>
                      <span style={{
                        backgroundColor: '#F3F4F6',
                        color: '#6B7280',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        fontWeight: '600',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        marginRight: '0.5rem',
                        marginTop: '0.15rem',
                        flexShrink: 0
                      }}>
                        #{selectedIssue.number}
                      </span>
                      <h2 style={{
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        color: '#111827',
                        margin: 0,
                        lineHeight: '1.4',
                        wordBreak: 'break-word'
                      }}>
                        {selectedIssue.title}
                      </h2>
                    </div>

                    <span style={{
                      backgroundColor: diffStyle.backgroundColor,
                      color: diffStyle.color,
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '9999px',
                      border: diffStyle.border,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      flexShrink: 0
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: diffStyle.dot }}></span>
                      {diff}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.8rem', color: '#6B7280', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      Opened {getDaysAgo(selectedIssue.createdAt)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      {selectedIssue.commentsCount} comments
                    </span>
                    <span style={{ color: '#16A34A', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }}></span>
                      Available
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                    <a
                      href={selectedIssue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        backgroundColor: 'white',
                        border: '1px solid #E5E7EB',
                        color: '#374151',
                        borderRadius: '8px',
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.82rem',
                        fontWeight: '500',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        textDecoration: 'none',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                      </svg>
                      <span>View on GitHub ↗</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Analysis Loading */}
          {isLoadingAnalysis && (
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '3rem',
              textAlign: 'center',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div className="spin-logo" style={{ fontSize: '32px', marginBottom: '1rem' }}>&lt;&gt;</div>
              <p style={{ color: '#6B7280', fontSize: '0.9rem', margin: 0 }}>Analyzing issue...</p>
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
          {!isLoadingAnalysis && !analysisError && (
            analysis ? (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                {/* SECTION E — WHAT NEEDS TO CHANGE */}
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginBottom: '1rem',
                  boxSizing: 'border-box'
                }}>
                  <h3 style={{
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    color: '#111827',
                    margin: '0 0 0.5rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="9" y1="9" x2="15" y2="9"></line>
                      <line x1="9" y1="13" x2="15" y2="13"></line>
                      <line x1="9" y1="17" x2="15" y2="17"></line>
                    </svg>
                    <span>What Needs to Change</span>
                  </h3>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#374151',
                    lineHeight: '1.6'
                  }}>
                    {analysis.summary}
                  </div>
                </div>

                {/* SECTION B — TWO COLUMN LAYOUT */}
                <div className="ws-two-column-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1rem',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  {/* LEFT COLUMN — "Start Here" */}
                  {Array.isArray(analysis.startHere) && analysis.startHere.length > 0 && (
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <h3 style={{
                          fontSize: '0.9rem',
                          fontWeight: '700',
                          color: '#111827',
                          margin: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                          </svg>
                          <span>Start Here</span>
                        </h3>
                        <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: '0.15rem 0 0 0' }}>
                          Follow these steps to begin working on this issue.
                        </p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {analysis.startHere.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.6rem 0', position: 'relative' }}>
                            {idx < analysis.startHere.length - 1 && (
                              <div style={{
                                position: 'absolute',
                                left: '11px',
                                top: '30px',
                                bottom: '-10px',
                                borderLeft: '2px dashed #E5E7EB',
                                width: 0,
                                zIndex: 1
                              }}></div>
                            )}

                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: '#3B82F6',
                              color: 'white',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 2
                            }}>
                              {item.step || idx + 1}
                            </div>

                            <div style={{ flexGrow: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.85rem' }}>
                                {item.action}
                              </div>
                              <div style={{ color: '#6B7280', fontSize: '0.78rem', marginTop: '0.15rem', lineHeight: '1.4' }}>
                                {item.detail}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RIGHT COLUMN — "Files to Touch" */}
                  <div style={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <h3 style={{
                        fontSize: '0.9rem',
                        fontWeight: '700',
                        color: '#111827',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.4rem' }}>
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span>Files to Touch</span>
                        <span style={{
                          backgroundColor: '#3B82F6',
                          color: 'white',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: '0.5rem'
                        }}>
                          {Array.isArray(analysis.filesToTouch) ? analysis.filesToTouch.length : 0}
                        </span>
                      </h3>
                      <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: '0.15rem 0 0 0' }}>
                        These files are most relevant to this issue.
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {Array.isArray(analysis.filesToTouch) && analysis.filesToTouch.map((file, idx) => {
                        const confidence = file.confidence || 0;
                        let confColor = '#9CA3AF';
                        if (confidence >= 90) confColor = '#10B981';
                        else if (confidence >= 70) confColor = '#F59E0B';

                        return (
                          <div
                            key={idx}
                            style={{
                              backgroundColor: '#F9FAFB',
                              border: '1px solid #E5E7EB',
                              borderLeft: `3px solid ${confColor}`,
                              borderRadius: '8px',
                              padding: '0.875rem',
                              marginBottom: '0.5rem',
                              display: 'flex',
                              flexDirection: 'column'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flexGrow: 1 }}>
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
                                  fontSize: '0.85rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }} title={file.path}>
                                  {file.path}
                                </span>
                              </div>
                              <span style={{
                                backgroundColor: `${confColor}1A`,
                                color: confColor,
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                flexShrink: 0
                              }}>
                                {confidence}%
                              </span>
                            </div>

                            <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                              Lines {file.lines || 'N/A'} · {file.lineCount || 0} lines
                            </div>

                            <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '0.25rem', lineHeight: '1.4' }}>
                              {file.reason}
                            </div>

                            <button
                              onClick={() => onFileOpen(file.path)}
                              style={{
                                alignSelf: 'flex-start',
                                backgroundColor: '#3B82F6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.78rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'background-color 0.15s ease',
                                marginTop: '0.5rem'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3B82F6'}
                            >
                              Open in Split View →
                            </button>
                          </div>
                        );
                      })}

                      <div style={{
                        fontSize: '0.72rem',
                        color: '#9CA3AF',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        marginTop: '0.5rem'
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="16" x2="12" y2="12"></line>
                          <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <span>Confidence is based on code relevance to the issue.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION C — RELEVANT CODE */}
                {(() => {
                  const firstFile = Array.isArray(analysis.filesToTouch) && analysis.filesToTouch[0];
                  if (!firstFile || !firstFile.codeSnippet || !firstFile.codeSnippet.trim()) {
                    return null;
                  }

                  const snippetLines = firstFile.codeSnippet.split('\n');
                  let startLineNumber = 1;
                  if (firstFile.lines) {
                    const match = firstFile.lines.match(/^(\d+)/);
                    if (match) {
                      startLineNumber = parseInt(match[1]);
                    }
                  }

                  return (
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      marginBottom: '1rem',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                          <h3 style={{
                            fontSize: '0.9rem',
                            fontWeight: '700',
                            color: '#111827',
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="16 18 22 12 16 6"></polyline>
                              <polyline points="8 6 2 12 8 18"></polyline>
                            </svg>
                            <span>Relevant Code</span>
                          </h3>
                          <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: '0.15rem 0 0 0' }}>
                            Key code snippet from {firstFile.path}
                          </p>
                        </div>

                        <button
                          onClick={() => onFileOpen(firstFile.path)}
                          style={{
                            backgroundColor: '#3B82F6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.78rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3B82F6'}
                        >
                          Open in Split View →
                        </button>
                      </div>

                      <div style={{
                        backgroundColor: '#0d1117',
                        borderRadius: '8px',
                        padding: '1rem 1.25rem',
                        overflowX: 'auto',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}>
                        {snippetLines.map((lineText, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '1rem', lineHeight: '1.4' }}>
                            <div style={{
                              color: '#484f58',
                              fontSize: '0.8rem',
                              minWidth: '2rem',
                              textAlign: 'right',
                              flexShrink: 0,
                              userSelect: 'none',
                              fontFamily: 'monospace'
                            }}>
                              {startLineNumber + idx}
                            </div>
                            <pre style={{
                              color: '#c9d1d9',
                              fontSize: '0.8rem',
                              fontFamily: 'monospace',
                              whiteSpace: 'pre',
                              margin: 0
                            }}>
                              {lineText}
                            </pre>
                          </div>
                        ))}
                      </div>

                      <p style={{ fontSize: '0.82rem', color: '#6B7280', marginTop: '0.75rem', marginBottom: 0, lineHeight: '1.4' }}>
                        {analysis.summary}
                      </p>
                    </div>
                  );
                })()}

                {/* SECTION D — BOTTOM STATS ROW */}
                <div className="ws-four-column-stats" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1rem',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  {/* CARD 1 — Estimated Effort */}
                  <div style={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#3B82F6', marginBottom: '0.5rem' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      <span style={{ fontSize: '0.72rem', uppercase: 'true', fontWeight: '700', color: '#6B7280', letterSpacing: '0.05em' }}>ESTIMATED EFFORT</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#3B82F6', margin: '0.1rem 0' }}>
                      {analysis.estimatedMinutes} min
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem', color: '#6B7280', marginTop: '0.5rem' }}>
                      <span>📄 Files: {Array.isArray(analysis.filesToTouch) ? analysis.filesToTouch.length : 0}</span>
                      <span>〰 Lines of Code: ~{analysis.totalLinesOfCode}</span>
                      <span>✓ Tests Needed: {analysis.testsNeeded ? 'Yes' : 'No'}</span>
                    </div>
                  </div>

                  {/* CARD 2 — Difficulty */}
                  {(() => {
                    const diffVal = analysis.difficulty || 'Unknown';
                    let diffDotColor = '#9CA3AF';
                    let diffLabelStyle = { backgroundColor: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' };
                    if (diffVal === 'Easy') {
                      diffDotColor = '#10B981';
                      diffLabelStyle = { backgroundColor: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' };
                    } else if (diffVal === 'Medium') {
                      diffDotColor = '#F59E0B';
                      diffLabelStyle = { backgroundColor: '#FFFBEB', color: '#854D0E', border: '1px solid #FDE68A' };
                    } else if (diffVal === 'Hard') {
                      diffDotColor = '#EF4444';
                      diffLabelStyle = { backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' };
                    }

                    const score = analysis.difficultyScore || 1;

                    return (
                      <div style={{
                        backgroundColor: 'white',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: diffDotColor, marginBottom: '0.5rem' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                          </svg>
                          <span style={{ fontSize: '0.72rem', uppercase: 'true', fontWeight: '700', color: '#6B7280', letterSpacing: '0.05em' }}>DIFFICULTY</span>
                        </div>
                        <div style={{ margin: '0.25rem 0' }}>
                          <span style={{
                            backgroundColor: diffLabelStyle.backgroundColor,
                            color: diffLabelStyle.color,
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            padding: '0.25rem 0.6rem',
                            borderRadius: '9999px',
                            border: diffLabelStyle.border,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: diffDotColor }}></span>
                            {diffVal}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', margin: '0.4rem 0' }}>
                          {[1, 2, 3, 4, 5].map(dot => (
                            <div
                              key={dot}
                              style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: dot <= score ? '#3B82F6' : '#E5E7EB'
                              }}
                            ></div>
                          ))}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#6B7280', lineHeight: '1.4', marginTop: '0.2rem' }}>
                          {analysis.difficultyReason}
                        </div>
                      </div>
                    );
                  })()}

                  {/* CARD 3 — Safe to Ignore */}
                  <div style={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#EF4444', marginBottom: '0.5rem' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                      </svg>
                      <span style={{ fontSize: '0.72rem', uppercase: 'true', fontWeight: '700', color: '#6B7280', letterSpacing: '0.05em' }}>SAFE TO IGNORE</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.2rem' }}>
                      {Array.isArray(analysis.filesToIgnore) && analysis.filesToIgnore.length > 0 ? (
                        analysis.filesToIgnore.map((ignorePath, idx) => (
                          <span
                            key={idx}
                            style={{
                              backgroundColor: '#F3F4F6',
                              color: '#6B7280',
                              border: '1px solid #E5E7EB',
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              fontFamily: 'monospace'
                            }}
                          >
                            {ignorePath}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>None listed</span>
                      )}
                    </div>
                  </div>

                  {/* CARD 4 — Why This Matters */}
                  <div style={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#F59E0B', marginBottom: '0.5rem' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path>
                        <line x1="9" y1="18" x2="15" y2="18"></line>
                        <line x1="10" y1="22" x2="14" y2="22"></line>
                      </svg>
                      <span style={{ fontSize: '0.72rem', uppercase: 'true', fontWeight: '700', color: '#6B7280', letterSpacing: '0.05em' }}>WHY THIS MATTERS</span>
                    </div>
                    <p style={{
                      fontSize: '0.82rem',
                      color: '#374151',
                      lineHeight: '1.5',
                      margin: '0.1rem 0 0.5rem 0',
                      flexGrow: 1
                    }}>
                      {analysis.whyItMatters}
                    </p>
                    <a
                      href={selectedIssue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: '600',
                        color: '#3B82F6',
                        textDecoration: 'none',
                        alignSelf: 'flex-start',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <span>Learn more</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              /* Fallback when analysis is null */
              <div style={{
                backgroundColor: '#F8FAFF',
                border: '1px solid #DBEAFE',
                borderRadius: '12px',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                width: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1D4ED8'
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#1D4ED8', margin: 0 }}>
                  Analysis unavailable for this issue
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#3B82F6', margin: 0, maxWidth: '400px', lineHeight: '1.5' }}>
                  This issue may have insufficient details for automatic analysis.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <a
                    href={selectedIssue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      borderRadius: '8px',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3B82F6'}
                  >
                    <span>View on GitHub →</span>
                  </a>
                  <span
                    onClick={handleBackToIssues}
                    style={{
                      fontSize: '0.82rem',
                      color: '#3B82F6',
                      cursor: 'pointer',
                      fontWeight: '500',
                      textDecoration: 'underline'
                    }}
                  >
                    Try another issue
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
