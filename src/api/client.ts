import { Platform } from 'react-native';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ApiResponse, UsuarioAuth } from '@/types/api.types';
import { getApiBaseUrl } from '@/api/config';
import { PENDING_SYNC_KEY, SessionStorage } from '@/auth/storage';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  skipRefresh?: boolean;
  queueOnNetworkError?: boolean;
}

export interface PendingSyncItem {
  id: string;
  path: string;
  method: Exclude<HttpMethod, 'GET'>;
  body?: unknown;
  createdAt: string;
}

interface RefreshResponseData {
  access_token: string;
  refresh_token?: string;
  usuario?: UsuarioAuth;
}

type PendingSyncListener = (count: number) => void;
const pendingListeners = new Set<PendingSyncListener>();

let activeRefreshPromise: Promise<string | null> | null = null;

async function readPendingQueue(): Promise<PendingSyncItem[]> {
  const raw = await SessionStorage.getItem(PENDING_SYNC_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PendingSyncItem[]) : [];
  } catch {
    return [];
  }
}

async function writePendingQueue(items: PendingSyncItem[]): Promise<void> {
  if (items.length === 0) {
    await SessionStorage.removeItem(PENDING_SYNC_KEY);
  } else {
    await SessionStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(items));
  }
  pendingListeners.forEach((listener) => listener(items.length));
}

export function subscribePendingSync(listener: PendingSyncListener): () => void {
  pendingListeners.add(listener);
  void readPendingQueue().then((items) => listener(items.length));
  return () => {
    pendingListeners.delete(listener);
  };
}

export async function getPendingSyncCount(): Promise<number> {
  const items = await readPendingQueue();
  return items.length;
}

export async function enqueuePendingSync(
  path: string,
  method: Exclude<HttpMethod, 'GET'>,
  body?: unknown
): Promise<void> {
  const items = await readPendingQueue();
  const nextItem: PendingSyncItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    path,
    method,
    body,
    createdAt: new Date().toISOString(),
  };
  await writePendingQueue([...items, nextItem]);
}

export async function flushPendingSyncQueue(): Promise<{ synced: number; remaining: number }> {
  const items = await readPendingQueue();
  if (items.length === 0) {
    return { synced: 0, remaining: 0 };
  }

  const remaining: PendingSyncItem[] = [];
  let synced = 0;

  for (const item of items) {
    try {
      await apiRequest<unknown>(item.path, {
        method: item.method,
        body: item.body,
        queueOnNetworkError: false,
      });
      synced += 1;
    } catch {
      remaining.push(item);
    }
  }

  await writePendingQueue(remaining);
  return { synced, remaining: remaining.length };
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function isAuthEndpoint(path: string): boolean {
  const clean = normalizePath(path);
  return (
    clean.startsWith('/auth/login') ||
    clean.startsWith('/auth/refresh') ||
    clean.startsWith('/auth/registro')
  );
}

export async function refreshAccessToken(): Promise<string | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    const refreshToken = await SessionStorage.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse<RefreshResponseData> | null;
      if (!response.ok || !payload || !payload.success || !payload.data?.access_token) {
        return null;
      }

      await SessionStorage.setAccessToken(payload.data.access_token);
      if (payload.data.refresh_token) {
        await SessionStorage.setRefreshToken(payload.data.refresh_token);
      }
      if (payload.data.usuario) {
        await SessionStorage.setUser(payload.data.usuario);
      }
      return payload.data.access_token;
    } catch {
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export interface FormDataFileInput {
  uri: string;
  name?: string;
  type?: string;
  blob?: Blob;
}

function inferDefaultMimeType(fieldName: string, fileName?: string): string {
  const lowerField = fieldName.toLowerCase();
  const lowerName = (fileName ?? '').toLowerCase();

  if (lowerField.includes('audio') || lowerField.includes('voz') || lowerName.endsWith('.m4a')) {
    return 'audio/m4a';
  }
  if (lowerName.endsWith('.webm')) {
    return 'audio/webm';
  }
  if (lowerName.endsWith('.wav')) {
    return 'audio/wav';
  }
  if (lowerField.includes('excel') || lowerName.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (lowerName.endsWith('.xls')) {
    return 'application/vnd.ms-excel';
  }
  if (lowerName.endsWith('.png')) {
    return 'image/png';
  }
  return 'image/jpeg';
}

function inferDefaultExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'audio/m4a':
    case 'audio/mp4':
      return 'm4a';
    case 'audio/webm':
      return 'webm';
    case 'audio/wav':
      return 'wav';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'xlsx';
    case 'application/vnd.ms-excel':
      return 'xls';
    default:
      return 'jpg';
  }
}

export async function appendFileToFormData(
  formData: FormData,
  fieldName: string,
  file: FormDataFileInput
): Promise<void> {
  const uri = typeof file?.uri === 'string' ? file.uri.trim() : '';
  if (!uri) {
    throw new Error(`El archivo "${fieldName}" no tiene una ruta (uri) válida para enviar.`);
  }

  const rawType = typeof file.type === 'string' ? file.type.split(';')[0]?.trim() : '';
  const mimeType = rawType || inferDefaultMimeType(fieldName, file.name);
  const rawName = typeof file.name === 'string' ? file.name.trim() : '';
  const fileName = rawName || `${fieldName}.${inferDefaultExtension(mimeType)}`;

  if (Platform.OS === 'web') {
    const blob = file.blob ?? (await (await fetch(uri)).blob());
    formData.append(fieldName, blob, fileName);
    return;
  }

  const localFile = new ExpoFile(uri);
  const fileBytes = await localFile.bytes();
  const nativePart = {
    uri,
    name: fileName,
    type: mimeType,
    bytes: async (): Promise<Uint8Array> => fileBytes,
  };
  formData.append(fieldName, nativePart as unknown as Blob);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    headers: customHeaders = {},
    skipAuth = false,
    skipRefresh = false,
    queueOnNetworkError = false,
  } = options;

  const cleanPath = normalizePath(path);
  const url = `${getApiBaseUrl()}${cleanPath}`;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const executeFetch = async (tokenOverride?: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...customHeaders,
    };

    if (isFormData) {
      delete headers['Content-Type'];
      delete headers['content-type'];
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (!skipAuth) {
      const token = tokenOverride !== undefined ? tokenOverride : await SessionStorage.getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const requestInit: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      requestInit.body = isFormData ? (body as FormData) : JSON.stringify(body);
    }

    return fetch(url, requestInit);
  };

  let response: Response;
  try {
    response = await executeFetch();
  } catch (networkError) {
    if (queueOnNetworkError && !isFormData && method !== 'GET') {
      await enqueuePendingSync(cleanPath, method, body);
      throw new Error(
        'Sin conexión con el servidor institucional. La operación se guardó para sincronizar al recuperar conectividad.'
      );
    }
    const reason =
      networkError instanceof Error ? networkError.message : 'No fue posible conectar con el servidor institucional.';
    throw new Error(`Error de red: ${reason}`);
  }

  if (response.status === 401 && !skipRefresh && !skipAuth && !isAuthEndpoint(cleanPath)) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      response = await executeFetch(refreshedToken);
    }
  }

  const textBody = await response.text();
  let payload: ApiResponse<T> | null = null;

  if (textBody) {
    try {
      payload = JSON.parse(textBody) as ApiResponse<T>;
    } catch {
      payload = null;
    }
  }

  if (!response.ok || !payload || payload.success === false) {
    const serverMessage =
      payload?.message ||
      (response.status === 401
        ? 'Tu sesión ha expirado. Inicia sesión nuevamente.'
        : `Error HTTP ${response.status} al comunicarse con el servidor institucional.`);
    throw new Error(serverMessage);
  }

  return payload.data;
}

export async function downloadPdfReport(queryString: string): Promise<void> {
  const cleanQuery = queryString.replace(/^\?/, '');
  const url = `${getApiBaseUrl()}/reportes/asistencia/pdf${cleanQuery ? `?${cleanQuery}` : ''}`;
  const accessToken = await SessionStorage.getAccessToken();

  if (!accessToken) {
    throw new Error('No existe una sesión activa para descargar el reporte PDF.');
  }

  const fileName = `reporte-asistencia-inpago-${Date.now()}.pdf`;

  if (Platform.OS === 'web') {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/pdf',
      },
    });

    if (!response.ok) {
      let message = `No se pudo generar el reporte PDF (HTTP ${response.status}).`;
      try {
        const errorJson = (await response.json()) as Partial<ApiResponse<unknown>>;
        if (errorJson.message) {
          message = errorJson.message;
        }
      } catch {
        // Respuesta binaria o texto plano
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
    return;
  }

  const destinationFile = new ExpoFile(Paths.cache, fileName);
  const downloadedFile = await ExpoFile.downloadFileAsync(url, destinationFile, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/pdf',
    },
    idempotent: true,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(downloadedFile.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Compartir Reporte de Asistencia Inpa_Go',
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  await Print.printAsync({ uri: downloadedFile.uri });
}
