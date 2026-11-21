import { useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { File as ExpoFile } from 'expo-file-system';
import { apiRequest, appendFileToFormData } from '@/api/client';
import { getDashboardRouteForRole, useAuth } from '@/auth/auth-context';
import { LegalPrivacyModal, type LegalTab } from '@/components/legal-privacy-modal';

type AuthTab = 'login' | 'register' | 'recover';
type RegisterRole = 'ESTUDIANTE' | 'DOCENTE';

interface CapturedPhoto {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

function requestPhotoConsent(source: 'camera' | 'library'): Promise<boolean> {
  const title = 'Consentimiento de Fotografía (UNINPAHU)';
  const message =
    source === 'camera'
      ? 'Inpa_Go utilizará la cámara únicamente para capturar tu fotografía institucional de registro y verificación visual en clase.'
      : 'Inpa_Go accederá a tu galería únicamente para seleccionar tu fotografía institucional de registro.';

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    }
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continuar', onPress: () => resolve(true) },
    ]);
  });
}

export default function LoginScreen(): ReactElement {
  const router = useRouter();
  const { signIn, registerFormData, signInWithBiometrics, biometricsAvailable } = useAuth();

  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  // Estado Iniciar Sesión y Recuperación
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [recoverEmail, setRecoverEmail] = useState<string>('');

  // Estado Registro (RF14)
  const [documento, setDocumento] = useState<string>('');
  const [codigoInstitucional, setCodigoInstitucional] = useState<string>('');
  const [nombreCompleto, setNombreCompleto] = useState<string>('');
  const [registerEmail, setRegisterEmail] = useState<string>('');
  const [registerPassword, setRegisterPassword] = useState<string>('');
  const [registerRole, setRegisterRole] = useState<RegisterRole>('ESTUDIANTE');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Consentimientos legales (Ley 1581 de 2012 — desmarcados por defecto)
  const [acceptedTermsPrivacy, setAcceptedTermsPrivacy] = useState<boolean>(false);
  const [acceptedBiometricGps, setAcceptedBiometricGps] = useState<boolean>(false);
  const [legalVisible, setLegalVisible] = useState<boolean>(false);
  const [legalTab, setLegalTab] = useState<LegalTab>('privacidad');

  const openLegalModal = (tab: LegalTab): void => {
    setLegalTab(tab);
    setLegalVisible(true);
  };

  const handleLogin = async (): Promise<void> => {
    setErrorMessage(null);
    if (!loginEmail.trim() || !loginPassword) {
      setErrorMessage('Ingresa tu correo institucional y contraseña.');
      return;
    }

    setSubmitting(true);
    try {
      const usuario = await signIn(loginEmail, loginPassword);
      router.replace(getDashboardRouteForRole(usuario.rol_codigo));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBiometricLogin = async (): Promise<void> => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const usuario = await signInWithBiometrics();
      router.replace(getDashboardRouteForRole(usuario.rol_codigo));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error en la autenticación biométrica.');
    } finally {
      setSubmitting(false);
    }
  };

  const pickPhoto = async (source: 'camera' | 'library'): Promise<void> => {
    setErrorMessage(null);

    const accepted = await requestPhotoConsent(source);
    if (!accepted) {
      return;
    }

    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setErrorMessage('Permiso de cámara denegado.');
          return;
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setErrorMessage('Permiso de galería denegado.');
          return;
        }
      }

      const pickerResult =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
            });

      if (pickerResult.canceled || !pickerResult.assets[0]) {
        return;
      }

      const asset = pickerResult.assets[0];
      let fileSize = asset.fileSize;

      if (fileSize === undefined && Platform.OS !== 'web') {
        const localFile = new ExpoFile(asset.uri);
        if (localFile.exists && typeof localFile.size === 'number') {
          fileSize = localFile.size;
        }
      }

      if (fileSize !== undefined && fileSize > MAX_PHOTO_BYTES) {
        setErrorMessage('La fotografía supera el límite máximo de 3 MB. Selecciona o toma una imagen más ligera.');
        return;
      }

      setPhoto({
        uri: asset.uri,
        fileName: asset.fileName ?? `foto-registro-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        fileSize,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible capturar la fotografía.');
    }
  };

  const handleRegister = async (): Promise<void> => {
    setErrorMessage(null);

    if (!documento.trim() || !nombreCompleto.trim() || !registerEmail.trim() || !registerPassword) {
      setErrorMessage('Completa documento, nombre completo, correo institucional y contraseña.');
      return;
    }

    if (registerPassword.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (!acceptedTermsPrivacy) {
      setErrorMessage(
        'Debes aceptar los Términos de Uso y el Aviso de Privacidad (Habeas Data) para crear tu cuenta.'
      );
      return;
    }

    if (!acceptedBiometricGps) {
      setErrorMessage(
        'Para completar el registro en la app con fotografía biométrica debes otorgar autorización expresa para datos biométricos sensibles. Recuerda que no es obligatorio: puedes solicitar el registro y control manual de asistencia con tu docente (MANUAL_DOCENTE).'
      );
      return;
    }

    if (!photo) {
      setErrorMessage('La fotografía de perfil es obligatoria para completar el registro biométrico en la app (RF14).');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('documento', documento.trim());
      if (codigoInstitucional.trim()) {
        formData.append('codigo_institucional', codigoInstitucional.trim());
      }
      formData.append('nombre_completo', nombreCompleto.trim());
      formData.append('correo_institucional', registerEmail.trim().toLowerCase());
      formData.append('password', registerPassword);
      formData.append('rol_codigo', registerRole);

      if (Platform.OS === 'web') {
        const blobResponse = await fetch(photo.uri);
        const blob = await blobResponse.blob();
        if (blob.size > MAX_PHOTO_BYTES) {
          throw new Error('La fotografía supera el límite máximo de 3 MB.');
        }
        await appendFileToFormData(formData, 'foto_perfil', {
          uri: photo.uri,
          name: photo.fileName,
          type: photo.mimeType,
          blob,
        });
      } else {
        await appendFileToFormData(formData, 'foto_perfil', {
          uri: photo.uri,
          name: photo.fileName,
          type: photo.mimeType,
        });
      }

      const usuario = await registerFormData(formData, {
        correo_institucional: registerEmail.trim().toLowerCase(),
        password: registerPassword,
      });
      router.replace(getDashboardRouteForRole(usuario.rol_codigo));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible completar el registro.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecoverPassword = async (): Promise<void> => {
    setErrorMessage(null);
    setInfoMessage(null);

    const normalizedEmail = recoverEmail.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setErrorMessage('Ingresa un correo institucional válido para solicitar la recuperación.');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest<unknown>('/auth/recuperar-password', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        body: { correo_institucional: normalizedEmail },
      });
      setInfoMessage(
        'Si el correo institucional está registrado, recibirás instrucciones para restablecer tu contraseña.'
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('Ruta no encontrada') || msg.includes('HTTP 404')) {
        setInfoMessage(
          'El restablecimiento automático aún no está habilitado en el servidor. Solicita el cambio de contraseña ante Bienestar Institucional UNINPAHU (soporte@uninpahu.edu.co) indicando tu documento y correo.'
        );
      } else {
        setErrorMessage(msg || 'No fue posible procesar la solicitud de recuperación.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerCard}>
          <Image source={require('../assets/logo.jpg')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brand}>
            <Text style={styles.brandNavy}>Inpa_</Text>
            <Text style={styles.brandOrange}>Go</Text>
          </Text>
          <Text style={styles.institutionText}>
            Sistema Institucional de Control de Asistencia — UNINPAHU
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.tabRow}>
            <Pressable
              accessibilityRole="tab"
              onPress={() => {
                setActiveTab('login');
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              style={[styles.tabButton, activeTab !== 'register' && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, activeTab !== 'register' && styles.tabTextActive]}>
                Iniciar Sesión
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              onPress={() => {
                setActiveTab('register');
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              style={[styles.tabButton, activeTab === 'register' && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, activeTab === 'register' && styles.tabTextActive]}>
                Registro con Foto
              </Text>
            </Pressable>
          </View>

          {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
          {infoMessage ? <Text style={styles.successBanner}>{infoMessage}</Text> : null}

          {activeTab === 'login' ? (
            <View style={styles.form}>
              <Text style={styles.label}>Correo institucional</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setLoginEmail}
                placeholder="usuario@uninpahu.edu.co"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                value={loginEmail}
              />

              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={setLoginPassword}
                placeholder="Ingresa tu contraseña"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                style={styles.input}
                value={loginPassword}
              />

              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => {
                  setRecoverEmail(loginEmail);
                  setErrorMessage(null);
                  setInfoMessage(null);
                  setActiveTab('recover');
                }}
                style={styles.forgotLinkWrap}
              >
                <Text style={styles.forgotLinkText}>¿Olvidaste tu contraseña?</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => {
                  void handleLogin();
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  submitting && styles.disabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Ingresar</Text>
                )}
              </Pressable>

              {biometricsAvailable && Platform.OS !== 'web' ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  onPress={() => {
                    void handleBiometricLogin();
                  }}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>Desbloquear con Huella / Face ID</Text>
                </Pressable>
              ) : null}
            </View>
          ) : activeTab === 'recover' ? (
            <View style={styles.form}>
              <Text style={styles.recoverTitle}>Recuperar Contraseña</Text>
              <Text style={styles.recoverSubtitle}>
                Ingresa tu correo institucional UNINPAHU para solicitar el restablecimiento de tu contraseña.
              </Text>

              <Text style={styles.label}>Correo institucional</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setRecoverEmail}
                placeholder="usuario@uninpahu.edu.co"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                value={recoverEmail}
              />

              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => {
                  void handleRecoverPassword();
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  submitting && styles.disabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Solicitar Recuperación</Text>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => {
                  setErrorMessage(null);
                  setInfoMessage(null);
                  setActiveTab('login');
                }}
                style={({ pressed }) => [styles.navyOutlineButton, pressed && styles.pressed]}
              >
                <Text style={styles.navyOutlineText}>Volver a Iniciar Sesión</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Rol institucional</Text>
              <View style={styles.roleRow}>
                {(['ESTUDIANTE', 'DOCENTE'] as const).map((role) => (
                  <Pressable
                    key={role}
                    accessibilityRole="button"
                    onPress={() => setRegisterRole(role)}
                    style={[styles.rolePill, registerRole === role && styles.rolePillActive]}
                  >
                    <Text style={[styles.rolePillText, registerRole === role && styles.rolePillTextActive]}>
                      {role === 'ESTUDIANTE' ? 'Estudiante' : 'Docente'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Número de documento *</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setDocumento}
                placeholder="Ej. 1012345678"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                value={documento}
              />

              <Text style={styles.label}>Código institucional (opcional)</Text>
              <TextInput
                autoCapitalize="characters"
                onChangeText={setCodigoInstitucional}
                placeholder="Ej. EST-2026-001"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                value={codigoInstitucional}
              />

              <Text style={styles.label}>Nombre completo *</Text>
              <TextInput
                onChangeText={setNombreCompleto}
                placeholder="Nombres y apellidos"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                value={nombreCompleto}
              />

              <Text style={styles.label}>Correo institucional *</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setRegisterEmail}
                placeholder="nombre@uninpahu.edu.co"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                value={registerEmail}
              />

              <Text style={styles.label}>Contraseña (mín. 8 caracteres) *</Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={setRegisterPassword}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                style={styles.input}
                value={registerPassword}
              />

              <View style={styles.photoBox}>
                <Text style={styles.label}>Fotografía de registro obligatoria (máx. 3 MB) *</Text>
                {photo ? (
                  <View style={styles.photoPreviewRow}>
                    <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                    <View style={styles.photoMeta}>
                      <Text style={styles.photoReadyText}>Foto lista para envío</Text>
                      <Text style={styles.photoFileName} numberOfLines={1}>
                        {photo.fileName}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.photoHint}>
                    Captura una foto clara de tu rostro para la validación visual en clase.
                  </Text>
                )}

                <View style={styles.photoButtonsRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={submitting}
                    onPress={() => {
                      void pickPhoto('camera');
                    }}
                    style={({ pressed }) => [styles.navyOutlineButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.navyOutlineText}>Tomar Foto</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={submitting}
                    onPress={() => {
                      void pickPhoto('library');
                    }}
                    style={({ pressed }) => [styles.navyOutlineButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.navyOutlineText}>Elegir de Galería</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.consentSection}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptedTermsPrivacy }}
                  onPress={() => setAcceptedTermsPrivacy((prev) => !prev)}
                  style={styles.checkboxRow}
                >
                  <View style={[styles.checkboxBox, acceptedTermsPrivacy && styles.checkboxBoxChecked]}>
                    {acceptedTermsPrivacy ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    Acepto los{' '}
                    <Text
                      onPress={() => openLegalModal('terminos')}
                      style={styles.inlineLink}
                    >
                      Términos de Uso
                    </Text>{' '}
                    y el{' '}
                    <Text
                      onPress={() => openLegalModal('privacidad')}
                      style={styles.inlineLink}
                    >
                      Aviso de Privacidad (Habeas Data)
                    </Text>{' '}
                    de UNINPAHU. *
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptedBiometricGps }}
                  onPress={() => setAcceptedBiometricGps((prev) => !prev)}
                  style={styles.checkboxRow}
                >
                  <View style={[styles.checkboxBox, acceptedBiometricGps && styles.checkboxBoxChecked]}>
                    {acceptedBiometricGps ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    Autorizo de forma expresa y facultativa el tratamiento de mis datos biométricos
                    sensibles (fotografía facial y patrón espectral de voz) y mi geolocalización
                    puntual en primer plano durante las sesiones de clase. Entiendo que{' '}
                    <Text style={styles.checkboxBold}>
                      no es obligatorio autorizar datos sensibles
                    </Text>{' '}
                    y que cuento con la alternativa de registro manual con el docente
                    (MANUAL_DOCENTE).
                  </Text>
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => {
                  void handleRegister();
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  submitting && styles.disabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Crear Cuenta e Ingresar</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => openLegalModal('privacidad')}
          style={styles.footerLegalLink}
        >
          <Text style={styles.footerLegalText}>
            Aviso de Privacidad (Ley 1581/2012), Términos de Uso y Derechos ARCO
          </Text>
        </Pressable>
      </ScrollView>

      <LegalPrivacyModal
        initialTab={legalTab}
        onClose={() => setLegalVisible(false)}
        visible={legalVisible}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  headerCard: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  logo: {
    width: Platform.OS === 'web' ? 240 : 210,
    height: Platform.OS === 'web' ? 160 : 140,
    borderRadius: 18,
  },
  brand: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandNavy: {
    color: '#07152F',
  },
  brandOrange: {
    color: '#F0440B',
  },
  institutionText: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 14,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#07152F',
  },
  tabText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    color: '#B42318',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  forgotLinkWrap: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
  },
  forgotLinkText: {
    color: '#F0440B',
    fontSize: 13,
    fontWeight: '700',
  },
  recoverTitle: {
    color: '#07152F',
    fontSize: 16,
    fontWeight: '800',
  },
  recoverSubtitle: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  form: {
    gap: 10,
  },
  label: {
    color: '#07152F',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0F172A',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rolePill: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  rolePillActive: {
    borderColor: '#F0440B',
    backgroundColor: '#FFF7ED',
  },
  rolePillText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  rolePillTextActive: {
    color: '#F0440B',
  },
  photoBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  photoHint: {
    color: '#64748B',
    fontSize: 12,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoPreview: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#F0440B',
  },
  photoMeta: {
    flex: 1,
    gap: 2,
  },
  photoReadyText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '700',
  },
  photoFileName: {
    color: '#64748B',
    fontSize: 12,
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navyOutlineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#07152F',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  navyOutlineText: {
    color: '#07152F',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#F0440B',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#07152F',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  consentSection: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#64748B',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: '#07152F',
    borderColor: '#07152F',
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  checkboxLabel: {
    flex: 1,
    color: '#334155',
    fontSize: 12,
    lineHeight: 18,
  },
  checkboxBold: {
    color: '#07152F',
    fontWeight: '700',
  },
  inlineLink: {
    color: '#F0440B',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  footerLegalLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerLegalText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
