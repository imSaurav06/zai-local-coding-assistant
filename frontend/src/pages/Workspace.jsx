import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BuildProjectMode from '../components/BuildProjectMode';
import AskAIMode from '../components/AskAIMode';
import CodeToolsMode from '../components/CodeToolsMode';
import { FiLayers, FiMessageSquare, FiTerminal } from 'react-icons/fi';

export default function Workspace() {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeMode, setActiveMode] = useState('build'); // 'build' | 'ask' | 'tools'
  
  // A simple render key to force rebuild the active child component (e.g. when resetting the state)
  const [resetKey, setResetKey] = useState(0);

  // Monitor location state from sidebar clicks (e.g. New Project resets workspace)
  useEffect(() => {
    if (location.state && location.state.reset) {
      setActiveMode('build');
      setResetKey((prev) => prev + 1);
      
      // Clear navigation state so subsequent renders don't keep resetting
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Main Mode Selector Tabs */}
      <div className="flex border-b border-dark-border bg-dark-card rounded-xl p-1.5 shadow select-none max-w-md">
        <button
          onClick={() => setActiveMode('build')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeMode === 'build'
              ? 'bg-brand-500 text-white shadow-md'
              : 'text-dark-muted hover:text-white hover:bg-dark-hover'
          }`}
        >
          <FiLayers className="w-4 h-4" />
          <span>Build Project</span>
        </button>
        <button
          onClick={() => setActiveMode('ask')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeMode === 'ask'
              ? 'bg-brand-500 text-white shadow-md'
              : 'text-dark-muted hover:text-white hover:bg-dark-hover'
          }`}
        >
          <FiMessageSquare className="w-4 h-4" />
          <span>Ask AI</span>
        </button>
        <button
          onClick={() => setActiveMode('tools')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeMode === 'tools'
              ? 'bg-brand-500 text-white shadow-md'
              : 'text-dark-muted hover:text-white hover:bg-dark-hover'
          }`}
        >
          <FiTerminal className="w-4 h-4" />
          <span>Code Tools</span>
        </button>
      </div>

      {/* Render Active Workspace Mode */}
      <div className="mt-4">
        {activeMode === 'build' && <BuildProjectMode key={resetKey} />}
        {activeMode === 'ask' && <AskAIMode key={resetKey} />}
        {activeMode === 'tools' && <CodeToolsMode key={resetKey} />}
      </div>
    </div>
  );
}
