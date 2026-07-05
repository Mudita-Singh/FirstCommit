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
    whyItMatters: 'Understanding this issue helps keep the application robust and error-free.',
    startHere: [
      { step: 1, action: 'Open relevant files', detail: 'Locate and check files mentioned below.' }
    ],
    filesToTouch: [],
    filesToIgnore: ['node_modules/', 'build/', 'dist/'],
    estimatedMinutes: '15-20',
    difficulty: estimateDifficultyFromText(issue.title, issue.body || ''),
    difficultyReason: 'Estimated from issue title',
    difficultyScore: 2,
    testsNeeded: false,
    totalLinesOfCode: 0,
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

    const prompt = `You are helping a first-time open source contributor fix a GitHub issue. Be specific and actionable.

Repository: ${owner}/${repo}
Issue #${issue.number}: ${issue.title}
${issue.body ? `Description:\n${issue.body}` : 'No description provided — analyze from title only.'}

Repository files:
${fileTree.slice(0, 150).join('\n')}

Respond ONLY with valid JSON. No markdown, no backticks:
{
  'summary': 'one clear sentence: what needs to change and why',
  'whyItMatters': 'one sentence: why this bug/feature matters, what goes wrong without the fix',
  'startHere': [
    {
      'step': 1,
      'action': 'short action title (max 5 words)',
      'detail': 'one sentence explaining this step'
    }
  ],
  'filesToTouch': [
    {
      'path': 'exact/file/path.js',
      'lines': '104-123',
      'lineCount': 20,
      'reason': 'one sentence why this file',
      'confidence': 95,
      'codeSnippet': 'actual relevant code lines — max 8 lines, only if confident about exact location, empty string if unsure'
    }
  ],
  'filesToIgnore': ['tests/', 'build/', 'node_modules/'],
  'estimatedMinutes': '20-30',
  'difficulty': 'Easy or Medium or Hard',
  'difficultyReason': 'one sentence',
  'difficultyScore': 2,
  'testsNeeded': true or false,
  'totalLinesOfCode': 20
}

Rules:
- startHere: 3-5 concrete steps a beginner follows in order. Step 1 always opens a specific file. Last step always runs tests or verifies the fix.
- filesToTouch: max 5, sorted by confidence descending. confidence is 0-100 integer.
- estimatedMinutes: realistic estimate like '15-20', '30-45', '1-2 hours'. Be honest — don't underestimate.
- difficultyScore: 1=very easy, 2=easy, 3=medium, 4=hard, 5=very hard. Used for dot rating display.
- totalLinesOfCode: sum of all filesToTouch lineCount values.
- If issue body is empty, base everything on title only. Lower confidence scores, fewer files, vaguer steps.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json'
      }
    });

    const responseText = result.response.text();
    
    let rawText = responseText;

    // Remove ALL possible markdown wrappers
    rawText = rawText
      .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
      .replace(/\s*```[\s\S]*$/i, '')
      .trim();

    // If still not starting with {, find the JSON
    if (!rawText.startsWith('{')) {
      const match = rawText.match(/\{[\s\S]*\}/)
      if (match) rawText = match[0]
    }

    console.log('=== RAW GEMINI RESPONSE ===')
    console.log(rawText)
    console.log('=== END RESPONSE ===')

    const analysis = JSON.parse(rawText)
    const parsedData = analysis;

    if (typeof parsedData !== 'object' || parsedData === null) {
      throw new Error('AI output was not in the expected object structure.');
    }

    return {
      summary: parsedData.summary || parsedData.Summary || '',
      whyItMatters: parsedData.whyItMatters || parsedData.WhyItMatters || '',
      startHere: Array.isArray(parsedData.startHere) ? parsedData.startHere : [],
      filesToTouch: Array.isArray(parsedData.filesToTouch) ? parsedData.filesToTouch.map(f => ({
        ...f,
        lineCount: typeof f.lineCount === 'number' ? f.lineCount : parseInt(f.lineCount || 0)
      })) : [],
      filesToIgnore: Array.isArray(parsedData.filesToIgnore) ? parsedData.filesToIgnore : (Array.isArray(parsedData.FilesToIgnore) ? parsedData.FilesToIgnore : ['node_modules/', 'build/', 'dist/']),
      estimatedMinutes: parsedData.estimatedMinutes || parsedData.EstimatedMinutes || '20-30',
      difficulty: parsedData.difficulty || parsedData.Difficulty || 'Unknown',
      difficultyReason: parsedData.difficultyReason || parsedData.DifficultyReason || '',
      difficultyScore: typeof parsedData.difficultyScore === 'number' ? parsedData.difficultyScore : 2,
      testsNeeded: parsedData.testsNeeded === true || parsedData.testsNeeded === 'true',
      totalLinesOfCode: typeof parsedData.totalLinesOfCode === 'number' ? parsedData.totalLinesOfCode : 0
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
