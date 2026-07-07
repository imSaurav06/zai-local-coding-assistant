/**
 * Simulated project generator service.
 * Builds detailed full-stack documentation according to specs.
 */
export const projectService = {
  generateProject: async (projectData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const {
          projectName = 'MyProject',
          projectType = 'web-app',
          frontendFramework = 'React',
          backendFramework = 'Express',
          database = 'MongoDB',
          features = 'CRUD operations, user login',
          designPreference = 'Dark Navy',
          authRequired = 'Yes',
          adminRequired = 'No'
        } = projectData;

        const responseMarkdown = `## Project Summary
A customized ${projectType} called **${projectName}** designed with a **${designPreference}** visual theme. 
Key functionalities requested: ${features}. Admin Panel: ${adminRequired === 'Yes' ? 'Enabled' : 'Disabled'}.

## Recommended Tech Stack
- **Frontend**: ${frontendFramework} (Vite build system) with Tailwind CSS
- **Backend**: Node.js & ${backendFramework} REST API
- **Database**: ${database} Database Engine
- **Auth**: ${authRequired === 'Yes' ? 'JWT state sessions' : 'No authentication requested'}

## Folder Structure
\`\`\`text
${projectName.toLowerCase()}/
├── server/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── userController.js
│   │   └── featureController.js
│   ├── models/
│   │   ├── User.js
│   │   └── Feature.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── features.js
│   ├── server.js
│   └── .env
└── client/
    ├── src/
    │   ├── components/
    │   │   └── Header.jsx
    │   ├── pages/
    │   │   └── MainView.jsx
    │   ├── App.jsx
    │   └── main.jsx
    ├── package.json
    └── tailwind.config.js
\`\`\`

## Frontend Pages
1. **Authentication Portal**: Seamless user login/registration matching the ${designPreference} design scheme.
2. **Dashboard / MainView**: Displays primary data and controls.
3. **Settings Dashboard**: Handles user settings, profile updates, and admin functions.

## Frontend Components
- \`Header.jsx\`: Navigational banner supporting theme settings.
- \`DataCard.jsx\`: Renders specific data items.
- \`ActionForm.jsx\`: Input validation for standard operations.

## Backend APIs
- \`POST /api/auth/register\` - Register new profiles
- \`POST /api/auth/login\` - Authorize session access
- \`GET /api/features\` - List items for client ingestion
- \`POST /api/features\` - Create new custom item

## Database Schema
Mongoose Database Models for ${database}:
- **Users**: \`name\`, \`email\`, \`password\`
- **Features**: \`title\`, \`description\`, \`ownerId\`

## Authentication Flow
${authRequired === 'Yes' 
  ? '1. User fills credentials on the Login interface.\n2. Backend validates passwords and issues an HTTP-only JWT Cookie.\n3. Request verification occurs in a custom server middleware.'
  : 'Authentication is disabled. All API endpoints are publicly accessible.'
}

## Development Plan
1. **Sprint 1**: Set up basic database configuration and directory structure.
2. **Sprint 2**: Implement endpoints for backend operations.
3. **Sprint 3**: Scaffold pages and wire Axios hooks.
4. **Sprint 4**: Theme UI using custom styles.

## Starter Code

### Starter App.jsx
\`\`\`jsx
import React from 'react';
import Header from './components/Header';
import MainView from './pages/MainView';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <Header />
      <main className="max-w-7xl mx-auto p-6">
        <MainView />
      </main>
    </div>
  );
}
\`\`\`

### Starter React Component
\`\`\`jsx
import React from 'react';

export default function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex justify-between items-center">
      <h1 className="text-xl font-bold tracking-tight text-white">
        ${projectName}
      </h1>
      <div className="flex gap-4">
        <span className="text-xs px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 font-medium">
          Framework: React
        </span>
      </div>
    </header>
  );
}
\`\`\`

### Starter Server.js
\`\`\`javascript
const express = require('express');
const app = express();

app.use(express.json());

// Main status endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', project: '${projectName}' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(\`Server is running on http://localhost:\${PORT}\`);
});
\`\`\`

### Starter Express Route
\`\`\`javascript
const express = require('express');
const router = express.Router();

router.post('/api/features', (req, res) => {
  const { title, description } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, message: 'Title is required' });
  }
  res.status(201).json({ 
    success: true, 
    data: { id: Date.now(), title, description } 
  });
});

module.exports = router;
\`\`\`

### Starter MongoDB Schema
\`\`\`javascript
const mongoose = require('mongoose');

const FeatureSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Feature', FeatureSchema);
\`\`\`
`;
        resolve({
          message: responseMarkdown,
          model: 'glm-5.1',
          createdAt: new Date().toISOString()
        });
      }, 1500);
    });
  }
};
