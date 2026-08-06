// src/services/groupService.ts
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Group } from '../@types';

export const createVolunteerGroup = async (group: Omit<Group, 'createdAt'>): Promise<Group> => {
  const gId = group.groupId || doc(collection(db, 'groups')).id;
  const groupRef = doc(db, 'groups', gId);
  const fullGroup: Group = {
    ...group,
    groupId: gId,
    createdAt: new Date().toISOString()
  };
  await setDoc(groupRef, fullGroup, { merge: true });
  return fullGroup;
};

export const getVolunteerGroup = async (groupId: string): Promise<Group | null> => {
  const groupRef = doc(db, 'groups', groupId);
  const snap = await getDoc(groupRef);
  if (snap.exists()) {
    return snap.data() as Group;
  }
  return null;
};

export const getAllVolunteerGroups = async (): Promise<Group[]> => {
  const groupsRef = collection(db, 'groups');
  const querySnap = await getDocs(groupsRef);
  return querySnap.docs.map(docSnap => docSnap.data() as Group);
};

export const updateVolunteerGroup = async (groupId: string, data: Partial<Group>): Promise<void> => {
  const groupRef = doc(db, 'groups', groupId);
  await setDoc(groupRef, data, { merge: true });
};

export const deleteVolunteerGroup = async (groupId: string): Promise<void> => {
  const groupRef = doc(db, 'groups', groupId);
  await deleteDoc(groupRef);
};
