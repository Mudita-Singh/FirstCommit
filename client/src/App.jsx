import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchHealth, analyzeRepository, fetchFileExplanation, fetchRawFileContent } from './services/api';
import CodeViewer from './CodeViewer';
import Navbar from './Navbar';
import './App.css';

// ─── single source of truth for repo analysis ────────────────────────────────
// Called by: Analyze button, repo chips, demo cards — all paths funnel here.

function App() {
  const [repoUrl, setRepoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState(null);

  // Split-view states
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileCode, setFileCode] = useState('');
  const [fileExplanation, setFileExplanation] = useState('');
  const [isViewerLoading, setIsViewerLoading] = useState(false);
  const [techStack, setTechStack] = useState([]);
  const [repoDescription, setRepoDescription] = useState('');

  // Ref to track latest analysisData in popstate closure
  const analysisDataRef = useRef(analysisData);
  useEffect(() => {
    analysisDataRef.current = analysisData;
  }, [analysisData]);

  // Sync-scroll refs
  const codeRef = useRef(null);
  const explainRef = useRef(null);
  const activeScrollRef = useRef(null);

  // ── Browser history: handle home nav and CodeViewer back operations ────────
  useEffect(() => {
    const handlePop = (e) => {
      if (e.state?.view === 'workspace') {
        if (e.state.file) {
          const fileObj = analysisDataRef.current?.files?.find(f => f.path === e.state.file);
          if (fileObj) setSelectedFile(fileObj);
        } else {
          setSelectedFile(null);
        }
      } else {
        // User pressed Back — return to homepage
        setAnalysisData(null);
        setSelectedFile(null);
        setFileCode('');
        setFileExplanation('');
        setError(null);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // ── Core analysis function ─────────────────────────────────────────────────
  const analyzeUrl = useCallback(async (targetUrl) => {
    if (!targetUrl.trim()) return;

    setIsLoading(true);
    setError(null);
    setAnalysisData(null);
    setSelectedFile(null);

    let cleanUrl = targetUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://github.com/${cleanUrl}`;
    }

    try {
      const response = await analyzeRepository(cleanUrl);
      if (response?.status === 'success') {
        // Push a new history entry so Back button works
        window.history.pushState({ view: 'workspace', url: cleanUrl }, '', '/workspace');
        setAnalysisData(response.data);
      } else {
        throw new Error(response.message || 'Failed to analyze repository');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Is the server running?');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    analyzeUrl(repoUrl);
  };

  const handleRepoCardClick = (repoPath) => {
    setRepoUrl(`https://github.com/${repoPath}`);
    analyzeUrl(repoPath);
  };

  const handleRescan = () => {
    if (analysisData) {
      analyzeUrl(`https://github.com/${analysisData.owner}/${analysisData.repo}`);
    }
  };

  const handleGoHome = () => {
    window.history.pushState({}, '', '/');
    setAnalysisData(null);
    setSelectedFile(null);
    setFileCode('');
    setFileExplanation('');
    setError(null);
  };

  // Scroll to top when analysis completes and the Read Order list mounts
  useEffect(() => {
    if (analysisData) {
      window.scrollTo(0, 0);
    }
  }, [analysisData]);

  // Fetch repo description dynamically from GitHub public API
  useEffect(() => {
    if (!analysisData) {
      setRepoDescription('');
      return;
    }
    const fetchDescription = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${analysisData.owner}/${analysisData.repo}`);
        if (response.ok) {
          const data = await response.json();
          setRepoDescription(data.description || '');
        }
      } catch (err) {
        console.error('Failed to fetch repo description from GitHub API:', err);
      }
    };
    fetchDescription();
  }, [analysisData]);

  // Asynchronously load and parse package.json for tech stack tags
  useEffect(() => {
    if (!analysisData) {
      setTechStack([]);
      return;
    }

    const loadTechStack = async () => {
      const list = [];
      
      const hasPackageJson = analysisData.files?.some(f => f.path === 'package.json');
      if (hasPackageJson) {
        try {
          const res = await fetchRawFileContent(analysisData.owner, analysisData.repo, 'package.json');
          if (res?.status === 'success' && res.data?.rawContent) {
            const pkg = JSON.parse(res.data.rawContent);
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            
            const mapping = {
              'express': 'Express',
              'react': 'React',
              'react-dom': 'React DOM',
              'typescript': 'TypeScript',
              'mongoose': 'MongoDB',
              'mongodb': 'MongoDB',
              'jest': 'Jest',
              'mocha': 'Mocha',
              'webpack': 'Webpack',
              'vite': 'Vite',
              'tailwindcss': 'Tailwind CSS',
              'next': 'Next.js',
              'vue': 'Vue',
              'nuxt': 'Nuxt',
              'angular': 'Angular',
              'redux': 'Redux',
              'axios': 'Axios',
              'prisma': 'Prisma',
              'graphql': 'GraphQL',
              'apollo-client': 'Apollo',
              'eslint': 'ESLint',
              'prettier': 'Prettier',
              'nodemon': 'Nodemon',
              'dotenv': 'Dotenv'
            };

            Object.keys(deps).forEach(dep => {
              if (mapping[dep]) {
                list.push(mapping[dep]);
              }
            });
          }
        } catch (e) {
          console.error('Failed to parse tech stack:', e);
        }
      }

      // Filter out primary language already shown in metadata row
      const lang = analysisData.language ? analysisData.language.trim().toLowerCase() : '';
      const filteredList = list.filter(item => item.trim().toLowerCase() !== lang);
      const uniqueList = Array.from(new Set(filteredList)).slice(0, 8);
      
      if (uniqueList.length < 2) {
        setTechStack([]);
      } else {
        setTechStack(uniqueList);
      }
    };

    loadTechStack();
  }, [analysisData]);

  // ── File viewer ────────────────────────────────────────────────────────────
  const handleReadFile = (path) => {
    if (!analysisData) return;
    const fileObj = analysisData.files.find(f => f.path === path);
    if (!fileObj) { setError(`Could not locate: ${path}`); return; }
    setSelectedFile(fileObj);
    window.history.pushState({ view: 'workspace', file: path }, '', `/workspace?file=${encodeURIComponent(path)}`);
  };

  const handleBackToDashboard = () => {
    setSelectedFile(null);
    if (window.history.state?.file) {
      window.history.back();
    }
  };

  const handleScrollSync = (source) => {
    if (activeScrollRef.current !== source) return;
    if (source === 'code' && explainRef.current && codeRef.current) {
      explainRef.current.scrollTop = codeRef.current.scrollTop;
    } else if (source === 'explain' && codeRef.current && explainRef.current) {
      codeRef.current.scrollTop = explainRef.current.scrollTop;
    }
  };

  const getFileIconLayout = (filePath) => {
    const ext = filePath.split('.').pop().toLowerCase();
    let bg = '#6B7280';
    let text = ext.toUpperCase();
    let fontSize = '0.7rem';
    let fontWeight = '700';
    
    if (ext === 'md') {
      bg = '#6366F1';
      text = 'MD';
      fontSize = '0.65rem';
    } else if (ext === 'json') {
      bg = '#10B981';
      text = '{}';
      fontSize = '0.9rem';
      fontWeight = 'normal';
    } else if (ext === 'js' || filePath.endsWith('.jsx')) {
      bg = '#F59E0B';
      text = 'JS';
    } else if (ext === 'ts' || filePath.endsWith('.tsx')) {
      bg = '#3B82F6';
      text = 'TS';
    } else if (ext === 'css') {
      bg = '#8B5CF6';
      text = 'CSS';
    }
    
    return (
      <div className="ws-file-icon-box" style={{ backgroundColor: bg }}>
        <span className="ws-file-mono-text" style={{ fontSize, fontWeight }}>
          {text}
        </span>
      </div>
    );
  };

  const getCategoryTag = (filePath) => {
    const lower = filePath.toLowerCase();
    if (lower.includes('examples/')) {
      if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.ts') || lower.endsWith('.tsx')) {
        return { text: 'Example Code', bg: '#FDF2F8', color: '#9D174D' };
      }
      return { text: 'Examples', bg: '#FFF7ED', color: '#92400E' };
    }
    if (lower.endsWith('.md') && lower.includes('readme')) {
      return { text: 'Documentation', bg: '#EEF2FF', color: '#4338CA' };
    }
    if (lower.endsWith('.json')) {
      return { text: 'Configuration', bg: '#ECFDF5', color: '#065F46' };
    }
    if (lower.endsWith('history.md')) {
      return { text: 'Documentation', bg: '#EEF2FF', color: '#4338CA' };
    }
    if (lower.includes('lib/') || lower.includes('src/')) {
      return { text: 'Source', bg: '#F0F9FF', color: '#0369A1' };
    }
    return { text: 'Source', bg: '#F3F4F6', color: '#374151' };
  };

  const getDifficulty = (filePath) => {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.md') || lower.endsWith('package.json') || lower.includes('config') || lower.includes('setup') || lower.includes('init')) {
      return 'Beginner';
    }
    const ext = lower.split('.').pop();
    if (['json', 'yaml', 'yml', 'toml', 'ini', 'md', 'txt'].includes(ext)) {
      return 'Beginner';
    }
    if (lower.includes('utils') || lower.includes('helper') || lower.includes('middleware') || lower.includes('auth') || lower.includes('parser') || lower.includes('engine') || lower.includes('router')) {
      return 'Advanced';
    }
    return 'Intermediate';
  };

  const formatStars = (n) => {
    if (!n) return '0';
    return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
  };

  const parseMarkdown = (md) => {
    if (!md) return '';
    if (typeof md === 'object') {
      return `<pre style="white-space: pre-wrap; font-family: monospace;"><code>${JSON.stringify(md, null, 2)}</code></pre>`;
    }
    let inList = false;
    let html = '';
    md.split('\n').forEach(line => {
      const t = line.trim();
      if (t.startsWith('#### ')) html += `<h4>${t.slice(5)}</h4>`;
      else if (t.startsWith('### ')) html += `<h3>${t.slice(4)}</h3>`;
      else if (t.startsWith('## ')) html += `<h2>${t.slice(3)}</h2>`;
      else if (t.startsWith('# ')) html += `<h1>${t.slice(2)}</h1>`;
      else if (t.startsWith('- ') || t.startsWith('* ')) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${t.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`;
      } else if (t === '') {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<br/>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p>${t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}</p>`;
      }
    });
    if (inList) html += '</ul>';
    return html;
  };


  const isHome = !analysisData && !selectedFile;

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className={isHome ? 'home-page' : 'workspace-page'}>

      {/* ── HOMEPAGE ─────────────────────────────────────────────────────── */}
      {isHome && (
        <>
          <Navbar isHome={true} />

          <main className="home-main">

            {/* ── HERO ─────────────────────────────────────── */}
            <section className="hero-section">
              <h1 className="hero-headline">
                Understand any GitHub repository{' '}
                <span className="accent">before contributing.</span>
              </h1>
              <p className="hero-subtitle">
                Get a personalized reading order, discover good first issues,<br />
                and understand the codebase before making your first contribution.
              </p>
            </section>

            {/* Search bar — sits directly in home-main for consistent centering */}
            <form className="search-form" onSubmit={handleSubmit}>
              <div className="search-container">
                <svg className="search-github-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <input
                  type="text"
                  className="search-input"
                  placeholder="e.g., https://github.com/expressjs/express"
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  className="search-btn"
                  disabled={isLoading}
                >
                  Analyze →
                </button>
              </div>
            </form>

            <div className="try-hint">
              <svg width="34" height="36" viewBox="0 0 34 36" fill="none" className="curved-arrow">
                <path d="M14 32 C8 32, 6 26, 8 22 C10 18, 18 16, 18 20 C18 24, 12 24, 12 18 C12 12, 18 10, 24 8" stroke="#3B82F6" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
                <path d="M22 4 L30 6 L28 12" stroke="#3B82F6" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Try a repository</span>
            </div>

            {/* Error */}
            {error && (
              <div className="hero-error">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="hero-loading">
                <div className="spin-logo" style={{ fontSize: '48px', marginBottom: '1rem' }}>&lt;&gt;</div>
                <p style={{ color: '#94A3B8' }}>Analyzing repository…</p>
              </div>
            )}

            {/* ── HOW IT WORKS ─────────────────────────────── */}
            <section className="hiw-section">
              <h2 className="hiw-title">How it works</h2>

              <div className="hiw-flow">
                {/* Wavy dotted connector SVG rendered behind the steps */}
                <div className="hiw-connector-wrap">
                  <svg className="hiw-connector-svg" viewBox="0 0 760 60" preserveAspectRatio="none" fill="none">
                    <path
                      d="M 60 30 C 100 10, 130 50, 190 30 C 250 10, 280 50, 380 30 C 480 10, 510 50, 570 30 C 630 10, 660 50, 700 30"
                      stroke="#93C5FD"
                      strokeWidth="2"
                      strokeDasharray="7 5"
                      strokeLinecap="round"
                    />
                    {/* Arrowhead at end */}
                    <path d="M 697 23 L 705 30 L 697 37" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>

                {/* Step 1 */}
                <div className="hiw-step">
                  <div className="hiw-icon-wrap" style={{'--icon-bg':'#DBEAFE'}}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                  </div>
                  <span className="hiw-dot" style={{'--dot-color':'#3B82F6'}}></span>
                  <div className="hiw-step-title">1. Paste Repository</div>
                  <p className="hiw-step-desc">Paste any public GitHub repository URL.</p>
                </div>

                {/* Step 2 */}
                <div className="hiw-step">
                  <div className="hiw-icon-wrap" style={{'--icon-bg':'#D1FAE5'}}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </div>
                  <span className="hiw-dot" style={{'--dot-color':'#10B981'}}></span>
                  <div className="hiw-step-title">2. Analyze Repository</div>
                  <p className="hiw-step-desc">We scan the repository structure and dependencies.</p>
                </div>

                {/* Step 3 */}
                <div className="hiw-step">
                  <div className="hiw-icon-wrap" style={{'--icon-bg':'#EDE9FE'}}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6"/>
                      <line x1="8" y1="12" x2="21" y2="12"/>
                      <line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/>
                      <line x1="3" y1="12" x2="3.01" y2="12"/>
                      <line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                  </div>
                  <span className="hiw-dot" style={{'--dot-color':'#7C3AED'}}></span>
                  <div className="hiw-step-title">3. Generate Read Order</div>
                  <p className="hiw-step-desc">Receive a personalized reading path through the codebase.</p>
                </div>

                {/* Step 4 */}
                <div className="hiw-step">
                  <div className="hiw-icon-wrap" style={{'--icon-bg':'#FEF3C7'}}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 17l10 5 10-5"/>
                      <path d="M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <span className="hiw-dot" style={{'--dot-color':'#F59E0B'}}></span>
                  <div className="hiw-step-title">4. Start Contributing</div>
                  <p className="hiw-step-desc">Know exactly where to begin your first contribution.</p>
                </div>
              </div>
            </section>

          </main>

          {/* ── TRY FIRSTCOMMIT — direct child of home-page so it can be truly full-width ── */}
          <section className="try-section">
            <div className="try-inner">
              <h2 className="try-title">Try FirstCommit</h2>
              <p className="try-subtitle">Click a repository to explore it with FirstCommit.</p>

              <div className="try-cards">
                {/* Card 1 */}
                <button
                  className="repo-card"
                  onClick={() => handleRepoCardClick('expressjs/express')}
                  disabled={isLoading}
                >
                  <div className="repo-card-left">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="#24292e" className="repo-gh-icon">
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                    <div className="repo-card-info">
                      <span className="repo-card-name">expressjs/express</span>
                      <span className="repo-card-desc">Fast, unopinionated, minimalist web framework for Node.js.</span>
                    </div>
                  </div>
                  <div className="repo-card-arrow">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </div>
                </button>

                {/* Card 2 */}
                <button
                  className="repo-card"
                  onClick={() => handleRepoCardClick('excalidraw/excalidraw')}
                  disabled={isLoading}
                >
                  <div className="repo-card-left">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="#24292e" className="repo-gh-icon">
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                    <div className="repo-card-info">
                      <span className="repo-card-name">excalidraw/excalidraw</span>
                      <span className="repo-card-desc">Virtual whiteboard for sketching hand-drawn like diagrams.</span>
                    </div>
                  </div>
                  <div className="repo-card-arrow">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </div>
                </button>
              </div>
            </div>

            {/* Soft wave */}
            <div className="try-wave">
              <svg viewBox="0 0 1440 60" fill="none" preserveAspectRatio="none">
                <path d="M0 30 C240 60, 480 0, 720 30 C960 60, 1200 0, 1440 30 L1440 60 L0 60Z" fill="#E8EEFF" opacity="0.4"/>
              </svg>
            </div>
          </section>

        </>
      )}


      {/* ── WORKSPACE ────────────────────────────────────────────────────── */}
      {!isHome && (
        <div className="workspace-wrap">
          <Navbar isHome={false} onLogoClick={handleGoHome} />

          <div className="workspace-dashboard" style={{ display: selectedFile ? 'none' : 'block' }}>
            {/* Repo Header Card */}
            <div className="ws-header-card">
              <div className="ws-header-left">
                <div className="ws-repo-avatar">
                  {analysisData?.repo ? analysisData.repo.slice(0, 2).toLowerCase() : 'fc'}
                </div>
                <div className="ws-repo-info">
                  <h2 className="ws-repo-name">
                    <a href={`https://github.com/${analysisData?.owner}/${analysisData?.repo}`} target="_blank" rel="noopener noreferrer" className="ws-repo-link">
                      {analysisData?.owner}/{analysisData?.repo}
                      <span className="ws-external-icon">↗</span>
                    </a>
                  </h2>
                  <p className="ws-repo-desc">{repoDescription || 'Fast, unopinionated, minimalist web framework for Node.js'}</p>
                  <div className="ws-badges">
                    {analysisData?.stars && <span className="ws-badge">★ {formatStars(analysisData.stars)}</span>}
                    {analysisData?.language && <span className="ws-badge">{analysisData.language}</span>}
                    {analysisData?.filesCount && <span className="ws-badge">{analysisData.filesCount} files</span>}
                  </div>
                </div>
              </div>
              <div className="ws-header-right">
                <button className="ws-rescan-btn" onClick={handleRescan} disabled={isLoading}>
                  ↺ Re-scan
                </button>
                <div className="ws-illustrations">
                  <svg width="140" height="90" viewBox="0 0 140 90" fill="none" style={{ opacity: 0.9 }}>
                    <rect x="5" y="20" width="95" height="60" rx="6" fill="none" stroke="#E5E7EB" strokeWidth="1.5" strokeDasharray="3 3" />
                    <rect x="50" y="8" width="85" height="65" rx="8" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1.5" />
                    <path d="M50 16C50 11.5817 53.5817 8 58 8H127C131.418 8 135 11.5817 135 16V22H50V16Z" fill="#1E293B" />
                    <circle cx="58" cy="14" r="2" fill="#EF4444" />
                    <circle cx="64" cy="14" r="2" fill="#F59E0B" />
                    <circle cx="70" cy="14" r="2" fill="#10B981" />
                    <text x="92" y="45" fill="#3B82F6" fontFamily="monospace" fontSize="20" fontWeight="700" textAnchor="middle">&lt;/&gt;</text>
                    <rect x="65" y="54" width="40" height="2.5" rx="1" fill="#E2E8F0" />
                    <rect x="65" y="60" width="55" height="2.5" rx="1" fill="#E2E8F0" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Read Order Heading Row */}
            <div className="ws-tabs-new">
              <div>
                <h3 className="ws-tabs-title"><span style={{ marginRight: '0.4rem' }}>📋</span>Read Order</h3>
                <p className="ws-tabs-subtitle">A recommended sequence to understand this repository step by step.</p>
              </div>
              <span className="ws-count-badge">{analysisData.readingList.length} items</span>
            </div>

            {error && <div className="ws-error">[ ERROR ] {error}</div>}

            {(isLoading || isViewerLoading) && (
              <div className="ws-loading">
                <div className="spin-logo" style={{ fontSize: '48px', marginBottom: '1rem' }}>&lt;&gt;</div>
                <p style={{ color: '#6B7280' }}>{isViewerLoading ? 'Loading file…' : 'Scanning repository…'}</p>
              </div>
            )}

            {!isLoading && !isViewerLoading && analysisData?.readingList && (
              <div className="ws-timeline-container">
                <div className="ws-timeline-line"></div>
                <div className="ws-list-timeline">
                  {analysisData.readingList.map((file, i) => {
                    const cat = getCategoryTag(file.path);
                    return (
                      <div key={file.path} className="ws-timeline-item">
                        <div className="ws-timeline-badge">{i + 1}</div>
                        <div className="ws-item-timeline-card">
                          {getFileIconLayout(file.path)}
                          <div className="ws-item-info">
                            <div className="ws-item-header-row">
                              <span className="ws-path">{file.path}</span>
                              <span className="ws-category-pill" style={{ backgroundColor: cat.bg, color: cat.color }}>
                                {cat.text}
                              </span>
                            </div>
                            <div className="ws-item-body">
                              <p className="ws-item-explanation">→ {file.explanation}</p>
                              <p className="ws-item-reason">→ {file.reason}</p>
                            </div>
                          </div>
                          <button className="ws-timeline-btn" onClick={() => handleReadFile(file.path)}>
                            Read Code &amp; Explanation
                            <span className="ws-chevron">›</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tip Card */}
                <div className="ws-tip-card">
                  <div className="ws-tip-icon-circle">!</div>
                  <div className="ws-tip-content">
                    <h4 className="ws-tip-title">Tip</h4>
                    <p className="ws-tip-text">Follow this order for the best learning experience. Each file builds context for the next one.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          {selectedFile && (
            <CodeViewer
              repoOwner={analysisData.owner}
              repoName={analysisData.repo}
              filePath={selectedFile.path}
              onClose={handleBackToDashboard}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
