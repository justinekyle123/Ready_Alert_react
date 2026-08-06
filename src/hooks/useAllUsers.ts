// src/hooks/useAllUsers.ts
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile } from '../@types';

export const useAllUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as UserProfile);
        });
        setUsers(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching all users real-time:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { users, loading };
};
