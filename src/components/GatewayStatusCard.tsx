// src/components/GatewayStatusCard.tsx
import React from 'react';
import { SignalHigh, RefreshCw, Smartphone, TriangleAlert } from 'lucide-react';
import { useGatewayHealth } from '../hooks/useGatewayHealth';
import { GatewayStatus } from '../@types';

interface StatusStyle {
  label: string;
  dot: string;
  text: string;
  border: string;
  badge: string;
}

const STATUS_STYLES: Record<GatewayStatus, StatusStyle> = {
  online: {
    label: 'Online',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    border: 'border-emerald-800/80',
    badge: 'bg-emerald-950 text-emerald-300 border-emerald-800'
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    border: 'border-amber-800/80',
    badge: 'bg-amber-950 text-amber-300 border-amber-800'
  },
  offline: {
    label: 'Offline',
    dot: 'bg-red-500',
    text: 'text-red-300',
    border: 'border-red-800/80',
    badge: 'bg-red-950 text-red-300 border-red-800'
  },
  unconfigured: {
    label: 'Not configured',
    dot: 'bg-slate-500',
    text: 'text-slate-300',
    border: 'border-slate-700',
    badge: 'bg-slate-800 text-slate-300 border-slate-700'
  },
  unknown: {
    label: 'Unknown',
    dot: 'bg-slate-500',
    text: 'text-slate-300',
    border: 'border-slate-700',
    badge: 'bg-slate-800 text-slate-300 border-slate-700'
  }
};

const formatLastSeen = (iso: string): string => {
  const seen = new Date(iso).getTime();
  if (Number.isNaN(seen)) return 'unknown';

  const minutes = Math.floor((Date.now() - seen) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/**
 * SMS gateway readiness for the Host overview.
 *
 * This reports whether the *phone* can send SMS. It is not proof that an alert
 * was texted — the SMS fan-out itself ships in Phase 3 of SMS_PLAN.md.
 */
export const GatewayStatusCard: React.FC = () => {
  const { health, loading, checking, error, checkNow } = useGatewayHealth();

  // No document at all means the heartbeat has never run — that is a setup
  // problem, not an ambiguous one, so report it as `unconfigured`.
  const status: GatewayStatus = loading
    ? 'unknown'
    : health?.status || (error ? 'unknown' : 'unconfigured');
  const style = STATUS_STYLES[status];
  const onlineDevice = health?.devices?.find((device) => device.online) || health?.devices?.[0];

  return (
    <div className={`bg-slate-900 border ${style.border} p-4 sm:p-5 rounded-2xl shadow-xl space-y-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center shadow-inner shrink-0">
            <SignalHigh className={`w-5 h-5 ${style.text}`} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-300">SMS Gateway</div>
            <div className="text-[10px] text-slate-500 font-mono truncate">
              {onlineDevice?.name || 'phone relay for text alerts'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${style.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${status === 'online' ? 'animate-pulse' : ''}`} />
            {style.label}
          </span>
          <button
            onClick={checkNow}
            disabled={checking}
            title="Probe the gateway now"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg text-slate-300 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Diagnostics line */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 font-mono">
        {onlineDevice ? (
          <span className="flex items-center gap-1">
            <Smartphone className="w-3 h-3" />
            last seen {formatLastSeen(onlineDevice.lastSeen)}
          </span>
        ) : (
          <span>no phone connected</span>
        )}
        <span>{health?.onlineDeviceCount ?? 0} device(s) online</span>
        {health?.latencyMs !== null && health?.latencyMs !== undefined && (
          <span>{health.latencyMs} ms</span>
        )}
        {health?.checkedAt && <span>checked {formatLastSeen(health.checkedAt)}</span>}
      </div>

      {(health?.error || error) && status !== 'online' && (
        <div className={`p-2.5 rounded-xl border text-[10px] flex items-start gap-1.5 ${style.border} bg-slate-950/60 ${style.text}`}>
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{health?.error || error}</span>
        </div>
      )}

      {status === 'unconfigured' && (
        <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-[10px] text-slate-400 space-y-1">
          <div className="font-bold text-slate-300">Enable the phone gateway:</div>
          <div className="font-mono">firebase functions:secrets:set ANDROID_SMS_GATEWAY_LOGIN</div>
          <div className="font-mono">firebase functions:secrets:set ANDROID_SMS_GATEWAY_PASSWORD</div>
          <div className="font-mono">firebase deploy --only functions</div>
          <div>Then set the phone's app to Cloud mode. Setup details in SMS_PLAN.md §1.</div>
        </div>
      )}

      <p className="text-[10px] text-slate-500 italic">
        Readiness only — SMS alerts are not sent yet; fan-out ships in Phase 3 of SMS_PLAN.md.
      </p>
    </div>
  );
};
