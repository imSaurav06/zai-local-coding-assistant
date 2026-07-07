import React from 'react';
import { FiInbox } from 'react-icons/fi';

export default function EmptyState({ title = 'No results found', message = 'There is no data to display right now.', icon: Icon = FiInbox }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-dark-card border border-dark-border rounded-xl select-none">
      <div className="p-4 bg-dark-hover text-brand-500 rounded-full mb-4">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-white text-base font-bold mb-1">{title}</h3>
      <p className="text-dark-muted text-xs max-w-sm">{message}</p>
    </div>

  );
}
