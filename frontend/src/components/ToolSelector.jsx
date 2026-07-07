import React from 'react';
import { FiX, FiCheck } from 'react-icons/fi';

export const toolOptions = [
  { id: 'gen-react-component', label: 'Generate React Component', promptPrefix: 'Generate a React component based on this request:\n\n' },
  { id: 'gen-express-api', label: 'Generate Express API', promptPrefix: 'Generate an Express API based on this request:\n\n' },
  { id: 'gen-mongo-schema', label: 'Generate MongoDB Schema', promptPrefix: 'Generate a MongoDB Mongoose schema based on this request:\n\n' },
  { id: 'gen-folder-struct', label: 'Generate Folder Structure', promptPrefix: 'Generate a project folder directory structure outline based on this request:\n\n' },
  { id: 'fix-code', label: 'Fix Code and Explain', promptPrefix: 'Audits and repairs bugs in the following script and provides a detailed logic review explanation:\n\n' },
  { id: 'explain-code', label: 'Explain Code', promptPrefix: 'Exposes step-by-step functionality breakdowns for this script:\n\n' }
];

export default function ToolSelector({ selectedTool, setSelectedTool, onClose }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-3.5 shadow-2xl w-64 text-dark-text select-none animate-fadeIn">
      <div className="flex justify-between items-center border-b border-dark-border/40 pb-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-dark-muted">Select Code Tool</span>
        <button 
          type="button"
          onClick={onClose}
          className="text-dark-muted hover:text-white transition-colors cursor-pointer"
        >
          <FiX className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1 max-h-56 overflow-y-auto scrollbar-none">
        {toolOptions.map((tool) => {
          const isSelected = selectedTool?.id === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => {
                setSelectedTool(tool);
                onClose();
              }}
              className={`w-full flex items-center justify-between text-left px-2.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isSelected 
                  ? 'bg-brand-500/10 text-brand-500 border border-brand-500/25' 
                  : 'text-dark-muted hover:text-white hover:bg-dark-hover border border-transparent'
              }`}
            >
              <span>{tool.label}</span>
              {isSelected && <FiCheck className="w-3.5 h-3.5 text-brand-500 flex-shrink-0 ml-2" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
