import { Platform } from 'react-native';

const DEFAULT_API_PATH_SUFFIX = /\/api\/v1$/;

export function getApiBaseUrl(): string {
  const rawUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!rawUrl) {
    throw new Error(
      'Falta la variable de entorno EXPO_PUBLIC_API_URL. Configúrala en .env apuntando al backend institucional (/api/v1).'
    );
  }

  const normalized = rawUrl.replace(/\/+$/, '');

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(
      `EXPO_PUBLIC_API_URL no es una URL válida: "${rawUrl}". Debe iniciar con http:// o https://.`
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Protocolo no permitido en EXPO_PUBLIC_API_URL ("${parsed.protocol}"). Usa http: o https:.`
    );
  }

  const isLocalHost =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1';

  const isDevMode = typeof __DEV__ !== 'undefined' && __DEV__;
  if (isLocalHost && (Platform.OS !== 'web' || !isDevMode)) {
    throw new Error(
      'EXPO_PUBLIC_API_URL no puede apuntar a localhost en dispositivos físicos o producción. Usa la URL pública HTTPS del backend institucional.'
    );
  }

  return normalized;
}

export function getServerOrigin(): string {
  return getApiBaseUrl().replace(DEFAULT_API_PATH_SUFFIX, '');
}

export function buildProtectedAssetUrl(pathOrUrl: string): string {
  if (!pathOrUrl) {
    return '';
  }
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${getServerOrigin()}${cleanPath}`;
}

export function getUsuarioFotoUrl(usuarioId: number): string {
  return `${getApiBaseUrl()}/usuarios/${usuarioId}/foto`;
}
