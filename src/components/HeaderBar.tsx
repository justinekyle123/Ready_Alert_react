// src/components/HeaderBar.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RoleBadge } from './RoleBadge';
import { 
  LogOut, 
  Activity, 
  User, 
  Phone, 
  Building2, 
  ShieldCheck, 
  X, 
  ChevronDown,
  Mail,
  Sun,
  Moon
} from 'lucide-react';

export const HeaderBar: React.FC = () => {
  const { userProfile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-md md:max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/40">
            <Activity className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight flex items-center gap-1.5">
              <span>Ready Alert</span>
              <span className="text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.5 rounded border border-red-500/30">
                EQ SAFE
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Earthquake Emergency Net</p>
          </div>
        </div>

        {/* User Interactive Circle Avatar with Dropdown */}
        {userProfile && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 p-1 rounded-full hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-purple-500 active:scale-95"
              aria-expanded={isDropdownOpen}
              aria-label="User menu"
            >
              {/* Circle Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 border-2 border-white/90 text-white font-black text-sm flex items-center justify-center shadow-lg flex-shrink-0">
                {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Avatar Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Dropdown User Info Header */}
                <div className="p-4 bg-slate-950/80 border-b border-slate-800 space-y-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-purple-900/80 border border-purple-500 text-purple-200 font-black flex items-center justify-center text-sm shadow">
                      {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-sm font-extrabold text-white truncate">{userProfile.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{userProfile.email}</div>
                    </div>
                  </div>
                  <div className="pt-1 flex items-center justify-between">
                    <RoleBadge role={userProfile.role} size="sm" />
                    {userProfile.groupId && (
                      <span className="text-[10px] bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono">
                        {userProfile.groupId}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dropdown Menu Actions */}
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setShowProfileModal(true);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-bold flex items-center space-x-2.5 transition active:scale-98"
                  >
                    <User className="w-4 h-4 text-purple-400" />
                    <span>My Account & Profile</span>
                  </button>

                  {/* Theme Mode Toggle Button */}
                  <button
                    onClick={() => {
                      toggleTheme();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-bold flex items-center justify-between transition active:scale-98"
                  >
                    <div className="flex items-center space-x-2.5">
                      {theme === 'dark' ? (
                        <Sun className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Moon className="w-4 h-4 text-indigo-400" />
                      )}
                      <span>Theme: {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-purple-300">
                      {theme === 'dark' ? 'Dark' : 'Light'}
                    </span>
                  </button>

                  <div className="border-t border-slate-800/80 my-1" />

                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-red-950/50 text-red-400 hover:text-red-300 text-xs font-bold flex items-center space-x-2.5 transition active:scale-98"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Profile Modal Dialog */}
      {showProfileModal && userProfile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 relative">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Modal Title */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 border-2 border-white text-white font-black text-lg flex items-center justify-center shadow-lg">
                {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <h3 className="text-base font-black text-white">{userProfile.name}</h3>
                <RoleBadge role={userProfile.role} size="sm" />
              </div>
            </div>

            {/* Profile Information List */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-purple-400" /> Email
                </span>
                <span className="font-semibold text-slate-200">{userProfile.email}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-400" /> Contact
                </span>
                <span className="font-semibold text-slate-200">{userProfile.contactNumber || 'Not provided'}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" /> Organization
                </span>
                <span className="font-semibold text-slate-200">{userProfile.organizationName || 'Metro Volunteer Group'}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Assigned Group
                </span>
                <span className="font-mono font-bold text-slate-200">{userProfile.groupId || 'GRP-001'}</span>
              </div>
            </div>

            <button
              onClick={() => setShowProfileModal(false)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition border border-slate-700"
            >
              Close Window
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

