# Project Log - FirstCommit

This file logs every completed milestone, what works, and the current milestones of the project.

---

## Milestone 1: Project Setup & Structure

✓ Created root workspace directory.
✓ Configured `package.json` with npm workspaces (`server`, `client`).
✓ Initialized the 5 educational tracking files in the root folder.

### Learned
- Difference between Monorepos and Polyrepos.
- How npm workspaces help run multiple independent sub-projects within a single root folder.
- Root configuration file role.

---

## Milestone 2: Express Server Setup

✓ Initialized server workspace sub-project.
✓ Configured server `package.json` and `.env` environment variables.
✓ Built a modular Express server entry point (`server.js`).
✓ Set up routing architecture and created `/api/health` check route using `express.Router()`.
✓ Configured a root `.gitignore` to prevent tracking of dependencies and secrets.
✓ Successfully ran and tested server using Nodemon and workspaces command.

### Learned
- Core principles of Node.js and Express.
- Routing via `express.Router` for clean code structure.
- Middlewares: `cors()` for cross-origin communications, `express.json()` for parsing HTTP bodies.
- Safe handling of configuration with `.env` files and `dotenv`.
- Hot-reloading development server workflow using `nodemon`.

---

## Milestone 3: React Client Setup

✓ Scaffolding client workspace using Vite with the React template.
✓ Cleared out boilerplate code to form a clean project base.
✓ Developed responsive URL submission interface in `App.jsx` using state management (`useState`).
✓ Configured custom, responsive layout styling using modern CSS properties in `App.css`.
✓ Set up local dev servers and verified correct page loads with automated browser testing.

### Learned
- Client tooling: Vite vs Create React App compilation models.
- Single Page Application (SPA) architecture basics.
- React components, state, props, and declarative UI rendering.
- Working with form handlers and user inputs inside React states.

---

## Milestone 4: Client ↔ Server Communication

✓ Designed modular API client service layer in `client/src/services/api.js`.
✓ Programmed `useEffect` hook to call server API dynamically on mount.
✓ Created responsive loading and connectivity check indicators in `App.jsx`.
✓ Successfully established browser-to-server connection over different ports utilizing CORS middleware configurations.
✓ Verified health checks and interface presentation using automated browser testing.

### Learned
- Consuming REST endpoints using modern browser Fetch API.
- Working with asynchronous operations using JavaScript Promises and async/await mechanisms.
- React hook lifecycle and performing side effects via `useEffect`.
- Handling multi-state logic (checking/success/failure) to drive component styles.

---

## Milestone 5: GitHub API Integration

✓ Built the repository URL parser utility inside `server/src/utils/githubParser.js` utilizing Regular Expressions.
✓ Implemented the `GithubService` inside `server/src/services/github.service.js` using node fetch.
✓ Programmed branch fallback routines to try both `main` and `master` branches automatically.
✓ Created repository router endpoints in `server/src/routes/repo.routes.js` to process analysis commands.
✓ Coded tree filtering helper to strip compile dependencies, IDE setups, images, media, and heavy files from lists.
✓ Verified GitHub repository queries and response payloads using terminal cmdlet automation checks.

### Learned
- Consuming structural branch data from GitHub REST API.
- Setting explicit HTTP header parameters (Accept and User-Agent rules required by external systems).
- Utilizing local environment keys to dynamically elevate API limits.
- Writing sanitization filtering routines to parse lists of file extensions.

---

## Milestone 6: AI-Generated Read Order (Server-side)

✓ Installed Google Generative AI SDK in the `server` workspace.
✓ Programmed `AiService` in `server/src/services/ai.service.js` to coordinate Gemini Content Generation.
✓ Applied JSON schema structure configurations forcing the model to generate strict arrays of file routes, explanations, and sequence reasons.
✓ Coded a robust fallback parser in the service generating clean mock arrays when `GEMINI_API_KEY` is undefined, preventing development crashes.
✓ Linked the `repo.routes.js` router to execute `generateReadingList()` and return the final sorted array back to clients.
✓ Verified the API outputs correctly using PowerShell endpoint test scripts.

### Learned
- Constructing prompts and system instructions inside LLMs.
- Configuring structured JSON Mode MIME-types to ensure parsing reliability.
- Implementing developer mock fallbacks for external APIs.
- Flow composition: chaining routing logic, API calls, AI parsing, and formatting layers sequentially.

---

## Milestone 7: Client-side URL Analysis & Reading List Render

✓ Created `analyzeRepository` API fetch integration in `client/src/services/api.js` utilizing POST request bodies.
✓ Implemented loading, success, and error states inside React landing page (`client/src/App.jsx`).
✓ Programmed UI rendering grid that loops through AI reading arrays and generates beautiful file cards dynamically.
✓ Structured responsive style elements inside `App.css` (custom flex models, badges, error alerts, spinner animations).
✓ Successfully verified full user analysis path and dashboard generation via automated browser verification.

### Learned
- Constructing HTTP POST requests with structured request headers and JSON payloads.
- Managing React form events and loader spinner/busy states during pending promises.
- Mapping structured data arrays to JSX elements with unique keys in React.
- Writing modern CSS keyframes spinner animations.

---

## Milestone 8: UI Layout Refinements & Sync Scrolling

✓ Implemented metadata fetcher `fetchRepoMetadata()` in `github.service.js` querying repository stars and languages.
✓ Integrated metadata details into parallel `Promise.all` routes in `repo.routes.js`.
✓ Created "Try an example" button triggers in `App.jsx` auto-filling `freeCodeCamp`, `excalidraw`, or `supabase` repositories.
✓ Structured dashboard layout badges displaying stars count, main coding language, and total files count with **Re-scan** control button.
✓ Programmed scroll synchronization triggers in `App.jsx` using `useRef` mapping and active scroll ref lock guards to block scrolling events looping.
✓ Verified scroll alignment and metadata card UI loading using automated browser simulation pages.

### Learned
- Chaining concurrent HTTP calls using JavaScript `Promise.all` optimization routines.
- Creating input presets and auto-submitting handlers in React state workflows.
- Syncing independent scroll panel positions dynamically using React element references (`useRef`).
- Tracking focus guards to eliminate scroll loop feedback bounces in dual-column interfaces.

---

## Milestone 9: Dark Developer Theme & Hero Mockup Preview

✓ Configured new developer-themed color palette: deep navy background (`#0F172A`), bright blue CTA buttons (`#3B82F6`), and high-contrast light gray cards (`#F8FAFC`).
✓ Created static CSS/JSX **Product Preview Mockup** demonstrating the analysis layout (directory sidebar, source code container, and AI explanation panels) for immediate value pitching on load.
✓ Added a radial **Hero Glow** blur layer gradient (Blue ➔ Violet) centered behind the preview.
✓ Updated "Try examples" quick links (`React`, `Supabase`, `Excalidraw`) to align with the core specification.
✓ Verified UI layout rendering and screenshot logs using automated browser subagents.

### Learned
- Coordinating high-contrast element hierarchies inside Dark Mode schemes (light-colored cards on dark background).
- Designing lightweight, high-performance visual mockups inside React/CSS layouts without relying on heavy graphic assets.
- Applying CSS blur filters and radial background gradients to create modern glowing depth effects.

---

## Milestone 10: Developer Terminal Style Transition

✓ Overhauled theme variables inside `App.css` to adopt a solid pitch black background (`#000000`) and monospace font family (`Menlo`, `Monaco`, `Consolas`, `monospace`).
✓ Created ASCII-inspired landing page structure containing dashed dividers (`----------------------------------------------------`), simple text headings, and plain text borders.
✓ Redesigned the primary submit control as a minimalist bracket button: `[ Analyze Repository ]`.
✓ Structured example trigger presets inline with simple spacing: `React   Excalidraw   Supabase`.
✓ Stripped the mockup product preview illustration completely from the home page.
✓ Refactored dashboard metrics badges (`stars`, `language`, `filesCount`) and file items (using arrow bullets `→` and flat inline lists) to maintain the retro-hacking design.
✓ Verified solid black presentation and directory navigation using automated browser subagent pages.

### Learned
- Overcoming over-designed template pitfalls to create clean, developer-focused minimalist layouts.
- Structuring ASCII-like visual elements (dashed lines, bracketed buttons, monospace logs) using standard CSS text formatting.
- Transitioning complex state representations (like directories listings) into flat directory logs in high-contrast layouts.

---

## Milestone 11: Stripe-Inspired Premium Home & Cursor-Dark Workspace

✓ Implemented visual theme switching using view state classes (`.home-theme` and `.workspace-theme`) on the outer viewport wrapper.
✓ Programmed light Stripe-inspired home page layout featuring a solid off-white background (`#FCFCFD`), a faint radial dot-grid, sans-serif Inter headers, and high-contrast spacing.
✓ Restructured input as a large `60px` search bar (`border-radius: 16px`) with a GitHub SVG icon inside and monospace input styling.
✓ Designed a solid blue, rounded CTA button (`Analyze Repository →`) with clean click transitions and zero gradient glows.
✓ Mapped examples inline separated by bullets (`React • Excalidraw • Supabase`).
✓ Retained the dark, high-contrast, Cursor-inspired coding workspace for analyzed lists and scroll-synchronized code readers.
✓ Verified design transitions and logged screenshots using automated browser subagent page flows.

### Learned
- Implementing contextual view-swapping style containers in React component architectures.
- Constructing subtle background aesthetics (radial dot grids) with high performance using pure CSS.
- Enhancing developer tools by separating onboarding light layouts from dark, code-focused workspaces.











