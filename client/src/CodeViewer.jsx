import { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { fetchRawFileContent, explainFileWithBlocksOnly, fetchFileUsages } from './services/api';

/**
 * CodeViewer Component
 * Renders a split-screen layout with syntax highlighted code on the left
 * and block-by-block beginner friendly explanations on the right.
 * 
 * Props:
 * @param {string} repoOwner - Owner of the repository.
 * @param {string} repoName - Name of the repository.
 * @param {string} filePath - File path to display and explain.
 * @param {function} onClose - Callback to close this view and return to dashboard.
 */
function UsagesPanel({ repoOwner, repoName, filePath, onFileClick }) {
  const [loading, setLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [usages, setUsages] = useState([]);
  const [searchedFiles, setSearchedFiles] = useState(0);
  const [totalFound, setTotalFound] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let timer = null;

    const loadUsages = async () => {
      // Start a 150ms delay before showing the loading spinner to prevent flash for cached requests
      timer = setTimeout(() => {
        if (active) {
          setShowLoading(true);
        }
      }, 150);

      setError(null);
      try {
        const res = await fetchFileUsages(repoOwner, repoName, filePath);
        if (active) {
          if (res?.status === 'success') {
            if (res.data.fromCache) {
              clearTimeout(timer);
              setShowLoading(false);
            } else {
              setShowLoading(true);
            }
            setUsages(res.data.usages || []);
            setSearchedFiles(res.data.searchedFiles || 0);
            setTotalFound(res.data.totalFound || 0);
          } else {
            throw new Error(res?.message || 'Failed to fetch usages');
          }
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'An error occurred while finding usages.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadUsages();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [repoOwner, repoName, filePath]);

  if (loading && showLoading) {
    return (
      <div className="cv-panel-loading" style={{ height: 'auto', padding: '2rem 0' }}>
        <div className="spin-logo" style={{ fontSize: '24px', marginBottom: '1rem' }}>&lt;&gt;</div>
        <p style={{ color: '#8b949e', fontSize: '0.88rem' }}>Searching {repoName} for imports...</p>
      </div>
    );
  }

  if (loading && !showLoading) {
    return null;
  }

  if (error) {
    return (
      <div style={{ padding: '1.5rem', color: '#EF4444', textAlign: 'center', fontSize: '0.875rem' }}>
        Error searching usages: {error}
      </div>
    );
  }

  if (usages.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        color: '#8b949e',
        fontSize: '0.875rem',
        textAlign: 'center'
      }}>
        <div style={{ position: 'relative', width: '48px', height: '48px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg 
            width="40" 
            height="40" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#30363d" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#58a6ff" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{
              position: 'absolute',
              bottom: '0px',
              right: '0px',
              background: '#0d1117',
              borderRadius: '50%',
              padding: '2px',
              boxShadow: '0 0 0 2px #0d1117'
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        No imports found in this repo's source files
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{
        fontSize: '0.9rem',
        fontWeight: '600',
        color: '#e6edf3',
        margin: '0 0 0.5rem'
      }}>
        Found in <span style={{ color: '#58a6ff' }}>{totalFound}</span> {totalFound === 1 ? 'file' : 'files'}
      </h3>
      {usages.map((usage, idx) => (
        <div 
          key={idx}
          style={{
            border: '1px solid #30363d',
            borderRadius: '8px',
            backgroundColor: '#0d1117',
            padding: '0.75rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}
        >
          <div 
            onClick={() => onFileClick(usage.filePath)}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '0.82rem',
              color: '#58a6ff',
              cursor: 'pointer',
              textDecoration: 'none',
              fontWeight: '600',
              alignSelf: 'flex-start'
            }}
            className="breadcrumb-link"
          >
            {usage.filePath}
          </div>
          <div style={{
            fontSize: '0.72rem',
            color: '#8b949e',
            fontWeight: '500'
          }}>
            Line {usage.line}:
          </div>
          <pre style={{
            fontFamily: 'var(--mono)',
            fontSize: '0.8rem',
            color: '#c9d1d9',
            backgroundColor: '#161b22',
            padding: '0.5rem',
            borderRadius: '6px',
            margin: 0,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            {usage.snippet}
          </pre>
        </div>
      ))}
    </div>
  );
}

export default function CodeViewer({ repoOwner, repoName, filePath, onClose, onFileClick }) {
  // Independent loading flags — file fetch and AI explanation run as separate phases
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [error, setError] = useState(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [isGithubLimitError, setIsGithubLimitError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Overall metadata states
  const [summary, setSummary] = useState('');
  const [concepts, setConcepts] = useState([]);
  const [difficulty, setDifficulty] = useState('');
  
  // Content states
  const [rawContent, setRawContent] = useState('');
  const [language, setLanguage] = useState('javascript');
  
  // Tab states
  const [activeTab, setActiveTab] = useState('explain'); // 'explain', 'where_used'
  const [explanationBlocks, setExplanationBlocks] = useState([]);
  
  // Cache explanations to prevent fetching them multiple times when switching tabs
  const cacheRef = useRef({
    explain: null,
    simplify: null
  });

  // State to track the currently highlighted block and line
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);

  // Refs for sync scroll
  const codeScrollRef = useRef(null);
  const explainScrollRef = useRef(null);
  const isScrollingRef = useRef(false); // To avoid scroll event thrashing
  const activeBlockIndexRef = useRef(0);

  // Load data when filePath or activeTab changes — two independent phases
  useEffect(() => {
    const fetchData = async () => {
      // 'where_used' tab has no API call — placeholder only
      if (activeTab === 'where_used') return;

      // Restore from cache if available
      if (cacheRef.current[activeTab]) {
        const cached = cacheRef.current[activeTab];
        setExplanationBlocks(cached.explanation || []);
        setSummary(cached.summary || '');
        setConcepts(cached.concepts || []);
        setDifficulty(cached.difficulty || '');
        return;
      }

      setError(null);
      setIsQuotaError(false);
      setIsGithubLimitError(false);

      try {
        const isSimplify = activeTab === 'simplify';
        let fetchedContent = rawContent;
        let fetchedLang = language;

        // Phase 1 — fetch raw file from GitHub (only if not already loaded)
        if (!fetchedContent) {
          setIsLoadingFile(true);
          const contentRes = await fetchRawFileContent(repoOwner, repoName, filePath);
          setIsLoadingFile(false);
          if (contentRes?.status === 'success') {
            fetchedContent = contentRes.data.rawContent || '';
            fetchedLang = contentRes.data.language || 'text';
            setRawContent(fetchedContent);
            setLanguage(fetchedLang);
          } else {
            throw new Error(contentRes?.message || 'Failed to fetch file content');
          }
        }

        // Phase 2 — generate AI explanation (code is already visible in left panel)
        setIsLoadingExplanation(true);
        const explainRes = await explainFileWithBlocksOnly(filePath, fetchedContent, isSimplify);

        if (explainRes?.status === 'success') {
          const { explanation, summary: fileSummary, concepts: fileConcepts, difficulty: fileDifficulty } = explainRes.data;

          setExplanationBlocks(explanation || []);
          setSummary(fileSummary || '');
          setConcepts(fileConcepts || []);
          setDifficulty(fileDifficulty || '');

          // Cache the result
          cacheRef.current[activeTab] = {
            explanation,
            summary: fileSummary,
            concepts: fileConcepts,
            difficulty: fileDifficulty
          };
        } else {
          throw new Error(explainRes?.message || 'Failed to generate explanation');
        }
      } catch (err) {
        console.error('Error fetching file details:', err);
        const quota =
          err.status === 429 ||
          err.message?.includes('429') ||
          err.message?.toLowerCase().includes('quota') ||
          err.message?.toLowerCase().includes('too many requests') ||
          err.message?.toLowerCase().includes('resource has been exhausted');
        setIsQuotaError(quota);
        const isGithubLimit =
          err.message?.toLowerCase().includes('rate limit') ||
          err.message?.toLowerCase().includes('github');
        setIsGithubLimitError(isGithubLimit);
        setError(err.message || 'An error occurred while fetching the file explanation.');
      } finally {
        // Always clear both flags on completion or error
        setIsLoadingFile(false);
        setIsLoadingExplanation(false);
      }
    };

    fetchData();
  }, [filePath, activeTab, repoOwner, repoName, retryCount]);

  // Clean cache when file changes
  useEffect(() => {
    cacheRef.current = { explain: null, simplify: null };
    setActiveBlockIndex(0);
    activeBlockIndexRef.current = 0;
    setSummary('');
    setConcepts([]);
    setDifficulty('');
    setRawContent('');
    setLanguage('javascript');
    setIsQuotaError(false);
    setIsGithubLimitError(false);
  }, [filePath]);

  // Find block index for a specific line number
  const findBlockIndexForLine = (lineNum) => {
    return explanationBlocks.findIndex(block => {
      if (!block.lines) return false;
      const parts = block.lines.split('-');
      if (parts.length === 2) {
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);
        return lineNum >= start && lineNum <= end;
      } else {
        const single = parseInt(block.lines, 10);
        return lineNum === single;
      }
    });
  };

  // Check if a line is in the active block range
  const isLineInActiveBlock = (lineNumber) => {
    if (activeBlockIndex === -1) return false;
    const block = explanationBlocks[activeBlockIndex];
    if (!block || !block.lines) return false;
    const parts = block.lines.split('-');
    if (parts.length === 2) {
      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);
      return lineNumber >= start && lineNumber <= end;
    }
    return lineNumber === parseInt(block.lines, 10);
  };

  // Scroll the explanation panel to the specified block
  const scrollToExplanationBlock = (blockIndex) => {
    const blockEl = document.getElementById(`explain-block-${blockIndex}`);
    if (blockEl && explainScrollRef.current) {
      const container = explainScrollRef.current;
      
      // Calculate top offset relative to parent container
      const containerRect = container.getBoundingClientRect();
      const blockRect = blockEl.getBoundingClientRect();
      const relativeTop = blockRect.top - containerRect.top + container.scrollTop;

      // Scroll smoothly to block
      container.scrollTo({
        top: Math.max(0, relativeTop - 16),
        behavior: 'smooth'
      });
    }
  };

  // Handle click on a line in the code view
  const handleLineClick = (lineNumber) => {
    const blockIndex = findBlockIndexForLine(lineNumber);
    if (blockIndex !== -1) {
      setActiveBlockIndex(blockIndex);
      activeBlockIndexRef.current = blockIndex;
      scrollToExplanationBlock(blockIndex);
    }
  };

  // Handle scroll on the code panel (sync-scroll explanation panel)
  const handleCodeScroll = (e) => {
    if (isScrollingRef.current) return;
    const container = e.target;
    const scrollTop = container.scrollTop;
    
    // Find all line elements
    const lines = container.querySelectorAll('.code-line');
    if (lines.length === 0) return;
    
    // Find which line is at the top of the viewport
    let topVisibleLine = 1;
    for (let i = 0; i < lines.length; i++) {
      // Adding a small buffer (5px)
      if (lines[i].offsetTop >= scrollTop - 5) {
        topVisibleLine = i + 1;
        break;
      }
    }
    
    // Map line to explanation block
    const blockIndex = findBlockIndexForLine(topVisibleLine);
    if (blockIndex !== -1 && blockIndex !== activeBlockIndexRef.current) {
      activeBlockIndexRef.current = blockIndex;
      setActiveBlockIndex(blockIndex);
      
      // Temporarily mark scrolling to prevent scroll battle
      isScrollingRef.current = true;
      scrollToExplanationBlock(blockIndex);
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 300);
    }
  };

  return (
    <div className="code-viewer-container">
      {/* HEADER BAR */}
      <header className="code-viewer-header">
        <div className="code-viewer-filepath" style={{ display: 'flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#3B82F6', marginRight: '0.5rem' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>{filePath}</span>
          {difficulty && (
            <span className={`difficulty-badge difficulty-${difficulty.toLowerCase()}`} style={{
              marginLeft: '0.75rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontFamily: 'var(--mono)',
              border: '1px solid currentColor',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              color: difficulty === 'Beginer' || difficulty === 'Beginner' ? '#10B981' : difficulty === 'Intermediate' ? '#F59E0B' : '#EF4444'
            }}>
              {difficulty}
            </span>
          )}
        </div>

        <div className="code-viewer-tabs">
          <button
            className={`code-viewer-tab-btn ${activeTab === 'explain' ? 'active' : ''}`}
            onClick={() => setActiveTab('explain')}
          >
            Explain this file
          </button>
          <button
            className={`code-viewer-tab-btn ${activeTab === 'where_used' ? 'active' : ''}`}
            onClick={() => setActiveTab('where_used')}
          >
            Where is this used
          </button>
        </div>
      </header>

      {/* VIEWER BODY — split layout is ALWAYS visible */}
      <div className="code-viewer-body">
        {/* LEFT PANEL — Source Code */}
        <div className="code-viewer-panel left-panel">
          <div className="code-viewer-panel-title">Source Code</div>
          <div className="code-viewer-scroll-container">
                {isLoadingFile || !rawContent ? (
                  /* Small inline spinner — never hides the right panel */
                  <div className="cv-panel-loading">
                    <div className="spin-logo" style={{ fontSize: '24px' }}>&lt;&gt;</div>
                    <p>Fetching file...</p>
                  </div>
                ) : (
                  <SyntaxHighlighter
                    language={language}
                    style={vscDarkPlus}
                    showLineNumbers={true}
                    wrapLines={true}
                    lineProps={(lineNumber) => ({
                      style: { display: 'block', cursor: 'pointer' },
                      onClick: () => handleLineClick(lineNumber),
                      className: `code-line line-${lineNumber} ${isLineInActiveBlock(lineNumber) ? 'highlighted-line' : ''}`
                    })}
                    CodeTag="code"
                    PreTag="pre"
                    containerProps={{
                      ref: codeScrollRef,
                      onScroll: handleCodeScroll,
                      className: 'code-viewer-pre'
                    }}
                  >
                    {rawContent}
                  </SyntaxHighlighter>
                )}
              </div>
            </div>

            {/* RIGHT PANEL — AI Explanation OR Usages */}
            <div className="code-viewer-panel">
              <div className="code-viewer-panel-title">
                {activeTab === 'where_used' ? 'Usages' : 'AI Explanation'}
              </div>
              <div className="code-viewer-explain-container ai-explanation-panel" ref={explainScrollRef}>
                {activeTab === 'where_used' ? (
                  <UsagesPanel
                    repoOwner={repoOwner}
                    repoName={repoName}
                    filePath={filePath}
                    onFileClick={onFileClick}
                  />
                ) : (
                  <>
                {error && !isLoadingFile && !isLoadingExplanation ? (
                  /* Error state — lives inside the right panel so left panel stays visible */
                  isGithubLimitError ? (
                    /* ── GitHub Rate Limit card ── */
                    <div style={{
                      margin: '2rem auto',
                      maxWidth: '420px',
                      backgroundColor: 'rgba(17, 24, 39, 0.85)',
                      border: '1px solid rgba(245, 158, 11, 0.5)',
                      borderRadius: '12px',
                      padding: '1.75rem',
                      textAlign: 'left',
                      boxShadow: '0 0 24px rgba(245, 158, 11, 0.08)'
                    }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⏳</div>
                      <h3 style={{
                        margin: '0 0 0.5rem',
                        fontSize: '1rem',
                        fontWeight: '700',
                        color: '#FCD34D'
                      }}>
                        GitHub request limit reached
                      </h3>
                      <p style={{
                        margin: '0 0 1rem',
                        fontSize: '0.875rem',
                        color: '#CBD5E1',
                        lineHeight: '1.6'
                      }}>
                        Please wait a few minutes and try again.
                      </p>
                      <button
                        className="ws-rescan"
                        onClick={() => {
                          cacheRef.current = { explain: null, simplify: null };
                          setRawContent('');
                          setIsGithubLimitError(false);
                          setRetryCount(c => c + 1);
                        }}
                        style={{
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          color: '#FCD34D',
                          padding: '0.45rem 1.1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          textDecoration: 'none'
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  ) : isQuotaError ? (
                    /* ── Quota / 429 card ── */
                    <div style={{
                      margin: '2rem auto',
                      maxWidth: '420px',
                      backgroundColor: 'rgba(17, 24, 39, 0.85)',
                      border: '1px solid rgba(245, 158, 11, 0.5)',
                      borderRadius: '12px',
                      padding: '1.75rem',
                      textAlign: 'left',
                      boxShadow: '0 0 24px rgba(245, 158, 11, 0.08)'
                    }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⏳</div>
                      <h3 style={{
                        margin: '0 0 0.5rem',
                        fontSize: '1rem',
                        fontWeight: '700',
                        color: '#FCD34D'
                      }}>
                        Daily AI limit reached
                      </h3>
                      <p style={{
                        margin: '0 0 1rem',
                        fontSize: '0.875rem',
                        color: '#CBD5E1',
                        lineHeight: '1.6'
                      }}>
                        This file hasn't been cached yet.<br />
                        Try again tomorrow, or open a file you've already viewed —
                        those load instantly from cache.
                      </p>
                      <button
                        className="ws-rescan"
                        onClick={() => {
                          cacheRef.current = { explain: null, simplify: null };
                          setRawContent('');
                          setIsQuotaError(false);
                          setRetryCount(c => c + 1);
                        }}
                        style={{
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          color: '#FCD34D',
                          padding: '0.45rem 1.1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          textDecoration: 'none'
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', textAlign: 'center' }}>
                      <div className="ws-error" style={{ fontFamily: 'var(--mono)' }}>
                        [ ERROR ] {error}
                      </div>
                      <button
                        className="ws-rescan"
                        onClick={() => {
                          cacheRef.current = { explain: null, simplify: null };
                          setRawContent('');
                          setRetryCount(c => c + 1);
                        }}
                        style={{ marginTop: '1rem', textDecoration: 'underline' }}
                      >
                        [ Retry ]
                      </button>
                    </div>
                  )
                ) : (isLoadingFile || isLoadingExplanation) ? (
                  /* Step tracker — small branded spinner + progress steps */
                  <div className="cv-panel-loading">
                    <div className="spin-logo" style={{ fontSize: '24px', marginBottom: '1.25rem' }}>&lt;&gt;</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <p style={{
                        fontWeight: '600',
                        color: isLoadingFile ? '#60A5FA' : '#10B981',
                        opacity: isLoadingFile ? 1 : 0.65,
                        animation: isLoadingFile ? 'pulse 1.5s infinite' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontFamily: 'var(--mono)',
                        fontSize: '0.88rem'
                      }}>
                        <span style={{ minWidth: '1.25rem' }}>{isLoadingFile ? '▶' : '✓'}</span>
                        Step 1: Fetching file from GitHub...
                      </p>
                      <p style={{
                        fontWeight: '600',
                        color: isLoadingExplanation ? '#60A5FA' : '#94A3B8',
                        opacity: isLoadingExplanation ? 1 : 0.35,
                        animation: isLoadingExplanation ? 'pulse 1.5s infinite' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontFamily: 'var(--mono)',
                        fontSize: '0.88rem'
                      }}>
                        <span style={{ minWidth: '1.25rem' }}>{isLoadingExplanation ? '▶' : '◽'}</span>
                        Step 2: Generating explanation...
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Overall Summary Box */}
                    {summary && (
                      <div className="code-viewer-summary-box" style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        borderLeft: '4px solid #3B82F6',
                        padding: '1rem',
                        borderRadius: '0 8px 8px 0',
                        marginBottom: '1rem',
                        fontSize: '0.9rem',
                        lineHeight: '1.6',
                        color: '#e6edf3'
                      }}>
                        <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#8b949e', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.1em' }}>File Summary</strong>
                        {summary}
                      </div>
                    )}

                    {/* Key Concepts Pills */}
                    {concepts && concepts.length > 0 && (
                      <div className="code-viewer-concepts-list" style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginBottom: '1.5rem',
                        paddingBottom: '1rem',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                      }}>
                        {concepts.map((concept, idx) => (
                          <span key={idx} className="concept-pill" style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            color: '#94A3B8',
                            fontSize: '0.78rem',
                            fontWeight: '500',
                            padding: '0.3rem 0.75rem',
                            borderRadius: '9999px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}>
                            <span style={{
                              width: '4px',
                              height: '4px',
                              borderRadius: '50%',
                              backgroundColor: '#3b82f6',
                              display: 'inline-block'
                            }}></span>
                            {concept}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Contiguous Block Explanations */}
                    {explanationBlocks.length === 0 ? (
                      <p style={{ color: '#64748B', fontStyle: 'italic' }}>No explanations generated for this file.</p>
                    ) : (
                      explanationBlocks.map((block, index) => (
                        <div
                          key={index}
                          id={`explain-block-${index}`}
                          className={`explanation-block ${activeBlockIndex === index ? 'active' : ''}`}
                          style={{
                            padding: '1rem',
                            marginBottom: '1rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            backgroundColor: activeBlockIndex === index ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          <div className="explanation-block-lines" style={{
                            fontFamily: 'var(--mono)',
                            fontSize: '0.72rem',
                            color: '#58a6ff',
                            marginBottom: '0.25rem',
                            letterSpacing: '0.05em',
                            fontWeight: '600'
                          }}>
                            LINES {block.lines}
                          </div>

                          <div className="explanation-block-title" style={{
                            fontWeight: '700',
                            fontSize: '0.95rem',
                            color: '#e6edf3',
                            marginBottom: '0.5rem'
                          }}>
                            {block.title || `Section (Lines ${block.lines})`}
                          </div>

                          {/* Conversational explanation — renders \n\n as paragraph breaks */}
                          <div className="explanation-block-body" style={{
                            fontSize: '0.875rem',
                            lineHeight: '1.7',
                            color: '#c9d1d9'
                          }}>
                            {(block.explanation || block.what || block.text || '').split('\n\n').map((para, i) => (
                              <p key={i} style={{ marginBottom: '0.5rem' }}>{para}</p>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}
                </>
              )}
              </div>
            </div>
      </div>
    </div>
  );
}
