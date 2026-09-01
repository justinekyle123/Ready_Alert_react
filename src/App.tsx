// src/App.tsx
import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './pages/LoginPage';
import { HostDashboard } from './pages/HostDashboard';
import { LeaderDashboard } from './pages/LeaderDashboard';
import { MemberDashboard } from './pages/MemberDashboard';
import { NotificationPermissionModal } from './components/NotificationPermissionModal';
import { SplashScreen } from './components/SplashScreen';

const AppContent: React.FC = () => {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (!userProfile) {
    return <LoginPage />;
  }

  return (
    <>
      <NotificationPermissionModal />
      {userProfile.role === 'HOST' ? (
        <HostDashboard />
      ) : userProfile.role === 'YOUTH_LEADER' ? (
        <LeaderDashboard />
      ) : (
        <MemberDashboard />
      )}
    </>
  );
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

