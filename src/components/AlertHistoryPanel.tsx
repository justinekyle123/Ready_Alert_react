// src/components/AlertHistoryPanel.tsx
import React, { useState } from 'react';
import { useAllAlerts } from '../hooks/useAllAlerts';
import { AlertLevel } from '../@types';
import { resolveAlert } from '../services/alertService';
import { confirmDeleteAlert, showSuccessToast, showErrorAlert } from '../utils/sweetalert';
import { 
  Calendar, 
  RotateCcw, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  Radio,
  Building2,
  XCircle,
  Check
} from 'lucide-react';

interface AlertHistoryPanelProps {
  userRole?: string;
  userGroupId?: string;
}

export const AlertHistoryPanel: React.FC<AlertHistoryPanelProps> = ({ userRole, userGroupId }) => {
  const { alerts, loading } = useAllAlerts();
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('ALL'); // 'ALL' | 'CRITICAL' | 'ACTIVE' | 'WARNING' | 'ADVISORY'
  const [acknowledgedIds, setAcknowledgedIds] = useState<Record<string, boolean>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (alertId: string) => {
    const confirmed = await confirmDeleteAlert(
      'Deactivate Emergency Alert?',
      'This will mark this active alert as resolved across all volunteer members.',
      'Yes, Deactivate'
    );
    if (!confirmed) return;

    setResolvingId(alertId);
    try {
      await resolveAlert(alertId);
      showSuccessToast('Alert Deactivated');
    } catch (err) {
      console.error('Error resolving alert:', err);
      showErrorAlert('Deactivation Failed', 'Could not deactivate alert.');
    } finally {
      setResolvingId(null);
    }
  };

  const handleAcknowledge = (alertId: string) => {
    setAcknowledgedIds(prev => ({ ...prev, [alertId]: true }));
  };

  const setTodayFilter = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  };

  const clearFilters = () => {
    setSelectedDate('');
    setActiveTab('ALL');
  };

  const parseTimestamp = (ts: any): Date => {
    if (!ts) return new Date();
    if (ts instanceof Date) return ts;
    if (typeof ts === 'number') {
      return new Date(ts < 1e11 ? ts * 1000 : ts);
    }
    if (typeof ts === 'object' && ts !== null) {
      if (typeof ts.toDate === 'function') {
        return ts.toDate();
      }
      if (typeof ts.seconds === 'number') {
        return new Date(ts.seconds * 1000);
      }
    }
    if (typeof ts === 'string') {
      const num = Number(ts);
      if (!isNaN(num) && ts.trim() !== '') {
        return new Date(num < 1e11 ? num * 1000 : num);
      }
      const d = new Date(ts);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  };

  const getExactDateTime = (timestamp: any) => {
    const d = parseTimestamp(timestamp);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getRelativeTime = (timestamp: any) => {
    const d = parseTimestamp(timestamp);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (isNaN(diffSec) || diffSec < 0) return 'Just now';
    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
  };

  // Filter alerts based on criteria
  const filteredAlerts = alerts.filter((item) => {
    // Group relevance: global or matching group
    const matchesGroup = !userGroupId || !item.groupId || item.groupId === 'GLOBAL_ALL' || item.groupId === userGroupId;
    
    // Tab filter
    let matchesTab = true;
    if (activeTab === 'CRITICAL') matchesTab = item.alertLevel === 'RED';
    else if (activeTab === 'ACTIVE') matchesTab = item.active;
    else if (activeTab === 'WARNING') matchesTab = item.alertLevel === 'YELLOW';
    else if (activeTab === 'ADVISORY') matchesTab = item.alertLevel === 'GREEN';

    // Date filter (compare YYYY-MM-DD)
    let matchesDate = true;
    if (selectedDate) {
      const alertDateStr = parseTimestamp(item.timestamp).toISOString().split('T')[0];
      matchesDate = alertDateStr === selectedDate;
    }

    return matchesGroup && matchesTab && matchesDate;
  });

  const getAlertConfig = (level: AlertLevel) => {
    switch (level) {
      case 'RED':
        return {
          leftBorder: 'border-l-red-600',
          badgeText: 'EMERGENCY',
          badgeTextColor: 'text-red-500',
          dotColor: 'bg-red-500',
          title: 'Critical Emergency Broadcast',
          icon: <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        };
      case 'YELLOW':
        return {
          leftBorder: 'border-l-amber-500',
          badgeText: 'HIGH',
          badgeTextColor: 'text-amber-400',
          dotColor: 'bg-amber-400',
          title: 'Warning & Standby Advisory',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        };
      case 'GREEN':
      default:
        return {
          leftBorder: 'border-l-emerald-500',
          badgeText: 'MEDIUM',
          badgeTextColor: 'text-emerald-400',
          dotColor: 'bg-emerald-400',
          title: 'Advisory / Low Severity Alert',
          icon: <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        };
    }
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Top Main Button: Filter by Date */}
      <div className="space-y-2">
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className={`w-full min-h-[52px] bg-slate-900 hover:bg-slate-800 border-2 ${selectedDate ? 'border-purple-500 text-purple-300' : 'border-slate-800 text-slate-100'} rounded-2xl p-3 flex items-center justify-center gap-2.5 font-bold text-sm sm:text-base tracking-wide transition active:scale-98 shadow-xl`}
        >
          <Calendar className="w-5 h-5 text-purple-400 flex-shrink-0" />
          <span>{selectedDate ? `Date: ${selectedDate}` : 'Filter by Date'}</span>
          {selectedDate && (
            <span 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDate('');
              }}
              className="ml-2 text-xs bg-slate-800 text-slate-300 hover:text-white px-2 py-0.5 rounded-md border border-slate-700"
            >
              Clear
            </span>
          )}
        </button>

        {/* Expandable Date Picker Controls */}
        {showDatePicker && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 shadow-2xl space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>Select Specific Date:</span>
              <button onClick={setTodayFilter} className="text-purple-400 hover:underline">
                Select Today
              </button>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
              }}
              className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        )}
      </div>

      {/* Horizontal Pill Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar text-xs font-mono">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-2 rounded-xl border-2 transition whitespace-nowrap font-bold min-h-[38px] ${
            activeTab === 'ALL'
              ? 'bg-slate-800 border-slate-500 text-slate-100 shadow-md'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          All Alerts
        </button>

        <button
          onClick={() => setActiveTab('CRITICAL')}
          className={`px-4 py-2 rounded-xl border-2 transition whitespace-nowrap font-bold min-h-[38px] ${
            activeTab === 'CRITICAL'
              ? 'bg-red-950/60 border-red-500 text-red-300 shadow-md'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-red-400'
          }`}
        >
          Critical Only
        </button>

        <button
          onClick={() => setActiveTab('ACTIVE')}
          className={`px-4 py-2 rounded-xl border-2 transition whitespace-nowrap font-bold min-h-[38px] ${
            activeTab === 'ACTIVE'
              ? 'bg-purple-950/60 border-purple-500 text-purple-300 shadow-md'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-purple-300'
          }`}
        >
          Active
        </button>

        <button
          onClick={() => setActiveTab('WARNING')}
          className={`px-4 py-2 rounded-xl border-2 transition whitespace-nowrap font-bold min-h-[38px] ${
            activeTab === 'WARNING'
              ? 'bg-amber-950/60 border-amber-500 text-amber-300 shadow-md'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-400'
          }`}
        >
          Warning
        </button>

        <button
          onClick={() => setActiveTab('ADVISORY')}
          className={`px-4 py-2 rounded-xl border-2 transition whitespace-nowrap font-bold min-h-[38px] ${
            activeTab === 'ADVISORY'
              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-md'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-400'
          }`}
        >
          Advisory
        </button>
      </div>

      {/* Alert Feed Container */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-10 text-xs font-mono text-slate-500 animate-pulse bg-slate-900 rounded-2xl border border-slate-800">
            Syncing alerts feed...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
            <Radio className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-bold text-slate-300">No Alerts Recorded</div>
            <p className="text-xs text-slate-500 max-w-xs mx-auto font-mono">
              {selectedDate 
                ? `No emergency broadcasts found for ${selectedDate}.` 
                : 'No alert broadcasts match the current filter.'}
            </p>
            {(selectedDate || activeTab !== 'ALL') && (
              <button
                onClick={clearFilters}
                className="mt-2 min-h-[36px] px-3 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded-xl text-xs font-bold border border-slate-700 inline-flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        ) : (
          filteredAlerts.map((item) => {
            const config = getAlertConfig(item.alertLevel);
            const isAck = acknowledgedIds[item.alertId];
            const shortId = `ALT-${item.alertId.slice(-4).toUpperCase()}`;
            const relativeTime = getRelativeTime(item.timestamp);

            return (
              <div
                key={item.alertId}
                className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 border-l-[6px] ${config.leftBorder} shadow-xl space-y-2.5 transition-all hover:border-slate-700`}
              >
                {/* Header Row: Badge & Timestamp */}
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <div className="flex items-center space-x-2">
                    {config.icon}
                    <span className={`tracking-widest uppercase text-xs ${config.badgeTextColor}`}>
                      {config.badgeText}
                    </span>
                    {item.isBackupAlert && (
                      <span className="text-[9px] font-extrabold bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800">
                        HOST OVERRIDE
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-end text-right font-sans">
                    <span className="text-slate-300 text-[11px] font-bold">
                      {getExactDateTime(item.timestamp)}
                    </span>
                    <span className="text-slate-400 text-[10px] font-mono">
                      ({relativeTime})
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h4 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight leading-snug">
                  {item.message.length > 50 
                    ? `${item.message.slice(0, 50)}...` 
                    : config.title}
                </h4>

                {/* Paragraph Message Body */}
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                  {item.message}
                </p>

                {/* Card Footer Row: ID on Left, Action / Acknowledge / Deactivate on Right */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block leading-none font-bold">ID</span>
                    <span className="text-xs font-bold text-slate-300 tracking-wider">{shortId}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    {/* Deactivate Button for Leaders/Hosts on active alerts */}
                    {item.active && (userRole === 'HOST' || userRole === 'YOUTH_LEADER') && (
                      <button
                        onClick={() => handleResolve(item.alertId)}
                        disabled={resolvingId === item.alertId}
                        className="min-h-[36px] px-3 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow"
                      >
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                        <span>{resolvingId === item.alertId ? 'Deactivating...' : 'Deactivate'}</span>
                      </button>
                    )}

                    {/* Acknowledge Button for Members or General Users */}
                    {item.active ? (
                      <button
                        onClick={() => handleAcknowledge(item.alertId)}
                        disabled={isAck}
                        className={`min-h-[36px] px-3 py-1.5 rounded-xl font-bold text-xs border transition active:scale-95 flex items-center gap-1.5 ${
                          isAck
                            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                        }`}
                      >
                        {isAck ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Acknowledged</span>
                          </>
                        ) : (
                          <span>Acknowledge</span>
                        )}
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Resolved</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

