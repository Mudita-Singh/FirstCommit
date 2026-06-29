const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * AI Service
 * Handles communication with Gemini API to generate structured reading orders.
 */

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
  const client = getAIClient();
  
  if (!client) {
    return getMockReadingList(files);
  }

  try {
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Only send paths — no URLs or sizes needed by the model
    const filePaths = files.map(f => f.path);

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

    const prompt =
      `Repository: ${repoName}\n` +
      `Pre-filtered source files (${filePaths.length} total — use ONLY paths from this list):\n` +
      `${JSON.stringify(filePaths, null, 2)}\n` +
      `\n` +
      `Produce the reading list JSON array now. Remember: max 2 meta/docs files, all other entries must be source code files.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json', // Force structured JSON output
        systemInstruction: systemInstruction
      }
    });

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);
    
    if (!Array.isArray(parsedData)) {
      throw new Error('AI output was not in the expected array structure.');
    }

    // Post-processing: flag suspiciously similar explanations (does not modify the list)
    warnIfDuplicateExplanations(parsedData);

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
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemInstruction = 
      `You are an expert developer mentor explaining code files to a student who recently learned:\n` +
      `- Basic JavaScript (ES6+)\n` +
      `- React (components, hooks like useState/useEffect)\n` +
      `- Node.js & Express (ports, routing, routers, basic middlewares)\n` +
      `- Basic MongoDB (Mongoose schemas, connection strings)\n\n` +
      `Your task is to write a clean, beginner-friendly explanation of the provided file code in Markdown format.\n` +
      `Guidelines:\n` +
      `1. Explain what the file does in 1-2 sentences first.\n` +
      `2. Break down the code in order: explain what key imports/dependencies do, explain the main functions or UI render components, and explain what is exported.\n` +
      `3. Use clear headings (e.g. ## Core Role, ## Key Code Breakdown, ## Takeaway Lessons).\n` +
      `4. Keep descriptions plain and use real-world analogies for tricky parts. Avoid overly dense jargon.\n` +
      `5. Do NOT output JSON. Output raw Markdown text directly.`;

    const prompt = `File Path: ${filePath}\n\nFile Code Content:\n\`\`\`\n${code}\n\`\`\``;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        systemInstruction: systemInstruction
      }
    });

    return result.response.text();
  } catch (error) {
    console.error('Error generating AI file explanation:', error);
    return getMockFileExplanation(filePath, code);
  }
}

module.exports = {
  generateReadingList,
  generateFileExplanation
};
