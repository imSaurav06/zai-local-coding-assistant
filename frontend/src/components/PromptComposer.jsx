import React, { useState } from 'react';
import { 
  FiSend, 
  FiSettings, 
  FiCpu, 
  FiSliders,
  FiTerminal
} from 'react-icons/fi';
import BuildOptions from './BuildOptions';
import ToolSelector from './ToolSelector';

export default function PromptComposer({ 
  prompt, 
  setPrompt, 
  onSend, 
  loading, 
  activeMode,
  buildOptions,
  setBuildOptions,
  selectedTool,
  setSelectedTool
}) {
  const [showBuildOptions, setShowBuildOptions] = useState(false);
  const [showToolSelector, setShowToolSelector] = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && prompt.trim()) {
        onSend();
      }
    }
  };

  const getPlaceholder = () => {
    switch (activeMode) {
      case 'build':
        return "Describe the application you want to build...";
      case 'tools':
        return "Paste code or describe what you want to generate...";
      case 'ask':
      default:
        return "Ask Z.ai about code, architecture, debugging...";
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto space-y-2 select-none">
      {/* Configuration Panels (Expand above the composer textbox) */}
      
      {activeMode === 'build' && showBuildOptions && (
        <div className="absolute bottom-full mb-2 left-0 right-0 z-20">
          <BuildOptions 
            options={buildOptions} 
            setOptions={setBuildOptions} 
            onClose={() => setShowBuildOptions(false)} 
          />
        </div>
      )}

      {activeMode === 'tools' && showToolSelector && (
        <div className="absolute bottom-full mb-2 left-0 z-20">
          <ToolSelector 
            selectedTool={selectedTool} 
            setSelectedTool={setSelectedTool} 
            onClose={() => setShowToolSelector(false)} 
          />
        </div>
      )}

      {/* Main Composer Box */}
      <div className="relative bg-dark-composer border border-dark-border rounded-2xl focus-within:border-brand-500/80 transition-all p-2 flex items-end shadow-lg shadow-black/20">
        
        {/* Left Option Triggers */}
        <div className="flex gap-1.5 pb-1 pl-1">
          {activeMode === 'build' && (
            <button
              type="button"
              onClick={() => setShowBuildOptions(!showBuildOptions)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                showBuildOptions 
                  ? 'bg-brand-500/10 text-brand-500 border-brand-500/25' 
                  : 'bg-dark-hover text-dark-muted hover:text-white border-dark-border'
              }`}
              title="Configure build parameters"
              aria-label="Build options settings"
            >
              <FiSliders className="w-4 h-4" />
            </button>
          )}

          {activeMode === 'tools' && (
            <button
              type="button"
              onClick={() => setShowToolSelector(!showToolSelector)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
                showToolSelector 
                  ? 'bg-brand-500/10 text-brand-500 border-brand-500/25' 
                  : 'bg-dark-hover text-dark-muted hover:text-white border-dark-border'
              }`}
              title="Select Code Tool"
              aria-label="Code tool settings"
            >
              <FiTerminal className="w-4 h-4" />
              <span className="hidden sm:inline">{selectedTool ? selectedTool.label : 'Select Tool'}</span>
            </button>
          )}
        </div>

        {/* Composer Textarea */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={2}
          placeholder={getPlaceholder()}
          className="flex-1 bg-transparent border-0 outline-none text-xs text-white placeholder-dark-muted/70 px-3 py-2 resize-none max-h-36 min-h-[40px] leading-relaxed scrollbar-thin"
        />

        {/* Right Action Button */}
        <div className="flex items-center gap-2 pb-1 pr-1 flex-shrink-0">
          {loading && (
            <div className="flex items-center gap-1.5 mr-2 text-[10px] text-brand-500 font-bold select-none animate-pulse">
              <FiCpu className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">Generating...</span>
            </div>
          )}
          <button
            onClick={() => onSend()}
            disabled={loading || !prompt.trim()}
            className="p-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl transition-all shadow-md cursor-pointer flex-shrink-0"
            aria-label="Send message prompt"
          >
            <FiSend className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
