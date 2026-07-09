# Z.ai Local Coding Assistant

Professional Browser-Based AI Coding Dashboard and Project Builder.

## Overview

The **Z.ai Local Coding Assistant** is an advanced MERN-stack developer tool designed to bridge the gap between natural language prompts and fully functional, locally testable web applications. Instead of generating raw, detached code snippets that the user has to copy-paste and configure, this application acts as an autonomous software agent.

### What it solves
Developing custom interfaces or landing pages often requires setting up scaffolding, styling configurations, package installations, and routes—even for simple proof-of-concept projects. The Z.ai Local Coding Assistant automates this entire pipeline. Users can input a single natural language description, and the application handles specifications analysis, directory scaffolding, code generation, package installations, error validation, and code-repair, presenting a complete runnable project with an instant live preview sandbox and an option to download the source code as a ZIP archive.

### Main Capabilities
*   **AI-Powered Project Specification:** Parses prompts into structured project blueprints containing folder structures, component dependencies, and design tokens.
*   **Deterministic Code Scaffolding:** Seeds configuration files (Vite configs, Tailwind stylesheets, postcss configurations) based on standard blueprints.
*   **Resilient Generation Pipeline:** Incorporates provider routing with fallback failover to ensure generations proceed even if primary model rate-limits or timeouts occur.
*   **Automated Validation and Targeted Repair:** Validates project code for syntax anomalies, undeclared package imports, or missing files, and batches corrective edits dynamically.
*   **Live Preview Sandbox:** Spawns isolation-safe web preview servers directly on the host machine and streams live port interfaces back to the browser.
*   **Complete ZIP Downloads:** Packages generated projects into standardized ZIP files for immediate extraction and use.

---

## Key Features

*   **User Authentication & Security:** User registration, password hashing (via `bcryptjs`), and secure login.
*   **JWT Authorization & Multi-tenant Isolation:** Authenticated API routing via JWT middleware. Projects and preview sandboxes are isolated strictly by owner; users cannot view, edit, download, or run previews for another user's project.
*   **AI-Powered Requirement Analysis:** Translates natural language descriptions into strict JSON specifications.
*   **Strategy-Aware Code Generation:** Plans generation chunks (either single-shot `SCAFFOLD_AI`, concurrent `PARALLEL`, or `CHUNKED` strategies) based on file coupling and codebase size.
*   **Dual-Provider Routing & Fallback:** Uses OpenRouter as the primary AI service provider, falling back automatically to the Z.ai endpoint during network, socket, timeout (`ECONNABORTED`), or rate-limiting (`429`) failures.
*   **Transient Retry Backoff:** Handles transient connection dropouts or provider safety flags (`"User Safety: safe"`) with jittered exponential backoffs.
*   **JSX Syntax and HTML closing tag check:** Validates files for JSX formatting errors (like dynamic `<{variable}` patterns or malformed HTML closing tags like `</h1 testing>`).
*   **Automated Targeted Repair:** Identifies errors and missing imports, batching them into targeted code-repair operations (up to 3 files per API call) to stay within model token budgets.
*   **Automated Installation & Build Verification:** Runs `npm install` and `npm run build` in the temporary workspace to guarantee compilation success.
*   **Live Preview Service Sandbox:** Manages local Vite dev processes. Supports Windows-specific `.cmd` execution, sanitizes environment values, and reads Vite's stdout/stderr streams to instantly capture port readiness.
*   **Robust Directory Teardown:** Cleans up preview environments using delayed retry loops to bypass Windows file locks (`EPERM` errors).
*   **Project History:** Persistent database indexing of generated projects and prompts using MongoDB.
*   **Comprehensive Test Coverage:** Features localized unit tests, database-direct integration tests, and full E2E validation scripts.

---

## Tech Stack

### Frontend
*   **React 18:** Functional library layout with custom hooks.
*   **Vite:** High-performance frontend toolchain.
*   **Tailwind CSS v3:** Core styling engine.
*   **React Router Dom v6:** Client-side navigation.
*   **React Syntax Highlighter & React Markdown:** Renders code viewers and markdown documentation.

### Backend
*   **Node.js & Express:** Scalable event-driven web backend using CommonJS module structures.
*   **Nodemon:** Developer watcher utility.
*   **Adm-zip:** Direct zip archiving library.
*   **Axios:** HTTP client for external AI completions.

### Database
*   **MongoDB:** Document-oriented database for projects, users, and logs.
*   **Mongoose:** ODM library enforcing structured model definitions and validation logic.

### Authentication
*   **JSON Web Tokens (JWT):** Generates signed bearer tokens for session identification.
*   **Bcryptjs:** Enforces one-way cryptographic hashing of user passwords before database storage.

### AI Providers and Models
*   **Primary Provider:** OpenRouter API (`google/gemini-2.5-flash` or configurable free models).
*   **Fallback Provider:** Z.ai API (`glm-4.5-flash`).
*   **Failover Logic:** Automatically routes completion requests to the fallback provider if the primary provider times out, fails rate-limit limits, or yields safety classification refusals.

### Development and Testing Tools
*   **Mocha & Custom Assertions:** Used to build database-direct test suites and unit regressions.
*   **Cross-Env & Dotenv:** Inject configurations from local `.env` files safely into runtime.

---

## System Architecture

```
User (Browser)
    │
    ▼
React Frontend (Workspace / BuildOptions / Preview)
    │  (JWT Authenticated JSON / Event Streams)
    ▼
Express API Router (/api/auth, /api/project, /api/history, /api/ai)
    │
    ▼
Auth Middleware (JWT validation, req.user assignment)
    │
    ├───────────────────────► MongoDB (Users, Projects, History)
    ▼
Project Controller
    │
    ▼
Project Service (Orchestrates requirement analysis & generation)
    │
    ├─► Requirement Analysis (Parses prompt to spec)
    ├─► Generation Planner (SCAFFOLD_AI vs PARALLEL strategy)
    │
    ▼
Provider Router
    │
    ├─► Primary Provider (OpenRouter API) ──[429/Timeout/Error]──► Fallback Provider (Z.ai API)
    │
    ▼
Validation & Repair Pipeline
    │
    ├─► validationProfiles.js (Verifies JSX syntax, imports, dependencies, files)
    ├─► targetedRepairService.js (Batches up to 3 corrupted files for AI repair)
    │
    ▼
Install & Build Verification
    │
    ├─► Spawns 'npm install' in temp directory
    ├─► Spawns 'npm run build' to verify bundle compilation
    │
    ▼
Live Preview Service (previewService.js)
    │
    ├─► Spawns Vite dev server ('npm run dev') on random port
    ├─► Reads stdout/stderr for Vite ready triggers
    ├─► Exposes sandbox endpoint back to React frontend
    │
    ▼
ZIP Downloader (adm-zip)
```

---

## Complete Application Flow

1.  **User Entry:** User opens the React application. Unauthenticated users are redirected to the `/login` page.
2.  **Registration / Login:** The user registers a new account or logs in. Backend hashes passwords using Bcrypt and saves credentials to MongoDB.
3.  **Token Issuance:** Backend returns a signed JWT. The frontend caches it in `localStorage` and loads the User context.
4.  **Authorized Requests:** All protected requests include the JWT in the `Authorization: Bearer <token>` header.
5.  **Submit Prompt:** The user enters a project prompt (e.g. *"Scaffold a simple React landing page for a gym website"*).
6.  **Requirement Analysis:** The backend sends the prompt to the Provider Router. The router tries OpenRouter, falling back to Z.ai if necessary. The AI returns a JSON specification.
7.  **Specification Extraction:** The backend parses the JSON schema containing routes, components, and Tailwind config parameters.
8.  **Strategy Selection:** The Generation Planner analyzes the complexity of the specification and assigns it a generation strategy (e.g., `SCAFFOLD_AI` for unified workspace file generation).
9.  **Scaffolding & File Generation:** The backend creates folders locally, generates static configs, and issues completion calls to write react code.
10. **File Validation:** The generated codebase is fed to `validationProfiles.js`, checking for undeclared package imports, missing files, or syntax faults.
11. **Targeted Repair:** If errors are found, the `targetedRepairService.js` batches the affected code and prompt into correction requests.
12. **Completeness Check:** Ensures that entry files (`main.jsx`, `App.jsx`, `index.css`) exist in the generated list.
13. **Local Setup Injection:** The generated project is written to a temporary build sandbox. Backend spawns a child process executing `npm install`.
14. **Compilation Verification:** Spawns `npm run build` to verify the project builds without esbuild errors.
15. **Preview Launch:** If the build passes, `previewService.js` spawns a local server using a randomly selected open port.
16. **Ready State Interception:** The service parses stdout/stderr for Vite's startup banner (`Local:` or `ready in`) to flag the server as live.
17. **Preview Streaming:** The frontend renders the sandbox URL in an `<iframe>` inside the workspace panel.
18. **History Storage:** The generated project blueprint is indexed in MongoDB under the user's ID.
19. **Project Packaging:** If the user clicks "Download ZIP", the backend packages the files using `adm-zip` and streams it as an attachment.
20. **Teardown & Cleanup:** When the user closes the workspace, the backend kills the preview processes and deletes temporary files.

---

## Project Folder Structure

```
z.AI/
├── backend/                    # Backend API application
│   ├── config/                 # Database configuration files
│   │   └── db.js               # MongoDB connection setup
│   ├── controllers/            # Request controllers
│   │   ├── aiController.js     # Chat endpoints
│   │   ├── authController.js   # Registration, Login, Profiles
│   │   ├── historyController.js# User project history log controllers
│   │   └── projectController.js# Project generation, download, and preview controllers
│   ├── middleware/             # Express middlewares
│   │   └── authMiddleware.js   # JWT authentication verification
│   ├── models/                 # Database model schemas
│   │   ├── History.js          # Chat / prompt logs
│   │   ├── Project.js          # Project structure storage
│   │   └── User.js             # User account structures
│   ├── routes/                 # Express API endpoints
│   │   ├── aiRoutes.js
│   │   ├── authRoutes.js
│   │   ├── historyRoutes.js
│   │   └── projectRoutes.js
│   ├── services/               # Core application logic & AI services
│   │   ├── aiGenerationExecutor.js # Runs completions, parses files, tracks limits
│   │   ├── aiProviders/        # AI Adapter patterns
│   │   │   ├── openRouterProvider.js
│   │   │   └── zaiProvider.js
│   │   ├── contractBuilder.js  # Maps specification structures
│   │   ├── generationOrchestrator.js # Orchestrates scaffold, generation, repair cycles
│   │   ├── generationPlanner.js# Assigns strategy bounds
│   │   ├── previewService.js   # Spawns sandbox previews and kills processes
│   │   ├── projectService.js   # Runs requirements analysis JSON parsing
│   │   ├── scaffoldRegistry.js # Houses default configurations and template metadata
│   │   ├── targetedRepairService.js # Runs correction batches for buggy code
│   │   └── validationProfiles.js # Validates file lists, JSX tags, and imports
│   ├── utils/                  # Helper utilities
│   ├── package.json            # Node backend config and scripts
│   ├── server.js               # Express entrypoint
│   └── test_*.js               # Automated unit, integration, and E2E tests
│
├── frontend/                   # React web application
│   ├── src/                    # Frontend React app source
│   │   ├── components/         # Reusable UI widgets
│   │   │   ├── BuildOptions.jsx# Prompt tuning configurations
│   │   │   ├── CodeBlock.jsx   # Highlighted code viewer
│   │   │   ├── GeneratedProjectPanel.jsx # Main project workspace viewport
│   │   │   ├── HistoryDrawer.jsx # Drawer displaying past generations
│   │   │   ├── MessageBubble.jsx # Chat bubbles with action buttons
│   │   │   ├── ProfileModal.jsx # User credentials editor
│   │   │   ├── ProtectedRoute.jsx # Route-guard checking JWTs
│   │   │   └── Sidebar.jsx     # Side navbar panel
│   │   ├── context/            # Global state context files
│   │   │   └── AuthContext.jsx # Handles user login, profile update, and JWT logic
│   │   ├── pages/              # Main routing pages
│   │   │   ├── Login.jsx       # Login form with transitions
│   │   │   ├── Register.jsx    # Registration form
│   │   │   └── Workspace.jsx   # Primary developer dashboard
│   │   ├── services/           # Axios API connectors
│   │   │   ├── api.js          # Base axios handler with header attachments
│   │   │   ├── authService.js  # Authentication endpoints
│   │   │   ├── historyService.js # User logs retrieval
│   │   │   └── projectService.js # Generation and preview trigger utilities
│   │   └── App.jsx             # React routing setup
│   └── package.json            # Vite frontend configuration
└── README.md                   # This project manual
```

### Major Backend Services

*   **Project Service ([projectService.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/projectService.js)):** Executes requirement analysis completions, parses markdown JSON content cleanly, and handles transient errors with a 3-attempt recovery cycle.
*   **AI Generation Executor ([aiGenerationExecutor.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/aiGenerationExecutor.js)):** Triggers code modules generation, parses file content blocks (`--- FILE: ... ---`), and safeguards against empty or safety-refused completions.
*   **Provider Router ([aiProviders/](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/aiProviders/)):** Enforces dual-adapter routing. Connects to OpenRouter or Z.ai dynamically, classifying errors (such as 429 and ETIMEDOUT) to guide transient retries and fallback operations.
*   **Validation Profiles ([validationProfiles.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/validationProfiles.js)):** Tests generated files against syntax rules, undeclared packages, and React Vite plugin structures.
*   **Targeted Repair Service ([targetedRepairService.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/targetedRepairService.js)):** Batches compilation or syntax errors into groups of ≤3 files, prompting models to repair defects within constrained token limits.
*   **Preview Service ([previewService.js](file:///c:/Users/LENOVO/OneDrive/Desktop/z.AI/backend/services/previewService.js)):** Mounts generated files in local folders, resolves OS child execution formats, binds processes to random ports, and tracks readiness directly from console stdout streams.

---

## Prerequisites

To run this application locally, ensure you have the following installed:
*   **Node.js:** v18.x or v20.x (LTS recommended)
*   **npm:** v9.x or later
*   **MongoDB:** Local installation running on port `27017` or a MongoDB Atlas connection URI.
*   **Git:** Required to clone and track changes.
*   **AI API Credentials:** OpenRouter API Key (primary) and Z.ai API Key (fallback) to run code generation.

---

## Environment Variables

### Backend Environment Variables
Create a file named `backend/.env` containing the following values (do not commit this file to git):

| Variable | Required | Purpose | Example Placeholder |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional | Port for the backend API server. Defaults to 5000. | `5000` |
| `MONGO_URI` | Required | Connection string for MongoDB database instance. | `mongodb://localhost:27017/zai` |
| `JWT_SECRET` | Required | Secure secret string used to sign session JWTs. | `your_jwt_signing_secret_key` |
| `AI_PRIMARY_PROVIDER`| Optional | Primary provider adapter to execute completions. | `openrouter` |
| `AI_FALLBACK_PROVIDER`| Optional | Fallback provider adapter when primary fails. | `zai` |
| `OPENROUTER_API_KEY` | Optional | API Key for OpenRouter completion requests. | `sk-or-v1-placeholder-token` |
| `OPENROUTER_MODEL` | Optional | Model identifier to run on OpenRouter. | `google/gemini-2.5-flash` |
| `ZAI_API_KEY` | Optional | API Key for Z.ai fallback completions. | `sk-zai-placeholder-token` |
| `ZAI_BASE_URL` | Optional | Endpoint URL for the Z.ai PaaS system. | `https://api.z.ai/api/paas/v4` |
| `ZAI_MODEL` | Optional | Model identifier for Z.ai completions. | `glm-4.5-flash` |

### Frontend Environment Variables
Create a file named `frontend/.env` containing the following configurations:

| Variable | Required | Purpose | Example Placeholder |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | Required | Absolute base route for the backend Express API. | `http://localhost:5000/api` |

*Note: Vite requires variables to be prefixed with `VITE_` to be bundled and accessible in client-side code.*

---

## Local Installation and Setup

Follow these steps to configure and run the application locally on your machine:

### 1. Clone the Repository
```powershell
git clone <repository-url>
cd z.AI
```

### 2. Configure Backend Setup
Navigate to the backend directory, install its node modules, copy the environment template, and configure variables:
```powershell
cd backend
npm install
Copy-Item .env.example .env
```
Open `backend/.env` in your text editor and fill in your actual `MONGO_URI`, `JWT_SECRET`, and API credentials (`OPENROUTER_API_KEY`, `ZAI_API_KEY`).

### 3. Configure Frontend Setup
Navigate to the frontend directory, install its node modules, copy the environment template:
```powershell
cd ../frontend
npm install
Copy-Item .env.example .env
```
Ensure `frontend/.env` correctly points to the backend port (`http://localhost:5000/api`).

### 4. Ensure Database Connectivity
Start your local MongoDB instance or ensure that your MongoDB Atlas cluster is accessible.

### 5. Launch Backend Server
In the backend directory, run:
```powershell
cd ../backend
npm run dev
```
The console will display:
`Server running on port 5000`
`Connected to MongoDB`

### 6. Launch Frontend Client
Open a separate terminal window, navigate to the frontend directory, and run:
```powershell
cd frontend
npm run dev
```
The console will display:
`  VITE v5.2.11  ready in XX ms`
`  ➜  Local:   http://localhost:5173/`

### 7. Open the Application
Navigate to `http://localhost:5173` in your browser.

---

## Quick Start

Run the application quickly with this terminal sequence (execute in separate terminals):

**Terminal 1 (Backend API):**
```powershell
cd backend
npm run dev
```

**Terminal 2 (Frontend Client):**
```powershell
cd frontend
npm run dev
```

---

## How to Use the Application

1.  **Register an Account:** Open `http://localhost:5173`, click **Register**, fill in your credentials, and click submit.
2.  **Log In:** Enter your registered email and password to log in.
3.  **Enter Prompt:** On the main dashboard workspace, locate the **Prompt Composer** at the bottom.
4.  **Enter Example Prompt:** Type:
    `Create a React login page using Tailwind CSS.`
5.  **Build Project:** Click the **Generate / Build** button.
6.  **Track Generation Steps:**
    *   **Plan Tab:** Displays the AI-generated requirements plan, component hierarchies, and selected layout contracts.
    *   **Files Tab:** Displays the generated workspace code. You can browse through individual files (like `App.jsx`, `index.css`, configurations) dynamically.
    *   **Live Preview Tab:** Displays the live rendering of the sandbox once dependency installation (`npm install`) and verification builds succeed.
7.  **Explore the Preview:** Interact with the generated app inside the preview frame.
8.  **Download Source Code:** Click **Download ZIP** at the top right of the generated project panel to fetch the complete standalone package.
9.  **History Panel:** Access the sidebar and click **History** to review past project builds and prompt logs.
10. **Logout:** Click **Logout** in the bottom sidebar configuration panel.

---

## Generated Project Lifecycle

```
User Prompt (e.g. Gym Landing Page)
        │
        ▼
1. Analyze Specification (Requirement Analysis JSON spec)
        │
        ▼
2. Generation Strategy Planning (SCAFFOLD_AI vs PARALLEL strategy)
        │
        ▼
3. Scaffolding Injection (vite.config.js, tailwind.config.js, postcss.config.js, index.html)
        │
        ▼
4. Modules Code Generation (App.jsx, main.jsx, components, pages)
        │
        ▼
5. Validation Check (Syntax check, dynamic expressions validator, import check)
        │
        ├─► [Failure] ──► 6. Targeted Repair (Repair up to 3 files concurrently, max 2 runs)
        ▼
7. Build Setup (Writes project files to backend/temp_previews/project_id)
        │
        ▼
8. Dependency Installation (npm install child process execution)
        │
        ▼
9. Build Verification (npm run build to check compilation)
        │
        ▼
10. Sandbox Spawn (Spawns Vite preview server on random free port)
        │
        ▼
11. Readiness Detection (Parses console stdout/stderr for ready markers)
        │
        ▼
12. Stream URL to Frontend / Download ZIP packaging (via adm-zip)
        │
        ▼
13. Cleanup & Teardown (Kills child process, recursive folder removal with lock recovery delay)
```

---

## AI Provider Routing and Fallback

Completions are sent through a failover router wrapper designed to shield operations from rate limits or transient outages:
*   **Adapter Pattern:** Adapters map payloads to the specific APIs of OpenRouter and Z.ai.
*   **Failover Route:** OpenRouter acts as the primary AI service provider. If it returns an HTTP `429` (Rate-limited), connection timeouts, or throws `ECONNABORTED`, the router transparently triggers fallback to Z.ai.
*   **Content Guarding:** If a completion returns an empty message, or throws safety filtering classifications (like `"User Safety: safe"`), it is classified as a transient model failure. The router triggers a 2-second delay, retrying the prompt configuration up to 3 times before failing or shifting providers.
*   **Parsing Safety:** All JSON payloads are checked for surrounding markdown ticks (` ```json `), and regex filters clean strings prior to `JSON.parse` blocks.

---

## Validation and Repair Pipeline

Before a codebase is sent for installation, it goes through validation checks:
1.  **Completeness Invariant:** Validates that essential files (`src/main.jsx`, `src/App.jsx`, `src/index.css`) exist in the generated bundle.
2.  **Import Schema Checking:** Scans imports in `.jsx` files. Any relative imports must map cleanly to paths defined in the project specification contract.
3.  **JSX Syntax Checking:** Scans for dynamic components incorrectly mapped using `<{expression} />` formats, enforcing capital variable rules instead.
4.  **Closing Tag Parser:** Uses regex scanners (`/<\/([a-zA-Z0-9]+)\s+[^>]+>/`) to intercept malformed closing tags containing attributes or text (like `</h1 testing>`) which break compilation.
5.  **Targeted Repair:** Errors are mapped back to their originating files. The `targetedRepairService` sends the affected files and compiler errors back to the model in batches of ≤3 files, running up to 2 repair iterations.

---

## Live Preview Architecture

The Live Preview sandbox executes generated codebases safely on the host machine:
*   **Sandbox Isolation:** Generated codebases are written to individual folders named `backend/temp_previews/<project_id>`.
*   **Windows Binary Wrapper Mappings:** Since Windows executes command shell binaries differently than POSIX platforms, the service intercepts executions, mapping calls to their `.cmd` counterparts (`npm.cmd` / `npx.cmd`) to prevent `spawn EINVAL` crashes.
*   **Environment String Sanitization:** The runner sanitizes `process.env` structures, converting values strictly to string strings prior to execution.
*   **Ready-State stdout parser:** Instead of running CPU-heavy URL get requests to test if the Vite server is ready, the preview manager captures Vite's console streams, triggering ready states the instant `Local:` or `ready in` flags are written.
*   **Lock recovery delay:** When stopping a sandbox, the system kills node child handles and executes a 4-attempt recursive directory removal loop with a 500ms delay. This ensures directories are deleted cleanly once Windows releases file locks.

---

## API Documentation

### Authentication APIs
All routes are sub-divided under `/api/auth`:

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | No | Creates a new user profile. Returns user metadata and JWT token. |
| `POST` | `/login` | No | Log in with email and password. Returns user profile and JWT. |
| `GET` | `/profile` | Yes | Retrieves authenticated user profile details. |
| `PUT` | `/profile` | Yes | Updates profile details (name, email, or password). |

### AI APIs
All routes are sub-divided under `/api/ai`:

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/chat` | Yes | Standard chat completion interface using the configured provider. |

### Project APIs
All routes are sub-divided under `/api/project`:

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/analyze` | Yes | Parses natural language prompt into specification JSON. |
| `POST` | `/generate` | Yes | Triggers the build planner, file generation, and repair pipelines. |
| `GET` | `/:projectId` | Yes | Retrieves structured code files and settings for a project. |
| `GET` | `/:projectId/download`| Yes | Generates and downloads a ZIP archive of the project codebase. |

### Preview APIs
Sub-routes under `/api/project` handling the sandbox runtime lifecycle:

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/:projectId/preview`| Yes | Spawns npm install and launches the sandbox Vite server. |
| `GET` | `/:projectId/preview/status`| Yes | Returns port numbers and ready status details. |
| `DELETE`| `/:projectId/preview`| Yes | Shuts down Vite servers and deletes temporary preview files. |

### History APIs
All routes are sub-divided under `/api/history`:

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Yes | Saves a new project chat history entry. |
| `GET` | `/` | Yes | Retrieves all historical entries for the authenticated user. |
| `GET` | `/:id` | Yes | Retrieves a specific history entry. |
| `DELETE`| `/:id` | Yes | Deletes a historical entry. |

---

## Authentication and Authorization Flow

```
Register Request (User Credentials)
      │
      ▼
Password Hashed via bcryptjs (10 rounds) ──► Stored in MongoDB (User Model)
      │
      ▼
Login Request ──► Compared against hash ──► Signed JWT Token Issued
                                                 │
                                                 ▼
Protected Route Request ──► Authorization Header Bearer <JWT>
                                                 │
                                                 ▼
                                     JWT verify Middleware
                                                 │
                                                 ▼
                                  Assign user payload (req.user)
                                                 │
                                                 ▼
                                   Project Owner Validation
                            (req.user.id must match project.userId)
                                                 │
                                                 ├─► [Match] ──► Execute Controller
                                                 └─► [Mismatch] ─► Return 403 Forbidden
```

---

## Database Models

### User Model (`User.js`)
*   **Purpose:** Houses credentials and access permissions for users.
*   **Key Fields:**
    *   `name` (String, Required)
    *   `email` (String, Required, Unique, Lowercase)
    *   `password` (String, Required, Minimum 6 chars)
*   **Behaviors:** Encrypts password on creation/modification via a pre-save hook and exposes a `comparePassword` method.

### Project Model (`Project.js`)
*   **Purpose:** Stores metadata, specifications, and code files for generated codebases.
*   **Key Fields:**
    *   `userId` (ObjectId, ref: 'User', Required)
    *   `projectName` (String, Required)
    *   `projectType` (String)
    *   `files` (Array of `{ name, content }` objects)
    *   `runInstructions` (Object containing prerequisites, steps, URLs)
    *   `projectSpec` (Mixed schema JSON)
*   **Behaviors:** Direct relation to User. Ownership isolation queries inspect this model.

### History Model (`History.js`)
*   **Purpose:** Records log metrics, prompt histories, and reference links to generated codebases.
*   **Key Fields:**
    *   `userId` (ObjectId, ref: 'User', Required)
    *   `prompt` (String, Required)
    *   `response` (String, Required)
    *   `type` (String, Enum: `["chat", "code", "project"]`)
    *   `projectId` (ObjectId, ref: 'Project')
*   **Behaviors:** Automatically cleans user dashboards on load by populating structured log cards.

---

## Available npm Scripts

### Backend Scripts
Run these commands from the `backend/` directory:

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `dev` | `nodemon server.js` | Launches API server in watch-mode, auto-restarting on changes. |
| `start` | `node server.js` | Runs the API server in standard production mode. |

### Frontend Scripts
Run these commands from the `frontend/` directory:

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `dev` | `vite` | Starts local Vite dev server. Exposes client at `localhost:5173`. |
| `build` | `vite build` | Compiles the React application into optimized static assets under `dist/`. |
| `preview`| `vite preview` | Runs a local server to preview the production build locally. |

---

## Testing

The codebase includes automated tests to verify functionality:

### 1. Unit & Regression Tests
Validates the generation planner, contract builder, fallback router, path safety sanitizers, and validation profiles. Runs locally using mocked AI responses.
```powershell
cd backend
node test_adaptive_engine.js
```

### 2. Authentication & Authorization Integration Tests
Verifies account creation, login, JWT validation, and multi-tenant security isolation. Connects to your live MongoDB database instance.
```powershell
cd backend
node test_auth_integration.js
```

### 3. Master End-to-End (E2E) Generation Tests
Runs the complete project builder lifecycle: requirement analysis, template generation, JSX syntax checks, package installations, compilation testing, and preview server sandboxing.
```powershell
cd backend
node test_e2e_generation.js
```
> [!WARNING]
> Running the E2E generation test uses live AI completions and will consume credits from your configured API providers.

---

## Manual End-to-End Testing Checklist

1.  [ ] Launch backend API with `npm run dev` and confirm database connection.
2.  [ ] Launch frontend with `npm run dev` and navigate to `http://localhost:5173`.
3.  [ ] Register a test account and verify redirection to dashboard.
4.  [ ] Log out and verify redirection back to `/login`.
5.  [ ] Try accessing `/` without a JWT and confirm redirect blocks access.
6.  [ ] Log in and enter: *"Scaffold a simple React landing page for a gym website."*
7.  [ ] Click **Generate / Build** and verify the **Plan Tab** displays JSON specifications.
8.  [ ] Confirm the **Files Tab** populates with files like `vite.config.js`, `App.jsx`, and `index.css`.
9.  [ ] Confirm validation triggers repair cycles if compilation errors occur.
10. [ ] Verify dependency installation runs in the console.
11. [ ] Verify production compilation build runs and succeeds.
12. [ ] Confirm the **Live Preview** sandbox displays the running web app.
13. [ ] Click buttons inside the sandbox preview and check for reactivity.
14. [ ] Stop the preview and confirm the port is released.
15. [ ] Restart the preview and verify it loads again.
16. [ ] Click **Download ZIP** and confirm file is downloaded locally.
17. [ ] Extract the ZIP file, run `npm install`, and check that `npm run build` succeeds.
18. [ ] Refresh the dashboard and confirm history drawer loads the project log.
19. [ ] Log in as a separate user and verify that first user's project history is hidden.
20. [ ] Confirm the `backend/temp_previews` folder is empty after stopping preview sessions.

---

## Troubleshooting

| Symptom | Likely Cause | Resolution |
| :--- | :--- | :--- |
| **MongoDB connection timeout** | Atlas IP Access List is missing your local machine IP. | Log into MongoDB Atlas portal, navigate to Network Access, and whitelist your current IP address. |
| **Request failed with status code 500** | Missing backend environment config or syntax crash. | Inspect `backend/server.js` logs for specific crash dumps or missing JWT secret setups. |
| **HTTP 429 Rate Limit Error** | Daily/hourly model credit limitations exceeded. | Wait for the quota to reset, or change your configured primary/fallback models in `backend/.env`. |
| **AI completions timeout / abort** | DNS socket hang or high provider completion delays. | The router will retry. You can increase the timeout settings in `projectService.js` if needed. |
| **Live Preview Spawn EINVAL** | Windows node wrapper configuration mismatch. | Ensure preview runs via `npm.cmd` on Windows. The preview service handles this automatically on Windows. |
| **EPERM folder delete locks** | File locks held by running node background sandboxes. | Close the active preview sessions to terminate Vite child handles before deleting folders. |
| **Preview start timeout** | Slow local disk write or internet download times during npm install. | Verify internet connectivity. The E2E script includes an extended 180s check limit. |
| **Port already in use** | Previously crashed preview process did not release socket. | Stop the preview to run the cleanup service, or kill the process manually in Task Manager. |

---

## Security Notes

*   **Cryptographic Password Hashing:** User passwords are never saved in cleartext. They are hashed using `bcryptjs` with 10 salt rounds.
*   **JSON Web Tokens:** Stateless validation of client sessions using cryptographically signed tokens.
*   **Environment Safety:** Database URIs, passwords, and API keys are stored in local `.env` files that are ignored by Git. A `.env.example` file is provided as a template.
*   **Path Traversal Prevention:** The preview service validates project IDs and workspace paths to block malicious path traversal attempts (e.g., `../../etc/passwd`).
*   **Sandboxing Limits:** Generated projects run in individual isolated folders. Outbound routes require project owner authorization, preventing cross-user data leakage.

---

## Git and Repository Hygiene

To keep the repository clean, the following generated files and folders are ignored in the root `.gitignore`:
*   `node_modules/`, `backend/node_modules/`, `frontend/node_modules/` (dependency directories)
*   `frontend/dist/`, `backend/dist/` (compiled production assets)
*   `temp_previews/`, `backend/temp_previews/` (sandboxed workspaces)
*   `*.zip` (zipped codebase packages)
*   `*.log` (console debug logs)
*   `.env`, `backend/.env`, `frontend/.env` (environment configuration files)

Never force commit or track any of the above items in the Git repository index.

---

## Production Deployment Considerations

*   **Frontend Hosting:** Build the client using `npm run build` inside `frontend/` and host the static assets on Vercel, Netlify, or AWS S3.
*   **Backend Hosting:** Deploy the Node/Express backend to platforms like Render, Heroku, or a VPS (DigitalOcean/AWS EC2).
*   **File System Ephemerality:** Serverless hosting platforms (like AWS Lambda or Vercel functions) have read-only filesystems. Since the Live Preview sandbox spawns child processes and writes files to local disk, the backend must be deployed to a persistent server (like an EC2 instance, VM, or Docker container) to support live previews.
*   **Database Cloud Hosting:** Use MongoDB Atlas to host database collections securely.
*   **Security Configuration:** Set `NODE_ENV=production` and configure CORS settings in `server.js` to whitelist your production frontend URL.

---

## Known Limitations

*   **API Outage Vulnerability:** Code generation depends on third-party provider access (OpenRouter/Z.ai). Outages in those systems will block generation workflows.
*   **Local Disk Usage:** Creating multiple preview sandboxes writes file modules to the host system disk. Regular folder cleanup is required to save disk space.
*   **Cold Startup Latency:** Spawning preview sandboxes executes fresh `npm install` runs on local disk, which can take up to 2 minutes on slower hard drives.

---

## Future Improvements

*   **Custom Environment Profiles:** Let users select React templates, tailwind styles, or component styles directly from the dashboard options.
*   **Containerized Previews:** Run preview servers inside isolated Docker containers to separate project workspaces from the host system.
*   **Collaborative Sessions:** Allow multiple developers to view and test live preview sandboxes simultaneously.

---

## Interview Explanation

Here is a quick overview of the project that you can use in technical interviews:

> **Project Pitch:**
> *"The Z.ai Local Coding Assistant is an AI-powered developer tool that generates React codebases from natural language descriptions and runs them in a local web preview sandbox. Built on the MERN stack, it features user auth, database tracking, and a failover router that connects to OpenRouter and Z.ai.*
>
> *When a user enters a prompt, the system parses the specifications, structures the contracts, and runs a generation planner. The code is checked for JSX syntax issues and malformed tags. Once verified, it writes the project to a sandboxed directory, installs dependencies, builds the project, and runs a Vite server on a random port. The live app is then loaded inside the dashboard.*
>
> *A key challenge I solved was process isolation and file locking on Windows. By creating wrapper child processes and implementing a delayed retry folder removal mechanism, I resolved EPERM errors when cleaning up sandboxes. I also built a failover router that retries failed requests and falls back to Z.ai if the primary provider rate-limits us."*

---

## License

No license file is currently included in this repository. All rights reserved.
