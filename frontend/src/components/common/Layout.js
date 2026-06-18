import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Shield, Files, Upload, Share2, Activity, Users,
  LayoutDashboard, LogOut, User, Menu, X, Bell, ChevronDown, Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/files', icon: Files, label: 'My Files' },
  { to: '/upload', icon: Upload, label: 'Upload File' },
  { to: '/shared', icon: Share2, label: 'Shared Files' },
  { to: '/security', icon: Shield, label: 'Security Center' },
  { to: '/audit-logs', icon: Activity, label: 'Audit Logs' },
];

const adminItems = [
  { to: '/users', icon: Users, label: 'User Management' },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-900 border-r border-slate-700/50 flex flex-col transition-all duration-300 shrink-0`}>
        {/* Logo */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-700/50 h-16">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <span className="font-bold text-slate-100 text-lg">SecureVault</span>
              <span className="block text-xs text-slate-400">Enterprise</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''} ${!sidebarOpen ? 'justify-center' : ''}`
              }
              title={!sidebarOpen ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className={`pt-3 pb-1 ${sidebarOpen ? 'px-3' : 'hidden'}`}>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</span>
              </div>
              {adminItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'active' : ''} ${!sidebarOpen ? 'justify-center' : ''}`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {sidebarOpen && <span>{label}</span>}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-slate-700/50">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors ${!sidebarOpen ? 'justify-center' : ''}`}
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              {sidebarOpen && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{user?.username}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                  </div>
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                </>
              )}
            </button>

            {userMenuOpen && sidebarOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-700 rounded-lg py-1 shadow-xl z-50">
                <NavLink to="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100" onClick={() => setUserMenuOpen(false)}>
                  <User className="w-4 h-4" /> Profile
                </NavLink>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-slate-900 border-b border-slate-700/50 flex items-center justify-between px-6 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-3 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Secure Connection
            </div>
            <button className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 relative">
              <Bell className="w-4 h-4" />
            </button>
            {isAdmin && (
              <span className="text-xs bg-purple-600/20 text-purple-400 border border-purple-500/30 px-2 py-1 rounded-full font-semibold">
                ADMIN
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
