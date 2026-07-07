import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  FiLayers, 
  FiClock, 
  FiUser, 
  FiLogOut,
  FiCpu,
  FiPlus
} from 'react-icons/fi';

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNewProject = () => {
    if (onClose) onClose();
    // Redirect to workspace page and trigger workspace state reset
    navigate('/app', { state: { reset: true } });
  };

  const getInitials = (name) => {
    if (!name) return 'Z';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-dark-card border-r border-dark-border text-white">
      {/* Logo Section */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-dark-border select-none">
        <div className="p-2 bg-brand-500/10 text-brand-400 rounded-lg">
          <FiCpu className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h2 className="font-bold tracking-tight text-lg leading-none">Z.ai</h2>
          <span className="text-[10px] text-dark-muted font-mono">LOCAL WORKSPACE</span>
        </div>
      </div>

      {/* Navigation Options */}
      <div className="flex-1 px-4 py-6 space-y-4 overflow-y-auto">
        {/* New Project CTA Button */}
        <button
          onClick={handleNewProject}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-brand-500/15 border border-brand-400/10 cursor-pointer select-none"
        >
          <FiPlus className="w-4 h-4" />
          <span>New Project</span>
        </button>

        <nav className="space-y-1.5 pt-2">
          {/* Main workspace (app) */}
          <NavLink
            to="/app"
            onClick={() => { if (onClose) onClose(); }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-brand-500/10 text-brand-400 border-l-2 border-brand-500 font-semibold'
                  : 'text-dark-muted hover:text-white hover:bg-dark-hover border-l-2 border-transparent'
              }`
            }
          >
            <FiLayers className="w-5 h-5 flex-shrink-0" />
            <span>Workspace</span>
          </NavLink>

          {/* History */}
          <NavLink
            to="/history"
            onClick={() => { if (onClose) onClose(); }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-brand-500/10 text-brand-400 border-l-2 border-brand-500 font-semibold'
                  : 'text-dark-muted hover:text-white hover:bg-dark-hover border-l-2 border-transparent'
              }`
            }
          >
            <FiClock className="w-5 h-5 flex-shrink-0" />
            <span>History</span>
          </NavLink>

          {/* Profile */}
          <NavLink
            to="/profile"
            onClick={() => { if (onClose) onClose(); }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-brand-500/10 text-brand-400 border-l-2 border-brand-500 font-semibold'
                  : 'text-dark-muted hover:text-white hover:bg-dark-hover border-l-2 border-transparent'
              }`
            }
          >
            <FiUser className="w-5 h-5 flex-shrink-0" />
            <span>Profile</span>
          </NavLink>
        </nav>
      </div>

      {/* Account Info and Logout */}
      <div className="p-4 border-t border-dark-border bg-slate-950/20">
        <div className="flex items-center gap-3 mb-4 px-2 select-none">
          <div className="w-10 h-10 rounded-full bg-brand-500 text-white font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-md">
            {getInitials(user?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {user?.name || 'Developer'}
            </p>
            <p className="text-xs text-dark-muted truncate leading-tight mt-0.5">
              {user?.email || 'demo@zai.dev'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700/80 text-dark-muted hover:text-white rounded-lg text-sm font-semibold transition-all border border-dark-border cursor-pointer"
        >
          <FiLogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
        <div
          className={`fixed inset-y-0 left-0 z-50 w-64 max-w-xs transition-transform duration-300 transform ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebarContent}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 h-screen sticky top-0 flex-shrink-0">
        {sidebarContent}
      </div>
    </>
  );
}
