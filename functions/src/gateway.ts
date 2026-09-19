/**
 * SMS gateway health probe.
 *
 * Answers one question for the app: **can an SMS actually be sent right now?**
 *
 * Two independent things have to be true:
 *   1. the gateway relay is up            → `client.getHealth()`   (pass / warn / fail)
 *   2. your phone is connected to it      → `client.getDevices()`  → `lastSeen` freshness
 *
 * (2) is the one that actually breaks in practice: a phone with a flat battery,
 * no signal, or a background process killed by the OEM's battery manager simply
 * disappears from the device list.
 */
import Client, { HealthStatus, type Device } from 'android-sms-gateway';

/** A device is considered connected when it reported in within this window. */
const DEVICE_STALE_AFTER_MS = 10 * 60 * 1000;

export type GatewayStatus =
  /** Relay healthy and at least one phone checking in recently */
  | 'online'
  /** Works, but something is off — relay warning or a device that stopped reporting */
  | 'degraded'
  /** Cannot send: relay failing, or no phone is connected */
  | 'offline'
  /** Credentials missing or rejected — nothing has been configured yet */
  | 'unconfigured'
  /** We could not determine the state (network/relay unreachable) */
  | 'unknown';

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
  /** How long the probe took, for spotting a slow/unreachable relay */
  latencyMs: number | null;
  relay: { status: string; version: string } | null;
  devices: GatewayDeviceState[];
  onlineDeviceCount: number;
  /** Human-readable reason when the status is not `online` */
  error: string | null;
}

const isFresh = (device: Device, now: number): boolean => {
  const lastSeen = new Date(device.lastSeen).getTime();
  if (Number.isNaN(lastSeen)) return false;
  return now - lastSeen < DEVICE_STALE_AFTER_MS;
};

const isAuthError = (message: string): boolean =>
  message.includes('401') || message.includes('403');

/**
 * Probe the gateway. Never throws — the failure becomes part of the report,
 * because "we could not check" is itself a status the UI must show honestly.
 */
export const probeGateway = async (params: {
  source: 'scheduled' | 'manual';
  login: string;
  password: string;
}): Promise<GatewayHealth> => {
  const checkedAt = new Date().toISOString();
  const base: GatewayHealth = {
    status: 'unknown',
    checkedAt,
    source: params.source,
    latencyMs: null,
    relay: null,
    devices: [],
    onlineDeviceCount: 0,
    error: null
  };

  if (!params.login || !params.password) {
    return {
      ...base,
      status: 'unconfigured',
      error:
        'Gateway credentials are not set. Run: firebase functions:secrets:set ANDROID_SMS_GATEWAY_LOGIN (and ..._PASSWORD).'
    };
  }

  const client = new Client(params.login, params.password);
  const startedAt = Date.now();

  let relayStatus: string;
  let relayVersion: string;
  let devices: Device[];

  try {
    const health = await client.getHealth();
    relayStatus = health.status;
    relayVersion = health.version;
    devices = await client.getDevices();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...base,
      status: isAuthError(message) ? 'unconfigured' : 'unknown',
      latencyMs: Date.now() - startedAt,
      error: isAuthError(message)
        ? 'Gateway rejected the credentials — check the login/password secrets.'
        : `Could not reach the SMS gateway relay: ${message}`
    };
  }

  const now = Date.now();
  const activeDevices = devices.filter((device) => !device.deletedAt);
  const deviceStates = activeDevices.map((device) => ({
    id: device.id,
    name: device.name,
    lastSeen: device.lastSeen,
    online: isFresh(device, now)
  }));
  const onlineDeviceCount = deviceStates.filter((device) => device.online).length;

  let status: GatewayStatus;
  let error: string | null = null;

  if (relayStatus === HealthStatus.Fail) {
    status = 'offline';
    error = 'The SMS gateway relay is reporting a failure.';
  } else if (onlineDeviceCount === 0) {
    status = 'offline';
    error =
      activeDevices.length === 0
        ? 'No phone is connected to the gateway account.'
        : `No phone has reported in for over ${DEVICE_STALE_AFTER_MS / 60000} minutes — the gateway app may be stopped, offline, or killed by battery optimisation.`;
  } else if (relayStatus === HealthStatus.Warn || onlineDeviceCount < activeDevices.length) {
    status = 'degraded';
    error = `${activeDevices.length - onlineDeviceCount} connected phone(s) stopped reporting in.`;
  } else {
    status = 'online';
  }

  return {
    ...base,
    status,
    latencyMs: Date.now() - startedAt,
    relay: { status: relayStatus, version: relayVersion },
    devices: deviceStates,
    onlineDeviceCount,
    error
  };
};
