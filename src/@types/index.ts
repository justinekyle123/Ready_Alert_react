// src/@types/index.ts

export type UserRole = 'HOST' | 'YOUTH_LEADER' | 'MEMBER';

export type EmergencyStatus = 'SAFE' | 'NEED_ASSISTANCE' | 'IN_DANGER' | 'UNACCOUNTED';

export type AlertLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  contactNumber?: string;
  /** Consent for SMS alerts — required before texting a member. See SMS_PLAN.md */
  smsOptIn?: boolean;
  groupId?: string;
  organizationName?: string;
  emergencyStatus?: EmergencyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Host {
  hostId: string;
  name: string;
  email: string;
  roleName: 'Host';
  contactNumber?: string;
}

export interface LeaderMemberVolunteer {
  leaderId: string;
  name: string;
  email: string;
  contactNumber: string;
  groupId: string;
  organizationName: string;
}

export interface Member {
  memberId: string;
  name: string;
  email: string;
  contactNumber?: string;
  groupId: string;
  emergencyStatus: EmergencyStatus;
  updatedAt?: string;
}

export interface Group {
  groupId: string;
  organizationName: string;
  leaderId?: string;
  leaderName?: string;
  memberCount?: number;
  createdAt: string;
}

export interface Alert {
  alertId: string;
  alertLevel: AlertLevel;
  timestamp: string; // ISO string
  message: string;
  triggeredBy: string; // User ID
  triggeredByName: string;
  triggeredByRole: UserRole;
  groupId?: string; // Optional: specific group or broadcast
  isBackupAlert: boolean; // True if Host overrode/sent backup alert
  active: boolean;
}

/**
 * SMS gateway (phone) readiness — written by the Cloud Functions in
 * functions/src/gateway.ts, read in real time from system/gatewayHealth.
 * Keep in sync with GatewayStatus in functions/src/gateway.ts.
 */
export type GatewayStatus = 'online' | 'degraded' | 'offline' | 'unconfigured' | 'unknown';

export interface GatewayDeviceState {
  id: string;
  name: string;
  lastSeen: string;
  online: boolean;
}

export interface GatewayHealth {
  status: GatewayStatus;
  checkedAt: string;
  source: 'scheduled' | 'manual';
  latencyMs: number | null;
  relay: { status: string; version: string } | null;
  devices: GatewayDeviceState[];
  onlineDeviceCount: number;
  error: string | null;
}

export interface TriAlarmOption {
  level: AlertLevel;
  title: string;
  description: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  ringColor: string;
}
