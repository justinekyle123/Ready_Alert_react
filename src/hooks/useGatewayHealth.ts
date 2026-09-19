// src/hooks/useGatewayHealth.ts
import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { GatewayHealth } from '../@types';

/**
 * Live SMS gateway (phone) readiness.
 *
 * The server writes `system/gatewayHealth` on a 5-minute heartbeat
 * (monitorGatewayHealth) and whenever someone presses "Check now"
 * (checkGatewayHealth). This hook only reads it.
 */
export const useGatewayHealth = () => {
  const [health, setHealth] = useState<GatewayHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [checking, setChecking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'system', 'gatewayHealth'),
      (snapshot) => {
        setHealth(snapshot.exists() ? (snapshot.data() as GatewayHealth) : null);
        setLoading(false);
      },
      (err) => {
        console.error('Error reading SMS gateway health:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /** Ask the server to probe the gateway right now (instead of waiting for the heartbeat) */
  const checkNow = useCallback(async (): Promise<GatewayHealth | null> => {
    setChecking(true);
    try {
      const callable = httpsCallable<void, GatewayHealth>(functions, 'checkGatewayHealth');
      const result = await callable();
      setHealth(result.data);
      setError(null);
      return result.data;
    } catch (err: any) {
      console.warn('Gateway health check failed:', err);
      setError(err?.message || 'Gateway health check failed.');
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  return { health, loading, checking, error, checkNow };
};
