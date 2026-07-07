import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MobileHeader from '../components/MobileHeader';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text flex flex-col lg:flex-row font-sans">
      {/* Mobile Navigation Header */}
      <MobileHeader onMenuToggle={() => setSidebarOpen(prev => !prev)} />

      {/* Sidebar - Handles both mobile overlay and desktop sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <main className="flex-1 overflow-y-auto px-6 py-8 md:p-8 lg:p-10 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
