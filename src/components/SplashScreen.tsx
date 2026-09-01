// src/components/SplashScreen.tsx
import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

const STATUS_MESSAGES = [
  'Establishing secure connection',
  'Syncing emergency contacts',
  'Calibrating alert network',
];

export const SplashScreen: React.FC = () => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-950 text-white overflow-hidden flex flex-col items-center justify-center p-4 select-none">
      {/* Ambient background lighting */}
      <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[30rem] h-[30rem] bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] bg-red-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center space-y-8 w-full">
        {/* Radar Logo */}
        <div className="relative flex items-center justify-center w-44 h-44">
          {/* Expanding detection rings */}
          <span
            className="absolute inset-0 rounded-full border border-red-500/30 animate-ping"
            style={{ animationDuration: '2.6s' }}
          />
          <span
            className="absolute inset-3 rounded-full border border-amber-500/20 animate-ping"
            style={{ animationDuration: '2.6s', animationDelay: '0.65s' }}
          />
          <span className="absolute inset-6 rounded-full border border-slate-700/60" />

          {/* Radar sweep */}
          <span className="absolute inset-0 rounded-full overflow-hidden animate-splash-sweep">
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, rgba(239,68,68,0) 0deg, rgba(239,68,68,0.45) 55deg, rgba(251,191,36,0.25) 110deg, rgba(239,68,68,0) 140deg)',
              }}
            />
          </span>

          {/* Core logo mark */}
          <div className="relative w-24 h-24 bg-gradient-to-br from-red-600 via-red-500 to-amber-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-red-950/80 ring-1 ring-red-500/40 overflow-hidden">
            <Activity className="w-12 h-12 text-white" />
            <span className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-white/25 to-transparent animate-splash-scan" />
          </div>

          {/* Network pulse dots */}
          <span className="absolute top-2 right-7 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          <span className="absolute bottom-6 left-2 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.9)]" style={{ animationDelay: '0.4s' }} />
          <span className="absolute bottom-1 right-4 w-1 h-1 rounded-full bg-amber-300 animate-pulse shadow-[0_0_6px_rgba(252,211,77,0.9)]" style={{ animationDelay: '0.8s' }} />
        </div>

        {/* Branding */}
        <div className="text-center space-y-2.5">
          <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(239,68,68,0.35)]">
            Ready Alert
          </h1>
          <div className="flex items-center justify-center space-x-2.5">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-red-500/60" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">
              Earthquake Emergency Network
            </p>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-red-500/60" />
          </div>
        </div>

        {/* Status + Progress */}
        <div className="w-full max-w-[280px] space-y-4">
          <div className="h-6 flex items-center justify-center">
            <p key={step} className="text-[11px] font-mono font-semibold text-slate-300 animate-splash-fade flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>{STATUS_MESSAGES[step]}...</span>
            </p>
          </div>

          <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden ring-1 ring-slate-700/50">
            <div className="h-full bg-gradient-to-r from-red-600 via-red-500 to-amber-500 rounded-full animate-splash-progress shadow-[0_0_10px_rgba(239,68,68,0.6)]" />
          </div>

          {/* Breadcrumb dots */}
          <div className="flex items-center justify-center space-x-1.5">
            {STATUS_MESSAGES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === step ? 'w-5 bg-red-500' : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 inset-x-0 text-center text-[10px] text-slate-600 font-semibold tracking-widest uppercase z-10">
        Initializing secure operations
      </div>
    </div>
  );
};