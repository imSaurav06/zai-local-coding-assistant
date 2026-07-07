import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  FiMessageSquare, 
  FiLayers, 
  FiTerminal, 
  FiClock, 
  FiUser, 
  FiLogOut,
  FiCpu,
  FiPlus
} from 'react-icons/fi';

export default function Sidebar({ 
  isOpen, 
  onClose, 
  activeMode, 
  setActiveMode, 
  onNewChat, 
  onOpenHistory, 
  onOpenProfile 
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error("Logout failed:", err);
    }
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

  const featureItems = [
    { mode: 'ask', label: 'Ask AI', icon: FiMessageSquare },
    { mode: 'build', label: 'Build Project', icon: FiLayers },
    { mode: 'tools', label: 'Code Tools', icon: FiTerminal }
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-dark-sidebar border-r border-dark-border text-dark-text select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-4.5 border-b border-dark-border/40">
        <div className="p-1.5 bg-brand-500/10 text-brand-500 rounded-lg">
          <FiCpu className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold tracking-tight text-sm text-white leading-none">Z.ai Assistant</h2>
          <span className="text-[9px] text-dark-muted font-mono tracking-wide uppercase">Workspace</span>
        </div>
      </div>

      {/* Navigation Options */}
      <div className="flex-grow px-3 py-4 flex flex-col justify-between overflow-y-auto space-y-4">
        <div className="space-y-4.5">
          {/* New Chat CTA Button */}
          <button
            onClick={() => {
              onNewChat();
              if (onClose) onClose();
            }}
            className="flex items-center gap-2 w-full px-4 py-2.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-500 border border-brand-500/25 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
          >
            <FiPlus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          {/* Feature Modes List */}
          <nav className="space-y-1">
            {featureItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeMode === item.mode;
              return (
                <button
                  key={item.mode}
                  onClick={() => {
                    setActiveMode(item.mode);
                    if (onClose) onClose();
                  }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer relative ${
                    isActive
                      ? 'bg-dark-card text-white border border-dark-border shadow-sm'
                      : 'text-dark-muted hover:text-white hover:bg-dark-hover border border-transparent'
                  }`}
                >
                  <IconComponent className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-brand-500' : ''}`} />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute left-0 top-3 bottom-3 w-1 bg-brand-500 rounded-r" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Divider */}
          <div className="h-px bg-dark-border/40 my-3" />

          {/* Utility List (History / Profile) */}
          <nav className="space-y-1">
            <button
              onClick={() => {
                onOpenHistory();
                if (onClose) onClose();
              }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-dark-muted hover:text-white hover:bg-dark-hover border border-transparent transition-all cursor-pointer"
            >
              <FiClock className="w-4 h-4 flex-shrink-0" />
              <span>History</span>
            </button>
            <button
              onClick={() => {
                onOpenProfile();
                if (onClose) onClose();
              }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-dark-muted hover:text-white hover:bg-dark-hover border border-transparent transition-all cursor-pointer"
            >
              <FiUser className="w-4 h-4 flex-shrink-0" />
              <span>Profile Settings</span>
            </button>
          </nav>
        </div>

        {/* User profile details and Sign Out */}
        <div className="pt-4 border-t border-dark-border/40 mt-auto bg-dark-sidebar space-y-3.5">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-brand-500 text-white font-bold text-xs flex items-center justify-center shadow-md flex-shrink-0 border border-dark-border">
              {getInitials(user?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate leading-tight">
                {user?.name || 'Developer'}
              </p>
              <p className="text-[10px] text-dark-muted truncate leading-tight mt-0.5 font-mono">
                {user?.email || 'demo@zai.dev'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-dark-hover hover:bg-red-950/10 text-dark-muted hover:text-red-400 border border-dark-border rounded-xl text-[11px] font-bold transition-all cursor-pointer uppercase tracking-wider"
          >
            <FiLogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Overlay */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
        <div
          className={`fixed inset-y-0 left-0 z-50 w-60 transition-transform duration-300 transform ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebarContent}
        </div>
      </div>

      {/* Desktop Sidebar (Fixed Left) */}
      <div className="hidden lg:block w-60 h-screen sticky top-0 flex-shrink-0">
        {sidebarContent}
      </div>
    </>
  );
}
