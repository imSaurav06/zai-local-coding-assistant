import React from 'react';
import { FiX } from 'react-icons/fi';

export default function BuildOptions({ options, setOptions, onClose }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setOptions((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-4 shadow-2xl w-full max-w-lg text-dark-text select-none animate-fadeIn border-t-2 border-t-brand-500">
      <div className="flex justify-between items-center border-b border-dark-border/40 pb-2 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-dark-muted">Project Scaffolding Settings</span>
        <button 
          type="button" 
          onClick={onClose}
          className="text-dark-muted hover:text-white transition-colors cursor-pointer"
        >
          <FiX className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
        {/* Project Name */}
        <div className="col-span-2">
          <label className="block font-bold text-dark-muted uppercase mb-1">Project Name</label>
          <input
            type="text"
            name="projectName"
            placeholder="e.g. AcmeStore"
            value={options.projectName || ''}
            onChange={handleChange}
            className="block w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Project Type */}
        <div className="col-span-2">
          <label className="block font-bold text-dark-muted uppercase mb-1">Project Type</label>
          <select
            name="projectType"
            value={options.projectType || 'Web Application'}
            onChange={handleChange}
            className="block w-full px-2.5 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none focus:border-brand-500"
          >
            <option>Web Application</option>
            <option>E-commerce Platform</option>
            <option>SaaS Dashboard</option>
            <option>REST API Service</option>
          </select>
        </div>

        {/* Frontend Framework */}
        <div>
          <label className="block font-bold text-dark-muted uppercase mb-1">Frontend</label>
          <select
            name="frontendFramework"
            value={options.frontendFramework || 'React.js (Vite)'}
            onChange={handleChange}
            className="block w-full px-2 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none"
          >
            <option>React.js (Vite)</option>
            <option>Vue.js</option>
            <option>Vanilla HTML/JS</option>
          </select>
        </div>

        {/* Backend Framework */}
        <div>
          <label className="block font-bold text-dark-muted uppercase mb-1">Backend</label>
          <select
            name="backendFramework"
            value={options.backendFramework || 'Express.js (Node)'}
            onChange={handleChange}
            className="block w-full px-2 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none"
          >
            <option>Express.js (Node)</option>
            <option>FastAPI (Python)</option>
            <option>No Backend</option>
          </select>
        </div>

        {/* Database */}
        <div>
          <label className="block font-bold text-dark-muted uppercase mb-1">Database</label>
          <select
            name="database"
            value={options.database || 'MongoDB (Mongoose)'}
            onChange={handleChange}
            className="block w-full px-2 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none"
          >
            <option>MongoDB (Mongoose)</option>
            <option>PostgreSQL (Sequelize)</option>
            <option>No Database</option>
          </select>
        </div>

        {/* Theme */}
        <div>
          <label className="block font-bold text-dark-muted uppercase mb-1">Design Theme</label>
          <select
            name="designPreference"
            value={options.designPreference || 'Dark Navy Professional'}
            onChange={handleChange}
            className="block w-full px-2 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none"
          >
            <option>Dark Navy Professional</option>
            <option>Emerald Minimalist</option>
            <option>Slate Modernist</option>
          </select>
        </div>

        {/* Auth Required */}
        <div className="col-span-2">
          <label className="block font-bold text-dark-muted uppercase mb-1">Auth Required?</label>
          <select
            name="authRequired"
            value={options.authRequired || 'Yes'}
            onChange={handleChange}
            className="block w-full px-2 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none"
          >
            <option>Yes</option>
            <option>No</option>
          </select>
        </div>

        {/* Admin Required */}
        <div className="col-span-2">
          <label className="block font-bold text-dark-muted uppercase mb-1">Admin Panel?</label>
          <select
            name="adminRequired"
            value={options.adminRequired || 'No'}
            onChange={handleChange}
            className="block w-full px-2 py-1.5 bg-slate-900 border border-dark-border rounded-lg text-white text-xs focus:outline-none"
          >
            <option>Yes</option>
            <option>No</option>
          </select>
        </div>
      </div>
    </div>
  );
}
