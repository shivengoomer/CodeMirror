import { STORAGE_KEYS, DEFAULT_BACKEND_URL, MAX_OFFLINE_QUEUE } from "./constants";
import type {
  AuthTokens,
  ExtensionSettings,
  QueuedSubmission,
  UnifiedSubmission,
  UserProfile,
  PopupData,
} from "./types";

// ── Generic helpers ─────────────────────────────────────────────────

export async function getStoredValue<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

export async function setStoredValue<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function removeStoredValue(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}

// ── Auth Tokens ─────────────────────────────────────────────────────

export async function getAuthTokens(): Promise<AuthTokens | undefined> {
  return getStoredValue<AuthTokens>(STORAGE_KEYS.AUTH_TOKENS);
}

export async function setAuthTokens(tokens: AuthTokens): Promise<void> {
  await setStoredValue(STORAGE_KEYS.AUTH_TOKENS, tokens);
}

export async function clearAuthTokens(): Promise<void> {
  await removeStoredValue(STORAGE_KEYS.AUTH_TOKENS);
}

// ── User Profile ────────────────────────────────────────────────────

export async function getUserProfile(): Promise<UserProfile | undefined> {
  return getStoredValue<UserProfile>(STORAGE_KEYS.USER_PROFILE);
}

export async function setUserProfile(profile: UserProfile): Promise<void> {
  await setStoredValue(STORAGE_KEYS.USER_PROFILE, profile);
}

export async function clearUserProfile(): Promise<void> {
  await removeStoredValue(STORAGE_KEYS.USER_PROFILE);
}

// ── Settings ────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: ExtensionSettings = {
  backendUrl: DEFAULT_BACKEND_URL,
  enableLeetcode: true,
  enableGfg: true,
  enableHackerrank: true,
};

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await getStoredValue<ExtensionSettings>(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function setSettings(
  settings: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const merged = { ...current, ...settings };
  await setStoredValue(STORAGE_KEYS.SETTINGS, merged);
  return merged;
}

// ── Offline Queue ───────────────────────────────────────────────────

export async function getOfflineQueue(): Promise<QueuedSubmission[]> {
  return (await getStoredValue<QueuedSubmission[]>(STORAGE_KEYS.OFFLINE_QUEUE)) ?? [];
}

export async function addToOfflineQueue(
  submission: UnifiedSubmission
): Promise<void> {
  const queue = await getOfflineQueue();
  if (queue.length >= MAX_OFFLINE_QUEUE) {
    queue.shift(); // drop oldest
  }
  queue.push({ submission, retries: 0, addedAt: Date.now() });
  await setStoredValue(STORAGE_KEYS.OFFLINE_QUEUE, queue);
}

export async function updateOfflineQueue(
  queue: QueuedSubmission[]
): Promise<void> {
  await setStoredValue(STORAGE_KEYS.OFFLINE_QUEUE, queue);
}

export async function clearOfflineQueue(): Promise<void> {
  await setStoredValue(STORAGE_KEYS.OFFLINE_QUEUE, []);
}

// ── Popup Cache ─────────────────────────────────────────────────────

export async function getPopupCache(): Promise<PopupData | undefined> {
  return getStoredValue<PopupData>(STORAGE_KEYS.POPUP_CACHE);
}

export async function setPopupCache(data: PopupData): Promise<void> {
  await setStoredValue(STORAGE_KEYS.POPUP_CACHE, data);
}
