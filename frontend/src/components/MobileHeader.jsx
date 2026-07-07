import React from 'react';
import { FiMenu, FiCpu } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

export default function MobileHeader({ onMenuToggle, onOpenProfile }) {
  const { user } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'Z';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <header className="lg:hidden flex items-center justify-between px-5 py-3.5 bg-dark-sidebar border-b border-dark-border/40 text-white sticky top-0 z-30 shadow-sm select-none">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-1.5 -ml-1 text-dark-muted hover:text-white rounded-lg transition-all cursor-pointer"
          aria-label="Open sidebar menu"
        >
          <FiMenu className="w-5.5 h-5.5" />
        </button>
        <div className="flex items-center gap-2">
          <FiCpu className="w-4.5 h-4.5 text-brand-500" />
          <span className="font-bold text-sm tracking-tight">Z.ai Assistant</span>
        </div>
      </div>
      
      <button 
        onClick={onOpenProfile}
        className="flex items-center cursor-pointer"
        aria-label="Open Profile Settings"
      >
        <div className="w-7 h-7 rounded-full bg-brand-500 text-white font-bold text-[10px] flex items-center justify-center shadow-md border border-dark-border">
          {getInitials(user?.name)}
        </div>
      </button>
    </header>
  );
}
