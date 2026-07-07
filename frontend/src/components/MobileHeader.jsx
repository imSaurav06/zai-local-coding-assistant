import React from 'react';
import { FiMenu, FiCpu } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function MobileHeader({ onMenuToggle }) {
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
    <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-dark-card border-b border-dark-border text-white sticky top-0 z-30 shadow-md">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
          aria-label="Open navigation menu"
        >
          <FiMenu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <FiCpu className="w-5 h-5 text-brand-400" />
          <span className="font-bold text-base tracking-tight">Z.ai</span>
        </div>
      </div>
      
      <Link to="/profile" className="flex items-center">
        <div className="w-8 h-8 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center shadow-md">
          {getInitials(user?.name)}
        </div>
      </Link>
    </header>
  );
}
