// src/services/alertService.ts
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Alert, AlertLevel, UserRole } from '../@types';
import { sendAlertSms } from './smsService';

const GLOBAL_SCOPE = 'GLOBAL_ALL';

const sendSmsForAlert = async (alert: Alert): Promise<void> => {
  try {
    const usersRef = collection(db, 'users');
    const usersQuery = alert.groupId && alert.groupId !== GLOBAL_SCOPE
      ? query(usersRef, where('groupId', '==', alert.groupId))
      : query(usersRef);
    const snapshot = await getDocs(usersQuery);
    const numbers = snapshot.docs
      .map((userDoc) => userDoc.data().contactNumber)
      .filter((number): number is string => typeof number === 'string' && number.trim().length > 0);
    const smsResult = await sendAlertSms({ message: alert.message, numbers });
    await updateDoc(doc(db, 'alerts', alert.alertId), {
      smsSummary: {
        status: smsResult.success ? 'sent' : 'failed',
        sent: smsResult.sent ?? 0,
        failed: smsResult.failed ?? numbers.length,
        provider: 'hosted-php-sms-api',
        messageId: smsResult.messageId ?? null,
        error: smsResult.error ?? null,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('SMS alert failed after the alert was created:', error);
    await updateDoc(doc(db, 'alerts', alert.alertId), {
      smsSummary: {
        status: 'failed',
        sent: 0,
        failed: 0,
        provider: 'hosted-php-sms-api',
        error: error instanceof Error ? error.message : 'SMS request failed.',
        completedAt: new Date().toISOString(),
      },
    });
  }
};

/**
 * End every alarm still marked active in the same viewing scope so only ONE alarm
 * is ever live. Without this a second transmit leaves the previous alarm active,
 * so the two overlap in the banner, the alert log, and on every receiver.
 *
 * A global (GLOBAL_ALL) alarm supersedes everything; a group alarm supersedes its
 * own group plus any global alarm the group is following. The alarm that was just
 * created is skipped by id.
 */
const resolveActiveAlertsInScope = async (
  scopeGroupId: string,
  exceptAlertId: string
): Promise<void> => {
  const activeSnapshot = await getDocs(query(collection(db, 'alerts'), where('active', '==', true)));
  const resolvedAt = new Date().toISOString();

  const updates = activeSnapshot.docs
    .filter((docSnap) => {
      if (docSnap.id === exceptAlertId) return false;
      const groupId = docSnap.data().groupId as string | undefined;
      return (
        scopeGroupId === GLOBAL_SCOPE ||
        groupId === scopeGroupId ||
        groupId === GLOBAL_SCOPE
      );
    })
    .map((docSnap) =>
      updateDoc(docSnap.ref, {
        active: false,
        resolvedAt,
        resolvedReason: 'superseded'
      })
    );

  if (updates.length > 0) {
    await Promise.all(updates);
    console.log(`Ended ${updates.length} previous alarm(s) superseded by the new broadcast.`);
  }
};

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

  // A new broadcast replaces whatever alarm was live before it. Run after the
  // new alert exists so receivers briefly see the newest one, but never let a
  // failure here lose the freshly transmitted alarm.
  try {
    await resolveActiveAlertsInScope(alertData.groupId, alertData.alertId);
  } catch (err) {
    console.error('Unable to end the previous alarm:', err);
  }

  void sendSmsForAlert(alertData);
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
