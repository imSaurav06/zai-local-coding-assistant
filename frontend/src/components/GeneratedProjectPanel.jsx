import React, { useState, useEffect } from 'react';
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
  FiBookOpen,
  FiCopy,
  FiCheck
} from 'react-icons/fi';
import api from '../services/api';

export default function GeneratedProjectPanel({ generatedProject }) {
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
    designPreference = 'Dark Navy Professional',
    files = [],
    runInstructions = null
  } = generatedProject;

  const [activeTab, setActiveTab] = useState('plan'); // 'plan' | 'code' | 'preview'
  const [activeCodeFile, setActiveCodeFile] = useState('README.md');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState('');

  // Update active file dynamically when files change
  useEffect(() => {
    if (files && files.length > 0) {
      // Prefer README.md if available
      const hasReadme = files.some(f => f.name.toLowerCase() === 'readme.md');
      setActiveCodeFile(hasReadme ? 'README.md' : files[0].name);
    }
  }, [files]);

  const handleDownload = async () => {
    if (!projectId) {
      setDownloadError("The current backend Z.ai API does not support project ZIP exports (missing projectId).");
      setTimeout(() => setDownloadError(''), 5000);
      return;
    }

    setDownloading(true);
    setDownloadError('');

    try {
      const response = await api.get(`/project/${projectId}/download`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const contentDisposition = response.headers['content-disposition'];
      let filename = `${projectName.toLowerCase().replace(/\s+/g, '_') || 'project'}.zip`;
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

  const getStarterCode = (filename) => {
    const matched = files.find(f => f.name === filename);
    return matched ? matched.content : '';
  };

  const handleCopyCommand = (cmd) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCommand(cmd);
    setTimeout(() => setCopiedCommand(''), 2000);
  };

  const renderPreview = () => {
    const isDark = designPreference.toLowerCase().includes('dark');
    const colorThemeClass = isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900';
    const cardBgClass = isDark ? 'bg-slate-900 border-slate-850' : 'bg-white border-slate-200';
    
    if (projectType.includes('E-commerce')) {
      return (
        <div className={`p-5 rounded-xl border max-w-lg mx-auto space-y-3 shadow-md ${colorThemeClass} ${cardBgClass}`}>
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold flex items-center gap-1 text-xs uppercase tracking-wider text-white">
              <FiShoppingBag className="text-brand-500" />
              <span>{projectName || 'E-Shop'}</span>
            </h4>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded">Active Store</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 border rounded-lg ${cardBgClass} flex flex-col justify-between`}>
              <h5 className="text-[11px] font-bold text-white">Mechanical Keyboard</h5>
              <div className="flex justify-between items-center mt-2.5">
                <span className="text-xs font-semibold text-brand-500">$89</span>
                <span className="px-1.5 py-0.5 bg-brand-500 text-white rounded text-[8px] font-bold">Add</span>
              </div>
            </div>
            <div className={`p-3 border rounded-lg ${cardBgClass} flex flex-col justify-between`}>
              <h5 className="text-[11px] font-bold text-white">Wireless Mouse</h5>
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
            <h4 className="font-bold flex items-center gap-1 text-xs uppercase tracking-wider text-white">
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

    return (
      <div className={`p-5 rounded-xl border max-w-lg mx-auto text-center space-y-3 shadow-md ${colorThemeClass} ${cardBgClass}`}>
        <h4 className="text-sm font-bold text-white">{projectName}</h4>
        <p className="text-xs text-slate-400 leading-relaxed">
          A customized {projectType} layout compiled inside a safe preview sandbox.
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

        {/* Download Project Button */}
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

      {/* Collapsible Local Setup Instructions Guide */}
      {runInstructions && (
        <div className="border-b border-dark-border bg-[#19191d]">
          <button
            onClick={() => setGuideOpen(!guideOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer select-none"
          >
            <span className="flex items-center gap-2">
              <FiBookOpen className="text-brand-500 w-4 h-4" />
              <span>How to Run Locally</span>
            </span>
            <span className="text-[9px] px-2 py-0.5 bg-slate-900 border border-dark-border text-dark-muted rounded-full">
              {guideOpen ? 'Hide Guide' : 'Show Guide'}
            </span>
          </button>

          {guideOpen && (
            <div className="p-4 text-xs text-dark-text border-t border-dark-border/40 bg-dark-bg/10 space-y-3 font-sans">
              <div className="bg-slate-900/60 border border-dark-border/50 rounded-xl p-3.5 space-y-3">
                {/* Prerequisites */}
                {runInstructions.prerequisites && runInstructions.prerequisites.length > 0 && (
                  <div>
                    <h5 className="font-bold text-white mb-1.5 uppercase text-[9px] tracking-wider text-brand-400 font-mono">Prerequisites</h5>
                    <ul className="list-disc list-inside text-slate-400 space-y-0.5 pl-1 leading-relaxed">
                      {runInstructions.prerequisites.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Steps */}
                {runInstructions.steps && runInstructions.steps.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-bold text-white mb-2 uppercase text-[9px] tracking-wider text-brand-400 font-mono">Setup & Execution Steps</h5>
                    <ol className="list-decimal list-inside text-slate-400 space-y-3.5 pl-1">
                      {runInstructions.steps.map((step, i) => {
                        const cmdRegex = /`([^`]+)`/g;
                        const hasCommand = cmdRegex.test(step);
                        
                        if (hasCommand) {
                          cmdRegex.lastIndex = 0;
                          const commands = [];
                          let match;
                          while ((match = cmdRegex.exec(step)) !== null) {
                            commands.push(match[1]);
                          }

                          return (
                            <li key={i} className="leading-relaxed">
                              <span>{step.replace(/`([^`]+)`/g, '"$1"')}</span>
                              <div className="mt-1.5 flex flex-wrap gap-2 pl-4">
                                {commands.map((cmd, idx) => {
                                  const isCopied = copiedCommand === cmd;
                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => handleCopyCommand(cmd)}
                                      className="px-2 py-1 bg-[#141416] border border-dark-border text-[9px] font-mono text-brand-400 hover:text-white rounded hover:bg-dark-hover active:bg-dark-bg transition-all flex items-center gap-1.5 cursor-pointer"
                                    >
                                      {isCopied ? <FiCheck className="text-emerald-500" /> : <FiCopy />}
                                      <span>Copy:</span>
                                      <code className="text-white bg-black px-1.5 py-0.5 rounded text-[8px] font-bold">{cmd}</code>
                                    </button>
                                  );
                                })}
                              </div>
                            </li>
                          );
                        }

                        return (
                          <li key={i} className="leading-relaxed">
                            {step}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}

                {/* Expected Localhost URLs */}
                {(runInstructions.frontendUrl || runInstructions.backendUrl) && (
                  <div className="border-t border-dark-border/40 pt-3 flex flex-wrap gap-6 text-[10px]">
                    {runInstructions.frontendUrl && (
                      <div>
                        <span className="text-dark-muted uppercase font-bold text-[8px] tracking-wider block mb-0.5">Frontend Dev URL</span>
                        <a
                          href={runInstructions.frontendUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-400 hover:underline font-mono font-bold"
                        >
                          {runInstructions.frontendUrl}
                        </a>
                      </div>
                    )}
                    {runInstructions.backendUrl && (
                      <div>
                        <span className="text-dark-muted uppercase font-bold text-[8px] tracking-wider block mb-0.5">Backend API URL</span>
                        <a
                          href={runInstructions.backendUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-400 hover:underline font-mono font-bold"
                        >
                          {runInstructions.backendUrl}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
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
              <span>Files ({files.length})</span>
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
            {activeTab === 'code' && files.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="md:col-span-3 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-y-auto max-h-[300px] pb-2 md:pb-0 select-none md:border-r border-dark-border pr-0 md:pr-2 scrollbar-thin">
                  {files.map((file) => (
                    <button
                      key={file.name}
                      onClick={() => setActiveCodeFile(file.name)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-left transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                        activeCodeFile === file.name
                          ? 'bg-brand-500/10 text-brand-500'
                          : 'text-slate-400 hover:text-white bg-transparent'
                      }`}
                    >
                      {file.name.endsWith('.jsx') ? (
                        <FiLayout className="w-3.5 h-3.5 flex-shrink-0" />
                      ) : file.name.endsWith('.js') && !file.name.toLowerCase().includes('schema') && !file.name.toLowerCase().includes('model') ? (
                        <FiServer className="w-3.5 h-3.5 flex-shrink-0" />
                      ) : file.name.toLowerCase().includes('schema') || file.name.toLowerCase().includes('model') ? (
                        <FiDatabase className="w-3.5 h-3.5 flex-shrink-0" />
                      ) : (
                        <FiCode className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span className="truncate max-w-[120px] font-mono" title={file.name}>
                        {file.name.split('/').pop()}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="md:col-span-9">
                  <div className="text-[10px] text-dark-muted font-mono mb-2 bg-[#141416] px-3 py-1.5 rounded border border-dark-border/40 select-none flex justify-between items-center">
                    <span>File: <strong className="text-slate-200">{activeCodeFile}</strong></span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500">{activeCodeFile.split('.').pop()} source</span>
                  </div>
                  <CodeBlock
                    code={getStarterCode(activeCodeFile)}
                    language={activeCodeFile.endsWith('.jsx') ? 'jsx' : activeCodeFile.endsWith('.json') ? 'json' : 'javascript'}
                  />
                </div>
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
