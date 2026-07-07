# Z.ai Local Coding Assistant - Frontend Application

This folder contains the complete, premium frontend dashboard application for **Z.ai Local Coding Assistant**, built with React, Vite, and Tailwind CSS. It is configured to run entirely in the browser using mock services and asynchronous handlers, and is fully structured to be connected to a real Node.js/Express backend API.

---

## Technical Stack

* **Build Tooling**: Vite
* **Language**: JavaScript (ESM modules)
* **CSS Framework**: Tailwind CSS (with PostCSS & Autoprefixer)
* **Router**: React Router DOM v6
* **HTTP Client**: Axios (configured with request interceptors ready for JWT)
* **Markdown Renderer**: React Markdown v9
* **Syntax Highlighter**: React Syntax Highlighter v15 (Prism core)
* **Icons**: React Icons (Feather Icons pack)

---

## Folder Structure

```text
frontend/
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx           # Sidebar drawer navigation
│   │   ├── MobileHeader.jsx      # Mobile hamburger banner
│   │   ├── ProtectedRoute.jsx    # Route-guard checking authentication
│   │   ├── CodeBlock.jsx         # Syntax highlighted prism rendering & clipboard copies
│   │   ├── PromptTemplates.jsx   # Selectable developer templates
│   │   ├── Loader.jsx            # Dynamic page spinner loaders
│   │   ├── EmptyState.jsx        # Fallback card when collections are blank
│   │   ├── ErrorMessage.jsx      # System failure messaging banner
│   │   └── StatCard.jsx          # Metric boxes
│   │
│   ├── layouts/
│   │   └── DashboardLayout.jsx   # Grid scaffolding with sidebar wrapper
│   │
│   ├── pages/
│   │   ├── Login.jsx             # Security authentication login portal
│   │   ├── Register.jsx          # User signup portal
│   │   ├── Dashboard.jsx         # Overview, metrics, and activity highlights
│   │   ├── ChatAssistant.jsx     # AI coding conversational chatbot
│   │   ├── ProjectBuilder.jsx    # Full-stack framework generator form
│   │   ├── CodeWorkspace.jsx     # Script debugging workbench
│   │   ├── History.jsx           # Searchable history catalog with deletion
│   │   ├── HistoryDetails.jsx    # Detail view of history documents
│   │   └── Profile.jsx           # Account info management
│   │
│   ├── services/
│   │   ├── api.js                # Axios base module with JWT interceptor
│   │   ├── authService.js        # Mock auth operations
│   │   ├── chatService.js        # Mock chat assistant generator logic
│   │   ├── projectService.js     # Mock full-stack boilerplate responses
│   │   └── historyService.js     # Mock persistent history storage
│   │
│   ├── context/
│   │   └── AuthContext.jsx       # Global session control provider
│   │
│   ├── data/
│   │   ├── promptTemplates.js    # Developer prompt templates list
│   │   └── mockData.js           # Initial activity history
│   │
│   ├── utils/
│   │   ├── formatDate.js        # ISO string localized date helper
│   │   └── copyToClipboard.js    # Browser clipboard copier
│   │
│   ├── App.jsx                   # Router mappings
│   ├── main.jsx                  # Virtual DOM root mounter
│   └── index.css                 # Custom scrollbars and Tailwind layer configs
│
├── .env.example                  # API port environment template
├── index.html                    # Root HTML template
├── postcss.config.js
├── tailwind.config.js            # Custom dark navy theme parameters
├── package.json
└── vite.config.js
```

---

## Installation & Setup

Follow these exact commands to boot the developer portal:

1. **Change directory** to the `frontend` application:
   ```bash
   cd frontend
   ```

2. **Install all dependencies**:
   ```bash
   npm install
   ```

3. **Initialize Environment Variables**:
   Create a `.env` file copying the parameters:
   ```bash
   copy .env.example .env
   ```

4. **Launch Local Server**:
   ```bash
   npm run dev
   ```
   *The browser should open automatically on [http://localhost:3000](http://localhost:3000)*

5. **Build bundle for production validation**:
   ```bash
   npm run build
   ```

---

## Mock Authentication Details

To log into the dashboard, use these credentials on the Sign In portal:

* **Demo User Email**: `demo@zai.dev`
* **Demo User Password**: `password123`

---

## Architecture Ready for Backend APIs

All operations inside `/src/pages` execute calls via `/src/services` rather than making direct requests. 

When you connect the Node.js/Express backend later, you only need to:
1. Turn on the server (running on `http://localhost:5000/api` or configured VITE_API_URL).
2. Replace mock timeout logic inside `src/services/*Service.js` with Axios requests pointing to your endpoints:
   - `authService.login` -> `POST /api/auth/register`
   - `chatService.sendMessage` -> `POST /api/chat/send`
   - `projectService.generateProject` -> `POST /api/project/generate`
   - `historyService.getHistory` -> `GET /api/history`
3. The Axios setup inside `src/services/api.js` is already intercepting requests and will attach standard Authorization Headers `Bearer <jwt_token>` as soon as `zai_mock_token` contains a valid JWT token.
