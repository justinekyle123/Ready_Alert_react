// src/components/MemberHomeView.tsx
import React from 'react';
import { UserProfile, Alert } from '../@types';
import { AlertBanner } from './AlertBanner';
import { playAudioAlarm } from '../utils/notification';
import { showSuccessToast } from '../utils/sweetalert';
import { 
  ShieldCheck, 
  Bell, 
  Users, 
  Volume2, 
  ArrowRight
} from 'lucide-react';

interface MemberHomeViewProps {
  userProfile: UserProfile;
  currentAlert: Alert | null;
  onNavigate: (tab: 'alarm' | 'network') => void;
}

export const MemberHomeView: React.FC<MemberHomeViewProps> = ({
  userProfile,
  currentAlert,
  onNavigate
}) => {
  const handleSirenTest = () => {
    playAudioAlarm('CRITICAL');
    showSuccessToast('🔊 Emergency Siren Test Triggered!');
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Enhanced Welcome Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-2.5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-28 h-28 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-row items-center justify-between gap-2.5 relative z-10">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-800/80 text-emerald-400 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Active
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/50 shrink-0 font-mono">
                {userProfile.groupId || 'GRP-001'}
              </span>
            </div>
            
            <h2 className="text-sm sm:text-lg md:text-xl font-black text-white tracking-tight truncate leading-tight">
              Welcome, {userProfile.name}! 👋
            </h2>
            <p className="text-[10px] sm:text-xs text-slate-400 truncate font-medium">
              Ready Alert Volunteer Network • Response Net
            </p>
          </div>

          <div className="flex items-center shrink-0">
            <button
              onClick={handleSirenTest}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-purple-950/80 hover:bg-purple-900 border border-purple-800/80 text-purple-200 text-[10px] sm:text-xs font-extrabold rounded-xl flex items-center space-x-1.5 transition active:scale-95 shadow-md shrink-0"
              title="Test Siren Audio"
            >
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
              <span>Test Siren</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Alert Banner OR All Clear Status */}
      {currentAlert ? (
        <AlertBanner alert={currentAlert} userRole={userProfile.role} />
      ) : (
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xl flex items-start space-x-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-950 border border-emerald-800/80 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="space-y-0.5 sm:space-y-1 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-300">
                System All Clear
              </h3>
              <span className="text-[9px] sm:text-[10px] text-slate-500 font-mono">24/7 Monitoring</span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-300 leading-relaxed">
              No active earthquake alerts broadcasted in your group area. Ready Alert is continuously synced with emergency transmitters.
            </p>
          </div>
        </div>
      )}

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
        {/* Live Alerts Log Card */}
        <div 
          onClick={() => onNavigate('alarm')}
          className="bg-slate-900 hover:bg-slate-850 border border-slate-800/90 hover:border-red-500/50 p-3.5 sm:p-4 rounded-2xl shadow-xl space-y-2 cursor-pointer transition active:scale-98 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-red-950 border border-red-800 text-red-400 flex items-center justify-center group-hover:scale-105 transition">
              <Bell className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-red-400 group-hover:translate-x-0.5 transition" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-white">Emergency Alerts Log</h4>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
              Browse broadcast history and earthquake emergency warnings.
            </p>
          </div>
        </div>

        {/* Group Net Card */}
        <div 
          onClick={() => onNavigate('network')}
          className="bg-slate-900 hover:bg-slate-850 border border-slate-800/90 hover:border-emerald-500/50 p-3.5 sm:p-4 rounded-2xl shadow-xl space-y-2 cursor-pointer transition active:scale-98 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
              <Users className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-white">Group Member Network</h4>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
              Connect with volunteer members in group {userProfile.groupId || 'GRP-001'}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
