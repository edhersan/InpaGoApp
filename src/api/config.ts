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
      `EXPO_PUBLIC_API_URL no es una URL válida: "${rawUrl}". Debe iniciar con https://.`
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Protocolo no permitido en EXPO_PUBLIC_API_URL ("${parsed.protocol}"). Usa https:.`
    );
  }

  const isLocalHost =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1';

  const isDevMode = typeof __DEV__ !== 'undefined' && __DEV__;
  const isProductionEnv = process.env.NODE_ENV === 'production' || !isDevMode;

  if (isLocalHost && (Platform.OS !== 'web' || isProductionEnv)) {
    throw new Error(
      'EXPO_PUBLIC_API_URL no puede apuntar a localhost en dispositivos físicos o producción. Usa la URL pública HTTPS del backend institucional.'
    );
  }

  if (parsed.protocol !== 'https:' && (isProductionEnv || !isLocalHost)) {
    throw new Error(
      'Conexión insegura bloqueada: EXPO_PUBLIC_API_URL debe usar https:// en entornos no locales o de producción.'
    );
  }

  return normalized;
}

export function getServerOrigin(): string {
  return getApiBaseUrl().replace(DEFAULT_API_PATH_SUFFIX, '');
}

export function isTrustedApiOrigin(targetUrl: string): boolean {
  try {
    const trustedOrigin = new URL(getServerOrigin()).origin;
    const candidateOrigin = new URL(targetUrl).origin;
    return candidateOrigin === trustedOrigin;
  } catch {
    return false;
  }
}

export function buildProtectedAssetUrl(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return isTrustedApiOrigin(trimmed) ? trimmed : '';
  }

  if (trimmed.startsWith('//')) {
    return '';
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const fullUrl = `${getServerOrigin()}${cleanPath}`;
  return isTrustedApiOrigin(fullUrl) ? fullUrl : '';
}

export function getUsuarioFotoUrl(usuarioId: number): string {
  return `${getApiBaseUrl()}/usuarios/${usuarioId}/foto`;
}
