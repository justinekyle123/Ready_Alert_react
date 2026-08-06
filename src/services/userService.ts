// src/services/userService.ts
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  getDocs,
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile, EmergencyStatus, Member } from '../@types';

export const createUserProfile = async (profile: UserProfile): Promise<void> => {
  const userRef = doc(db, 'users', profile.uid);
  await setDoc(userRef, {
    ...profile,
    updatedAt: new Date().toISOString()
  });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }
  return null;
};

export const updateUserEmergencyStatus = async (uid: string, status: EmergencyStatus): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    emergencyStatus: status,
    updatedAt: new Date().toISOString()
  });
};

export const getMembersByGroup = async (groupId: string): Promise<Member[]> => {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('groupId', '==', groupId), where('role', '==', 'MEMBER'));
  const querySnap = await getDocs(q);
  
  return querySnap.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      memberId: docSnap.id,
      name: data.name || 'Unknown Member',
      email: data.email || '',
      contactNumber: data.contactNumber || '',
      groupId: data.groupId || groupId,
      emergencyStatus: (data.emergencyStatus as EmergencyStatus) || 'UNACCOUNTED',
      updatedAt: data.updatedAt
    };
  });
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const usersRef = collection(db, 'users');
  const querySnap = await getDocs(usersRef);
  return querySnap.docs.map(docSnap => docSnap.data() as UserProfile);
};

export const updateUserGroupAssignment = async (
  uid: string, 
  groupId: string, 
  organizationName?: string
): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    groupId,
    ...(organizationName ? { organizationName } : {}),
    updatedAt: new Date().toISOString()
  });
};

export const createNewUserByHost = async (userData: {
  uid?: string;
  name: string;
  email: string;
  role: 'HOST' | 'YOUTH_LEADER' | 'MEMBER';
  contactNumber?: string;
  groupId: string;
  organizationName?: string;
}): Promise<UserProfile> => {
  const uid = userData.uid || `usr_${userData.role.toLowerCase()}_${Date.now()}`;
  const profile: UserProfile = {
    uid,
    name: userData.name,
    email: userData.email,
    role: userData.role,
    contactNumber: userData.contactNumber || '',
    groupId: userData.groupId,
    organizationName: userData.organizationName || 'Metro Volunteer Group',
    emergencyStatus: userData.role === 'MEMBER' ? 'SAFE' : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await createUserProfile(profile);
  return profile;
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    ...data,
    updatedAt: new Date().toISOString()
  });
};

export const deleteUserProfile = async (uid: string): Promise<void> => {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists() && snap.data().role === 'HOST') {
    throw new Error('Host HQ administrator accounts cannot be deleted.');
  }
  await deleteDoc(userRef);
};

