// src/hooks/useMembers.ts
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Member, EmergencyStatus } from '../@types';

export const useMembers = (groupId?: string) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    const usersRef = collection(db, 'users');
    
    // Listen to members in group or all members if host
    let q = query(usersRef, where('role', '==', 'MEMBER'));
    if (groupId && groupId !== 'GRP-HQ') {
      q = query(usersRef, where('role', '==', 'MEMBER'), where('groupId', '==', groupId));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const memberList: Member[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          memberList.push({
            memberId: docSnap.id,
            name: data.name || 'Anonymous Member',
            email: data.email || '',
            contactNumber: data.contactNumber || 'N/A',
            groupId: data.groupId || 'GRP-001',
            emergencyStatus: (data.emergencyStatus as EmergencyStatus) || 'UNACCOUNTED',
            updatedAt: data.updatedAt
          });
        });
        setMembers(memberList);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching members real-time:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  const safeCount = members.filter(m => m.emergencyStatus === 'SAFE').length;
  const assistanceCount = members.filter(m => m.emergencyStatus === 'NEED_ASSISTANCE').length;
  const dangerCount = members.filter(m => m.emergencyStatus === 'IN_DANGER').length;
  const unaccountedCount = members.filter(m => m.emergencyStatus === 'UNACCOUNTED').length;

  return {
    members,
    loading,
    stats: {
      total: members.length,
      safe: safeCount,
      needAssistance: assistanceCount,
      inDanger: dangerCount,
      unaccounted: unaccountedCount
    }
  };
};
