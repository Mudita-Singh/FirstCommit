# Commands Reference - FirstCommit

This file tracks every command used during the project and what it does.

---

## Milestone 1: Initialization

No CLI commands have been run yet, as we manually created the root workspace files to prevent generating garbage files. In future steps, we will log commands like `npm init`, `npm install`, and running servers.

---

## Milestone 2: Express Server Setup

### Installation & Initialization
*   `npm install`
    *   *Purpose*: Run from the root directory to read the root `package.json` workspaces configuration. It scans all subfolders listed under workspaces (`server/` and `client/`) and installs their packages into a central `node_modules` folder in the root, avoiding package duplication.

### Running Development Servers
*   `npm run dev` (run from the root directory)
    *   *Purpose*: Starts **both** the client and server development processes concurrently in a single terminal session using `concurrently`.
*   `npm run dev:server` (run from the root directory)
    *   *Purpose*: Starts the Express backend development server in watch mode using Nodemon.
*   `npm run dev:client` (run from the root directory)
    *   *Purpose*: Starts the Vite React frontend development server on port `5173`.



### Testing Endpoints
*   `Invoke-RestMethod -Uri http://localhost:5000/api/health`
    *   *Purpose*: A PowerShell cmdlet that sends an HTTP request to the local Express server and automatically parses the JSON response into a formatted object table in the console.

---

## Milestone 3: React Client Setup

### Project Creation
*   `npx -y create-vite@latest --help`
    *   *Purpose*: Displays the command line parameters and templates available in the latest version of `create-vite`.
*   `mkdir client`
    *   *Purpose*: Creates the folder structure in the workspace root to hold the client application.
*   `npx -y create-vite@latest ./ --template react --no-interactive`
    *   *Purpose*: Run from inside the `client/` directory to bootstrap a React application using Vite without prompting the user for input.

### Installation
*   `npm install`
    *   *Purpose*: Executed at the root directory to download and link all React client dependencies inside the root workspaces repository.

### Running Dev Server
*   `npm run dev` (run from the `client/` directory)
    *   *Purpose*: Boots the Vite server locally on port `5173`. We run this directly inside the folder rather than via the root `-w` flag on Windows to prevent path-resolution issues with the global CLI runner.

---

No new installation commands were run, but we created the client fetching module `client/src/services/api.js` and wired it into `App.jsx` using `useEffect`. We confirmed that when the React app runs in the browser, it successfully sends an HTTP GET request to `http://localhost:5000/api/health` and displays the connection success indicator.

---

## Milestone 5: GitHub API Integration

### Testing Repo Structure API Endpoint
*   `Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/repo/structure -ContentType "application/json" -Body '{"url":"https://github.com/octocat/Spoon-Knife"}'`
    *   *Purpose*: Sends an HTTP POST request to our server containing a repository URL in the JSON body, and prints the returned structure (owner, repo name, total files count).
*   `$res = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/repo/structure -ContentType "application/json" -Body '{"url":"https://github.com/octocat/Spoon-Knife"}'; $res.data.files | Format-Table`
    *   *Purpose*: Queries the repository structure endpoint, stores the results in a PowerShell variable `$res`, and formats the parsed list of code files (showing paths, sizes, and raw URLs) as a neat table.

---

## Milestone 6: AI-Generated Read Order (Server-side)

### Installation
*   `npm install @google/generative-ai -w server`
    *   *Purpose*: Installs the Google Generative AI SDK inside the `server/` workspace directory, registering the dependency in `server/package.json`.

### Testing AI Analysis Output
*   `$res = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/repo/structure -ContentType "application/json" -Body '{"url":"https://github.com/octocat/Spoon-Knife"}'; $res.data.readingList | Format-Table`
    *   *Purpose*: Calls the analysis endpoint which fetches Spoon-Knife files, pipes them through the AI service, and displays the structured reading list array (paths, explanations, reasons) returned by the server.






