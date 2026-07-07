import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { projectService } from '../services/projectService';
import { historyService } from '../services/historyService';
import CodeBlock from './CodeBlock';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import EmptyState from './EmptyState';
import { 
  FiLayers, 
  FiRefreshCw, 
  FiSliders, 
  FiPlay, 
  FiFolder, 
  FiCpu, 
  FiLayout, 
  FiEye, 
  FiCode, 
  FiServer,
  FiDatabase,
  FiShoppingBag,
  FiGrid,
  FiActivity,
  FiTerminal
} from 'react-icons/fi';

export default function BuildProjectMode() {
  const [prompt, setPrompt] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState('');

  // Project configuration parameters
  const [projectName, setProjectName] = useState('AcmeSaaS');
  const [projectType, setProjectType] = useState('Web Application');
  const [frontendFramework, setFrontendFramework] = useState('React.js (Vite)');
  const [backendFramework, setBackendFramework] = useState('Express.js (Node)');
  const [database, setDatabase] = useState('MongoDB (Mongoose)');
  const [designPreference, setDesignPreference] = useState('Dark Navy Professional');
  const [authRequired, setAuthRequired] = useState('Yes');
  const [adminRequired, setAdminRequired] = useState('No');

  // Tabs for the generated project output
  const [activeTab, setActiveTab] = useState('plan'); // 'plan' | 'code' | 'preview'
  const [activeCodeFile, setActiveCodeFile] = useState('App.jsx'); // App.jsx | Component.jsx | server.js | routes.js | schema.js

  const handleBuild = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setError('Please describe your project prompt.');
      return;
    }

    setError('');
    setLoading(true);
    setOutput('');

    const payload = {
      projectName: projectName || 'MyProject',
      projectType,
      frontendFramework,
      backendFramework,
      database,
      features: prompt,
      designPreference,
      authRequired,
      adminRequired
    };

    try {
      const response = await projectService.generateProject(payload);

      // Save to mock history
      await historyService.saveHistory({
        prompt: `Build Project: ${payload.projectName} - ${prompt.substring(0, 50)}...`,
        response: response.message,
        type: 'project',
        model: response.model
      });

      setOutput(response.message);
      setActiveTab('plan');
    } catch (err) {
      setError(err.message || 'Build generation failed.');
    } finally {
      setLoading(false);
    }
  };

  // Safe file extraction for the "Code" tab based on static starter configs
  const getStarterCode = (filename) => {
    switch (filename) {
      case 'App.jsx':
        return `import React from 'react';\nimport Header from './components/Header';\nimport Dashboard from './pages/Dashboard';\n\nexport default function App() {\n  return (\n    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">\n      <Header projectName="${projectName}" />\n      <main className="flex-grow max-w-7xl mx-auto p-6 w-full">\n        <Dashboard />\n      </main>\n    </div>\n  );\n}`;
      case 'Component.jsx':
        return `import React from 'react';\n\nexport default function Header({ projectName }) {\n  return (\n    <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center">\n      <h1 className="text-lg font-bold tracking-tight text-white">{projectName}</h1>\n      <div className="flex gap-2">\n        <span className="text-xs px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 font-medium">\n          Frontend: ${frontendFramework}\n        </span>\n      </div>\n    </header>\n  );\n}`;
      case 'server.js':
        return `const express = require('express');\nconst cors = require('cors');\nconst app = express();\n\napp.use(cors());\napp.use(express.json());\n\napp.get('/api/health', (req, res) => {\n  res.json({ status: 'healthy', database: '${database}', framework: '${backendFramework}' });\n});\n\nconst PORT = process.env.PORT || 5000;\napp.listen(PORT, () => console.log('Server active on port ' + PORT));`;
      case 'routes.js':
        return `const express = require('express');\nconst router = express.Router();\n\n// REST Endpoint\nrouter.get('/items', (req, res) => {\n  res.status(200).json({\n    success: true,\n    message: 'Scaffolded items route endpoints.',\n    authType: '${authRequired === 'Yes' ? 'JWT Headers' : 'None'}'\n  });\n});\n\nmodule.exports = router;`;
      case 'schema.js':
        return `const mongoose = require('mongoose');\n\nconst ItemSchema = new mongoose.Schema({\n  title: { type: String, required: true, trim: true },\n  active: { type: Boolean, default: true },\n  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }\n}, { timestamps: true });\n\nmodule.exports = mongoose.model('Item', ItemSchema);`;
      default:
        return '';
    }
  };

  // Safe client-side HTML mock previews based on Project options and type
  const renderPreview = () => {
    const isDark = designPreference.toLowerCase().includes('dark');
    const colorThemeClass = isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900';
    const cardBgClass = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
    
    if (projectType.includes('E-commerce')) {
      return (
        <div className={`p-6 rounded-xl border max-w-xl mx-auto space-y-4 shadow-lg ${colorThemeClass} ${cardBgClass}`}>
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="font-bold flex items-center gap-1.5 text-sm uppercase tracking-wider">
              <FiShoppingBag className="text-brand-400" />
              <span>{projectName || 'E-Shop'}</span>
            </h3>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded">Storefront Online</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 border rounded-lg ${cardBgClass} flex flex-col justify-between`}>
              <div>
                <h4 className="text-xs font-bold">Premium Mechanical Keyboard</h4>
                <p className="text-[10px] text-slate-400 mt-1">RGB backlighting, blue switches</p>
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs font-semibold text-brand-400">$89.99</span>
                <button className="px-2 py-1 bg-brand-500 text-white rounded text-[10px] font-bold">Add</button>
              </div>
            </div>
            <div className={`p-4 border rounded-lg ${cardBgClass} flex flex-col justify-between`}>
              <div>
                <h4 className="text-xs font-bold">Ergonomic Wireless Mouse</h4>
                <p className="text-[10px] text-slate-400 mt-1">Adjustable DPI, rechargeable</p>
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs font-semibold text-brand-400">$45.00</span>
                <button className="px-2 py-1 bg-brand-500 text-white rounded text-[10px] font-bold">Add</button>
              </div>
            </div>
          </div>
          
          <div className="text-[10px] text-slate-500 text-center select-none pt-2 border-t border-slate-800/40">
            Preview Model | Frontend: {frontendFramework} | Auth: {authRequired}
          </div>
        </div>
      );
    }

    if (projectType.includes('SaaS') || projectType.includes('Dashboard')) {
      return (
        <div className={`p-6 rounded-xl border max-w-xl mx-auto space-y-4 shadow-lg ${colorThemeClass} ${cardBgClass}`}>
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="font-bold flex items-center gap-1.5 text-sm uppercase tracking-wider">
              <FiGrid className="text-brand-400" />
              <span>{projectName || 'SaaS Console'}</span>
            </h3>
            <span className="text-[10px] bg-brand-500/10 text-brand-400 border border-brand-500/25 px-2 py-0.5 rounded">Operational</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className={`p-3 border rounded-lg text-center ${cardBgClass}`}>
              <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Sessions</span>
              <span className="text-lg font-extrabold text-white mt-1 block">14,231</span>
            </div>
            <div className={`p-3 border rounded-lg text-center ${cardBgClass}`}>
              <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Queries</span>
              <span className="text-lg font-extrabold text-white mt-1 block">982 ms</span>
            </div>
            <div className={`p-3 border rounded-lg text-center ${cardBgClass}`}>
              <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Active users</span>
              <span className="text-lg font-extrabold text-brand-400 mt-1 block">189</span>
            </div>
          </div>

          <div className={`p-3 border rounded-lg ${cardBgClass} space-y-2`}>
            <span className="text-[10px] font-bold text-slate-300 block">Recent System Access logs</span>
            <div className="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-800/40 pb-1.5">
              <span>GET /api/health</span>
              <span className="text-emerald-400 font-bold">200 OK</span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400">
              <span>POST /api/auth/login</span>
              <span className="text-emerald-400 font-bold">201 OK</span>
            </div>
          </div>
        </div>
      );
    }

    if (projectType.includes('REST') || projectType.includes('API')) {
      return (
        <div className="bg-[#0c1017] border border-slate-800 rounded-xl p-5 font-mono text-xs text-slate-300 max-w-xl mx-auto shadow-2xl space-y-3">
          <div className="flex justify-between items-center border-b border-slate-900 pb-2.5 text-slate-500">
            <span>Terminal API Client</span>
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
          </div>
          <div className="space-y-1.5">
            <p className="text-brand-400">$ curl -X GET http://localhost:5000/api/health</p>
            <p className="text-slate-500">{"{"}</p>
            <p className="pl-4">"status": "healthy",</p>
            <p className="pl-4">"database": "{database}",</p>
            <p className="pl-4">"framework": "{backendFramework}"</p>
            <p className="text-slate-500">{"}"}</p>
          </div>
          <div className="pt-2 border-t border-slate-900 space-y-1.5">
            <p className="text-brand-400">$ curl -X GET http://localhost:5000/api/items</p>
            <p className="text-slate-500">{"{"}</p>
            <p className="pl-4">"success": true,</p>
            <p className="pl-4">"authRequired": "{authRequired}"</p>
            <p className="text-slate-500">{"}"}</p>
          </div>
        </div>
      );
    }

    // Default Web Application / Portfolio
    return (
      <div className={`p-6 rounded-xl border max-w-xl mx-auto text-center space-y-4 shadow-lg ${colorThemeClass} ${cardBgClass}`}>
        <div className="max-w-md mx-auto space-y-2">
          <h3 className="text-lg font-extrabold text-white">{projectName || 'My WebApp'}</h3>
          <p className="text-xs text-slate-400">
            A customized {projectType} scaffolded seamlessly using React components. Ready to connect API routing.
          </p>
        </div>
        <div className="py-4 border-y border-slate-800/40 grid grid-cols-2 gap-4 text-left max-w-sm mx-auto">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Frontend Framework</span>
            <span className="text-xs font-semibold text-white">{frontendFramework}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Database Stack</span>
            <span className="text-xs font-semibold text-white">{database}</span>
          </div>
        </div>
        <button className="px-4 py-2 bg-brand-500 text-white rounded-lg text-xs font-bold tracking-wide">
          Explore App
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Input Form Container */}
      <form onSubmit={handleBuild} className="bg-dark-card border border-dark-border rounded-2xl p-6 space-y-4 shadow-lg">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <FiLayout className="text-brand-400" />
            <span>Create a new project</span>
          </h2>
          <p className="text-xs text-dark-muted">
            Outline the core layout, database collections, API routing endpoints, and design theme details.
          </p>
        </div>

        {/* Text prompt query */}
        <div className="relative bg-slate-900 border border-dark-border rounded-xl focus-within:border-brand-500/80 transition-all p-1.5 flex items-end">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            rows={3}
            placeholder="e.g. Build an e-commerce dashboard backend using express, frontend using react and mongodb database. Implement strip billing and login flows."
            className="flex-1 bg-transparent border-0 outline-none text-xs text-white placeholder-slate-600 p-2.5 resize-none scrollbar-thin"
          />
        </div>

        {/* Project Options Toggle */}
        <div className="border-t border-dark-border/40 pt-3 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-1.5 text-xs text-dark-muted hover:text-white transition-colors cursor-pointer select-none font-semibold"
            >
              <FiSliders className="w-4 h-4 text-brand-400" />
              <span>Project Options ({showOptions ? 'Hide' : 'Expand'})</span>
            </button>
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Building...</span>
                </>
              ) : (
                <>
                  <FiPlay className="w-3.5 h-3.5" />
                  <span>Build Project</span>
                </>
              )}
            </button>
          </div>

          {/* Configuration Grid */}
          {showOptions && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/40 p-4 border border-dark-border rounded-xl animate-fadeIn">
              {/* Project Name */}
              <div>
                <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="block w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs font-medium focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Project Type */}
              <div>
                <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">Project Type</label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="block w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs font-medium focus:outline-none focus:border-brand-500"
                >
                  <option>Web Application</option>
                  <option>E-commerce Platform</option>
                  <option>SaaS Dashboard</option>
                  <option>REST API Service</option>
                </select>
              </div>

              {/* Frontend Framework */}
              <div>
                <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">Frontend</label>
                <select
                  value={frontendFramework}
                  onChange={(e) => setFrontendFramework(e.target.value)}
                  className="block w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs font-medium focus:outline-none focus:border-brand-500"
                >
                  <option>React.js (Vite)</option>
                  <option>Vue.js</option>
                  <option>Vanilla HTML/JS</option>
                </select>
              </div>

              {/* Backend Framework */}
              <div>
                <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">Backend</label>
                <select
                  value={backendFramework}
                  onChange={(e) => setBackendFramework(e.target.value)}
                  className="block w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs font-medium focus:outline-none focus:border-brand-500"
                >
                  <option>Express.js (Node)</option>
                  <option>FastAPI (Python)</option>
                  <option>NestJS</option>
                  <option>No Backend</option>
                </select>
              </div>

              {/* Database */}
              <div>
                <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">Database</label>
                <select
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  className="block w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs font-medium focus:outline-none focus:border-brand-500"
                >
                  <option>MongoDB (Mongoose)</option>
                  <option>PostgreSQL (Sequelize)</option>
                  <option>MySQL (Prisma)</option>
                  <option>No Database</option>
                </select>
              </div>

              {/* Design Theme */}
              <div>
                <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">Theme</label>
                <select
                  value={designPreference}
                  onChange={(e) => setDesignPreference(e.target.value)}
                  className="block w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs font-medium focus:outline-none focus:border-brand-500"
                >
                  <option>Dark Navy Professional</option>
                  <option>Emerald Minimalist</option>
                  <option>Slate Modernist</option>
                  <option>High Contrast Light</option>
                </select>
              </div>

              {/* Require Auth */}
              <div>
                <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">Auth Required</label>
                <select
                  value={authRequired}
                  onChange={(e) => setAuthRequired(e.target.value)}
                  className="block w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs font-medium focus:outline-none focus:border-brand-500"
                >
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>

              {/* Require Admin */}
              <div>
                <label className="block text-[10px] font-bold text-dark-muted mb-1 uppercase tracking-wider">Admin Panel</label>
                <select
                  value={adminRequired}
                  onChange={(e) => setAdminRequired(e.target.value)}
                  className="block w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs font-medium focus:outline-none focus:border-brand-500"
                >
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </form>

      {error && <ErrorMessage message={error} />}

      {/* Output Panel Layout */}
      {loading && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-12 text-center shadow-lg">
          <Loader size="lg" />
          <p className="text-xs text-slate-400 mt-4 animate-pulse">
            Compiling configurations and scaffolding workspace layout templates...
          </p>
        </div>
      )}

      {!loading && !output && (
        <EmptyState
          title="Project Blueprint Output"
          message="Complete the prompt details above and start 'Build Project' to initiate architecture blueprints, setup plans, and starter code viewports."
          icon={FiLayers}
        />
      )}

      {!loading && output && (
        <div className="bg-dark-card border border-dark-border rounded-2xl shadow-lg overflow-hidden animate-fadeIn">
          {/* Tabs Navigation Header */}
          <div className="flex border-b border-dark-border bg-[#0e131d] px-4 select-none">
            <button
              onClick={() => setActiveTab('plan')}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'plan'
                  ? 'border-brand-500 text-white'
                  : 'border-transparent text-dark-muted hover:text-white'
              }`}
            >
              <FiFolder className="w-4 h-4" />
              <span>Plan</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'code'
                  ? 'border-brand-500 text-white'
                  : 'border-transparent text-dark-muted hover:text-white'
              }`}
            >
              <FiCode className="w-4 h-4" />
              <span>Code</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'border-brand-500 text-white'
                  : 'border-transparent text-dark-muted hover:text-white'
              }`}
            >
              <FiEye className="w-4 h-4" />
              <span>Preview</span>
            </button>
          </div>

          <div className="p-6">
            {/* Tab: Plan */}
            {activeTab === 'plan' && (
              <div className="prose-custom max-h-[50vh] overflow-y-auto pr-2 scrollbar-thin">
                <ReactMarkdown
                  components={{
                    code({ node, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const isInline = !match;
                      return !isInline ? (
                        <CodeBlock
                          code={String(children).replace(/\n$/, '')}
                          language={match[1]}
                        />
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {output}
                </ReactMarkdown>
              </div>
            )}

            {/* Tab: Code (File-based Viewer) */}
            {activeTab === 'code' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* File list */}
                <div className="md:col-span-3 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 select-none border-b md:border-b-0 md:border-r border-dark-border pr-0 md:pr-4">
                  {['App.jsx', 'Component.jsx', 'server.js', 'routes.js', 'schema.js'].map((filename) => (
                    <button
                      key={filename}
                      onClick={() => setActiveCodeFile(filename)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer flex items-center gap-2 flex-shrink-0 ${
                        activeCodeFile === filename
                          ? 'bg-brand-500/10 text-brand-400 border border-brand-500/30'
                          : 'text-dark-muted hover:text-white bg-slate-900/40 border border-transparent'
                      }`}
                    >
                      {filename.endsWith('.jsx') ? (
                        <FiLayout className="w-3.5 h-3.5" />
                      ) : filename.endsWith('.js') && filename !== 'schema.js' ? (
                        <FiServer className="w-3.5 h-3.5" />
                      ) : (
                        <FiDatabase className="w-3.5 h-3.5" />
                      )}
                      <span>{filename}</span>
                    </button>
                  ))}
                </div>

                {/* Explorer Display */}
                <div className="md:col-span-9">
                  <p className="text-[10px] text-dark-muted font-mono mb-2 uppercase select-none">
                    Viewer / src / {activeCodeFile}
                  </p>
                  <CodeBlock
                    code={getStarterCode(activeCodeFile)}
                    language={activeCodeFile.endsWith('.jsx') ? 'jsx' : 'javascript'}
                  />
                </div>
              </div>
            )}

            {/* Tab: Preview (Safe Mock Previews) */}
            {activeTab === 'preview' && (
              <div className="py-4 space-y-4">
                <div className="text-center max-w-sm mx-auto mb-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-center gap-1.5 select-none">
                    <FiActivity className="text-brand-400" />
                    <span>Mock Sandbox Render</span>
                  </h4>
                  <p className="text-[10px] text-dark-muted leading-relaxed mt-1">
                    Visual interface simulated client-side. No server connections are executed.
                  </p>
                </div>
                {renderPreview()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
