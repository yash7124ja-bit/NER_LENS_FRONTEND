import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Session, 
  CachedMission, 
  CachedRouteAlert, 
  FieldReport, 
  PositionBatchQueueItem, 
  LanguageCode 
} from '../types';

const KEYS = {
  SESSION: 'ner_lens_session',
  ACTIVE_OWNER: 'ner_lens_active_owner',
  MISSIONS_PREFIX: 'ner_lens_missions_',
  ALERTS_PREFIX: 'ner_lens_alerts_',
  REPORTS_PREFIX: 'ner_lens_reports_',
  GPS_QUEUE_PREFIX: 'ner_lens_gps_',
  SETTINGS: 'ner_lens_settings',
};

export interface AppSettings {
  language: LanguageCode;
  gpsTrackingEnabled: boolean;
  gpsIntervalSeconds: number;
  serverUrl: string;
  isMockMode: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  gpsTrackingEnabled: true,
  gpsIntervalSeconds: 15,
  serverUrl: 'https://ner-lens.yash7124ja.workers.dev/v1',
  isMockMode: false,
};

export async function saveSession(session: Session | null): Promise<void> {
  if (!session) {
    await AsyncStorage.removeItem(KEYS.SESSION);
  } else {
    await AsyncStorage.setItem(KEYS.SESSION, JSON.stringify(session));
    await setActiveOwner(session.user.actor_id);
  }
}

export async function getSession(): Promise<Session | null> {
  const data = await AsyncStorage.getItem(KEYS.SESSION);
  if (!data) return null;
  try {
    return JSON.parse(data) as Session;
  } catch {
    return null;
  }
}

export async function setActiveOwner(owner: string): Promise<void> {
  const prevOwner = await AsyncStorage.getItem(KEYS.ACTIVE_OWNER);
  if (prevOwner && prevOwner !== owner) {
    // When switching account, prevent cross-user cached trip leakage
    console.log(`[Storage] Switching active account from ${prevOwner} to ${owner}`);
  }
  await AsyncStorage.setItem(KEYS.ACTIVE_OWNER, owner);
}

export async function getActiveOwner(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.ACTIVE_OWNER);
}

export async function getCachedMissions(owner: string): Promise<CachedMission[]> {
  const data = await AsyncStorage.getItem(`${KEYS.MISSIONS_PREFIX}${owner}`);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveCachedMissions(owner: string, missions: CachedMission[]): Promise<void> {
  await AsyncStorage.setItem(`${KEYS.MISSIONS_PREFIX}${owner}`, JSON.stringify(missions));
}

export async function getCachedAlerts(owner: string): Promise<CachedRouteAlert[]> {
  const data = await AsyncStorage.getItem(`${KEYS.ALERTS_PREFIX}${owner}`);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveCachedAlerts(owner: string, alerts: CachedRouteAlert[]): Promise<void> {
  await AsyncStorage.setItem(`${KEYS.ALERTS_PREFIX}${owner}`, JSON.stringify(alerts));
}

export async function getFieldReports(owner: string): Promise<FieldReport[]> {
  const data = await AsyncStorage.getItem(`${KEYS.REPORTS_PREFIX}${owner}`);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveFieldReports(owner: string, reports: FieldReport[]): Promise<void> {
  await AsyncStorage.setItem(`${KEYS.REPORTS_PREFIX}${owner}`, JSON.stringify(reports));
}

export async function getGpsQueue(owner: string): Promise<PositionBatchQueueItem[]> {
  const data = await AsyncStorage.getItem(`${KEYS.GPS_QUEUE_PREFIX}${owner}`);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveGpsQueue(owner: string, queue: PositionBatchQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(`${KEYS.GPS_QUEUE_PREFIX}${owner}`, JSON.stringify(queue));
}

export async function getSettings(): Promise<AppSettings> {
  const data = await AsyncStorage.getItem(KEYS.SETTINGS);
  if (!data) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
  return updated;
}

export async function clearCurrentAccountCache(owner: string): Promise<void> {
  await AsyncStorage.removeItem(`${KEYS.MISSIONS_PREFIX}${owner}`);
  await AsyncStorage.removeItem(`${KEYS.ALERTS_PREFIX}${owner}`);
  await AsyncStorage.removeItem(KEYS.SESSION);
}
