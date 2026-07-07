import React from 'react';

export default function StatCard({ title, value, icon: Icon, description }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-lg flex items-center justify-between hover:border-brand-500/50 transition-all duration-300">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-dark-muted mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
        {description && (
          <p className="text-xs text-dark-muted mt-1.5 truncate">{description}</p>
        )}
      </div>
      {Icon && (
        <div className="p-3 bg-slate-800/60 text-brand-400 rounded-lg ml-4 flex-shrink-0">
          <Icon className="w-6 h-6" />
        </div>
      )}
    </div>
  );
}
