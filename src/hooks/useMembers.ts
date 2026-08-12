// src/hooks/useMembers.ts
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Member, EmergencyStatus, UserProfile } from '../@types';

export const useMembers = (groupId?: string) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [leaders, setLeaders] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    const usersRef = collection(db, 'users');
    
    // Listen to members & leaders in group or all if HQ
    let q = query(usersRef);
    if (groupId && groupId !== 'GRP-HQ') {
      q = query(usersRef, where('groupId', '==', groupId));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const memberList: Member[] = [];
        const leaderList: UserProfile[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as UserProfile;
          if (data.role === 'YOUTH_LEADER' || data.role === 'HOST') {
            leaderList.push({
              ...data,
              uid: docSnap.id
            });
          } else {
            memberList.push({
              memberId: docSnap.id,
              name: data.name || 'Anonymous Member',
              email: data.email || '',
              contactNumber: data.contactNumber || 'N/A',
              groupId: data.groupId || 'GRP-001',
              emergencyStatus: (data.emergencyStatus as EmergencyStatus) || 'UNACCOUNTED',
              updatedAt: data.updatedAt
            });
          }
        });

        setMembers(memberList);
        setLeaders(leaderList);
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
    leaders,
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

