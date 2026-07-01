# Questions & Reviews - FirstCommit

Tracks questions asked, common mistakes, and future improvements.

---

## Milestone 1: Workspace Setup

### Mentee Concept Check Questions & Answers
1. **Why keep dependencies separate in a monorepo?**
   - *Answer*: Client runs in the browser, while server runs in a Node environment on a machine. Browsers don't understand Node-specific APIs (like filesystem libraries, express servers), and servers don't need UI libraries (like React). Mixing them leads to bloated bundles, slower build times, and runtime crashes due to incompatible APIs.
2. **What is the job of the root `package.json` in an npm workspace?**
   - *Answer*: It serves as the orchestrator. It tells npm that the subfolders (like `server` and `client`) are "workspaces". When you run `npm install` at the root, npm traverses the subfolders and installs all their dependencies efficiently, often deduplicating packages.
3. **If you wanted to install a package specifically for the server, where would you run `npm install`?**
   - *Answer*: You should either navigate into the `server/` folder and run `npm install <package>`, or run it from the root using the workspace flag: `npm install <package> -w server`.


---

## Milestone 2: Express Server Setup

### Mentee Concept Check Questions & Answers
1. **If the client sends a request to our Express server containing a JSON body, what middleware is required for our route handler to read that data inside `req.body`?**
   - *Answer*: We need the `express.json()` middleware. It parses incoming requests with JSON payloads (text streams) and binds the resulting JavaScript object to `req.body`. Without it, `req.body` is `undefined`.
2. **Why do we want to separate the code that fetches data from GitHub into a separate "service" file rather than writing it directly inside the route handler?**
   - *Answer*: To maintain "Separation of Concerns". Keeping business logic (like talking to external APIs or databases) in a Service file keeps routes lightweight, reusable, and easy to test. If the external API shifts, we only modify the service file rather than multiple route handlers.

---

## Milestone 3: React Client Setup

### Mentee Concept Check Questions & Answers
1. **Why is Vite faster than Create React App (CRA) during development?**
   - *Answer*: CRA uses Webpack, which bundles the entire application code before serving it. Vite leverages Native ES Modules in modern browsers to build and transpile files on-demand (only loading the active files you request in the browser), resulting in near-instant hot-reloading and starting times.
2. **What is the difference between "State" and "Props" in React?**
   - *Answer*: State is managed locally inside a component and is mutable (e.g. tracking URL inputs or button click counts). Props are passed down from parent components to children and are read-only (immutable) to the child component.

---

## Milestone 4: Client ↔ Server Communication

### Mentee Concept Check Questions & Answers
1. **If you make a network request using `fetch()`, why does it return a "Promise" instead of returning the raw data immediately?**
   - *Answer*: Network requests are asynchronous operations that take time to complete. Because JavaScript is single-threaded, waiting synchronously for a server response would freeze the entire browser window (making the page unresponsive). A Promise is returned immediately as a placeholder representing this future value, allowing the rest of the UI thread to remain smooth and interactive.
2. **Why do we group all our fetch functions into a single file (`client/src/services/api.js`) instead of writing the `fetch()` calls directly inside our button click handlers in `App.jsx`?**
   - *Answer*: For modularity and maintenance. Centralizing API requests isolates the network logic from UI layout components. It avoids duplicating the base URL, makes adding features like global error handling or authorization headers simple, and allows us to test or modify endpoints without editing visual rendering files.

---

## Milestone 5: GitHub API Integration

### Mentee Concept Check Questions & Answers
1. **Why does the GitHub API require us to parse the URL (extracting the owner and repository names) instead of just letting us send the whole URL to them?**
   - *Answer*: The GitHub API has structured REST endpoints (e.g. `GET /repos/{owner}/{repo}/git/trees/{sha}`). It does not perform fuzzy searches on generic URLs. We must parse the link to extract the correct resource keys (`owner` and `repo`) and fit them into their API route schema parameters.
2. **What is the benefit of storing our GitHub Personal Access Token in `.env` rather than directly inside `github.service.js`?**
   - *Answer*: Separates keys and credentials from code logic, preventing secret leakage on GitHub. It also allows developers to configure their own tokens locally without editing code files.

---

## Milestone 6: AI-Generated Read Order (Server-side)

### Mentee Concept Check Questions & Answers
1. **Why do we want the LLM to return data in JSON format instead of a plain text description?**
   - *Answer*: Program scripts cannot easily parse conversational text. Forcing the model to return valid JSON (e.g., an array of file objects) allows our server and client systems to parse it instantly via `JSON.parse()` and map it directly to React components for display.
2. **In our data flow, where does the call to the AI service happen—on the React Client side, or the Express Server side? Why?**
   - *Answer*: On the Express Server side. Storing and calling API keys (like Gemini or OpenAI keys) on the browser client exposes them to users via inspection tools, leading to rate limits depletion or billing theft. Keeping it on the server keeps credentials secure and allows caching in the future.

---

## Milestone 7: Client-side URL Analysis & Reading List Render

### Mentee Concept Check Questions & Answers
1. **Why must we set `'Content-Type': 'application/json'` in our headers when sending a POST request with a body?**
   - *Answer*: It tells the receiving server how to parse and decode the raw text stream inside the HTTP request body. Without it, the server's body-parsing middleware (`express.json()`) doesn't know the body is JSON and won't decode it, leaving `req.body` as `undefined` or empty.
2. **When rendering a list of elements in React (like our reading list cards) using `.map()`, why does React require us to add a unique `key` prop to the outer element?**
   - *Answer*: React uses the `key` prop to identify which items have changed, been added, or been removed in the Virtual DOM. Without unique keys, React cannot perform efficient rendering updates and must reconstruct the entire list from scratch, which slows down performance and can cause focus or state bugs in the UI.

---

## Milestone 8: UI Layout Refinements & Sync Scrolling

### Mentee Concept Check Questions & Answers
1. **Why do we use `Promise.all()` to query the repository tree structure and repository metadata concurrently instead of running them sequentially?**
   - *Answer*: If we query sequentially, the second request must wait for the first to resolve, doubling response latency. `Promise.all` triggers both network requests in parallel over separate TCP streams, so the server only blocks for the duration of the slowest request, reducing load times.
2. **How does tracking hovered containers with `activeScrollRef.current` prevent scrolling event loops in synchronized scroll containers?**
   - *Answer*: When panel A updates panel B's `scrollTop`, panel B's `onScroll` event listener naturally fires, which would normally trigger an update back to panel A, setting off an infinite feedback loop. By verifying that the scrolled container matches `activeScrollRef.current` (which is updated strictly on `onMouseEnter`), we prevent B from echoing scroll events back to A.

---

## Milestone 9: Dark Developer Theme & Hero Mockup Preview

### Mentee Concept Check Questions & Answers
1. **Why do we use HTML/CSS elements to build our Product Preview Mockup instead of just saving a screenshot image (like mockup.png) in the repository?**
   - *Answer*: Using HTML/CSS elements is much better for performance, responsiveness, and sharpness. A screenshot image can be large, slowing down the page load. An HTML/CSS mockup scales automatically to fit mobile or desktop screens and text remains perfectly crisp on high-resolution Retina displays, while an image might get pixelated or require multiple versions.
2. **When styling a dark-themed application, what is the value of using a light-colored background (like `#F8FAFC`) specifically for card components?**
   - *Answer*: It creates visual depth and a clear structural hierarchy. By placing high-contrast light-colored cards on top of a dark navy background, we define a clear focal point, instantly drawing the user's attention to the primary content (like the recommended reading list file cards).

---

## Milestone 10: Developer Terminal Style Transition

### Mentee Concept Check Questions & Answers
1. **What is "SaaS template fatigue" and why are command-line/ASCII styled interfaces popular in modern developer tools?**
   - *Answer*: SaaS template fatigue is when users get tired of seeing the exact same modern landing page styles (soft gradients, floating rounded cards, generic mockups) across every product. Monospaced ASCII terminal designs feel authentic, functional, fast, and signal to developers that the tool is built for core code utility rather than marketing presentation.
2. **How does standard CSS handle monospace ASCII borders (like `----------------------`) dynamically without breaking screen wrap boundaries?**
   - *Answer*: By using `user-select: none` to prevent copy errors, set a solid monospace typography `font-family: var(--mono)`, and ensure borders wrap or hide correctly. We can also style elements as simple text borders to scale with the wrapper container elements.









