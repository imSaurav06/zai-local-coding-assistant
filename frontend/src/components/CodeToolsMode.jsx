import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatService } from '../services/chatService';
import { historyService } from '../services/historyService';
import PromptTemplates from './PromptTemplates';
import CodeBlock from './CodeBlock';
import Loader from './Loader';
import ErrorMessage from './ErrorMessage';
import EmptyState from './EmptyState';
import { 
  FiTerminal, 
  FiPlay, 
  FiHelpCircle, 
  FiCheck, 
  FiTrash2, 
  FiSave, 
  FiCopy,
  FiFileText
} from 'react-icons/fi';
import { copyToClipboard } from '../utils/copyToClipboard';

export default function CodeToolsMode() {
  const [prompt, setPrompt] = useState('');
  const [editorCode, setEditorCode] = useState(`// Write or paste Javascript scripts here\nfunction calculateAverage(list) {\n  let sum = 0;\n  for (let i = 0; i <= list.length; i++) {\n    sum += list[i].value;\n  }\n  return sum / list.length;\n}`);
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setError('');
    setLoading(true);
    setSaveStatus('');
    try {
      const res = await chatService.generateCode({ prompt });
      setOutput(res.message);
      
      // Auto extract javascript blocks
      const codeRegex = /```(?:javascript|js|jsx)\n([\s\S]*?)```/i;
      const match = codeRegex.exec(res.message);
      if (match && match[1]) {
        setEditorCode(match[1].trim());
      }
    } catch (err) {
      setError(err.message || 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!editorCode.trim()) {
      setError('Please provide code to explain.');
      return;
    }
    setError('');
    setLoading(true);
    setSaveStatus('');
    try {
      const res = await chatService.explainCode({ prompt, code: editorCode });
      setOutput(res.message);
    } catch (err) {
      setError(err.message || 'Explanation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleFix = async () => {
    if (!editorCode.trim()) {
      setError('Please provide code to refactor.');
      return;
    }
    setError('');
    setLoading(true);
    setSaveStatus('');
    try {
      const res = await chatService.fixCode({ prompt, code: editorCode });
      setOutput(res.message);

      const codeRegex = /```(?:javascript|js|jsx)\n([\s\S]*?)```/i;
      const match = codeRegex.exec(res.message);
      if (match && match[1]) {
        setEditorCode(match[1].trim());
      }
    } catch (err) {
      setError(err.message || 'Fix execution failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOutput = async () => {
    if (!output.trim()) return;
    const success = await copyToClipboard(output);
    if (success) {
      setSaveStatus('Response copied!');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };

  const handleSaveToHistory = async () => {
    if (!output.trim()) return;
    setError('');
    setLoading(true);
    try {
      await historyService.saveHistory({
        prompt: prompt || 'Code Workspace Operation',
        response: `### Sandbox Script\n\`\`\`javascript\n${editorCode}\n\`\`\`\n\n${output}`,
        type: 'code',
        model: 'glm-5.1'
      });
      setSaveStatus('Saved to History!');
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (err) {
      setError('Could not persist history logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPrompt('');
    setEditorCode('');
    setOutput('');
    setError('');
    setSaveStatus('');
  };

  return (
    <div className="space-y-6">
      {/* Upper Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Commands Panel */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-4 shadow flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-dark-border/40 pb-2.5 mb-3 select-none">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Instructions</h3>
              <button
                type="button"
                onClick={handleClear}
                className="text-[10px] font-semibold text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              >
                <FiTrash2 className="w-3.5 h-3.5 inline mr-1" />
                <span>Clear Workspace</span>
              </button>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-dark-muted mb-2 px-1">
                Workspace Suggestions
              </p>
              <PromptTemplates onSelect={(txt) => setPrompt(txt)} />
            </div>

            <div className="mt-4">
              <label htmlFor="codeToolsPrompt" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Command Prompts
              </label>
              <textarea
                id="codeToolsPrompt"
                rows="2"
                placeholder="Instruct AI what script structure to build or audit..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="block w-full px-3 py-2 bg-slate-900 border border-dark-border rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-brand-500 text-xs font-medium resize-none scrollbar-thin"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider cursor-pointer"
          >
            <FiPlay className="w-4 h-4" />
            <span>Generate Code</span>
          </button>
        </div>

        {/* Right Side: Response Panel */}
        <div className="flex flex-col min-h-[260px]">
          {loading && (
            <div className="bg-dark-card border border-dark-border rounded-2xl p-8 text-center shadow h-full flex flex-col items-center justify-center">
              <Loader size="lg" />
              <p className="text-xs text-slate-400 mt-3 animate-pulse">Running semantic evaluation...</p>
            </div>
          )}

          {!loading && !output && (
            <div className="h-full">
              <EmptyState
                title="Compilation Output"
                message="Run prompt calculations or trigger explanations to view formatting code blocks here."
                icon={FiFileText}
              />
            </div>
          )}

          {!loading && output && (
            <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow flex flex-col justify-between h-full">
              <div>
                <div className="flex justify-between items-center border-b border-dark-border/40 pb-2 mb-3 select-none">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Compiler response</span>
                  <div className="flex items-center gap-2 text-dark-muted">
                    <button
                      onClick={handleCopyOutput}
                      className="p-1 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                      title="Copy response content"
                    >
                      <FiCopy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleSaveToHistory}
                      className="p-1 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                      title="Save script details to history logs"
                    >
                      <FiSave className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="prose-custom max-h-[30vh] overflow-y-auto pr-1.5 scrollbar-thin">
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
              </div>

              {saveStatus && (
                <div className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded w-fit mt-3 select-none">
                  {saveStatus}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Editor Row (Full Width Bottom Area) */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-dark-border/40 pb-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5 select-none">
              <FiTerminal className="text-brand-400" />
              <span>Developer Script Editor</span>
            </h4>
            <p className="text-xs text-dark-muted mt-0.5">
              Refactor logic models or inspect files. Trigger operations.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExplain}
              disabled={loading || !editorCode.trim()}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-dark-border cursor-pointer transition-all"
            >
              <FiHelpCircle className="w-3.5 h-3.5" />
              <span>Explain</span>
            </button>
            <button
              onClick={handleFix}
              disabled={loading || !editorCode.trim()}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50 text-indigo-400 hover:text-brand-300 rounded-lg text-xs font-semibold border border-indigo-500/20 cursor-pointer transition-all"
            >
              <FiTerminal className="w-3.5 h-3.5" />
              <span>Fix Bug</span>
            </button>
          </div>
        </div>

        {/* Text Editor Textarea */}
        <div className="relative border border-dark-border rounded-xl overflow-hidden bg-slate-900/60 p-4 flex">
          <div className="select-none text-right pr-3.5 text-slate-750 border-r border-dark-border/50 font-mono text-xs w-8 flex-shrink-0 flex flex-col">
            {Array.from({ length: Math.max(6, editorCode.split('\n').length || 1) }).map((_, i) => (
              <span key={i} className="block leading-6">{i + 1}</span>
            ))}
          </div>

          <textarea
            value={editorCode}
            onChange={(e) => setEditorCode(e.target.value)}
            disabled={loading}
            placeholder="// Paste source codes to audit..."
            className="flex-grow bg-transparent border-0 outline-none text-white pl-4 resize-none min-h-[140px] max-h-[260px] font-mono text-xs leading-6 scrollbar-thin"
          />
        </div>

        {error && <ErrorMessage message={error} />}
      </div>
    </div>
  );
}
