// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserProfile, updateUserEmergencyStatus } from '../services/userService';
import { 
  loginUser, 
  logoutUser, 
  registerUser, 
  seedDemoAccounts, 
  getStoredLocalUser 
} from '../services/authService';
import { UserProfile, UserRole, EmergencyStatus } from '../@types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<UserProfile>;
  register: (params: {
    email: string;
    pass: string;
    name: string;
    role: UserRole;
    contactNumber?: string;
    groupId?: string;
    organizationName?: string;
  }) => Promise<UserProfile>;
  logout: () => Promise<void>;
  updateStatus: (status: EmergencyStatus) => Promise<void>;
  quickLoginAsRole: (role: UserRole) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => getStoredLocalUser());
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (uid: string) => {
    try {
      const profile = await getUserProfile(uid);
      if (profile) {
        setUserProfile(profile);
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  };

  useEffect(() => {
    // Seed demo accounts asynchronously into Firestore on boot
    seedDemoAccounts().catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchProfile(user.uid);
      } else {
        const local = getStoredLocalUser();
        if (local) {
          setUserProfile(local);
        }
      }
      setLoading(false);
    });

    // Timeout safety fallback
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 800);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const login = async (email: string, pass: string): Promise<UserProfile> => {
    const profile = await loginUser(email, pass);
    setUserProfile(profile);
    return profile;
  };

  const register = async (params: {
    email: string;
    pass: string;
    name: string;
    role: UserRole;
    contactNumber?: string;
    groupId?: string;
    organizationName?: string;
  }): Promise<UserProfile> => {
    const profile = await registerUser(params);
    setUserProfile(profile);
    return profile;
  };

  const logout = async (): Promise<void> => {
    await logoutUser();
    setUserProfile(null);
    setCurrentUser(null);
  };

  const updateStatus = async (status: EmergencyStatus): Promise<void> => {
    if (!userProfile) return;
    await updateUserEmergencyStatus(userProfile.uid, status);
    const updated = { ...userProfile, emergencyStatus: status };
    setUserProfile(updated);
    localStorage.setItem('readyalert_active_user', JSON.stringify(updated));
  };

  const refreshProfile = async (): Promise<void> => {
    if (userProfile) {
      await fetchProfile(userProfile.uid);
    }
  };

  const quickLoginAsRole = async (roleToLogin: UserRole) => {
    setLoading(true);
    let email = 'member1@readyalert.org';
    if (roleToLogin === 'HOST') email = 'host@readyalert.org';
    if (roleToLogin === 'YOUTH_LEADER') email = 'leader@readyalert.org';

    try {
      await login(email, 'password123');
    } catch (err) {
      console.warn('Quick login failed, attempting re-registering demo account...', err);
      if (roleToLogin === 'HOST') {
        await register({
          email,
          pass: 'password123',
          name: 'Host Operations Center',
          role: 'HOST',
          organizationName: 'National Disaster Preparedness HQ',
          groupId: 'GRP-HQ'
        });
      } else if (roleToLogin === 'YOUTH_LEADER') {
        await register({
          email,
          pass: 'password123',
          name: 'Leader Alex Rivera',
          role: 'YOUTH_LEADER',
          organizationName: 'Metro Youth Volunteers Unit 1',
          groupId: 'GRP-001'
        });
      } else {
        await register({
          email,
          pass: 'password123',
          name: 'Sarah Chen (Member)',
          role: 'MEMBER',
          organizationName: 'Metro Youth Volunteers Unit 1',
          groupId: 'GRP-001'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const role = userProfile ? userProfile.role : null;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        role,
        loading,
        login,
        register,
        logout,
        updateStatus,
        quickLoginAsRole,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

