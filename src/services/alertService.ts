// src/services/alertService.ts
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where,
  orderBy 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Alert, AlertLevel, UserRole } from '../@types';

export const transmitTriAlarmAlert = async (params: {
  alertLevel: AlertLevel;
  message: string;
  triggeredBy: string;
  triggeredByName: string;
  triggeredByRole: UserRole;
  groupId?: string;
  isBackupAlert?: boolean;
}): Promise<Alert> => {
  // Validate that only Leader or Host can trigger alert
  if (params.triggeredByRole !== 'YOUTH_LEADER' && params.triggeredByRole !== 'HOST') {
    throw new Error("Unauthorized: Only Leaders or Host can trigger Tri-Alarm alerts.");
  }

  const newAlertRef = doc(collection(db, 'alerts'));
  const alertData: Alert = {
    alertId: newAlertRef.id,
    alertLevel: params.alertLevel,
    timestamp: new Date().toISOString(),
    message: params.message,
    triggeredBy: params.triggeredBy,
    triggeredByName: params.triggeredByName,
    triggeredByRole: params.triggeredByRole,
    groupId: params.groupId || 'GLOBAL_ALL',
    isBackupAlert: !!params.isBackupAlert,
    active: true
  };

  await setDoc(newAlertRef, alertData);
  return alertData;
};

export const transmitBackupAlert = async (params: {
  alertLevel: AlertLevel;
  message: string;
  hostId: string;
  hostName: string;
  targetGroupId?: string;
}): Promise<Alert> => {
  return transmitTriAlarmAlert({
    alertLevel: params.alertLevel,
    message: `[HOST OVERRIDE BACKUP] ${params.message}`,
    triggeredBy: params.hostId,
    triggeredByName: params.hostName,
    triggeredByRole: 'HOST',
    groupId: params.targetGroupId || 'GLOBAL_ALL',
    isBackupAlert: true
  });
};

export const resolveAlert = async (alertId: string): Promise<void> => {
  const alertRef = doc(db, 'alerts', alertId);
  await updateDoc(alertRef, {
    active: false,
    resolvedAt: new Date().toISOString()
  });
};

export const getActiveAlerts = async (): Promise<Alert[]> => {
  const alertsRef = collection(db, 'alerts');
  const q = query(alertsRef, where('active', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(docSnap => docSnap.data() as Alert);
};
