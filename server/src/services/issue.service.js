/**
 * Issue Service
 * Handles fetching open issues from GitHub and analyzing them using Gemini.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * detectDifficulty Helper
 * Determines difficulty category ('Easy', 'Medium', 'Hard', 'Unknown') based on label names.
 */
function detectDifficulty(labels) {
  const names = (labels || []).map(l => (typeof l === 'string' ? l : l.name || '').toLowerCase());
  
  const easyKeywords = ['good first issue', 'easy', 'beginner', 'starter', 'good-first-issue', 'low hanging fruit'];
  const mediumKeywords = ['medium', 'intermediate', 'help wanted', 'help-wanted', 'good second issue'];
  const hardKeywords = ['hard', 'complex', 'difficult', 'advanced'];

  if (names.some(name => easyKeywords.includes(name))) {
    return 'Easy';
  }
  if (names.some(name => mediumKeywords.includes(name))) {
    return 'Medium';
  }
  if (names.some(name => hardKeywords.includes(name))) {
    return 'Hard';
  }
  return 'Unknown';
}

function estimateDifficultyFromText(title, body) {
  const text = (title + ' ' + (body || '')).toLowerCase();
  
  // Easy signals
  const easySignals = ['typo', 'readme', 'documentation', 
    'docs', 'comment', 'spelling', 'broken link', 
    'update', 'add example', 'missing example',
    'simple', 'small', 'minor', 'trivial'];
  
  // Hard signals  
  const hardSignals = ['performance', 'security', 
    'breaking change', 'refactor', 'architecture',
    'race condition', 'memory leak', 'regression',
    'complex', 'major'];
  
  if (easySignals.some(s => text.includes(s))) 
    return 'Easy';
  if (hardSignals.some(s => text.includes(s))) 
    return 'Hard';
  return 'Medium'; // default for unlabeled
}

/**
 * fetchRepoIssues
 * Fetches open issues from the GitHub API, filters out pull requests, maps the required fields,
 * and sorts them (Easy -> Medium -> Hard -> Unknown, then newest first).
 */
async function fetchRepoIssues(owner, repo) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'FirstCommit-App',
    ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {})
  };

  const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`;
  const response = await fetch(url, { headers });

  if (response.status === 403 || response.status === 429) {
    throw new Error('GITHUB_RATE_LIMIT');
  }
  if (response.status === 404) {
    throw new Error('REPO_NOT_FOUND');
  }
  if (!response.ok) {
    throw new Error(`GitHub API returned status ${response.status}: ${response.statusText}`);
  }

  const issuesData = await response.json();
  if (!Array.isArray(issuesData)) {
    throw new Error('Invalid response structure received from GitHub.');
  }

  // Filter out Pull Requests
  const filtered = issuesData.filter(issue => !issue.pull_request);

  // Map each issue to the exact schema
  const mapped = filtered.map(issue => {
    const isUnassigned = (issue.assignees || []).length === 0 && (issue.assignee === null || issue.assignee === undefined);
    
    let difficulty = detectDifficulty(issue.labels);
    let difficultySource = 'label';
    if (difficulty === 'Unknown') {
      difficulty = estimateDifficultyFromText(issue.title, issue.body || '');
      difficultySource = 'estimated';
    }

    return {
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      url: issue.html_url,
      createdAt: issue.created_at,
      commentsCount: issue.comments,
      assignee: issue.assignee || null,
      assignees: issue.assignees || [],
      isUnassigned,
      labels: (issue.labels || []).map(l => typeof l === 'string' ? l : l.name || ''),
      difficulty,
      difficultySource
    };
  });

  // Sort: Easy -> Medium -> Hard -> Unknown
  // Within same difficulty: newest first (createdAt descending)
  const difficultyOrder = { 'Easy': 0, 'Medium': 1, 'Hard': 2, 'Unknown': 3 };
  mapped.sort((a, b) => {
    const diffA = difficultyOrder[a.difficulty];
    const diffB = difficultyOrder[b.difficulty];
    if (diffA !== diffB) {
      return diffA - diffB;
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return {
    issues: mapped,
    total: mapped.length,
    rawIssues: issuesData,
    filteredIssues: filtered,
    url: url
  };
}

/**
 * analyzeIssue
 * Uses Gemini AI to determine which files to modify to fix the GitHub issue.
 */
async function analyzeIssue(owner, repo, issue, fileTree) {
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const apiKey = process.env.GEMINI_API_KEY;

  const fallback = {
    summary: `This issue is about: "${issue.title}". Read the full description on GitHub for details.`,
    filesToTouch: [],
    filesToIgnore: ['node_modules/', 'build/', 'dist/'],
    estimatedEffort: 'Check the GitHub issue for scope details',
    difficulty: estimateDifficultyFromText(issue.title, issue.body || ''),
    difficultyReason: 'Estimated from issue title',
    firstStep: 'Read the issue on GitHub carefully, then search the codebase for relevant files mentioned in the description.'
  };

  if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY is missing. Returning fallback issue analysis.');
    return fallback;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL
    });

    const prompt = `You are helping a first-time open source contributor understand which files to change to fix a GitHub issue.

Repository: ${owner}/${repo}
Issue #${issue.number}: ${issue.title}

Issue description:
${issue.body || 'No description provided'}

Repository files:
${(fileTree || []).slice(0, 150).join('\n')}

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation. Just the JSON:
{
  'summary': 'one clear sentence explaining what needs to change and why',
  'filesToTouch': [
    {
      'path': 'exact/file/path.js',
      'lines': '12-40',
      'reason': 'one sentence why this file needs changing',
      'codeSnippet': 'the exact relevant lines from this file that relate to the issue — copy them exactly as they appear, max 8 lines'
    }
  ],
  'filesToIgnore': ['tests/', 'build/', 'node_modules/'],
  'estimatedEffort': 'one sentence about scope',
  'difficulty': 'Easy or Medium or Hard',
  'difficultyReason': 'one sentence explaining rating',
  'firstStep': 'one specific sentence — exactly where to start and what to look at first'
}

Rules:
- filesToTouch: max 5 files, most important first
- filesToIgnore: folder patterns only, not full paths
- difficulty must be exactly Easy, Medium, or Hard
- codeSnippet: only include if you are confident about the exact lines — if unsure, return empty string ''
- Base analysis only on files that exist in the repository files list provided above
- If issue body is empty, analyze from title only`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json'
      }
    });

    const responseText = result.response.text();
    
    // Strip markdown code blocks if present
    let rawText = responseText;
    rawText = rawText
      .replace(/^```json\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    const parsedData = JSON.parse(rawText);

    if (typeof parsedData !== 'object' || parsedData === null) {
      throw new Error('AI output was not in the expected object structure.');
    }

    return {
      summary: parsedData.summary || parsedData.Summary || '',
      filesToTouch: Array.isArray(parsedData.filesToTouch) ? parsedData.filesToTouch : (Array.isArray(parsedData.FilesToTouch) ? parsedData.FilesToTouch : []),
      filesToIgnore: Array.isArray(parsedData.filesToIgnore) ? parsedData.filesToIgnore : (Array.isArray(parsedData.FilesToIgnore) ? parsedData.FilesToIgnore : ['node_modules/', 'build/', 'dist/']),
      estimatedEffort: parsedData.estimatedEffort || parsedData.EstimatedEffort || '',
      difficulty: parsedData.difficulty || parsedData.Difficulty || 'Unknown',
      difficultyReason: parsedData.difficultyReason || parsedData.DifficultyReason || '',
      firstStep: parsedData.firstStep || parsedData.FirstStep || ''
    };
  } catch (error) {
    console.error('Error analyzing issue with Gemini:', error);
    return fallback;
  }
}

module.exports = {
  fetchRepoIssues,
  analyzeIssue
};
