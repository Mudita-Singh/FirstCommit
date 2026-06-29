# Architecture - FirstCommit

This document maps out the structure of the project and the data flows.

---

## Directory Tree

```
FirstCommit/ (Root Workspace)
├── package.json (Configures workspaces: "server", "client")
├── PROJECT_LOG.md (Milestone accomplishments)
├── LEARNING_NOTES.md (Definitions and revision notes)
├── COMMANDS.md (Terminal commands log)
├── ARCHITECTURE.md (This file - diagrams & code layouts)
├── QUESTIONS.md (Concept checks & reviews)
├── .gitignore (Excludes node_modules and secrets)
├── server/
│   ├── package.json (Server specific dependencies)
│   ├── .env (Environment secrets, untracked by Git)
│   └── src/
│       ├── routes/
│       │   ├── health.routes.js (Modular endpoint for checks)
│       │   └── repo.routes.js (Handles repository parsing and structure actions)
│       ├── services/
│       │   └── github.service.js (Handles connection to GitHub REST API)
│       ├── utils/
│       │   └── githubParser.js (Parses owner and repo names from URLs)
│       └── server.js (Express server bootstrap)
└── client/
    ├── package.json (Client specific dependencies)
    ├── vite.config.js (Vite compiler parameters)
    ├── index.html (Single page app host HTML)
    └── src/
        ├── main.jsx (Mounts App component to HTML root)
        ├── App.jsx (Primary App layout component)
        ├── App.css (Dashboard/form styling rules)
        └── services/
            └── api.js (Centralized fetch integration helper)
```

---

## Request Flow

### Health Check Request Flow
```
App.jsx (React component loads / mounts on screen)
↓ [Triggers useEffect hook on load]
api.js (Invokes fetchHealth() async function)
↓ [Sends HTTP GET request to http://localhost:5000/api/health]
server.js (Express server entry point on port 5000)
↓ [Passes through cors() security and express.json() middlewares]
health.routes.js (Router maps client GET to route code)
↓ [Generates JSON response: { status: 'success', ... }]
api.js (Resolves HTTP response, decodes JSON payload)
↓ [Returns result to App.jsx]
App.jsx (Updates serverStatus state to 'connected')
↓ [React re-renders UI]
Browser UI (Renders green connectivity status badge)
```

### Analyze Repository Request Flow
```
App.jsx (User clicks example button or submits URL form)
↓ [Triggers analyzeUrl(targetUrl)]
api.js (Invokes analyzeRepository(url) async function)
↓ [Sends POST request to http://localhost:5000/api/repo/structure]
server.js (Express server parses JSON body payload)
↓ [Routes to repo.routes.js controller matching POST /structure]
repo.routes.js (Triggers parseGithubUrl to extract owner and repo)
↓
github.service.js (Fires fetchRepoStructure and fetchRepoMetadata concurrently)
↓ [Executes parallel query using Promise.all()]
GitHub REST API (Fetches repository directory tree AND general repo info)
↓ [Returns raw lists and stargazers/language metadata payload]
repo.routes.js (Invokes generateReadingList AI service)
↓
Gemini API (Returns structured reading array with reasons and explanations)
↓
repo.routes.js (Returns status 200 JSON with owner, repo, stars, language, files, list)
↓ [Resolves POST promise inside client]
App.jsx (Stores payload in analysisData state, sets isLoading = false)
↓ [React updates DOM]
Browser UI (Displays stars badge, language tag, tabs, and sorted cards)
```

### Split View Scroll Synchronization Flow
```
User hovers cursor over Code Panel (Left Panel)
↓ [Triggers onMouseEnter event handler]
activeScrollRef.current (Sets active scrolling source to 'code')
↓
User scrolls Code Panel vertically
↓ [Triggers onScroll event handler on left pre block]
handleScrollSync('code') (Compares active source: 'code' matches activeScrollRef)
↓
explainRef.current.scrollTop (Sets Right Panel scrollTop equal to Left Panel scrollTop)
↓ [Right Panel scrolls to matching position without triggering looping cascades]
```




