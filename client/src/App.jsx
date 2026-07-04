import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchHealth, analyzeRepository, fetchFileExplanation, fetchRawFileContent } from './services/api';
import CodeViewer from './CodeViewer';
import Navbar from './Navbar';
import Breadcrumb from './components/Breadcrumb';
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
  const readOrderScrollPos = useRef(0);
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
        setSelectedFile(null);
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
        const data = response.data;
        data.fullName = `${data.owner}/${data.repo}`;
        setAnalysisData(data);
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
    setRepoUrl('');
    setAnalysisData(null);
    setSelectedFile(null);
    setFileCode('');
    setFileExplanation('');
    setError(null);
    window.scrollTo(0, 0);
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
    readOrderScrollPos.current = window.scrollY;
    setSelectedFile(fileObj);
  };

  const handleBackToDashboard = () => {
    setSelectedFile(null);
    setTimeout(() => {
      window.scrollTo(0, readOrderScrollPos.current);
    }, 0);
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

    // Each type: { bg, iconColor, label, svgPath }
    let bg = '#F3F4F6';
    let iconColor = '#6B7280';
    let label = ext.toUpperCase();
    let iconSvg = null;

    if (ext === 'md') {
      bg = '#EFF6FF';
      iconColor = '#3B82F6';
      label = 'MD';
      // Document icon
      iconSvg = (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      );
    } else if (ext === 'json') {
      bg = '#ECFDF5';
      iconColor = '#10B981';
      label = 'JSON';
      // Braces icon
      iconSvg = (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
        </svg>
      );
    } else if (ext === 'js' || filePath.endsWith('.jsx')) {
      bg = '#FFFBEB';
      iconColor = '#F59E0B';
      label = 'JS';
      // Code icon
      iconSvg = (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
        </svg>
      );
    } else if (ext === 'ts' || filePath.endsWith('.tsx')) {
      bg = '#EFF6FF';
      iconColor = '#3B82F6';
      label = 'TS';
      iconSvg = (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
        </svg>
      );
    } else if (ext === 'css') {
      bg = '#F5F3FF';
      iconColor = '#7C3AED';
      label = 'CSS';
      iconSvg = (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      );
    } else {
      iconSvg = (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      );
    }

    return (
      <div className="ws-file-icon-box" style={{ backgroundColor: bg }}>
        <div className="ws-file-icon-graphic">{iconSvg}</div>
        <span className="ws-file-icon-label" style={{ color: iconColor }}>{label}</span>
      </div>
    );
  };

  const getButtonTheme = (filePath) => {
    const ext = filePath.split('.').pop().toLowerCase();
    const lower = filePath.toLowerCase();
    if (lower.includes('examples/') && (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx')) return 'pink';
    if (lower.includes('examples/')) return 'orange';
    if (ext === 'md') return 'blue';
    if (ext === 'json') return 'green';
    if (ext === 'js' || ext === 'jsx') return 'orange';
    if (ext === 'ts' || ext === 'tsx') return 'blue';
    if (ext === 'css') return 'purple';
    return 'blue';
  };

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

  const getTechLogo = (name) => {
    const n = name.toLowerCase();
    // Each returns a small 16×16 inline SVG or styled span
    if (n.includes('react'))
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#61DAFB" strokeWidth="2"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" style={{transform:'rotate(60deg)',transformOrigin:'50% 50%'}}/><ellipse cx="12" cy="12" rx="10" ry="4" style={{transform:'rotate(120deg)',transformOrigin:'50% 50%'}}/></svg>;
    if (n.includes('typescript') || n === 'ts')
      return <span style={{background:'#3178C6',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>TS</span>;
    if (n.includes('javascript') || n === 'js')
      return <span style={{background:'#F7DF1E',color:'#111',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>JS</span>;
    if (n.includes('node'))
      return <span style={{background:'#339933',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>N</span>;
    if (n.includes('express'))
      return <span style={{background:'#000',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>Ex</span>;
    if (n.includes('next'))
      return <span style={{background:'#000',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>N↗</span>;
    if (n.includes('vite'))
      return <span style={{background:'#646CFF',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>V</span>;
    if (n.includes('vue'))
      return <span style={{background:'#42B883',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>V</span>;
    if (n.includes('tailwind'))
      return <span style={{background:'#38BDF8',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>TW</span>;
    if (n.includes('mongo'))
      return <span style={{background:'#13AA52',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>M</span>;
    if (n.includes('prisma'))
      return <span style={{background:'#2D3748',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>P</span>;
    if (n.includes('graphql'))
      return <span style={{background:'#E10098',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>G</span>;
    if (n.includes('jest'))
      return <span style={{background:'#C21325',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>J</span>;
    if (n.includes('mocha'))
      return <span style={{background:'#8D6748',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>M</span>;
    if (n.includes('eslint'))
      return <span style={{background:'#4B32C3',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>E</span>;
    if (n.includes('prettier'))
      return <span style={{background:'#F7B93E',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>P</span>;
    if (n.includes('webpack'))
      return <span style={{background:'#8DD6F9',color:'#111',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>W</span>;
    if (n.includes('redux'))
      return <span style={{background:'#764ABC',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>Rx</span>;
    if (n.includes('axios'))
      return <span style={{background:'#5A29E4',color:'#fff',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>Ax</span>;
    // Default: first 2 chars of name
    return <span style={{background:'#E2E8F0',color:'#475569',fontSize:'0.55rem',fontWeight:800,padding:'1px 3px',borderRadius:3,fontFamily:'monospace',lineHeight:1}}>{name.slice(0,2)}</span>;
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
          <Breadcrumb
            repoName={analysisData ? analysisData.fullName : null}
            filePath={selectedFile ? selectedFile.path : null}
            onHomeClick={handleGoHome}
            onRepoClick={handleBackToDashboard}
          />

          <div className="workspace-dashboard" style={{ display: selectedFile ? 'none' : 'block' }}>
            {/* Repo Header Card */}
            <div className="ws-header-card">
              {/* Left: avatar + info */}
              <div className="ws-header-left">
                <div className="ws-repo-avatar-wrap">
                  <div className="ws-repo-avatar">
                    {analysisData?.repo ? analysisData.repo.slice(0, 2).toLowerCase() : 'fc'}
                  </div>
                  <span className="ws-avatar-dot"></span>
                </div>
                <div className="ws-repo-info">
                  <h2 className="ws-repo-name">
                    <a href={`https://github.com/${analysisData?.owner}/${analysisData?.repo}`} target="_blank" rel="noopener noreferrer" className="ws-repo-link">
                      {analysisData?.owner}/{analysisData?.repo}
                    </a>
                    <a href={`https://github.com/${analysisData?.owner}/${analysisData?.repo}`} target="_blank" rel="noopener noreferrer" className="ws-external-btn" aria-label="Open on GitHub">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  </h2>
                  {repoDescription && <p className="ws-repo-desc">{repoDescription}</p>}

                  {/* Stat boxes */}
                  <div className="ws-stat-boxes">
                    {analysisData?.stars && (
                      <div className="ws-stat-box">
                        <div className="ws-stat-top">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#3B82F6" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          <span className="ws-stat-value">{formatStars(analysisData.stars)}</span>
                        </div>
                        <span className="ws-stat-label">Stars</span>
                      </div>
                    )}
                    {analysisData?.language && (
                      <div className="ws-stat-box">
                        <div className="ws-stat-top">
                          <span className="ws-lang-badge">JS</span>
                          <span className="ws-stat-value">{analysisData.language}</span>
                        </div>
                        <span className="ws-stat-label">Primary language</span>
                      </div>
                    )}
                    {analysisData?.filesCount && (
                      <div className="ws-stat-box">
                        <div className="ws-stat-top">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                          <span className="ws-stat-value">{analysisData.filesCount}</span>
                        </div>
                        <span className="ws-stat-label">Files</span>
                      </div>
                    )}
                  </div>

                  {/* Tech Stack */}
                  {techStack.length >= 2 && (
                    <div className="ws-header-tech-stack">
                      <div className="ws-tech-stack-heading">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
                        <span className="ws-tech-stack-label">TECH STACK</span>
                      </div>
                      <div className="ws-tech-stack-pills">
                        {techStack.slice(0, 4).map(t => (
                          <span key={t} className="ws-tech-pill">
                            {getTechLogo(t)}
                            {t}
                          </span>
                        ))}
                        {techStack.length > 4 && (
                          <span className="ws-tech-pill ws-tech-more">+{techStack.length - 4} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: illustration */}
              <div className="ws-header-illustration">
                <svg width="200" height="130" viewBox="0 0 200 130" fill="none">
                  {/* Back document */}
                  <rect x="8" y="28" width="110" height="80" rx="8" fill="none" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="4 3"/>
                  {/* Browser window */}
                  <rect x="55" y="10" width="120" height="88" rx="10" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5"/>
                  {/* Titlebar */}
                  <rect x="55" y="10" width="120" height="24" rx="10" fill="#1E293B"/>
                  <rect x="55" y="22" width="120" height="12" fill="#1E293B"/>
                  <circle cx="68" cy="22" r="3.5" fill="#EF4444"/>
                  <circle cx="79" cy="22" r="3.5" fill="#F59E0B"/>
                  <circle cx="90" cy="22" r="3.5" fill="#10B981"/>
                  {/* Code symbol */}
                  <text x="115" y="68" fill="#3B82F6" fontFamily="monospace" fontSize="28" fontWeight="800" textAnchor="middle">&lt;/&gt;</text>
                  {/* Lines */}
                  <rect x="75" y="80" width="50" height="3" rx="1.5" fill="#E2E8F0"/>
                  <rect x="75" y="87" width="70" height="3" rx="1.5" fill="#E2E8F0"/>
                  {/* Floating doc */}
                  <rect x="130" y="75" width="58" height="45" rx="8" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5"/>
                  <rect x="140" y="86" width="38" height="3" rx="1.5" fill="#CBD5E1"/>
                  <rect x="140" y="93" width="28" height="3" rx="1.5" fill="#CBD5E1"/>
                  <rect x="140" y="100" width="33" height="3" rx="1.5" fill="#CBD5E1"/>
                  <rect x="140" y="107" width="20" height="3" rx="1.5" fill="#CBD5E1"/>
                </svg>
              </div>
            </div>

            {/* Read Order Heading Row */}
            <div className="ws-tabs-new">
              <div className="ws-tabs-title-row">
                <div className="ws-tabs-book-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="ws-tabs-title">Read Order</h3>
                  <p className="ws-tabs-subtitle">A recommended sequence to understand this repository step by step.</p>
                </div>
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
                    const theme = getButtonTheme(file.path);
                    const dotColor = getDotColor(file.path);
                    return (
                      <div key={file.path} className="ws-timeline-item">
                        <div className="ws-timeline-dot" style={{ backgroundColor: dotColor }}></div>
                        <div className="ws-item-timeline-card">
                          {getFileIconLayout(file.path)}
                          <div className="ws-item-info">
                            <div className="ws-item-header-row">
                              <span className="ws-path">{file.path}</span>
                              <span className="ws-category-pill" style={{ backgroundColor: cat.bg, color: cat.color }}>
                                {cat.text}
                              </span>
                            </div>
                            <ul className="ws-item-body">
                              <li className="ws-item-explanation">{file.explanation}</li>
                              <li className="ws-item-reason">{file.reason}</li>
                            </ul>
                          </div>
                          <button className={`ws-timeline-btn ws-btn-${theme}`} onClick={() => handleReadFile(file.path)}>
                            Read Code &amp; Explanation
                            <span className="ws-chevron">→</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
              onFileClick={handleReadFile}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
