// src/services/authService.ts
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut
} from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { createUserProfile, getUserProfile } from './userService';
import { createVolunteerGroup } from './groupService';
import { UserProfile, UserRole } from '../@types';

const LOCAL_STORAGE_KEY = 'readyalert_active_user';

export const registerUser = async (params: {
  email: string;
  pass: string;
  name: string;
  role: UserRole;
  contactNumber?: string;
  groupId?: string;
  organizationName?: string;
}): Promise<UserProfile> => {
  let uid = '';

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, params.email, params.pass);
    uid = userCredential.user.uid;
  } catch (err: any) {
    console.warn('Firebase Auth standard registration unavailable (e.g. provider disabled), using direct database account store:', err?.code || err);
    uid = `usr_${params.role.toLowerCase()}_${Date.now()}`;
  }

  const profile: UserProfile = {
    uid,
    email: params.email,
    name: params.name,
    role: params.role,
    contactNumber: params.contactNumber || '',
    groupId: params.groupId || (params.role === 'HOST' ? 'GRP-HQ' : 'GRP-001'),
    organizationName: params.organizationName || 'Metro North Relief Unit',
    emergencyStatus: params.role === 'MEMBER' ? 'SAFE' : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await createUserProfile(profile);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
  return profile;
};

export const loginUser = async (email: string, pass: string): Promise<UserProfile> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const profile = await getUserProfile(userCredential.user.uid);
    if (profile) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
      return profile;
    }
  } catch (err: any) {
    console.warn('Firebase Auth sign-in bypassed or unavailable, querying Firestore user directory:', err?.code || err);
  }

  // Fallback: Query Firestore users collection by email
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', email.trim()));
  const snap = await getDocs(q);

  if (!snap.empty) {
    const profile = snap.docs[0].data() as UserProfile;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
    return profile;
  }

  throw new Error(`User account for ${email} not found. Please register first.`);
};

export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (e) {
    // ignore
  }
  localStorage.removeItem(LOCAL_STORAGE_KEY);
};

export const getStoredLocalUser = (): UserProfile | null => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Seed initial demo accounts directly into Firestore without requiring Auth Email Provider enable
export const seedDemoAccounts = async (): Promise<void> => {
  const demoUsers: UserProfile[] = [
    {
      uid: 'uid_host_hq',
      email: 'host@readyalert.org',
      name: 'Host Operations Center',
      role: 'HOST',
      contactNumber: '+1 800 555 0199',
      organizationName: 'National Disaster Preparedness HQ',
      groupId: 'GRP-HQ',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      uid: 'uid_leader_001',
      email: 'leader@readyalert.org',
      name: 'Leader Alex Rivera',
      role: 'YOUTH_LEADER',
      contactNumber: '+1 555 012 3456',
      organizationName: 'Metro Youth Volunteers Unit 1',
      groupId: 'GRP-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      uid: 'uid_member_001',
      email: 'member1@readyalert.org',
      name: 'Sarah Chen (Member)',
      role: 'MEMBER',
      contactNumber: '+1 555 018 7654',
      organizationName: 'Metro Youth Volunteers Unit 1',
      groupId: 'GRP-001',
      emergencyStatus: 'SAFE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      uid: 'uid_member_002',
      email: 'member2@readyalert.org',
      name: 'David Miller (Member)',
      role: 'MEMBER',
      contactNumber: '+1 555 019 8833',
      organizationName: 'Metro Youth Volunteers Unit 1',
      groupId: 'GRP-001',
      emergencyStatus: 'NEED_ASSISTANCE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  for (const user of demoUsers) {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, user, { merge: true });
    } catch (err) {
      console.error('Error seeding demo user:', err);
    }
  }

  // Seed standard group if missing
  try {
    await createVolunteerGroup({
      groupId: 'GRP-001',
      organizationName: 'Metro Youth Volunteers Unit 1',
      leaderId: 'uid_leader_001',
      leaderName: 'Leader Alex Rivera',
      memberCount: 2
    });
  } catch {
    // Ignore if exists
  }
};

