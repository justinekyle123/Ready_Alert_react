// src/hooks/useActiveAlert.ts
import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Alert } from '../@types';
import { sendPushNotification, AlertLevelType } from '../utils/notification';

export const useActiveAlert = (groupId?: string) => {
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const notifiedAlertIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef<boolean>(true);

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

        // Trigger push notification for new incoming active alerts
        filtered.forEach((alert) => {
          if (!notifiedAlertIds.current.has(alert.alertId)) {
            notifiedAlertIds.current.add(alert.alertId);
            if (!isInitialLoad.current) {
              const rawLevel = String(alert.alertLevel);
              const levelTitle = rawLevel === 'RED' || rawLevel === 'CRITICAL'
                ? '🚨 RED ALERT - EARTHQUAKE EMERGENCY'
                : rawLevel === 'YELLOW' || rawLevel === 'WARNING'
                ? '⚠️ YELLOW ALERT - EARTHQUAKE WARNING'
                : '🟢 GREEN ALERT - SAFETY ADVISORY';

              const mappedLevel: AlertLevelType = rawLevel === 'RED'
                ? 'CRITICAL'
                : rawLevel === 'YELLOW'
                ? 'WARNING'
                : 'ADVISORY';

              sendPushNotification(
                levelTitle,
                alert.message || 'New earthquake alert issued.',
                mappedLevel
              );
            }
          }
        });

        if (isInitialLoad.current) {
          isInitialLoad.current = false;
        }

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

