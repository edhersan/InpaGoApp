import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { LoginResponseData, UsuarioAuth } from '@/types/api.types';

export const ACCESS_KEY = 'inpago_access_token';
export const REFRESH_KEY = 'inpago_refresh_token';
export const USER_KEY = 'inpago_user_profile';
export const DEVICE_ID_KEY = 'inpago_device_id';
export const BIOMETRIC_KEY = 'inpago_biometric_enabled';
export const PENDING_SYNC_KEY = 'inpago_pending_sync_queue';

function isWebStorageAvailable(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

async function getItem(key: string): Promise<string | null> {
  if (isWebStorageAvailable()) {
    return window.localStorage.getItem(key);
  }
  if (Platform.OS === 'web') {
    return null;
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWebStorageAvailable()) {
    window.localStorage.setItem(key, value);
    return;
  }
  if (Platform.OS === 'web') {
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (isWebStorageAvailable()) {
    window.localStorage.removeItem(key);
    return;
  }
  if (Platform.OS === 'web') {
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function generateDeviceId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `inpago-${Platform.OS}-${timePart}-${randomPart}`;
}

export const SessionStorage = {
  getItem,
  setItem,
  removeItem,

  async getAccessToken(): Promise<string | null> {
    return getItem(ACCESS_KEY);
  },

  async setAccessToken(token: string): Promise<void> {
    await setItem(ACCESS_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return getItem(REFRESH_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    await setItem(REFRESH_KEY, token);
  },

  async getUser(): Promise<UsuarioAuth | null> {
    const raw = await getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as UsuarioAuth;
    } catch {
      return null;
    }
  },

  async setUser(user: UsuarioAuth): Promise<void> {
    await setItem(USER_KEY, JSON.stringify(user));
  },

  async saveSession(data: LoginResponseData): Promise<void> {
    await Promise.all([
      setItem(ACCESS_KEY, data.access_token),
      setItem(REFRESH_KEY, data.refresh_token),
      setItem(USER_KEY, JSON.stringify(data.usuario)),
    ]);
  },

  async clearSession(): Promise<void> {
    await Promise.all([
      removeItem(ACCESS_KEY),
      removeItem(REFRESH_KEY),
      removeItem(USER_KEY),
    ]);
  },

  async getOrCreateDeviceId(): Promise<string> {
    const existing = await getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }
    const created = generateDeviceId();
    await setItem(DEVICE_ID_KEY, created);
    return created;
  },

  async isBiometricEnabled(): Promise<boolean> {
    const value = await getItem(BIOMETRIC_KEY);
    return value === 'true';
  },

  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await setItem(BIOMETRIC_KEY, enabled ? 'true' : 'false');
  },
};
