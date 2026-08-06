// src/components/NotificationPermissionModal.tsx
import React, { useState, useEffect } from 'react';
import { Bell, BellRing, ShieldAlert, Volume2, Smartphone, ExternalLink, X } from 'lucide-react';
import {
  initNotificationService,
  getNotificationPermission,
  requestNotificationPermission
} from '../utils/notification';

export const NotificationPermissionModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    initNotificationService();
    const perm = getNotificationPermission();
    const iframeCheck = window.self !== window.top;
    setIsIframe(iframeCheck);

    const dismissed = sessionStorage.getItem('readyalert_notif_prompt_dismissed');

    // Automatically prompt upon opening the app if permission is not yet granted
    if (perm === 'default' && !dismissed) {
      // Small timeout to allow initial dashboard render smoothly
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAllow = async () => {
    sessionStorage.setItem('readyalert_notif_prompt_dismissed', 'true');
    setIsOpen(false);
    await requestNotificationPermission();
  };

  const handleDismiss = () => {
    sessionStorage.setItem('readyalert_notif_prompt_dismissed', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 sm:rounded-3xl rounded-t-3xl shadow-2xl p-6 space-y-5 text-white relative transform transition-all duration-300 animate-slideUp">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Badge Header */}
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-red-600 flex items-center justify-center shadow-lg shadow-purple-900/40 animate-pulse">
            <BellRing className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-red-950 border border-red-800 text-red-400">
              Mobile Alert System
            </span>
            <h2 className="text-lg font-black text-white leading-tight mt-0.5">
              Enable Push Notifications
            </h2>
          </div>
        </div>

        {/* Informational Message */}
        <p className="text-xs text-slate-300 leading-relaxed">
          Stay protected during earthquake disasters. Allow Ready Alert to send real-time push alerts and emergency siren sounds directly to your mobile device.
        </p>

        {/* Feature Highlights */}
        <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 text-xs text-slate-200">
          <div className="flex items-center space-x-2.5">
            <Volume2 className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Loud Emergency Siren Sounds (Web Audio Synth)</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>Immediate Tri-Alarm Red/Yellow/Green Warnings</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Instant Lockscreen Alerts for Host & Youth Leaders</span>
          </div>
        </div>

        {/* iFrame Notice if inside preview */}
        {isIframe && (
          <div className="p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-[11px] text-amber-200 flex items-start space-x-2">
            <ExternalLink className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Note for AI Studio Preview:</strong> Native browser popups require opening the app in a <strong>New Tab ↗️</strong> for direct permission access.
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            onClick={handleAllow}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 via-red-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-purple-950/50 flex items-center justify-center space-x-2 transition active:scale-98"
          >
            <Bell className="w-4 h-4 fill-white" />
            <span>ALLOW EMERGENCY ALERTS NOW</span>
          </button>

          <button
            onClick={handleDismiss}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition text-center"
          >
            Remind Me Later
          </button>
        </div>
      </div>
    </div>
  );
};
