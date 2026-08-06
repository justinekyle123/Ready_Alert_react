// src/components/AlertBanner.tsx
import React, { useEffect, useState } from 'react';
import { Alert, AlertLevel } from '../@types';
import { AlertTriangle, ShieldAlert, Bell, XCircle } from 'lucide-react';
import { resolveAlert } from '../services/alertService';

interface AlertBannerProps {
  alert: Alert | null;
  userRole?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ alert, userRole }) => {
  const [resolving, setResolving] = useState(false);

  // Play audio alert pulse when new high severity alert arrives
  useEffect(() => {
    if (alert && alert.active && (alert.alertLevel === 'RED' || alert.alertLevel === 'YELLOW')) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = alert.alertLevel === 'RED' ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(alert.alertLevel === 'RED' ? 880 : 587.33, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
      } catch (e) {
        // AudioContext may require user gesture on web
      }
    }
  }, [alert?.alertId, alert?.alertLevel]);

  const handleResolve = async () => {
    if (!alert) return;
    setResolving(true);
    try {
      await resolveAlert(alert.alertId);
    } catch (err) {
      console.error(err);
    } finally {
      setResolving(false);
    }
  };

  if (!alert || !alert.active) {
    return null;
  }

  const getAlertDetails = (level: AlertLevel) => {
    switch (level) {
      case 'RED':
        return {
          cardBg: 'bg-red-950/90 border-2 border-red-500 shadow-2xl shadow-red-950/80 animate-pulse',
          ovalStyle: 'border-4 border-red-400 bg-red-600 text-white shadow-xl shadow-red-600/50',
          icon: <ShieldAlert className="w-8 h-8 text-white mb-1" />,
          title: 'RED TRI-ALARM',
          sub: 'CRITICAL EMERGENCY'
        };
      case 'YELLOW':
        return {
          cardBg: 'bg-amber-950/90 border-2 border-amber-500 shadow-2xl shadow-amber-950/80',
          ovalStyle: 'border-4 border-amber-300 bg-amber-500 text-slate-950 shadow-xl shadow-amber-500/50',
          icon: <AlertTriangle className="w-8 h-8 text-slate-950 mb-1" />,
          title: 'YELLOW TRI-ALARM',
          sub: 'WARNING / STANDBY'
        };
      case 'GREEN':
      default:
        return {
          cardBg: 'bg-emerald-950/90 border-2 border-emerald-500 shadow-2xl shadow-emerald-950/80',
          ovalStyle: 'border-4 border-emerald-300 bg-emerald-600 text-white shadow-xl shadow-emerald-600/50',
          icon: <Bell className="w-8 h-8 text-white mb-1" />,
          title: 'GREEN TRI-ALARM',
          sub: 'ADVISORY / LOW SEVERITY'
        };
    }
  };

  const details = getAlertDetails(alert.alertLevel);

  return (
    <div className={`rounded-2xl p-5 shadow-2xl space-y-5 text-center relative overflow-hidden transition-all duration-300 ${details.cardBg}`}>
      {/* Top Header Bar with Circle Indicator on Top Right */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-white/20">
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-white/90">
            EARTHQUAKE ALERT BROADCAST
          </span>
          {alert.isBackupAlert && (
            <span className="font-extrabold text-[10px] bg-purple-900 text-purple-200 px-2 py-0.5 rounded border border-purple-400">
              HOST OVERRIDE BACKUP
            </span>
          )}
        </div>
        {/* Top Right Circle Indicator */}
        <div className="w-6 h-6 rounded-full bg-white/20 border-2 border-white flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
        </div>
      </div>

      {/* Wireframe Layout Component 1: OVAL ALERT TYPE BADGE */}
      <div className="flex flex-col items-center justify-center pt-1">
        <div className={`w-48 h-28 sm:w-56 sm:h-32 rounded-full flex flex-col items-center justify-center p-2 text-center transform transition active:scale-95 ${details.ovalStyle}`}>
          {details.icon}
          <span className="text-sm sm:text-base font-black tracking-widest uppercase leading-tight">
            {details.title}
          </span>
          <span className="text-[10px] font-extrabold opacity-90 tracking-wider">
            {details.sub}
          </span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-white/80 mt-1">
          ALERT TYPE
        </span>
      </div>

      {/* Wireframe Layout Component 2: RECTANGULAR ALERT MESSAGE BOX */}
      <div className="border-2 border-white/30 bg-black/50 backdrop-blur-md rounded-xl p-4 sm:p-5 text-left space-y-3 shadow-inner">
        <div className="flex items-center justify-between border-b border-white/20 pb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
            ALERT MESSAGE
          </span>
          <span className="text-[11px] font-bold text-white/90">
            {new Date(alert.timestamp).toLocaleTimeString()}
          </span>
        </div>

        <p className="text-sm sm:text-base font-black text-white leading-relaxed">
          "{alert.message}"
        </p>

        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-white/90">
          <div>
            Transmitted by: <strong className="text-white">{alert.triggeredByName}</strong> ({alert.triggeredByRole})
          </div>

          {(userRole === 'HOST' || userRole === 'YOUTH_LEADER') && (
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="min-h-[44px] px-3.5 py-1.5 bg-white text-slate-950 hover:bg-slate-200 text-xs font-black rounded-lg border border-white flex items-center gap-1.5 flex-shrink-0 active:scale-95 transition shadow-lg"
              title="Deactivate this alarm"
            >
              <XCircle className="w-4 h-4 text-red-600" />
              <span>{resolving ? 'Deactivating...' : 'Deactivate Alarm'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

