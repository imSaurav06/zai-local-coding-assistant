import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  FiUser, 
  FiCpu, 
  FiSettings, 
  FiPlay, 
  FiLoader, 
  FiAlertTriangle,
  FiTerminal,
  FiFolder,
  FiCode,
  FiLayers,
  FiLock,
  FiDatabase,
  FiGlobe
} from 'react-icons/fi';
import CodeBlock from './CodeBlock';
import GeneratedProjectPanel from './GeneratedProjectPanel';

export default function MessageBubble({ msg, msgIndex, onGenerateProject }) {
  const isUser = msg.sender === 'user';
  const isSpec = msg.type === 'project-spec';

  // State for editable project specification
  const [spec, setSpec] = useState(msg.projectSpec || null);

  useEffect(() => {
    if (msg.projectSpec) {
      setSpec(msg.projectSpec);
    }
  }, [msg.projectSpec]);

  const handleFieldChange = (name, value) => {
    setSpec((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleListFieldChange = (name, valStr) => {
    const list = valStr.split(',').map(item => item.trim()).filter(Boolean);
    setSpec((prev) => ({
      ...prev,
      [name]: list
    }));
  };

  const handleGenerate = () => {
    if (onGenerateProject && spec) {
      onGenerateProject(msgIndex, spec);
    }
  };

  return (
    <div className={`flex gap-4 p-5 rounded-2xl border transition-all ${
      isUser
        ? 'bg-dark-card/30 border-dark-border/40 max-w-3xl ml-auto flex-row-reverse'
        : 'bg-dark-card/85 border-dark-border/60 max-w-4xl mr-auto w-full'
    }`}>
      {/* Avatar Icon */}
      <div className={`p-2 rounded-xl h-fit flex-shrink-0 border select-none ${
        isUser
          ? 'bg-dark-composer text-dark-muted border-dark-border'
          : 'bg-brand-500/10 text-brand-500 border-brand-500/20'
      }`}>
        {isUser ? <FiUser className="w-4 h-4" /> : <FiCpu className="w-4 h-4" />}
      </div>

      {/* Message Content */}
      <div className="flex-grow min-w-0">
        {/* Header Metadata */}
        <div className="flex justify-between items-center mb-2.5 select-none text-[10px] text-dark-muted font-mono">
          <span className="font-bold text-dark-text/70">
            {isUser ? 'You' : 'Z.ai Assistant'}
          </span>
          <span>
            {!isUser && msg.model && `[${msg.model}] `}
            {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>

        {isUser ? (
          <p className="text-slate-200 text-sm whitespace-pre-wrap font-mono leading-relaxed">
            {msg.content}
          </p>
        ) : isSpec && spec ? (
          // STAGE 1: Render Interactive Requirement Specification Card
          <div className="space-y-4 font-sans text-dark-text">
            <div className="flex items-center gap-2 border-b border-dark-border/40 pb-2">
              <FiSettings className="text-brand-500 w-4 h-4 animate-spin-slow" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">Project Specification Plan</h3>
              <span className="text-[8px] bg-brand-500/10 text-brand-500 px-1.5 py-0.5 rounded border border-brand-500/20 uppercase tracking-widest font-bold ml-auto font-mono">AI Inferred</span>
            </div>

            <p className="text-xs text-dark-muted leading-relaxed">
              Z.ai has inferred the following project architecture from your request. You can edit any field to customize before generating.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {/* Project Name */}
              <div>
                <label className="block text-[9px] uppercase font-bold text-dark-muted tracking-wider mb-1">Project Name</label>
                <input
                  type="text"
                  value={spec.projectName || ''}
                  onChange={(e) => handleFieldChange('projectName', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white font-mono text-xs focus:outline-none focus:border-brand-500/50"
                />
              </div>

              {/* Project Type */}
              <div>
                <label className="block text-[9px] uppercase font-bold text-dark-muted tracking-wider mb-1">Project Type</label>
                <input
                  type="text"
                  value={spec.projectType || ''}
                  onChange={(e) => handleFieldChange('projectType', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none focus:border-brand-500/50"
                />
              </div>

              {/* Frontend Framework */}
              <div>
                <label className="block text-[9px] uppercase font-bold text-dark-muted tracking-wider mb-1 flex items-center gap-1">
                  <FiGlobe className="text-brand-400 w-3 h-3" />
                  <span>Frontend Stack</span>
                </label>
                <input
                  type="text"
                  value={spec.frontend || ''}
                  onChange={(e) => handleFieldChange('frontend', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none focus:border-brand-500/50"
                />
              </div>

              {/* Backend Framework */}
              <div>
                <label className="block text-[9px] uppercase font-bold text-dark-muted tracking-wider mb-1 flex items-center gap-1">
                  <FiTerminal className="text-brand-400 w-3 h-3" />
                  <span>Backend Framework</span>
                </label>
                <input
                  type="text"
                  value={spec.backend || ''}
                  onChange={(e) => handleFieldChange('backend', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none focus:border-brand-500/50"
                />
              </div>

              {/* Database */}
              <div>
                <label className="block text-[9px] uppercase font-bold text-dark-muted tracking-wider mb-1 flex items-center gap-1">
                  <FiDatabase className="text-brand-400 w-3 h-3" />
                  <span>Database</span>
                </label>
                <input
                  type="text"
                  value={spec.database || ''}
                  onChange={(e) => handleFieldChange('database', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none focus:border-brand-500/50"
                />
              </div>

              {/* Authentication */}
              <div>
                <label className="block text-[9px] uppercase font-bold text-dark-muted tracking-wider mb-1 flex items-center gap-1">
                  <FiLock className="text-brand-400 w-3 h-3" />
                  <span>Authentication</span>
                </label>
                <input
                  type="text"
                  value={spec.authentication || ''}
                  onChange={(e) => handleFieldChange('authentication', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none focus:border-brand-500/50"
                />
              </div>

              {/* Main Features */}
              <div className="md:col-span-2">
                <label className="block text-[9px] uppercase font-bold text-dark-muted tracking-wider mb-1">Main Features (comma separated)</label>
                <textarea
                  rows={2}
                  value={spec.mainFeatures ? spec.mainFeatures.join(', ') : ''}
                  onChange={(e) => handleListFieldChange('mainFeatures', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none focus:border-brand-500/50 resize-none"
                />
              </div>

              {/* Important Dependencies */}
              <div className="md:col-span-2">
                <label className="block text-[9px] uppercase font-bold text-dark-muted tracking-wider mb-1">Important Dependencies (comma separated)</label>
                <input
                  type="text"
                  value={spec.importantDependencies ? spec.importantDependencies.join(', ') : ''}
                  onChange={(e) => handleListFieldChange('importantDependencies', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white font-mono text-xs focus:outline-none focus:border-brand-500/50"
                />
              </div>

              {/* Environment Variables */}
              <div className="md:col-span-2">
                <label className="block text-[9px] uppercase font-bold text-dark-muted tracking-wider mb-1">Environment Variables Required (comma separated)</label>
                <input
                  type="text"
                  value={spec.environmentVariables ? spec.environmentVariables.join(', ') : ''}
                  onChange={(e) => handleListFieldChange('environmentVariables', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white font-mono text-xs focus:outline-none focus:border-brand-500/50"
                />
              </div>
            </div>

            {/* Error Message if Generation failed */}
            {msg.generationError && (
              <div className="border border-red-500/35 bg-red-950/20 rounded-xl p-3 flex gap-2.5 items-start text-red-400 text-xs mt-2 select-none">
                <FiAlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                <div className="space-y-1">
                  <span className="font-extrabold uppercase text-[9px] tracking-wider block text-red-300">Codebase Scaffolding Failed Validation</span>
                  <p className="font-mono text-[10px] leading-relaxed whitespace-pre-wrap">{msg.generationError}</p>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center gap-3 pt-2 border-t border-dark-border/40 select-none">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={msg.generating}
                className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md disabled:cursor-not-allowed"
              >
                {msg.generating ? (
                  <>
                    <FiLoader className="w-3.5 h-3.5 animate-spin" />
                    <span>Scaffolding Files...</span>
                  </>
                ) : (
                  <>
                    <FiPlay className="w-3 h-3 fill-current" />
                    <span>Generate Project</span>
                  </>
                )}
              </button>

              {msg.generating && (
                <span className="text-[10px] text-brand-400 font-bold animate-pulse flex items-center gap-1.5">
                  <span>{msg.progressStage ? `${msg.progressStage}: ${msg.progressText || ""}` : "Initializing generation pipeline..."}</span>
                </span>
              )}
            </div>
          </div>
        ) : (
          // STAGE 2 / Standard Assistant response
          <div className="space-y-4">
            {/* Standard AI Markdown Response */}
            {msg.content && (
              <div className="prose-custom">
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
                  {msg.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Render Generated Project Scaffolding Panel (if applicable) */}
            {msg.generatedProject && (
              <div className="pt-2 border-t border-dark-border/40">
                <GeneratedProjectPanel generatedProject={msg.generatedProject} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
