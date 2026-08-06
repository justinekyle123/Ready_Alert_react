// src/hooks/useGroupData.ts
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Group } from '../@types';

export const useGroupData = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const groupsRef = collection(db, 'groups');
    const q = query(groupsRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Group[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Group);
        });
        setGroups(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching groups:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { groups, loading };
};
