// src/components/TriAlarmPanel.tsx
import React, { useState } from 'react';
import { AlertLevel, UserRole } from '../@types';
import { transmitTriAlarmAlert, transmitBackupAlert } from '../services/alertService';
import { Radio, AlertOctagon, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface TriAlarmPanelProps {
  userRole: UserRole;
  userId: string;
  userName: string;
  groupId?: string;
  isHostOverride?: boolean;
}

export const TriAlarmPanel: React.FC<TriAlarmPanelProps> = ({
  userRole,
  userId,
  userName,
  groupId,
  isHostOverride = false
}) => {
  const [selectedLevel, setSelectedLevel] = useState<AlertLevel>('RED');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [transmitting, setTransmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const defaultMessages: Record<AlertLevel, string> = {
    RED: 'EARTHQUAKE SHAKING DETECTED! Drop, Cover, and Hold On immediately! Report status when safe.',
    YELLOW: 'AFTERSHOCK WARNING! Standby for potential tremors and inspect local structures.',
    GREEN: 'ALL CLEAR: Tremors subsided. Conduct roll call and mark your emergency status.'
  };

  const handleTransmit = async () => {
    setTransmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const message = customMessage.trim() || defaultMessages[selectedLevel];

    try {
      if (isHostOverride || userRole === 'HOST') {
        await transmitBackupAlert({
          alertLevel: selectedLevel,
          message,
          hostId: userId,
          hostName: userName,
          targetGroupId: groupId || 'GLOBAL_ALL'
        });
        setSuccessMsg(`HOST BACKUP ALERT (${selectedLevel}) transmitted directly to members!`);
      } else {
        await transmitTriAlarmAlert({
          alertLevel: selectedLevel,
          message,
          triggeredBy: userId,
          triggeredByName: userName,
          triggeredByRole: userRole,
          groupId: groupId || 'GRP-001'
        });
        setSuccessMsg(`TRI-ALARM (${selectedLevel}) broadcasted to group and Host HQ!`);
      }
      setCustomMessage('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to transmit alert.');
    } finally {
      setTransmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 text-slate-100">
      {/* Wireframe Header Row: TRI-ALARM on left, leader role on right */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          {isHostOverride ? (
            <ShieldAlert className="w-5 h-5 text-purple-400 animate-pulse flex-shrink-0" />
          ) : (
            <Radio className="w-5 h-5 text-red-500 animate-pulse flex-shrink-0" />
          )}
          <h2 className="text-sm sm:text-base font-black tracking-widest uppercase text-slate-100">
            {isHostOverride ? 'HOST OVERRIDE' : 'TRI-ALARM'}
          </h2>
        </div>
        <span className="text-xs sm:text-sm font-semibold text-slate-300 lowercase">
          {userRole === 'YOUTH_LEADER' ? 'leader' : userRole.toLowerCase()}
        </span>
      </div>

      {/* Wireframe Top Box: Rectangular Container with Green, Yellow, Red Circles */}
      <div className="border-2 border-slate-700 bg-slate-950 rounded-xl p-4 sm:p-5 flex items-center justify-around gap-2 shadow-inner">
        {/* GREEN CIRCLE (Left) */}
        <button
          type="button"
          onClick={() => setSelectedLevel('GREEN')}
          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 flex flex-col items-center justify-center font-black transition-all active:scale-95 relative ${
            selectedLevel === 'GREEN'
              ? 'bg-emerald-500 border-white text-white ring-4 ring-emerald-500/80 scale-105 shadow-lg shadow-emerald-500/50'
              : 'bg-emerald-600 border-slate-900 text-white opacity-70 hover:opacity-100'
          }`}
          title="GREEN Alert - Safe / Advisory"
        >
          <CheckCircle2 className="w-6 h-6 mb-0.5" />
          <span className="text-[10px] font-black tracking-widest uppercase">GREEN</span>
          {selectedLevel === 'GREEN' && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-emerald-600 rounded-full text-[10px] font-black flex items-center justify-center shadow">✓</span>
          )}
        </button>

        {/* YELLOW CIRCLE (Middle) */}
        <button
          type="button"
          onClick={() => setSelectedLevel('YELLOW')}
          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 flex flex-col items-center justify-center font-black transition-all active:scale-95 relative ${
            selectedLevel === 'YELLOW'
              ? 'bg-yellow-400 border-white text-slate-950 ring-4 ring-yellow-400/80 scale-105 shadow-lg shadow-yellow-400/50'
              : 'bg-yellow-500 border-slate-900 text-slate-950 opacity-70 hover:opacity-100'
          }`}
          title="YELLOW Alert - Warning / Standby"
        >
          <AlertTriangle className="w-6 h-6 mb-0.5" />
          <span className="text-[10px] font-black tracking-widest uppercase">YELLOW</span>
          {selectedLevel === 'YELLOW' && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-slate-950 text-yellow-400 rounded-full text-[10px] font-black flex items-center justify-center shadow">✓</span>
          )}
        </button>

        {/* RED CIRCLE (Right) */}
        <button
          type="button"
          onClick={() => setSelectedLevel('RED')}
          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 flex flex-col items-center justify-center font-black transition-all active:scale-95 relative ${
            selectedLevel === 'RED'
              ? 'bg-red-600 border-white text-white ring-4 ring-red-500/80 scale-105 shadow-lg shadow-red-600/50'
              : 'bg-red-800 border-slate-900 text-white opacity-70 hover:opacity-100'
          }`}
          title="RED Alert - Critical Emergency"
        >
          <AlertOctagon className="w-6 h-6 mb-0.5" />
          <span className="text-[10px] font-black tracking-widest uppercase">RED</span>
          {selectedLevel === 'RED' && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-red-600 rounded-full text-[10px] font-black flex items-center justify-center shadow">✓</span>
          )}
        </button>
      </div>

      {/* Wireframe Middle Box: Rectangular Container for Message */}
      <div className="border-2 border-slate-700 bg-slate-950 rounded-xl p-3 sm:p-4 shadow-inner space-y-1.5">
        <label className="block text-xs font-black uppercase tracking-widest text-slate-300">
          Message
        </label>
        <textarea
          rows={3}
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          placeholder={defaultMessages[selectedLevel]}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed resize-none"
        />
        <div className="text-[10px] text-slate-400 italic truncate">
          Default: "{defaultMessages[selectedLevel]}"
        </div>
      </div>

      {/* Wireframe Bottom Button: Pill / Stadium Shape "Send Alert" */}
      <button
        onClick={handleTransmit}
        disabled={transmitting}
        className={`w-full min-h-[52px] sm:min-h-[56px] rounded-full font-black text-sm sm:text-base uppercase tracking-wider transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 border-2 ${
          selectedLevel === 'RED'
            ? 'bg-red-600 border-red-400 text-white hover:bg-red-500 shadow-red-950/80'
            : selectedLevel === 'YELLOW'
            ? 'bg-amber-400 border-amber-200 text-slate-950 hover:bg-amber-300 shadow-amber-950/80'
            : 'bg-emerald-500 border-emerald-300 text-white hover:bg-emerald-400 shadow-emerald-950/80'
        }`}
      >
        <Radio className="w-5 h-5 animate-pulse" />
        <span>{transmitting ? 'Sending Alert...' : 'Send Alert'}</span>
      </button>

      {successMsg && (
        <div className="p-3 bg-emerald-900/90 border border-emerald-500 text-emerald-100 text-xs font-bold rounded-xl text-center shadow-lg animate-fade-in">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-900/90 border border-red-500 text-red-100 text-xs font-bold rounded-xl text-center shadow-lg animate-fade-in">
          {errorMsg}
        </div>
      )}
    </div>
  );
};
