// src/App.tsx
import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './pages/LoginPage';
import { HostDashboard } from './pages/HostDashboard';
import { LeaderDashboard } from './pages/LeaderDashboard';
import { MemberDashboard } from './pages/MemberDashboard';
import { Activity } from 'lucide-react';

const AppContent: React.FC = () => {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center space-y-3 p-4">
        <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center animate-pulse shadow-xl shadow-red-900/50">
          <Activity className="w-7 h-7 text-white" />
        </div>
        <div className="text-sm font-bold tracking-wider uppercase text-slate-300">
          Securing Ready Alert Operations...
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return <LoginPage />;
  }

  switch (userProfile.role) {
    case 'HOST':
      return <HostDashboard />;
    case 'YOUTH_LEADER':
      return <LeaderDashboard />;
    case 'MEMBER':
    default:
      return <MemberDashboard />;
  }
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

