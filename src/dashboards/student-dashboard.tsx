import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type {
  EstadoAsistencia,
  EvidenciaVozGpsResponse,
  HistorialAsistenciaItem,
  PerfilVozResponse,
  SesionAbiertaItem,
} from '@/types/api.types';
import { apiRequest, appendFileToFormData } from '@/api/client';
import { getUsuarioFotoUrl } from '@/api/config';
import { useAuth } from '@/auth/auth-context';
import { captureValidatedLocation, type ValidatedLocation } from '@/location/validate-location';
import {
  VoiceRecorderPanel,
  type RecordedAudioClip,
} from '@/voice/voice-recorder-panel';
import {
  buildArcoMailtoUrl,
  LegalPrivacyModal,
  type LegalTab,
} from '@/components/legal-privacy-modal';

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getAttendanceBadgeColors(estado: EstadoAsistencia): { bg: string; fg: string } {
  switch (estado) {
    case 'PRESENTE':
      return { bg: '#DCFCE7', fg: '#15803D' };
    case 'TARDE':
      return { bg: '#FEF3C7', fg: '#B45309' };
    case 'AUSENTE':
      return { bg: '#FEE2E2', fg: '#B42318' };
    case 'EXCUSA':
      return { bg: '#EDE9FE', fg: '#6D28D9' };
  }
}

export function StudentDashboard(): ReactElement {
  const router = useRouter();
  const {
    user,
    accessToken,
    biometricsAvailable,
    biometricsEnabled,
    enableBiometrics,
    updateLocalUser,
    signOut,
  } = useAuth();

  const [avatarFailed, setAvatarFailed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [sesionesAbiertas, setSesionesAbiertas] = useState<SesionAbiertaItem[]>([]);
  const [historial, setHistorial] = useState<HistorialAsistenciaItem[]>([]);
  const [selectedAsignaturaId, setSelectedAsignaturaId] = useState<number | null>(null);

  // Enrolamiento de voz
  const [enrollingVoice, setEnrollingVoice] = useState<boolean>(false);
  const [voiceProfileResult, setVoiceProfileResult] = useState<PerfilVozResponse | null>(null);

  // Confirmación Voz + GPS por sesión
  const [activeConfirmSesion, setActiveConfirmSesion] = useState<SesionAbiertaItem | null>(null);
  const [capturedGps, setCapturedGps] = useState<ValidatedLocation | null>(null);
  const [capturingGps, setCapturingGps] = useState<boolean>(false);
  const [transcripcionVoz, setTranscripcionVoz] = useState<string>('');
  const [submittingEvidence, setSubmittingEvidence] = useState<boolean>(false);
  const [lastEvidence, setLastEvidence] = useState<EvidenciaVozGpsResponse | null>(null);
  const [legalVisible, setLegalVisible] = useState<boolean>(false);
  const [legalTab, setLegalTab] = useState<LegalTab>('privacidad');

  const openLegalModal = (tab: LegalTab): void => {
    setLegalTab(tab);
    setLegalVisible(true);
  };

  const loadDashboardData = useCallback(async (isRefresh = false): Promise<void> => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      const [abiertasData, historialData] = await Promise.all([
        apiRequest<SesionAbiertaItem[] | { sesiones: SesionAbiertaItem[] }>('/sesiones/abiertas'),
        apiRequest<HistorialAsistenciaItem[] | { historial: HistorialAsistenciaItem[] }>(
          '/asistencias/historial'
        ),
      ]);
      const openList = Array.isArray(abiertasData)
        ? abiertasData
        : Array.isArray(abiertasData?.sesiones)
          ? abiertasData.sesiones
          : [];
      const historyList = Array.isArray(historialData)
        ? historialData
        : Array.isArray(historialData?.historial)
          ? historialData.historial
          : [];
      setSesionesAbiertas(openList);
      setHistorial(historyList);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No fue posible cargar la información del estudiante.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const handleEnableBiometrics = async (): Promise<void> => {
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const ok = await enableBiometrics();
      if (ok) {
        setInfoMessage('Acceso biométrico activado correctamente en este dispositivo.');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo activar la biometría.');
    }
  };

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    router.replace('/login');
  };

  const handleEnrollVoice = async (clip: RecordedAudioClip): Promise<void> => {
    setEnrollingVoice(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const formData = new FormData();
      await appendFileToFormData(formData, 'audio_voz', {
        uri: clip.uri,
        name: clip.fileName,
        type: clip.mimeType,
        blob: clip.blob,
      });
      const result = await apiRequest<PerfilVozResponse>('/usuarios/me/perfil-voz', {
        method: 'POST',
        body: formData,
      });
      setVoiceProfileResult(result);
      await updateLocalUser({ tiene_perfil_voz: true });
      setInfoMessage('Muestra base de voz registrada correctamente.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al registrar el perfil de voz.';
      setErrorMessage(msg);
      throw error;
    } finally {
      setEnrollingVoice(false);
    }
  };

  const handleStartAttendanceConfirmation = async (sesion: SesionAbiertaItem): Promise<void> => {
    setErrorMessage(null);
    setInfoMessage(null);
    setLastEvidence(null);
    setCapturingGps(true);

    try {
      const coords = await captureValidatedLocation();
      setCapturedGps(coords);
      setActiveConfirmSesion(sesion);
      setTranscripcionVoz(`Presente, ${user?.nombre_completo ?? ''}`.trim());
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No fue posible obtener tu ubicación GPS.';
      setErrorMessage(msg);
      if (Platform.OS !== 'web') {
        Alert.alert('Ubicación requerida', msg);
      }
    } finally {
      setCapturingGps(false);
    }
  };

  const handleSubmitVoiceGpsEvidence = async (clip: RecordedAudioClip): Promise<void> => {
    if (!activeConfirmSesion || !capturedGps) {
      throw new Error('Primero captura tu ubicación GPS para confirmar asistencia.');
    }

    setSubmittingEvidence(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const formData = new FormData();
      formData.append('latitud_reportada', String(capturedGps.latitude));
      formData.append('longitud_reportada', String(capturedGps.longitude));
      formData.append('precision_metros', String(Math.round(capturedGps.accuracy)));
      formData.append('transcripcion_voz', transcripcionVoz.trim() || `Presente, ${user?.nombre_completo ?? ''}`);
      await appendFileToFormData(formData, 'audio_voz', {
        uri: clip.uri,
        name: clip.fileName,
        type: clip.mimeType,
        blob: clip.blob,
      });

      const response = await apiRequest<EvidenciaVozGpsResponse>(
        `/sesiones/${activeConfirmSesion.sesion_id}/evidencia-estudiante`,
        {
          method: 'POST',
          body: formData,
        }
      );

      setLastEvidence(response);
      if (response.enrolamiento_inicial) {
        await updateLocalUser({ tiene_perfil_voz: true });
      }
      setActiveConfirmSesion(null);
      setCapturedGps(null);
      setInfoMessage('Evidencia de voz y GPS enviada correctamente al servidor institucional.');
      await loadDashboardData(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No fue posible enviar la evidencia de asistencia.';
      setErrorMessage(msg);
      throw error;
    } finally {
      setSubmittingEvidence(false);
    }
  };

  const asignaturasFiltro = useMemo(() => {
    const map = new Map<number, string>();
    historial.forEach((item) => {
      if (!map.has(item.asignatura_id)) {
        map.set(item.asignatura_id, `${item.asignatura_codigo} · ${item.asignatura_nombre}`);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [historial]);

  const filteredHistorial = useMemo(() => {
    if (selectedAsignaturaId === null) {
      return historial;
    }
    return historial.filter((item) => item.asignatura_id === selectedAsignaturaId);
  }, [historial, selectedAsignaturaId]);

  const kpis = useMemo(() => {
    const total = filteredHistorial.length;
    let presentes = 0;
    let tardanzas = 0;
    let ausencias = 0;
    let excusas = 0;

    filteredHistorial.forEach((item) => {
      if (item.estado === 'PRESENTE') presentes += 1;
      else if (item.estado === 'TARDE') tardanzas += 1;
      else if (item.estado === 'AUSENTE') ausencias += 1;
      else if (item.estado === 'EXCUSA') excusas += 1;
    });

    const efectivos = presentes + tardanzas + excusas;
    const porcentaje = total > 0 ? Math.round((efectivos / total) * 100) : 100;

    return { total, presentes, tardanzas, ausencias, excusas, porcentaje };
  }, [filteredHistorial]);

  if (!user) {
    return <View style={styles.screen} />;
  }

  const avatarUri = getUsuarioFotoUrl(user.usuario_id);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Encabezado y Perfil */}
      <View style={styles.headerCard}>
        <View style={styles.profileRow}>
          {!avatarFailed && accessToken ? (
            <Image
              source={{
                uri: avatarUri,
                headers: { Authorization: `Bearer ${accessToken}` },
              }}
              onError={() => setAvatarFailed(true)}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{getInitials(user.nombre_completo)}</Text>
            </View>
          )}

          <View style={styles.profileInfo}>
            <Text style={styles.brandSmall}>
              <Text style={styles.brandWhite}>Inpa_</Text>
              <Text style={styles.brandOrange}>Go</Text>
              <Text style={styles.roleTag}> · Estudiante</Text>
            </Text>
            <Text style={styles.userName}>{user.nombre_completo}</Text>
            <Text style={styles.userMeta}>
              {user.codigo_institucional ? `Código: ${user.codigo_institucional} · ` : ''}
              Doc: {user.documento}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {Platform.OS !== 'web' && biometricsAvailable && !biometricsEnabled ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void handleEnableBiometrics();
              }}
              style={styles.biometricBtn}
            >
              <Text style={styles.biometricBtnText}>Activar Huella</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void loadDashboardData(true);
            }}
            style={styles.refreshBtn}
          >
            <Text style={styles.refreshBtnText}>{refreshing ? 'Actualizando...' : 'Actualizar'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void handleSignOut();
            }}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutBtnText}>Salir</Text>
          </Pressable>
        </View>
      </View>

      {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
      {infoMessage ? <Text style={styles.successBanner}>{infoMessage}</Text> : null}

      {/* Tarjeta de Enrolamiento de Voz */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Perfil Base de Voz (RF08)</Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: user.tiene_perfil_voz ? '#DCFCE7' : '#FEF3C7' },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: user.tiene_perfil_voz ? '#15803D' : '#B45309' },
              ]}
            >
              {user.tiene_perfil_voz ? 'Registrado' : 'Pendiente'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionSubtitle}>
          {user.tiene_perfil_voz
            ? 'Tu muestra base de voz ya está registrada. Puedes actualizarla si lo necesitas.'
            : 'Graba 3 a 4 segundos diciendo tu nombre completo para habilitar la verificación vocal en clase.'}
        </Text>

        <VoiceRecorderPanel
          isSubmitting={enrollingVoice}
          maxDurationSeconds={4}
          onClipReady={handleEnrollVoice}
          promptHint={`Di con claridad: "Soy ${user.nombre_completo}, estudiante de UNINPAHU".`}
          submitLabel="Guardar Perfil de Voz"
          title="Grabación de Muestra Base"
        />

        {voiceProfileResult ? (
          <View style={styles.evidenceBox}>
            <Text style={styles.evidenceTitle}>Perfil vocal procesado</Text>
            <Text style={styles.evidenceText}>
              Método: {voiceProfileResult.metodo_analisis} · Frames activos: {voiceProfileResult.frames_activos}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Retroalimentación de última evidencia Voz + GPS */}
      {lastEvidence ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Resultado de Validación Voz + GPS</Text>
          <View style={styles.metricsRow}>
            <View
              style={[
                styles.metricPill,
                { backgroundColor: lastEvidence.ubicacion_valida ? '#DCFCE7' : '#FEE2E2' },
              ]}
            >
              <Text
                style={[
                  styles.metricPillText,
                  { color: lastEvidence.ubicacion_valida ? '#15803D' : '#B42318' },
                ]}
              >
                GPS: {Math.round(lastEvidence.distancia_metros)} m / {lastEvidence.radio_autorizado_metros} m (
                {lastEvidence.ubicacion_valida ? 'Dentro de geocerca' : 'Fuera de geocerca'})
              </Text>
            </View>
            <View
              style={[
                styles.metricPill,
                { backgroundColor: lastEvidence.voz_valida ? '#DCFCE7' : '#FEF3C7' },
              ]}
            >
              <Text
                style={[
                  styles.metricPillText,
                  { color: lastEvidence.voz_valida ? '#15803D' : '#B45309' },
                ]}
              >
                Voz: {Math.round(lastEvidence.similitud_espectro)}% (
                {lastEvidence.voz_valida ? 'Voz válida' : 'Revisión docente'})
              </Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>Método espectral: {lastEvidence.metodo_analisis}</Text>
        </View>
      ) : null}

      {/* Clases / Sesiones Abiertas */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Sesiones Abiertas (RF08 / RF09)</Text>
        {loading ? (
          <ActivityIndicator color="#F0440B" />
        ) : sesionesAbiertas.length === 0 ? (
          <Text style={styles.emptyText}>No tienes sesiones abiertas en este momento.</Text>
        ) : (
          sesionesAbiertas.map((sesion) => {
            const isPaused = sesion.estado === 'PAUSADA';
            const isConfirmingThis = activeConfirmSesion?.sesion_id === sesion.sesion_id;

            return (
              <View key={sesion.sesion_id} style={styles.itemCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.itemTitle}>
                    {sesion.asignatura_codigo} · {sesion.asignatura_nombre}
                  </Text>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: isPaused ? '#FEF3C7' : '#DCFCE7' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: isPaused ? '#B45309' : '#15803D' },
                      ]}
                    >
                      {sesion.estado}
                    </Text>
                  </View>
                </View>

                <Text style={styles.itemMeta}>
                  Grupo {sesion.codigo_grupo} · {sesion.fecha} ({sesion.hora_inicio})
                </Text>
                <Text style={styles.itemMeta}>
                  Docente: {sesion.docente_nombre ?? 'Asignado'} · Sede: {sesion.sede ?? 'UNINPAHU'} (Radio{' '}
                  {sesion.radio_metros ?? 100} m)
                </Text>

                {sesion.evidencia_id ? (
                  <View style={styles.metricsRow}>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: sesion.ubicacion_valida === 1 ? '#DCFCE7' : '#FEE2E2' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: sesion.ubicacion_valida === 1 ? '#15803D' : '#B42318' },
                        ]}
                      >
                        GPS: {sesion.ubicacion_valida === 1 ? 'Válido' : 'Fuera de rango'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: sesion.voz_valida === 1 ? '#DCFCE7' : '#FEF3C7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: sesion.voz_valida === 1 ? '#15803D' : '#B45309' },
                        ]}
                      >
                        Voz: {sesion.voz_valida === 1 ? 'Validada' : 'En revisión'}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {isPaused ? (
                  <Text style={styles.pausedNotice}>
                    Esta sesión está pausada temporalmente por el docente. Espera a que sea reanudada.
                  </Text>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    disabled={capturingGps}
                    onPress={() => {
                      void handleStartAttendanceConfirmation(sesion);
                    }}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                  >
                    {capturingGps ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Confirmar Asistencia (Voz + GPS)</Text>
                    )}
                  </Pressable>
                )}

                {isConfirmingThis && capturedGps ? (
                  <View style={styles.confirmBox}>
                    <Text style={styles.gpsConfirmedText}>
                      GPS capturado: {capturedGps.latitude.toFixed(6)}, {capturedGps.longitude.toFixed(6)} (precisión{' '}
                      {Math.round(capturedGps.accuracy)} m)
                    </Text>
                    <Text style={styles.label}>Frase verbal de confirmación</Text>
                    <TextInput
                      onChangeText={setTranscripcionVoz}
                      placeholder="Ej. Presente, Nombre Completo"
                      placeholderTextColor="#94A3B8"
                      style={styles.input}
                      value={transcripcionVoz}
                    />
                    <VoiceRecorderPanel
                      isSubmitting={submittingEvidence}
                      maxDurationSeconds={5}
                      onClipReady={handleSubmitVoiceGpsEvidence}
                      promptHint="Graba 3 a 5 segundos diciendo 'Presente' seguido de tu nombre completo."
                      submitLabel="Enviar Evidencia Voz + GPS"
                      title="Confirmación Verbal en Clase"
                    />
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      {/* KPIs e Historial */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>KPIs e Historial de Asistencia (RF11)</Text>

        {asignaturasFiltro.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Pressable
              onPress={() => setSelectedAsignaturaId(null)}
              style={[styles.filterPill, selectedAsignaturaId === null && styles.filterPillActive]}
            >
              <Text
                style={[styles.filterPillText, selectedAsignaturaId === null && styles.filterPillTextActive]}
              >
                Todas
              </Text>
            </Pressable>
            {asignaturasFiltro.map((asig) => (
              <Pressable
                key={asig.id}
                onPress={() => setSelectedAsignaturaId(asig.id)}
                style={[styles.filterPill, selectedAsignaturaId === asig.id && styles.filterPillActive]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    selectedAsignaturaId === asig.id && styles.filterPillTextActive,
                  ]}
                >
                  {asig.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{kpis.porcentaje}%</Text>
            <Text style={styles.kpiLabel}>Asistencia Global</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#15803D' }]}>{kpis.presentes}</Text>
            <Text style={styles.kpiLabel}>Presentes</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#B45309' }]}>{kpis.tardanzas}</Text>
            <Text style={styles.kpiLabel}>Tardanzas</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#B42318' }]}>{kpis.ausencias}</Text>
            <Text style={styles.kpiLabel}>Ausencias</Text>
          </View>
        </View>

        {kpis.total > 0 && kpis.porcentaje < 80 ? (
          <View style={styles.alertRiskBox}>
            <Text style={styles.alertRiskText}>
              Alerta académica: tu porcentaje de asistencia ({kpis.porcentaje}%) está por debajo del 80% institucional.
            </Text>
          </View>
        ) : null}

        {filteredHistorial.length === 0 ? (
          <Text style={styles.emptyText}>Aún no tienes registros de asistencia confirmados.</Text>
        ) : (
          filteredHistorial.map((item) => {
            const colors = getAttendanceBadgeColors(item.estado);
            return (
              <View key={item.asistencia_id} style={styles.historyRow}>
                <View style={styles.historyInfo}>
                  <Text style={styles.itemTitle}>
                    {item.asignatura_codigo} · {item.asignatura_nombre}
                  </Text>
                  <Text style={styles.itemMeta}>
                    Grupo {item.codigo_grupo} · {item.fecha} ({item.hora_inicio})
                  </Text>
                  {item.observacion ? <Text style={styles.itemObs}>Obs: {item.observacion}</Text> : null}
                </View>
                <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.badgeText, { color: colors.fg }]}>{item.estado}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
      {/* Privacidad y Derechos ARCO */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Privacidad y Derechos ARCO (Ley 1581 de 2012)</Text>
        <Text style={styles.sectionSubtitle}>
          El tratamiento de tus datos biométricos (foto y voz) es facultativo y puedes ejercer tus
          derechos ARCO o pasar al registro manual docente (MANUAL_DOCENTE) en cualquier momento.
        </Text>

        <View style={styles.arcoActionsRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => openLegalModal('privacidad')}
            style={({ pressed }) => [styles.arcoOutlineBtn, pressed && styles.pressed]}
          >
            <Text style={styles.arcoOutlineBtnText}>Ver Política Completa</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void Linking.openURL(
                buildArcoMailtoUrl(
                  'Revocatoria de Autorización Biométrica — Inpa_Go',
                  `Cordial saludo,\n\nSolicito revocar mi autorización para el tratamiento de datos biométricos sensibles (fotografía facial y patrón espectral de voz) en Inpa_Go y pasar al método de registro manual docente (MANUAL_DOCENTE).\n\nNombre completo: ${user.nombre_completo}\nDocumento: ${user.documento}\nCorreo institucional: ${user.correo_institucional}`
                )
              );
            }}
            style={({ pressed }) => [styles.arcoWarningBtn, pressed && styles.pressed]}
          >
            <Text style={styles.arcoWarningBtnText}>Revocar Autorización Biométrica</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void Linking.openURL(
                buildArcoMailtoUrl(
                  'Solicitud de Eliminación de Cuenta y Datos Personales — Inpa_Go',
                  `Cordial saludo,\n\nEn ejercicio de mis derechos ARCO (Ley 1581 de 2012), solicito la cancelación/eliminación de mi cuenta y datos personales registrados en Inpa_Go.\n\nNombre completo: ${user.nombre_completo}\nDocumento: ${user.documento}\nCorreo institucional: ${user.correo_institucional}`
                )
              );
            }}
            style={({ pressed }) => [styles.arcoDangerBtn, pressed && styles.pressed]}
          >
            <Text style={styles.arcoDangerBtnText}>Solicitar Eliminación de Cuenta</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => openLegalModal('privacidad')}
        style={styles.footerLegalLink}
      >
        <Text style={styles.footerLegalText}>Aviso de Privacidad, Términos y Contacto</Text>
      </Pressable>

      <LegalPrivacyModal
        initialTab={legalTab}
        onClose={() => setLegalVisible(false)}
        visible={legalVisible}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    padding: 16,
    gap: 14,
    maxWidth: 920,
    width: '100%',
    alignSelf: 'center',
  },
  headerCard: {
    backgroundColor: '#07152F',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#F0440B',
  },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#F0440B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  brandSmall: {
    fontSize: 14,
    fontWeight: '800',
  },
  brandWhite: {
    color: '#FFFFFF',
  },
  brandOrange: {
    color: '#F0440B',
  },
  roleTag: {
    color: '#CBD5E1',
    fontWeight: '600',
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  userMeta: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  biometricBtn: {
    backgroundColor: '#F0440B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  biometricBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  refreshBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  refreshBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    color: '#B42318',
    padding: 12,
    borderRadius: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
    padding: 12,
    borderRadius: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#07152F',
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  sectionSubtitle: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  evidenceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 2,
  },
  evidenceTitle: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 13,
  },
  evidenceText: {
    color: '#334155',
    fontSize: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  metricPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  itemTitle: {
    color: '#07152F',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  itemMeta: {
    color: '#475569',
    fontSize: 12,
  },
  itemObs: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
  },
  pausedNotice: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
    padding: 10,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#F0440B',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  confirmBox: {
    gap: 8,
    marginTop: 4,
  },
  gpsConfirmedText: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
    padding: 8,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    color: '#07152F',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  filterRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  filterPillActive: {
    backgroundColor: '#07152F',
  },
  filterPillText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flexGrow: 1,
    minWidth: 110,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  kpiValue: {
    color: '#07152F',
    fontSize: 22,
    fontWeight: '800',
  },
  kpiLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  alertRiskBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
  },
  alertRiskText: {
    color: '#B42318',
    fontSize: 12,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  historyInfo: {
    flex: 1,
    gap: 2,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  arcoActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  arcoOutlineBtn: {
    borderWidth: 1,
    borderColor: '#07152F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },
  arcoOutlineBtnText: {
    color: '#07152F',
    fontSize: 12,
    fontWeight: '700',
  },
  arcoWarningBtn: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#B45309',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  arcoWarningBtnText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
  },
  arcoDangerBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#B42318',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  arcoDangerBtnText: {
    color: '#B42318',
    fontSize: 12,
    fontWeight: '700',
  },
  footerLegalLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  footerLegalText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
