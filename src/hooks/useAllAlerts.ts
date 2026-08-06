// src/hooks/useAllAlerts.ts
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Alert } from '../@types';

export const useAllAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const alertsRef = collection(db, 'alerts');
    const q = query(alertsRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Alert[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Alert);
        });
        // Sort descending by timestamp
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setAlerts(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching all alerts real-time:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { alerts, loading };
};
