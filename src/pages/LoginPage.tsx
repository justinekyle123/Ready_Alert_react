// src/pages/LoginPage.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, Activity, AlertCircle, KeyRound } from 'lucide-react';

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

  const fillCredentials = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6">
      <div className="w-full max-w-md mx-auto my-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-red-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-red-900/60 ring-4 ring-red-500/20">
            <Activity className="w-9 h-9 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-3">Ready Alert</h1>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Earthquake Emergency Communication System
          </p>
        </div>

        {/* Main Secured Auth Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
          <div className="text-center pb-1 border-b border-slate-800">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
              Sign In to Your Account
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your credentials to access your designated operational center.
            </p>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="e.g. host@readyalert.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[48px] bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[48px] bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/80 border border-red-700 rounded-xl text-red-200 text-xs font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[52px] bg-red-600 hover:bg-red-500 text-white font-black text-sm uppercase tracking-wider rounded-xl transition shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 active:scale-98"
            >
              <span>{loading ? 'AUTHENTICATING...' : 'SECURE SIGN IN'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          {/* Quick Account Reference */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Registered System Accounts (Password: <code className="text-amber-300">password123</code>):</span>
            </div>

            <div className="space-y-1 text-xs">
              <button
                type="button"
                onClick={() => fillCredentials('host@readyalert.org')}
                className="w-full text-left p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 text-slate-300 flex justify-between items-center transition"
              >
                <span className="font-semibold">Host HQ:</span>
                <span className="text-purple-400 font-mono text-[11px]">host@readyalert.org</span>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('leader@readyalert.org')}
                className="w-full text-left p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 text-slate-300 flex justify-between items-center transition"
              >
                <span className="font-semibold">Youth Leader:</span>
                <span className="text-blue-400 font-mono text-[11px]">leader@readyalert.org</span>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('member1@readyalert.org')}
                className="w-full text-left p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 text-slate-300 flex justify-between items-center transition"
              >
                <span className="font-semibold">Member:</span>
                <span className="text-emerald-400 font-mono text-[11px]">member1@readyalert.org</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-500 mt-6">
        Ready Alert &copy; {new Date().getFullYear()} — Hierarchical Earthquake Emergency Network
      </div>
    </div>
  );
};

