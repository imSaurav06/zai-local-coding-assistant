import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import CodeBlock from './CodeBlock';
import { 
  FiFolder, 
  FiCode, 
  FiEye, 
  FiDownload, 
  FiCheckCircle, 
  FiCpu,
  FiServer,
  FiDatabase,
  FiLayout,
  FiShoppingBag,
  FiGrid,
  FiActivity
} from 'react-icons/fi';
import api from '../services/api';

export default function GeneratedProjectPanel({ generatedProject }) {
  const [activeTab, setActiveTab] = useState('plan'); // 'plan' | 'code' | 'preview'
  const [activeCodeFile, setActiveCodeFile] = useState('App.jsx');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const {
    projectName = 'MyProject',
    projectType = 'Web Application',
    frontendFramework = 'React.js',
    backendFramework = 'Express.js',
    database = 'MongoDB',
    result = '', // The AI markdown project plan
    model = '',
    projectId = null, // Backend projectId
    authRequired = 'Yes',
    adminRequired = 'No',
    designPreference = 'Dark Navy Professional'
  } = generatedProject;

  const handleDownload = async () => {
    if (!projectId) {
      setDownloadError("The current backend Z.ai API does not support project ZIP exports (missing projectId).");
      setTimeout(() => setDownloadError(''), 5000);
      return;
    }

    setDownloading(true);
    setDownloadError('');

    try {
      // Trigger request to GET /api/project/:projectId/download
      const response = await api.get(`/project/${projectId}/download`, {
        responseType: 'blob'
      });

      // Trigger browser file download
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Attempt to extract filename from headers
      const contentDisposition = response.headers['content-disposition'];
      let filename = `${projectName.toLowerCase() || 'project'}.zip`;
      if (contentDisposition) {
        const matches = /filename="?([^";]+)"?/i.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setDownloadError("Download request failed. Confirm backend API endpoints configuration.");
      setTimeout(() => setDownloadError(''), 5000);
    } finally {
      setDownloading(false);
    }
  };

  // Safe file code extraction helper
  const getStarterCode = (filename) => {
    switch (filename) {
      case 'App.jsx':
        return `import React from 'react';\nimport Header from './components/Header';\nimport Dashboard from './pages/Dashboard';\n\nexport default function App() {\n  return (\n    <div className="min-h-screen bg-[#141416] text-white flex flex-col font-sans">\n      <Header projectName="${projectName}" />\n      <main className="flex-grow max-w-7xl mx-auto p-6 w-full">\n        <Dashboard />\n      </main>\n    </div>\n  );\n}`;
      case 'Component.jsx':
        return `import React from 'react';\n\nexport default function Header({ projectName }) {\n  return (\n    <header className="bg-[#1e1e20] border-b border-dark-border px-6 py-4 flex justify-between items-center">\n      <h1 className="text-lg font-bold text-white">{projectName}</h1>\n      <span className="text-xs px-2.5 py-1 bg-brand-500/10 text-brand-500 rounded-full border border-brand-500/20 font-medium">\n        Frontend: ${frontendFramework}\n      </span>\n    </header>\n  );\n}`;
      case 'server.js':
        return `const express = require('express');\nconst app = express();\n\napp.use(express.json());\n\napp.get('/api/health', (req, res) => {\n  res.json({ status: 'healthy', database: '${database}', framework: '${backendFramework}' });\n});\n\nconst PORT = process.env.PORT || 5000;\napp.listen(PORT, () => console.log('Server active on port ' + PORT));`;
      case 'routes.js':
        return `const express = require('express');\nconst router = express.Router();\n\nrouter.get('/items', (req, res) => {\n  res.status(200).json({\n    success: true,\n    message: 'Scaffolded routing route endpoints.',\n    auth: '${authRequired}'\n  });\n});\n\nmodule.exports = router;`;
      case 'schema.js':
        return `const mongoose = require('mongoose');\n\nconst ItemSchema = new mongoose.Schema({\n  title: { type: String, required: true },\n  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }\n}, { timestamps: true });\n\nmodule.exports = mongoose.model('Item', ItemSchema);`;
      default:
        return '';
    }
  };

  // Previews mock visual representations
  const renderPreview = () => {
    const isDark = designPreference.toLowerCase().includes('dark');
    const colorThemeClass = isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900';
    const cardBgClass = isDark ? 'bg-slate-900 border-slate-850' : 'bg-white border-slate-200';
    
    if (projectType.includes('E-commerce')) {
      return (
        <div className={`p-5 rounded-xl border max-w-lg mx-auto space-y-3 shadow-md ${colorThemeClass} ${cardBgClass}`}>
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold flex items-center gap-1 text-xs uppercase tracking-wider">
              <FiShoppingBag className="text-brand-500" />
              <span>{projectName || 'E-Shop'}</span>
            </h4>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded">Active Store</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 border rounded-lg ${cardBgClass} flex flex-col justify-between`}>
              <h5 className="text-[11px] font-bold">Mechanical Keyboard</h5>
              <div className="flex justify-between items-center mt-2.5">
                <span className="text-xs font-semibold text-brand-500">$89</span>
                <span className="px-1.5 py-0.5 bg-brand-500 text-white rounded text-[8px] font-bold">Add</span>
              </div>
            </div>
            <div className={`p-3 border rounded-lg ${cardBgClass} flex flex-col justify-between`}>
              <h5 className="text-[11px] font-bold">Wireless Mouse</h5>
              <div className="flex justify-between items-center mt-2.5">
                <span className="text-xs font-semibold text-brand-500">$45</span>
                <span className="px-1.5 py-0.5 bg-brand-500 text-white rounded text-[8px] font-bold">Add</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (projectType.includes('SaaS') || projectType.includes('Dashboard')) {
      return (
        <div className={`p-5 rounded-xl border max-w-lg mx-auto space-y-3 shadow-md ${colorThemeClass} ${cardBgClass}`}>
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold flex items-center gap-1 text-xs uppercase tracking-wider">
              <FiGrid className="text-brand-500" />
              <span>{projectName || 'Console'}</span>
            </h4>
            <span className="text-[9px] bg-brand-500/10 text-brand-500 border border-brand-500/20 px-1.5 py-0.5 rounded">Operational</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className={`p-2 border rounded-lg text-center ${cardBgClass}`}>
              <span className="block text-[8px] uppercase tracking-wider text-slate-400">Queries</span>
              <span className="text-sm font-extrabold text-white">982 ms</span>
            </div>
            <div className={`p-2 border rounded-lg text-center ${cardBgClass}`}>
              <span className="block text-[8px] uppercase tracking-wider text-slate-400">Users</span>
              <span className="text-sm font-extrabold text-brand-500">189</span>
            </div>
            <div className={`p-2 border rounded-lg text-center ${cardBgClass}`}>
              <span className="block text-[8px] uppercase tracking-wider text-slate-400">Requests</span>
              <span className="text-sm font-extrabold text-white">12k</span>
            </div>
          </div>
        </div>
      );
    }

    // Default Preview
    return (
      <div className={`p-5 rounded-xl border max-w-lg mx-auto text-center space-y-3 shadow-md ${colorThemeClass} ${cardBgClass}`}>
        <h4 className="text-sm font-bold text-white">{projectName}</h4>
        <p className="text-xs text-slate-400">
          A customized {projectType} layout compiled inside a safe frontend preview sandbox.
        </p>
        <div className="text-[9px] text-slate-500 border-t border-slate-800/40 pt-2 flex justify-center gap-4">
          <span>Frontend: {frontendFramework}</span>
          <span>Database: {database}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="border border-dark-border rounded-xl bg-dark-composer/50 overflow-hidden mt-4">
      {/* Header Panel */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-dark-card border-b border-dark-border select-none gap-3">
        <div className="flex items-center gap-2">
          <FiCheckCircle className="text-emerald-500 w-4.5 h-4.5" />
          <span className="text-xs font-bold text-white uppercase tracking-wider font-sans">
            Project Scaffolding Generated
          </span>
          {model && (
            <span className="text-[9px] font-mono text-dark-muted bg-dark-bg border border-dark-border px-1.5 py-0.5 rounded flex items-center gap-1">
              <FiCpu className="w-3 h-3" />
              <span>{model}</span>
            </span>
          )}
        </div>

        {/* Download Project Button - Only show if projectId is available */}
        {projectId && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
          >
            <FiDownload className="w-3.5 h-3.5" />
            <span>{downloading ? "Downloading..." : "Download Project"}</span>
          </button>
        )}
      </div>

      {downloadError && (
        <div className="px-4 py-2 border-b border-red-500/20 bg-red-950/10 text-[10px] text-red-400 font-semibold select-none">
          {downloadError}
        </div>
      )}

      {/* Render tabs ONLY if backend structured data exists */}
      {projectId ? (
        <>
          {/* Tabs */}
          <div className="flex border-b border-dark-border bg-dark-sidebar/30 px-3 select-none">
            <button
              onClick={() => setActiveTab('plan')}
              className={`px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'plan' ? 'border-brand-500 text-white' : 'border-transparent text-dark-muted hover:text-white'
              }`}
            >
              <FiFolder className="w-3.5 h-3.5" />
              <span>Plan</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'code' ? 'border-brand-500 text-white' : 'border-transparent text-dark-muted hover:text-white'
              }`}
            >
              <FiCode className="w-3.5 h-3.5" />
              <span>Files</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview' ? 'border-brand-500 text-white' : 'border-transparent text-dark-muted hover:text-white'
              }`}
            >
              <FiEye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>

          {/* Contents */}
          <div className="p-4 bg-dark-bg/20">
            {/* Plan tab */}
            {activeTab === 'plan' && (
              <div className="prose-custom max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
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
                  {result}
                </ReactMarkdown>
              </div>
            )}

            {/* Code explorer tab */}
            {activeTab === 'code' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="md:col-span-3 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 select-none md:border-r border-dark-border pr-0 md:pr-2">
                  {['App.jsx', 'Component.jsx', 'server.js', 'routes.js', 'schema.js'].map((filename) => (
                    <button
                      key={filename}
                      onClick={() => setActiveCodeFile(filename)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-left transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                        activeCodeFile === filename
                          ? 'bg-brand-500/10 text-brand-500'
                          : 'text-dark-muted hover:text-white bg-transparent'
                      }`}
                    >
                      {filename.endsWith('.jsx') ? (
                        <FiLayout className="w-3 h-3 flex-shrink-0" />
                      ) : filename.endsWith('.js') && filename !== 'schema.js' ? (
                        <FiServer className="w-3 h-3 flex-shrink-0" />
                      ) : (
                        <FiDatabase className="w-3 h-3 flex-shrink-0" />
                      )}
                      <span>{filename}</span>
                    </button>
                  ))}
                </div>
                <div className="md:col-span-9">
                  <CodeBlock
                    code={getStarterCode(activeCodeFile)}
                    language={activeCodeFile.endsWith('.jsx') ? 'jsx' : 'javascript'}
                  />
                </div>
              </div>
            )}

            {/* Preview Tab */}
            {activeTab === 'preview' && (
              <div className="py-2">
                {renderPreview()}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Render plain markdown scaffold block if no structured projectId exists */
        <div className="p-4 bg-dark-bg/20 space-y-4">
          <div className="prose-custom max-h-[400px] overflow-y-auto pr-1.5 scrollbar-thin">
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
              {result}
            </ReactMarkdown>
          </div>
          
          <div className="p-3 bg-dark-card border border-dark-border/80 rounded-xl text-[10px] text-dark-muted font-mono leading-relaxed select-none">
            <span className="font-bold text-white block mb-1">Backend Configuration Notice:</span>
            <span>Structured code navigation and ZIP folder downloads require a database backend setup. Currently running on the dynamic Z.ai text completions profile.</span>
          </div>
        </div>
      )}
    </div>
  );
}
