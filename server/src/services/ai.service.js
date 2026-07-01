const { GoogleGenerativeAI } = require('@google/generative-ai');
const EXPLAIN_FILE_PROMPT = require('../prompts/explainFile.prompt');
const { getCached, setCached } = require('./cache.service');

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

/**
 * AI Service
 * Handles communication with Gemini API to generate structured reading orders.
 */

// Raw prompt string to be sent to the LLM later
const RAW_PROMPT_STRING = `I am NOT asking you to execute the following prompt.

I am asking you to place it inside my backend/service as a string that will later be sent to the LLM.

Do not interpret the prompt.

Do not generate JSON.

Do not answer the prompt.

Treat everything below as plain text.`;


// Initialize the Gemini API client
// We use a getter function to check if the API key is present at runtime
let genAI = null;
function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Generates a mock reading list if the user hasn't configured a Gemini API key.
 * This ensures the application is immediately testable without configuration.
 */
function getMockReadingList(files) {
  console.warn('⚠️ GEMINI_API_KEY is missing in server/.env. Falling back to Mock AI reading list.');

  const mockList = [];
  
  // Look for README.md first
  const readme = files.find(f => f.path.toLowerCase() === 'readme.md');
  if (readme) {
    mockList.push({
      path: readme.path,
      explanation: 'Top-level README describing the project\'s purpose, architecture, and setup steps.',
      reason: 'Start here to understand what the repository does and how to run it locally before reading any code.'
    });
  }

  // Look for package.json next
  const pkgJson = files.find(f => f.path.toLowerCase() === 'package.json');
  if (pkgJson) {
    mockList.push({
      path: pkgJson.path,
      explanation: 'Root package.json defining the project\'s dependencies, scripts, and workspace structure.',
      reason: 'Shows which libraries the project depends on and which npm scripts (dev, build, test) are available.'
    });
  }

  // Add up to 3 other files with high-quality, specific, non-templated descriptions
  const otherFiles = files.filter(f => f.path.toLowerCase() !== 'readme.md' && f.path.toLowerCase() !== 'package.json');
  otherFiles.slice(0, 3).forEach((file) => {
    const name = file.path.split('/').pop();
    const nameLower = name.toLowerCase();
    const dir = file.path.includes('/') ? file.path.split('/').slice(-2, -1)[0] : '';
    
    let explanation = '';
    let reason = '';
    
    if (nameLower === 'claude.md') {
      explanation = 'Developer reference guide outlining specific coding style conventions, test suites, and tool integrations.';
      reason = 'Gives the developer guidelines on project-specific guidelines and constraints before writing code.';
    } else if (nameLower === 'contributing.md') {
      explanation = 'Documentation file explaining the workflow for contributing, filing bug reports, and submitting pull requests.';
      reason = 'Read this to understand the contribution guidelines, branching strategy, and PR expectations.';
    } else if (nameLower === 'dockerfile') {
      explanation = 'Container build specification configuring the deployment container image and build environment.';
      reason = 'Defines the environment dependencies and runtime isolation config required to run the app.';
    } else if (nameLower === 'makefile') {
      explanation = 'Build script container defining shorthand targets to build, test, and run database migrations.';
      reason = 'Provides command shortcuts to speed up local testing and run tasks.';
    } else if (nameLower.startsWith('history') || nameLower.startsWith('changelog')) {
      explanation = `Release history and version log detailing updates, bug fixes, and modifications across releases.`;
      reason = `Helps you trace how the project API has evolved and identify recent changes.`;
    } else if (file.path.includes('examples/')) {
      if (nameLower.endsWith('.md')) {
        explanation = `Documentation index with guides and setup targets for the example implementations.`;
        reason = `Examine this to see the catalog of available demo scripts you can run.`;
      } else {
        explanation = `Example application code (${name}) showcasing library initialization and server setups.`;
        reason = `Review this implementation to see how to import and call the module APIs in practice.`;
      }
    } else if (nameLower.endsWith('.js') || nameLower.endsWith('.ts') || nameLower.endsWith('.jsx') || nameLower.endsWith('.tsx')) {
      explanation = `Source code module defining the logic or exports for the ${name} file under ${dir || 'root'}.`;
      reason = `Reading this code exposes the implementation details of the ${dir || 'project'} components.`;
    } else {
      explanation = `Module metadata config file (${name}) specifying integrations or dependencies inside ${dir || 'root'}.`;
      reason = `Examine this to trace structural configurations and build parameters for the codebase.`;
    }

    mockList.push({
      path: file.path,
      explanation,
      reason
    });
  });

  return mockList;
}

/**
 * Computes Jaccard word-overlap similarity between two strings.
 * Returns a value between 0 (no overlap) and 1 (identical word sets).
 * Used to detect templated/copy-pasted AI explanations.
 */
function jaccardSimilarity(a, b) {
  const tokenize = str =>
    new Set(str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const w of setA) { if (setB.has(w)) intersection++; }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/**
 * Scans the returned reading list for suspiciously similar explanation text.
 * Logs a warning for any pair whose Jaccard similarity exceeds the threshold.
 * Does NOT modify the list — this is an observability hook only.
 */
function warnIfDuplicateExplanations(readingList, threshold = 0.7) {
  for (let i = 0; i < readingList.length; i++) {
    for (let j = i + 1; j < readingList.length; j++) {
      const a = readingList[i];
      const b = readingList[j];
      const expSim = jaccardSimilarity(a.explanation || '', b.explanation || '');
      const rsnSim = jaccardSimilarity(a.reason     || '', b.reason     || '');
      if (expSim > threshold) {
        console.warn(
          `[similarity] Explanation too similar (${(expSim * 100).toFixed(0)}% overlap) between:\n` +
          `  [${i}] ${a.path}: "${a.explanation}"\n` +
          `  [${j}] ${b.path}: "${b.explanation}"\n` +
          `  → Prompt fix may not have fully worked for these two entries.`
        );
      }
      if (rsnSim > threshold) {
        console.warn(
          `[similarity] Reason too similar (${(rsnSim * 100).toFixed(0)}% overlap) between:\n` +
          `  [${i}] ${a.path}: "${a.reason}"\n` +
          `  [${j}] ${b.path}: "${b.reason}"`
        );
      }
    }
  }
}

/**
 * Reviews a list of files from a GitHub repository and returns a sorted reading list.
 * 
 * @param {string} repoName - The name of the repository.
 * @param {Array} files - Array of file objects [{ path, size, url }].
 * @returns {Promise<Array>} Sorted reading list with explanations.
 */
async function generateReadingList(repoName, files) {
  // Extract owner and repo for cache key
  let owner = '';
  let repo = repoName;
  if (repoName.includes('/')) {
    const parts = repoName.split('/');
    owner = parts[0];
    repo = parts[1];
  } else if (files && files.length > 0 && files[0].url) {
    const match = files[0].url.match(/githubusercontent\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      owner = match[1];
      repo = match[2];
    }
  }
  const cacheKey = `readOrder:${owner}:${repo}`;

  try {
    const cached = await getCached(cacheKey, GEMINI_MODEL);
    if (cached) {
      console.log(`CACHE HIT: [${cacheKey}]`);
      return cached;
    }
    console.log(`CACHE MISS — calling Gemini`);
  } catch (err) {
    console.error('Cache get error in generateReadingList:', err);
  }

  const client = getAIClient();
  
  if (!client) {
    return getMockReadingList(files);
  }

  const systemInstruction =
    `You are a senior open-source maintainer helping a brand-new contributor understand the repository "${repoName}".\n` +
    `Your task: given a pre-filtered list of source file paths, produce an ordered JSON reading list of the 6-10 most important files to read first.\n` +
    `\n` +
    `STRICT RULES — violating any rule makes your output useless:\n` +
    `\n` +
    `1. ONLY use paths that appear verbatim in the input list. Do NOT invent or reference any path not present.\n` +
    `\n` +
    `2. SKIP any file that looks like tooling, config, or infrastructure even if it appears in the list:\n` +
    `   - Anything inside a dot-directory (.agents, .github, .vscode, .husky, .cursor, .circleci, etc.)\n` +
    `   - CI/CD config files (*.yml, *.yaml at the root level)\n` +
    `   - Linter/formatter configs (.eslintrc, .prettierrc, .babelrc, tsconfig.json at root, etc.)\n` +
    `   - Test fixtures, mocks, or snapshot files\n` +
    `   - Lock files of any kind\n` +
    `\n` +
    `3. META-FILE CAP — in the first 5 results, at most 2 entries may be meta/documentation files.\n` +
    `   Meta files are: CONTRIBUTING.md, DEVELOPERS.md, CODE_OF_CONDUCT.md, Makefile, LICENSE, CI config files, SECURITY.md, History.md, History,\n` +
    `   any file whose name starts with CONTRIBUTING, DEVELOPERS, CODE_OF_CONDUCT, SECURITY, or SUPPORT.\n` +
    `   The remaining slots in the top 5 MUST be filled with README/package.json and actual source code entry points:\n` +
    `   package.json, index.js / index.ts, main.js, App.jsx/tsx, server.js, app.js, or files inside src/, lib/, app/, packages/.\n` +
    `   If a large monorepo has many package subdirectories, pick one representative entry file per package, not multiple docs.\n` +
    `\n` +
    `4. Prioritise in this order: README → root package.json → main entry points → core routing/config → domain logic → utilities.\n` +
    `\n` +
    `5. UNIQUE FILE-SPECIFIC EXPLANATIONS — this is the most critical rule:\n` +
    `   For EVERY single file, you must write explanations based on that file's REAL, SPECIFIC content and purpose. Never reuse the same sentence structure, phrasing, or wording across different files.\n` +
    `   - SILENT CATEGORIZATION: For each file path, you MUST first silently identify the file's category (e.g. changelog/release history, license, configuration, build script, source code view, domain helper, example demo, markdown documentation) based on its extension, name, and folder location.\n` +
    `   - Ground your explanation and reason fields entirely in that identified file category.\n` +
    `   - If you cannot determine specific value for a file, exclude it rather than generating a generic placeholder.\n` +
    `\n` +
    `   INLINE EXAMPLES (Use these to guide your pattern, do not copy-paste them):\n` +
    `   - File: "Dockerfile"\n` +
    `     * BAD: "Dockerfile inside the project root — defines the module-level logic for that layer of the application." (Factually wrong, templated)\n` +
    `     * GOOD: "Defines the Docker containerization steps and environment environment configurations to run the application in production."\n` +
    `   - File: "src/middleware/auth.js"\n` +
    `     * BAD: "auth.js inside src/middleware — defines the module-level logic for that layer of the application." (Generic boilerplate)\n` +
    `     * GOOD: "Implements Express middleware to validate JSON Web Tokens (JWTs) and secure user routes."\n` +
    `   - File: "Makefile"\n` +
    `     * BAD: "Makefile inside the project root — defines the module-level logic for that layer of the application."\n` +
    `     * GOOD: "Specifies shorthand command workflows to automate build tasks, database migrations, and testing scripts."\n` +
    `\n` +
    `   BANNED TEMPLATES & PHRASES (Your output is discarded if any match or close variation is found):\n` +
    `   - "[filename] inside [dir] — defines the module-level logic..." (or similar variations)\n` +
    `   - "defines the module-level logic for that layer of the application"\n` +
    `   - "will help you trace the data flow through the codebase"\n` +
    `   - "Configuration or resource file"\n` +
    `   - "located inside the project root"\n` +
    `   - "located inside the examples directory"\n` +
    `   - "Helps you trace structural configurations and build schemas"\n` +
    `   - "core code component", "containing logical implementations", "important source file", "key file", "this file is important", "relevant file"\n` +
    `\n` +
    `6. For EACH file, write TWO distinct fields:\n` +
    `   - "explanation": ONE sentence describing what is SPECIFICALLY inside this exact file.\n` +
    `     Describe its specific type (e.g. Express router, React context provider, Docker config, make targets, changelog documentation).\n` +
    `   - "reason": ONE sentence explaining WHY a first-time contributor should read this file at this point in the sequence.\n` +
    `     Describe its architectural dependency or high learning value (e.g. "Understand this first to see how request payloads are authenticated before they reach the controller endpoints").\n` +
    `\n` +
    `7. Output ONLY a valid JSON array. No markdown fences, no commentary, no wrapper object.\n` +
    `   Required schema: [{ "path": "<exact path>", "explanation": "<string>", "reason": "<string>" }]`;

  try {
    // Model initialization with systemInstruction passed to getGenerativeModel
    const model = client.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemInstruction
    });

    // Only send paths — no URLs or sizes needed by the model
    const filePaths = files.map(f => f.path);

    const prompt =
      `Repository: ${repoName}\n` +
      `Pre-filtered source files (${filePaths.length} total — use ONLY paths from this list):\n` +
      `${JSON.stringify(filePaths, null, 2)}\n` +
      `\n` +
      `Produce the reading list JSON array now. Remember: max 2 meta/docs files, all other entries must be source code files.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json' // Force structured JSON output
      }
    });

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);
    
    if (!Array.isArray(parsedData)) {
      throw new Error('AI output was not in the expected array structure.');
    }

    // Post-processing: flag suspiciously similar explanations (does not modify the list)
    warnIfDuplicateExplanations(parsedData);

    try {
      await setCached(cacheKey, GEMINI_MODEL, 'readOrder', parsedData);
      console.log(`CACHED: [${cacheKey}]`);
    } catch (err) {
      console.error('Cache set error in generateReadingList:', err);
    }

    return parsedData;
  } catch (error) {
    console.error('Error generating AI reading list:', error);
    return getMockReadingList(files);
  }
}

/**
 * Generates a mock explanation for a file if GEMINI_API_KEY is missing.
 */
function getMockFileExplanation(filePath, code) {
  console.warn(`⚠️ GEMINI_API_KEY is missing. Generating mock code explanation for: ${filePath}`);

  const lines = code.split('\n');
  const totalLines = lines.length;

  let explanation = `### 🚀 Code Overview: **${filePath}**\n\n`;
  explanation += `This is a source file containing **${totalLines} lines of code**. Here is a beginner-friendly explanation of how it fits into the project:\n\n`;

  if (filePath.toLowerCase().endsWith('readme.md')) {
    explanation += `#### 📖 High-Level Purpose\n`;
    explanation += `This is a Markdown documentation file. It acts as the primary user guide for the repository. It usually contains project roadmap details, quick-start commands, configuration scripts, and documentation mappings.\n\n`;
    explanation += `#### 🛠️ Key Takeaways for Beginners\n`;
    explanation += `- Read this file first to understand *what* problem this codebase solves.\n`;
    explanation += `- Follow the step-by-step instructions inside to run the project locally on your machine.`;
  } else if (filePath.toLowerCase().endsWith('package.json')) {
    explanation += `#### 📦 Dependency Manager Config\n`;
    explanation += `This JSON file is the heart of a Node.js project. It lists all the external packages (libraries) that this codebase depends on to run properly.\n\n`;
    explanation += `#### ⚙️ Scripts & Metadata\n`;
    explanation += `- **dependencies**: Libraries required for production (e.g. React or Express).\n`;
    explanation += `- **scripts**: Shortcut commands (e.g., \`npm run dev\` or \`npm run build\`) used to compile or run the server easily.`;
  } else {
    explanation += `#### 🧩 Architecture & Role\n`;
    explanation += `This code defines structural features of the repository. It imports helper modules, executes business logic functions, and exports variables for other files to access.\n\n`;
    explanation += `#### 💡 MERN Concept Check\n`;
    explanation += `- Check the top lines of this file to see which files/modules it imports using \`require()\` or \`import\`.\n`;
    explanation += `- Look at the bottom of the file to see how it exports its functions using \`module.exports\` or \`export default\` so other parts of the app can reuse its features.`;
  }

  return explanation;
}

/**
 * Explains a file's code targetted for a developer who recently learned MERN.
 * 
 * @param {string} filePath - Path of the file.
 * @param {string} code - Raw code content.
 * @returns {Promise<string>} Junior-level markdown explanation.
 */
async function generateFileExplanation(filePath, code) {
  const client = getAIClient();

  if (!client) {
    return getMockFileExplanation(filePath, code);
  }

  try {
    const model = client.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: EXPLAIN_FILE_PROMPT
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: code }] }],
      generationConfig: {
        responseMimeType: 'application/json' // Instruct Gemini to return valid JSON
      }
    });

    const responseText = result.response.text();
    
    // Parse the returned JSON
    const parsedJson = JSON.parse(responseText);
    return parsedJson;
  } catch (error) {
    console.error('Error generating AI file explanation:', error);
    return {
      error: 'Failed to generate explanation',
      details: error.message
    };
  }
}

/**
 * Generates a mock block-by-block explanation for a file if GEMINI_API_KEY is missing.
 */
function getFileTypeCategory(filePath) {
  const nameLower = filePath.split('/').pop().toLowerCase();
  if (nameLower.endsWith('.md')) return 'markdown';
  if (nameLower.endsWith('.json')) return 'json';
  if (nameLower === 'dockerfile') return 'dockerfile';
  if (nameLower.endsWith('.js') || nameLower.endsWith('.ts') || nameLower.endsWith('.jsx') || nameLower.endsWith('.tsx')) {
    return 'source_code';
  }
  return 'other';
}
function getMockBlockExplanation(filePath, code, simplify = false) {
  console.warn(`⚠️ GEMINI_API_KEY is missing. Generating mock block explanation for: ${filePath}`);
  const lines = code.split('\n');
  const totalLines = lines.length;
  const category = getFileTypeCategory(filePath);

  // Custom high-quality granular mock for examples/auth/index.js
  if (filePath.endsWith('examples/auth/index.js') || filePath.includes('auth/index.js')) {
    return {
      "summary": "This file sets up a login system — it handles passwords, sessions, and protects pages from logged-out users.",
      "concepts": ["Sessions", "Password Hashing", "Middleware", "EJS Templates"],
      "difficulty": "Intermediate",
      "explanation": [
        {
          "lines": "1-6",
          "title": "Enforcing strict mode",
          "what": "Tells the JavaScript engine to throw errors for bad syntax.",
          "why": "Prevents subtle bugs and coding mistakes from running silently."
        },
        {
          "lines": "7-11",
          "title": "Loading module dependencies",
          "what": "Imports the Express web framework, path utility, password hashing tool, and session tracker.",
          "why": "Without these external tools, we would have to code complex routing, session managers, and security from scratch.",
          "note": "pbkdf2-password is a security library that scrambles passwords before saving them, so even if your database gets hacked, passwords aren't readable."
        },
        {
          "lines": "12-13",
          "title": "Initializing the Express app",
          "what": "Creates the main application instance and makes it available for exports.",
          "why": "Without starting an application instance, we cannot declare web routes or listen on network ports.",
          "note": "module.exports makes the app available to other files."
        },
        {
          "lines": "14-18",
          "title": "Configuring page templates",
          "what": "Configures EJS as the engine to print dynamic HTML pages from the views folder.",
          "why": "Without a templating engine, we would have to serve static files or write HTML inside JavaScript strings.",
          "note": "EJS stands for Embedded JavaScript — it lets you inject JS variables directly into HTML files."
        },
        {
          "lines": "19-27",
          "title": "Configuring middlewares",
          "what": "Initializes urlencoded form reader and cookie session manager.",
          "why": "Without urlencoded middleware, form submissions would arrive empty; without sessions, users would log out on every page reload.",
          "note": "session stores persistent data across multiple pages."
        },
        {
          "lines": "28-40",
          "title": "Flash message middleware",
          "what": "Retrieves saved success/error messages from the session and moves them to local variables.",
          "why": "If we don't clear these messages, they will remain on screen forever instead of disappearing after one reload."
        },
        {
          "lines": "41-46",
          "title": "Mock database setup",
          "what": "Creates a temporary local database object holding a user named 'tj'.",
          "why": "Without a database store, we would have no users to authenticate.",
          "note": "This is in-memory only — restarting the server resets any changes."
        },
        {
          "lines": "47-56",
          "title": "Hashing default password",
          "what": "Hashes the password 'foobar' for user 'tj' immediately on server start.",
          "why": "We must pre-register our users with hashed passwords so they can attempt logging in.",
          "note": "pbkdf2 password hashing generates a salt (random noise) to ensure hash uniqueness."
        },
        {
          "lines": "57-73",
          "title": "Authentication handler function",
          "what": "Checks if the username exists and verifies if the password hash matches.",
          "why": "Without this function, we cannot distinguish between valid users and incorrect login attempts.",
          "note": "Uses a callback to return the result asynchronously."
        },
        {
          "lines": "74-82",
          "title": "Access restriction middleware",
          "what": "Blocks requests to pages if the session doesn't contain a user object.",
          "why": "Without this wall, logged-out users could bypass the login screen by typing the URL directly.",
          "note": "middleware runs before the main route handler."
        },
        {
          "lines": "83-87",
          "title": "Home page redirect route",
          "what": "Redirects any request pointing to the main domain root page directly to the login page.",
          "why": "We want to enforce the login screen as the entry point for this web app."
        },
        {
          "lines": "88-92",
          "title": "Restricted route configuration",
          "what": "Serves a secret page protected by the restrict middleware.",
          "why": "Demonstrates how private routes are protected using middleware chains."
        },
        {
          "lines": "93-100",
          "title": "Logout route configuration",
          "what": "Wipes out the session and redirects the visitor back to the home page.",
          "why": "If we do not destroy the session, the user will remain logged in indefinitely.",
          "note": "req.session.destroy clears the cookie session."
        },
        {
          "lines": "101-105",
          "title": "Login view route",
          "what": "Renders the login HTML template to display the credentials form.",
          "why": "Provides the visual interface where users can type their usernames and passwords."
        },
        {
          "lines": "106-130",
          "title": "Login post handler",
          "what": "Verifies form credentials, generates a new session, and saves user data.",
          "why": "Without this route, form submissions would fail to authenticate or save session state.",
          "note": "req.session.regenerate prevents session fixation attacks."
        },
        {
          "lines": "131-137",
          "title": "Server listener initialization",
          "what": "Starts the web server listening on port 3000.",
          "why": "If we do not start the port listener, the server cannot receive any browser requests."
        }
      ]
    };
  }

  const split1 = Math.min(10, Math.floor(totalLines / 3));
  const split2 = Math.min(totalLines - 2, Math.floor((totalLines * 2) / 3));

  let summary = "";
  let concepts = [];
  let difficulty = "Beginner";
  let explanation = [];

  if (category === 'markdown') {
    summary = "This is a documentation file explaining the repository structure and setup guidelines.";
    concepts = ["Markdown", "Repository Overview", "Contributor Guide"];
    difficulty = "Beginner";
    explanation = [
      {
        lines: `1-${split1}`,
        title: "Header and introduction",
        what: "Introduces the repository name and defines the main purpose of this project.",
        why: "So that new users visiting the codebase can immediately understand what it is about."
      },
      {
        lines: `${split1 + 1}-${split2}`,
        title: "Getting started guide",
        what: "Provides step-by-step instructions on setting up and installing this codebase locally.",
        why: "Without setup guides, contributors cannot run the project locally to make edits."
      },
      {
        lines: `${split2 + 1}-${totalLines}`,
        title: "Additional documentation links",
        what: "Lists extra markdown files and links describing specific system architecture modules.",
        why: "Helps users locate deeper guides detailing how specific features work."
      }
    ];
  } else if (category === 'json') {
    summary = "This file holds the metadata, package configuration settings, and dependency registries.";
    concepts = ["JSON Manifest", "Dependency Management", "npm Scripts"];
    difficulty = "Beginner";
    explanation = [
      {
        lines: `1-${split1}`,
        title: "Basic project metadata",
        what: "Defines package attributes like project name, version, and initial entrypoint paths.",
        why: "Required for the package manager to identify the module characteristics."
      },
      {
        lines: `${split1 + 1}-${split2}`,
        title: "Runtime dependencies",
        what: "Lists required external libraries needed for the server or client applications to run.",
        why: "If these libraries are not declared, npm cannot download and install them."
      },
      {
        lines: `${split2 + 1}-${totalLines}`,
        title: "Dev dependencies and scripts",
        what: "Lists developer-only tool libraries and defines command shortcut alias scripts.",
        why: "Without dev commands, developers would have to type lengthy shell commands manually."
      }
    ];
  } else {
    // source_code, dockerfile or other
    summary = "This file contains program source code executing system workflows.";
    concepts = ["Source Code", "System Logic", "Node.js Modules"];
    difficulty = "Intermediate";
    explanation = [
      {
        lines: `1-${split1}`,
        title: "Module setup and imports",
        what: "Loads necessary dependencies and helper services using require statements.",
        why: "Without these helper libraries, the file cannot access standard tools to run code."
      },
      {
        lines: `${split1 + 1}-${split2}`,
        title: "Core operations and definitions",
        what: "Implements logic algorithms and registers functions to process request data.",
        why: "Without this main block, no functional procedures would run when the program is triggered."
      },
      {
        lines: `${split2 + 1}-${totalLines}`,
        title: "Module exports",
        what: "Exports local functions or objects to make them accessible to other project files.",
        why: "If modules do not export variables, they cannot be shared across the repository."
      }
    ];
  }

  return {
    summary,
    concepts,
    difficulty,
    explanation
  };
}

/**
 * Explains code in line-range blocks, targeted for junior MERN stack developers.
 * Supports a "simplify" flag for even simpler explanations with analogies.
 */
async function generateBlockExplanation(filePath, code, simplify = false) {
  // Mock fallback should only run if explicitly set via an environment variable like USE_MOCK=true
  if (process.env.USE_MOCK === 'true') {
    console.log("FALLING BACK TO MOCK");
    return getMockBlockExplanation(filePath, code, simplify);
  }

  const cacheKey = `file:${filePath}:${simplify}`;
  try {
    const cached = await getCached(cacheKey, GEMINI_MODEL);
    if (cached) {
      console.log(`CACHE HIT: [${cacheKey}]`);
      return cached;
    }
    console.log(`CACHE MISS — calling Gemini`);
  } catch (err) {
    console.error('Cache get error in generateBlockExplanation:', err);
  }

  // Real AI API call
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY environment variable is missing.");
    console.error("Error generating AI block explanation:", err);
    throw err;
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const category = getFileTypeCategory(filePath);
    
    let categoryDoc = '';
    switch (category) {
      case 'markdown':
        categoryDoc = `This is a Markdown documentation file.
Explain it as documentation:
- Describe what each section/block of lines covers (e.g., headings, setup guides, project features).
- Explain the key takeaway for a contributor reading this section.
- NEVER mention code constructs such as imports, exports, functions, routes, variables, or programming logic.
- Speak directly and practically to the user (e.g., use "this section tells you how to install the project locally" instead of "this block implements documentation logic").`;
        break;
      case 'json':
        categoryDoc = `This is a JSON configuration file.
Explain it as configuration:
- Describe what each top-level key and settings group represents (e.g., dependencies, script aliases, compiler options).
- Explain why these settings matter for the project's development or execution.`;
        break;
      case 'dockerfile':
        categoryDoc = `This is a Dockerfile (container environment config).
Explain it as a build/deployment configuration:
- Describe what each command/instruction (e.g., FROM, RUN, COPY, EXPOSE, CMD) does in plain English.
- Explain how it sets up the container environment or handles project files.`;
        break;
      case 'source_code':
        categoryDoc = `This is a source code file.
Explain it as source code:
- Describe what each block of code does, what functions or components are defined, and what role they play.
- Explain key programming statements or operations in plain English.`;
        break;
      default:
        categoryDoc = `Explain this file based on what is actually visible in the content.
- Describe what the lines represent based on the literal text.
- Do NOT mention imports, exports, routes, or programming functions unless they are literally present in the file text.`;
    }

    const sysInstruction = simplify
      ? `You are a patient senior developer explaining code/file contents to a beginner who is brand new to programming using basic analogies (explain like I'm 5).
Explain the provided file in the simplest possible terms, avoiding all complex programming jargon. Use basic analogies where appropriate.

RULES FOR GRANULARITY & BLOCK SIZING:
1. All import/require lines must be grouped into exactly ONE block total (not one block per import).
2. Each function definition must get its own block (even if it spans 30 lines). Do not split a single function across multiple blocks!
3. Each route definition (e.g. app.get, app.post) must get its own block.
4. Config/setup lines (e.g. app.set, app.use) must be grouped together into a single block where logical.
5. Never cover more than 10-15 lines in a single block unless the lines are genuinely trivial (such as closing brackets, comments, blank lines).
6. Never create blocks smaller than a single logical unit.

RULES FOR RESPONSE FORMAT:
1. Output ONLY a valid JSON object matching the required schema. No markdown formatting (like \`\`\`json), no commentary.
Required JSON schema:
{
  "summary": "One extremely simple, analogy-based sentence summarizing the overall purpose of this file.",
  "concepts": ["Concept 1", "Concept 2", "Concept 3"], // array of 3-4 key concept tags used in this file
  "difficulty": "Beginner", // one of "Beginner", "Intermediate", or "Advanced" based on patterns used in the file
  "explanation": [
    {
      "lines": "startLine-endLine",
      "title": "5 words max, describes what this block IS",
      "what": "one sentence only using simple analogies, explaining the behavior",
      "why": "one sentence only, what breaks or goes wrong without this code",
      "note": "OPTIONAL — only include when there is a noteworthy concept to explain with analogies. Omit the field entirely if nothing noteworthy."
    }
  ]
}`
      : `You are a patient, beginner-friendly senior developer teaching a student who has just finished their first MERN stack tutorial.
Explain the provided file in plain, jargon-free English by breaking it down into small, logical, contiguous line-range blocks (e.g. "1-5", "6-9", "10-14").

RULES FOR GRANULARITY & BLOCK SIZING:
1. All import/require lines must be grouped into exactly ONE block total (not one block per import).
2. Each function definition must get its own block (even if it spans 30 lines). Do not split a single function across multiple blocks!
3. Each route definition (e.g. app.get, app.post) must get its own block.
4. Config/setup lines (e.g. app.set, app.use) must be grouped together into a single block where logical.
5. Never cover more than 10-15 lines in a single block unless the lines are genuinely trivial (such as closing brackets, comments, blank lines).
6. Never create blocks smaller than a single logical unit.

RULES FOR RESPONSE FORMAT:
1. Output ONLY a valid JSON object matching the required schema. No markdown formatting (like \`\`\`json), no commentary.
Required JSON schema:
{
  "summary": "One plain-English sentence summarizing the overall purpose of this file.",
  "concepts": ["Concept 1", "Concept 2", "Concept 3"], // array of 3-4 key concept tags used in this file
  "difficulty": "Beginner", // one of "Beginner", "Intermediate", or "Advanced" based on patterns used in the file
  "explanation": [
    {
      "lines": "startLine-endLine",
      "title": "5 words max, describes what this block IS",
      "what": "one sentence only, plain English, no jargon, explaining the behavior",
      "why": "one sentence only, what breaks or goes wrong without this code",
      "note": "OPTIONAL — only include when there is a noteworthy concept to flag (like inline definitions of jargon like middleware, session, salt, hash, require, etc., security patterns, or common mistakes). Omit the field entirely if nothing noteworthy."
    }
  ]
}`;

    const model = client.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: sysInstruction
    });

    const prompt = `Explain the following code file from path: "${filePath}" using the system instructions.
Code:
${code}`;

    console.log("CALLING REAL AI");
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    if (typeof parsedData !== 'object' || parsedData === null) {
      throw new Error('AI output was not in the expected object structure.');
    }

    try {
      await setCached(cacheKey, GEMINI_MODEL, 'fileExplanation', parsedData);
      console.log(`CACHED: [${cacheKey}]`);
    } catch (err) {
      console.error('Cache set error in generateBlockExplanation:', err);
    }

    return parsedData;
  } catch (error) {
    // Detailed logging to identify rate‑limit vs daily‑quota issues
    const status = error?.response?.status;
    const headers = error?.response?.headers;
    console.error('Error generating AI block explanation:', error);
    if (status) {
      console.error('→ HTTP status:', status);
    }
    if (headers) {
      console.error('→ Response headers:', headers);
      if (headers['retry-after']) {
        console.warn('⏳ Retry-After (seconds):', headers['retry-after']);
      }
    }
    // ONLY fall back to mock if USE_MOCK is explicitly true
    if (process.env.USE_MOCK === 'true') {
      console.log("FALLING BACK TO MOCK");
      return getMockBlockExplanation(filePath, code, simplify);
    }
    // Otherwise re‑throw the error so the server returns a 500 and we can see the logs
    throw error;
  }
}

module.exports = {
  generateReadingList,
  generateFileExplanation,
  generateBlockExplanation,
  RAW_PROMPT_STRING
};

