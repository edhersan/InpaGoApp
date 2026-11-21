import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import type { LoginResponseData, RolCodigo, UsuarioAuth } from '@/types/api.types';
import { apiRequest, refreshAccessToken } from '@/api/client';
import { SessionStorage } from '@/auth/storage';

export interface AuthContextValue {
  user: UsuarioAuth | null;
  accessToken: string | null;
  isLoading: boolean;
  biometricsAvailable: boolean;
  biometricsEnabled: boolean;
  signIn: (correoInstitucional: string, password: string) => Promise<UsuarioAuth>;
  registerFormData: (
    formData: FormData,
    credentials: { correo_institucional: string; password: string }
  ) => Promise<UsuarioAuth>;
  signInWithBiometrics: () => Promise<UsuarioAuth>;
  enableBiometrics: () => Promise<boolean>;
  updateLocalUser: (partial: Partial<UsuarioAuth>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function getDashboardRouteForRole(rol: RolCodigo): '/admin' | '/teacher' | '/student' {
  switch (rol) {
    case 'ADMIN_BIENESTAR':
      return '/admin';
    case 'DOCENTE':
      return '/teacher';
    case 'ESTUDIANTE':
      return '/student';
  }
}

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): ReactElement {
  const [user, setUser] = useState<UsuarioAuth | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean>(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    const bootstrap = async (): Promise<void> => {
      try {
        const [storedToken, storedUser, storedBiometric] = await Promise.all([
          SessionStorage.getAccessToken(),
          SessionStorage.getUser(),
          SessionStorage.isBiometricEnabled(),
        ]);

        let hardwareReady = false;
        if (Platform.OS !== 'web') {
          const [hasHardware, isEnrolled] = await Promise.all([
            LocalAuthentication.hasHardwareAsync(),
            LocalAuthentication.isEnrolledAsync(),
          ]);
          hardwareReady = hasHardware && isEnrolled;
        }

        if (!active) {
          return;
        }

        setBiometricsAvailable(hardwareReady);
        setBiometricsEnabled(storedBiometric || Boolean(storedUser?.biometria_habilitada));

        if (storedToken && storedUser) {
          setAccessToken(storedToken);
          setUser(storedUser);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (correoInstitucional: string, password: string): Promise<UsuarioAuth> => {
    const deviceId = await SessionStorage.getOrCreateDeviceId();
    const loginData = await apiRequest<LoginResponseData>('/auth/login', {
      method: 'POST',
      skipAuth: true,
      skipRefresh: true,
      body: {
        correo_institucional: correoInstitucional.trim().toLowerCase(),
        password,
        device_id: deviceId,
      },
    });

    await SessionStorage.saveSession(loginData);
    setAccessToken(loginData.access_token);
    setUser(loginData.usuario);
    if (loginData.usuario.biometria_habilitada) {
      await SessionStorage.setBiometricEnabled(true);
      setBiometricsEnabled(true);
    }
    return loginData.usuario;
  }, []);

  const registerFormData = useCallback(
    async (
      formData: FormData,
      credentials: { correo_institucional: string; password: string }
    ): Promise<UsuarioAuth> => {
      await apiRequest<unknown>('/auth/registro', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        body: formData,
      });

      return signIn(credentials.correo_institucional, credentials.password);
    },
    [signIn]
  );

  const enableBiometrics = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      throw new Error('La autenticación biométrica nativa solo está disponible en Android e iOS.');
    }

    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);

    if (!hasHardware || !isEnrolled) {
      throw new Error('Tu dispositivo no tiene huella dactilar o reconocimiento facial configurado.');
    }

    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirma tu identidad para activar el acceso biométrico en Inpa_Go',
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar clave del dispositivo',
    });

    if (!authResult.success) {
      return false;
    }

    await SessionStorage.setBiometricEnabled(true);
    setBiometricsEnabled(true);
    setBiometricsAvailable(true);

    if (user) {
      const updatedUser: UsuarioAuth = { ...user, biometria_habilitada: true };
      await SessionStorage.setUser(updatedUser);
      setUser(updatedUser);
    }

    return true;
  }, [user]);

  const signInWithBiometrics = useCallback(async (): Promise<UsuarioAuth> => {
    if (Platform.OS === 'web') {
      throw new Error('El desbloqueo biométrico está disponible únicamente en la aplicación móvil.');
    }

    const [storedRefresh, storedUser] = await Promise.all([
      SessionStorage.getRefreshToken(),
      SessionStorage.getUser(),
    ]);

    if (!storedRefresh || !storedUser) {
      throw new Error('Inicia sesión primero con tu correo institucional para habilitar el acceso biométrico.');
    }

    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquea tu sesión institucional Inpa_Go',
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar contraseña',
    });

    if (!authResult.success) {
      throw new Error('Verificación biométrica cancelada o no reconocida.');
    }

    const freshToken = await refreshAccessToken();
    if (!freshToken) {
      await SessionStorage.clearSession();
      setAccessToken(null);
      setUser(null);
      throw new Error('La sesión expiró en el servidor institucional. Ingresa nuevamente con tu contraseña.');
    }

    const refreshedUser = (await SessionStorage.getUser()) ?? storedUser;
    setAccessToken(freshToken);
    setUser(refreshedUser);
    return refreshedUser;
  }, []);

  const updateLocalUser = useCallback(async (partial: Partial<UsuarioAuth>): Promise<void> => {
    setUser((prev) => {
      if (!prev) {
        return prev;
      }
      const merged: UsuarioAuth = { ...prev, ...partial };
      void SessionStorage.setUser(merged);
      return merged;
    });
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    const refreshToken = await SessionStorage.getRefreshToken();
    try {
      if (refreshToken) {
        await apiRequest<unknown>('/auth/logout', {
          method: 'POST',
          skipRefresh: true,
          body: { refresh_token: refreshToken },
        });
      }
    } catch {
      // Garantizar cierre de sesión local incluso sin red
    } finally {
      await SessionStorage.clearSession();
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isLoading,
      biometricsAvailable,
      biometricsEnabled,
      signIn,
      registerFormData,
      signInWithBiometrics,
      enableBiometrics,
      updateLocalUser,
      signOut,
    }),
    [
      user,
      accessToken,
      isLoading,
      biometricsAvailable,
      biometricsEnabled,
      signIn,
      registerFormData,
      signInWithBiometrics,
      enableBiometrics,
      updateLocalUser,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider.');
  }
  return context;
}
