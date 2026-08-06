// src/pages/LoginPage.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, Activity, AlertCircle, ShieldCheck } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();

  // Form State
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      await login(email.trim(), password);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden selection:bg-red-500 selection:text-white">
      {/* Subtle Ambient Background Lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md mx-auto my-auto space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-amber-600 rounded-2xl mx-auto flex items-center justify-center shadow-xl shadow-red-950/60 ring-1 ring-red-500/30">
              <Activity className="w-9 h-9 text-white animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-slate-950"></span>
            </span>
          </div>

          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Ready Alert
            </h1>
            <div className="flex items-center justify-center space-x-2 mt-1.5">
              <span className="h-px w-6 bg-red-500/50"></span>
              <p className="text-[10px] font-black uppercase tracking-widest text-red-400">
                Earthquake Emergency Network
              </p>
              <span className="h-px w-6 bg-red-500/50"></span>
            </div>
          </div>
        </div>

        {/* Main Secured Auth Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1 pb-2 border-b border-slate-800/80">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Secure Operation Access</span>
            </div>
            <h2 className="text-base font-black text-white pt-1">
              Sign in to your dashboard
            </h2>
            <p className="text-xs text-slate-400">
              Authorized personnel emergency portal
            </p>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="w-4 h-4 text-slate-500 group-focus-within:text-red-400 transition absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="name@readyalert.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[48px] bg-slate-950 border border-slate-800 focus:border-red-500/80 rounded-2xl pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Password
              </label>
              <div className="relative group">
                <Lock className="w-4 h-4 text-slate-500 group-focus-within:text-red-400 transition absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[48px] bg-slate-950 border border-slate-800 focus:border-red-500/80 rounded-2xl pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-red-950/90 border border-red-800/80 rounded-2xl text-red-200 text-xs font-semibold flex items-center space-x-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[52px] bg-gradient-to-r from-red-600 via-red-500 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition shadow-lg shadow-red-950/60 flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-60"
            >
              <span>{loading ? 'AUTHENTICATING...' : 'SECURE SIGN IN'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-slate-500 mt-6 relative z-10">
        Ready Alert &copy; {new Date().getFullYear()} — Hierarchical Earthquake Emergency Network
      </div>
    </div>
  );
};


