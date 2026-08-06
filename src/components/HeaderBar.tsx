// src/components/HeaderBar.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
  Bell,
  BellRing,
  BellOff
} from 'lucide-react';
import {
  initNotificationService,
  getNotificationPermission,
  requestNotificationPermission
} from '../utils/notification';

export const HeaderBar: React.FC = () => {
  const { userProfile, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initNotificationService();
    setNotifPermission(getNotificationPermission());
  }, []);

  const handleToggleNotif = async () => {
    if (notifPermission !== 'granted') {
      const success = await requestNotificationPermission();
      if (success) {
        setNotifPermission('granted');
      } else {
        setNotifPermission(getNotificationPermission());
      }
    }
  };

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
    <header className="bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-50 shadow-lg shadow-black/20">
      <div className="max-w-md md:max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
        {/* Brand Header */}
        <div className="flex items-center space-x-2.5">
          <div className="relative flex items-center justify-center">
            <div className="w-9 h-9 bg-gradient-to-br from-red-600 via-red-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-950/60 ring-1 ring-red-500/30">
              <Activity className="w-5 h-5 text-white animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-900"></span>
            </span>
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
              <span>Ready Alert</span>
              <span className="text-[9px] font-black tracking-wider uppercase bg-red-950/90 text-red-400 px-1.5 py-0.5 rounded-md border border-red-800/80 shadow-inner">
                EQ SAFE
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wide mt-0.5">
              Earthquake Emergency Net
            </p>
          </div>
        </div>

        {/* User Interactive Profile Pill with Dropdown */}
        {userProfile && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 p-1.5 pl-2 rounded-full bg-slate-950/80 hover:bg-slate-800 border border-slate-800/80 transition focus:outline-none focus:ring-2 focus:ring-red-500/40 active:scale-95 shadow-inner"
              aria-expanded={isDropdownOpen}
              aria-label="User menu"
            >
              {/* User Name on Desktop / Tablet */}
              <div className="hidden sm:block text-right pr-1">
                <div className="text-xs font-bold text-white truncate max-w-[110px]">
                  {userProfile.name?.split(' ')[0] || 'User'}
                </div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  {userProfile.role}
                </div>
              </div>

              {/* Circle Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 via-red-600 to-amber-600 p-0.5 shadow-md shrink-0">
                <div className="w-full h-full rounded-full bg-slate-950 text-white font-black text-xs flex items-center justify-center">
                  {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                </div>
              </div>

              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-white' : ''}`} />
            </button>

            {/* Avatar Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-2xl border border-slate-800/90 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Dropdown User Info Header */}
                <div className="p-4 bg-slate-950/90 border-b border-slate-800/80 space-y-2.5">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-red-600 p-0.5 shadow-lg shrink-0">
                      <div className="w-full h-full rounded-full bg-slate-950 text-white font-black text-sm flex items-center justify-center">
                        {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-sm font-extrabold text-white truncate">{userProfile.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{userProfile.email}</div>
                    </div>
                  </div>
                  <div className="pt-1 flex items-center justify-between">
                    <RoleBadge role={userProfile.role} size="sm" />
                    {userProfile.groupId && (
                      <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full text-slate-300 font-mono">
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
                    className="w-full text-left px-3 py-2.5 rounded-2xl hover:bg-slate-800/80 text-slate-200 hover:text-white text-xs font-bold flex items-center space-x-2.5 transition active:scale-98"
                  >
                    <User className="w-4 h-4 text-purple-400" />
                    <span>My Account & Profile</span>
                  </button>

                  {/* Push Notification Action Button */}
                  <button
                    onClick={handleToggleNotif}
                    className="w-full text-left px-3 py-2.5 rounded-2xl hover:bg-slate-800/80 text-slate-200 hover:text-white text-xs font-bold flex items-center justify-between transition active:scale-98"
                  >
                    <div className="flex items-center space-x-2.5">
                      {notifPermission === 'granted' ? (
                        <BellRing className="w-4 h-4 text-emerald-400 animate-pulse" />
                      ) : notifPermission === 'denied' ? (
                        <BellOff className="w-4 h-4 text-red-400" />
                      ) : (
                        <Bell className="w-4 h-4 text-purple-400" />
                      )}
                      <span>Push Notifications</span>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      notifPermission === 'granted'
                        ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                        : notifPermission === 'denied'
                        ? 'bg-red-950/80 border-red-700 text-red-300'
                        : 'bg-purple-950/80 border-purple-700 text-purple-300'
                    }`}>
                      {notifPermission === 'granted' ? 'Active' : notifPermission === 'denied' ? 'Blocked' : 'Enable'}
                    </span>
                  </button>

                  <div className="border-t border-slate-800/80 my-1" />

                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-2xl hover:bg-red-950/50 text-red-400 hover:text-red-300 text-xs font-bold flex items-center space-x-2.5 transition active:scale-98"
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800/90 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 animate-slideUp relative">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Modal Title */}
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 via-red-600 to-amber-600 p-0.5 shadow-lg shrink-0">
                <div className="w-full h-full rounded-full bg-slate-950 text-white font-black text-lg flex items-center justify-center">
                  {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                </div>
              </div>
              <div>
                <h3 className="text-base font-black text-white">{userProfile.name}</h3>
                <div className="mt-0.5">
                  <RoleBadge role={userProfile.role} size="sm" />
                </div>
              </div>
            </div>

            {/* Profile Information List */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-purple-400" /> Email
                </span>
                <span className="font-semibold text-slate-200 truncate max-w-[160px]">{userProfile.email}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-400" /> Contact
                </span>
                <span className="font-semibold text-slate-200">{userProfile.contactNumber || 'Not provided'}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" /> Organization
                </span>
                <span className="font-semibold text-slate-200">{userProfile.organizationName || 'Metro Volunteer Group'}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Assigned Group
                </span>
                <span className="font-mono font-bold text-slate-200">{userProfile.groupId || 'GRP-001'}</span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-purple-400" /> Push Alerts
                </span>
                <button
                  onClick={handleToggleNotif}
                  className="px-2.5 py-1 bg-purple-950/80 hover:bg-purple-900 border border-purple-700 text-purple-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
                >
                  <span>{notifPermission === 'granted' ? 'Active' : 'Enable Push'}</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowProfileModal(false)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-xs transition border border-slate-700"
            >
              Close Window
            </button>
          </div>
        </div>
      )}
    </header>
  );
};


