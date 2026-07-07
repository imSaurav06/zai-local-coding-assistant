import React from 'react';
import { promptTemplates } from '../data/promptTemplates';
import { 
  FiCode, 
  FiServer, 
  FiDatabase, 
  FiAlertTriangle, 
  FiHelpCircle, 
  FiFolder, 
  FiLock, 
  FiLayout 
} from 'react-icons/fi';

// Map string icons to React Icons
const iconMap = {
  "gen-react-component": FiCode,
  "gen-express-api": FiServer,
  "create-mongo-schema": FiDatabase,
  "fix-code-bug": FiAlertTriangle,
  "explain-code": FiHelpCircle,
  "create-project-struct": FiFolder,
  "create-auth-flow": FiLock,
  "create-dashboard-ui": FiLayout
};

export default function PromptTemplates({ onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
      {promptTemplates.map((template) => {
        const IconComponent = iconMap[template.id] || FiCode;
        return (
          <button
            key={template.id}
            onClick={() => onSelect(template.prompt)}
            className="flex flex-col text-left p-4 bg-dark-card border border-dark-border hover:border-brand-500/50 hover:bg-dark-hover rounded-xl shadow transition-all duration-300 group cursor-pointer"
          >
            <div className="p-2 bg-slate-800/60 text-brand-400 group-hover:text-brand-300 rounded-lg mb-3 flex-shrink-0">
              <IconComponent className="w-5 h-5" />
            </div>
            <h4 className="text-white text-sm font-bold mb-1 group-hover:text-brand-300 transition-colors">
              {template.title}
            </h4>
            <p className="text-dark-muted text-xs leading-relaxed line-clamp-2">
              {template.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
