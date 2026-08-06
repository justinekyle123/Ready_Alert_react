// src/hooks/useActiveAlert.ts
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Alert } from '../@types';

export const useActiveAlert = (groupId?: string) => {
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const alertsRef = collection(db, 'alerts');
    const q = query(
      alertsRef, 
      where('active', '==', true)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const alertsList: Alert[] = [];
        snapshot.forEach((docSnap) => {
          alertsList.push(docSnap.data() as Alert);
        });

        // Filter alerts relevant to this group or global alerts
        const filtered = alertsList.filter(
          (a) => !a.groupId || a.groupId === 'GLOBAL_ALL' || (groupId && a.groupId === groupId)
        );

        // Sort most recent first
        filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setActiveAlerts(filtered);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching real-time alerts:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  const currentAlert = activeAlerts.length > 0 ? activeAlerts[0] : null;

  return { activeAlerts, currentAlert, loading, error };
};
