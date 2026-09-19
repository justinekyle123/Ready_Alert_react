// src/components/PushDiagnostics.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  RefreshCw,
  Send,
  Smartphone,
  XCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getPushDiagnostics,
  requestNotificationPermission,
  type PushDiagnostics as PushDiagnosticsData
} from '../utils/notification';
import { showSuccessToast, showErrorAlert } from '../utils/sweetalert';

/**
 * Push troubleshooting helper shown inside the Account & Profile modal.
 * Push needs permission AND a saved token AND a deployed sender — this shows
 * which one is missing so a failed test does not look like "nothing happened".
 */
export const PushDiagnostics: React.FC = () => {
  const { userProfile } = useAuth();
  const [diagnostics, setDiagnostics] = useState<PushDiagnosticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [registering, setRegistering] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDiagnostics(await getPushDiagnostics(userProfile?.uid));
    } catch (err) {
      console.warn('Push diagnostics failed:', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRegisterDevice = async () => {
    setRegistering(true);
    try {
      const granted = await requestNotificationPermission();
      await refresh();
      if (!granted) {
        showErrorAlert(
          'Permission Not Granted',
          'The device is still blocking notifications. Enable them in Settings → Apps → Ready Alert → Notifications, then try again.'
        );
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleCopyToken = async () => {
    if (!diagnostics?.token) return;
    try {
      await navigator.clipboard.writeText(diagnostics.token);
      showSuccessToast('Token copied! Paste it into Firebase Console → Messaging → Send test message.');
    } catch {
      showErrorAlert('Copy Failed', 'Long-press the token below to copy it manually.');
    }
  };

  const permissionGranted = diagnostics?.permission === 'granted';
  const hasToken = Boolean(diagnostics?.token);

  const StatusRow: React.FC<{ ok: boolean; label: string; detail: string }> = ({
    ok,
    label,
    detail
  }) => (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-1.5 text-slate-400">
        {ok ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        )}
        {label}
      </span>
      <span className="font-semibold text-slate-200 text-right break-all">{detail}</span>
    </div>
  );

  return (
    <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-slate-200 font-bold flex items-center gap-1.5">
          <Send className="w-3.5 h-3.5 text-purple-400" /> Push Diagnostics
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg text-[10px] font-bold text-slate-300 flex items-center gap-1 transition"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Checking' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-2 pt-1">
        <StatusRow
          ok={Boolean(diagnostics?.projectId && diagnostics.projectId !== 'unknown')}
          label="Firebase project"
          detail={diagnostics?.projectId || '—'}
        />
        <StatusRow
          ok={Boolean(diagnostics?.messagingSenderId)}
          label="Sender ID"
          detail={diagnostics?.messagingSenderId || '—'}
        />
        <StatusRow
          ok={permissionGranted}
          label="Permission"
          detail={diagnostics?.permission || '—'}
        />
        <StatusRow ok={hasToken} label="Device token saved" detail={hasToken ? 'yes' : 'no'} />
        <StatusRow
          ok={Boolean(diagnostics?.tokenPlatform)}
          label="Token platform"
          detail={diagnostics?.tokenPlatform || '—'}
        />
        {diagnostics?.platform === 'web' && (
          <StatusRow
            ok={Boolean(diagnostics?.vapidKeyConfigured)}
            label="VAPID key (.env.local)"
            detail={diagnostics.vapidKeyConfigured ? 'configured' : 'missing'}
          />
        )}
        <StatusRow
          ok={true}
          label="App platform"
          detail={diagnostics?.platform || '—'}
        />
      </div>

      {hasToken && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">FCM token</span>
            <button
              onClick={handleCopyToken}
              className="px-2 py-1 bg-purple-950/80 hover:bg-purple-900 border border-purple-700 rounded-lg text-[10px] font-bold text-purple-200 flex items-center gap-1 transition"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <code className="block bg-slate-900 border border-slate-800 rounded-xl p-2 text-[10px] text-slate-300 break-all select-all max-h-24 overflow-y-auto">
            {diagnostics?.token}
          </code>
        </div>
      )}

      {diagnostics?.tokenUpdatedAt && (
        <p className="text-[10px] text-slate-500">
          Token last saved: {new Date(diagnostics.tokenUpdatedAt).toLocaleString()}
        </p>
      )}

      <button
        onClick={handleRegisterDevice}
        disabled={registering}
        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1.5 transition border border-slate-700"
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
        {registering ? 'Registering device…' : 'Re-register this device'}
      </button>

      {!hasToken && (
        <div className="p-2.5 bg-amber-950/50 border border-amber-800/80 rounded-xl text-[10px] text-amber-200 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>
            No token yet — nothing can be delivered to this device. Tap{' '}
            <strong>Re-register this device</strong> above and allow notifications when the system
            asks.
          </span>
        </div>
      )}
    </div>
  );
};
