import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type {
  AsignaturaGrupoItem,
  ConfirmarAsistenciaItem,
  EstadoAsistencia,
  EstudianteListaAsistencia,
  GeocercaItem,
  ListaAsistenciaResponse,
  SesionAbiertaItem,
} from '@/types/api.types';
import { apiRequest, downloadPdfReport } from '@/api/client';
import { buildProtectedAssetUrl } from '@/api/config';
import { useAuth } from '@/auth/auth-context';
import { LegalPrivacyModal } from '@/components/legal-privacy-modal';
import { speakSpanish } from '@/voice/tts-helper';

const ATTENDANCE_STATES: EstadoAsistencia[] = ['PRESENTE', 'TARDE', 'AUSENTE', 'EXCUSA'];

function getCurrentDateIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentTimeHm(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}:00`;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function getStateColors(estado: EstadoAsistencia): { bg: string; fg: string; border: string } {
  switch (estado) {
    case 'PRESENTE':
      return { bg: '#DCFCE7', fg: '#15803D', border: '#15803D' };
    case 'TARDE':
      return { bg: '#FEF3C7', fg: '#B45309', border: '#B45309' };
    case 'AUSENTE':
      return { bg: '#FEE2E2', fg: '#B42318', border: '#B42318' };
    case 'EXCUSA':
      return { bg: '#EDE9FE', fg: '#6D28D9', border: '#6D28D9' };
  }
}

function confirmFinishDialog(): Promise<boolean> {
  const title = 'Finalizar Sesión Académica';
  const message =
    '¿Deseas cerrar definitivamente esta sesión? Los estudiantes ya no podrán enviar evidencias de voz ni GPS.';

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    }
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Finalizar sesión', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function TeacherDashboard(): ReactElement {
  const router = useRouter();
  const { user, accessToken, signOut } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [busyAction, setBusyAction] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [grupos, setGrupos] = useState<AsignaturaGrupoItem[]>([]);
  const [geocercas, setGeocercas] = useState<GeocercaItem[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<number | null>(null);
  const [selectedGeocercaId, setSelectedGeocercaId] = useState<number | null>(null);

  const [activeSesion, setActiveSesion] = useState<SesionAbiertaItem | null>(null);
  const [listaAsistencia, setListaAsistencia] = useState<ListaAsistenciaResponse | null>(null);
  const [draftStates, setDraftStates] = useState<Record<number, EstadoAsistencia>>({});
  const [failedAvatars, setFailedAvatars] = useState<Record<number, boolean>>({});
  const [legalVisible, setLegalVisible] = useState<boolean>(false);

  const loadAttendanceList = useCallback(async (sesionId: number): Promise<void> => {
    const data = await apiRequest<ListaAsistenciaResponse>(`/sesiones/${sesionId}/lista-asistencia`);
    setListaAsistencia(data);

    const nextDrafts: Record<number, EstadoAsistencia> = {};
    data.estudiantes.forEach((est: EstudianteListaAsistencia) => {
      if (est.estado_asistencia) {
        nextDrafts[est.estudiante_id] = est.estado_asistencia;
      } else if (est.ubicacion_valida === 1 && est.voz_valida === 1) {
        nextDrafts[est.estudiante_id] = 'PRESENTE';
      } else {
        nextDrafts[est.estudiante_id] = 'AUSENTE';
      }
    });
    setDraftStates(nextDrafts);
  }, []);

  const loadInitialData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [asignaturasData, geocercasData, sesionesAbiertas] = await Promise.all([
        apiRequest<AsignaturaGrupoItem[] | { asignaturas: AsignaturaGrupoItem[] }>('/asignaturas'),
        apiRequest<GeocercaItem[] | { geocercas: GeocercaItem[] }>('/configuracion/geocercas'),
        apiRequest<SesionAbiertaItem[] | { sesiones: SesionAbiertaItem[] }>('/sesiones/abiertas'),
      ]);

      const rawAsignaturas = Array.isArray(asignaturasData)
        ? asignaturasData
        : Array.isArray(asignaturasData?.asignaturas)
          ? asignaturasData.asignaturas
          : [];
      const validGrupos = rawAsignaturas.filter((item) => item.grupo_id !== null);
      const validGeocercas = Array.isArray(geocercasData)
        ? geocercasData
        : Array.isArray(geocercasData?.geocercas)
          ? geocercasData.geocercas
          : [];
      const openList = Array.isArray(sesionesAbiertas)
        ? sesionesAbiertas
        : Array.isArray(sesionesAbiertas?.sesiones)
          ? sesionesAbiertas.sesiones
          : [];

      setGrupos(validGrupos);
      setGeocercas(validGeocercas);

      if (validGrupos[0]?.grupo_id && selectedGrupoId === null) {
        setSelectedGrupoId(validGrupos[0].grupo_id);
      }
      if (validGeocercas[0]?.geocerca_id && selectedGeocercaId === null) {
        setSelectedGeocercaId(validGeocercas[0].geocerca_id);
      }

      const currentOpen = openList[0] ?? null;
      setActiveSesion(currentOpen);

      if (currentOpen) {
        await loadAttendanceList(currentOpen.sesion_id);
      } else {
        setListaAsistencia(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible cargar el panel docente.');
    } finally {
      setLoading(false);
    }
  }, [loadAttendanceList, selectedGeocercaId, selectedGrupoId]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const handleStartSession = async (): Promise<void> => {
    if (!selectedGrupoId || !selectedGeocercaId) {
      setErrorMessage('Selecciona un grupo asignado y una sede UNINPAHU antes de iniciar la sesión.');
      return;
    }

    setBusyAction(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const created = await apiRequest<{ sesion_id: number }>('/sesiones', {
        method: 'POST',
        body: {
          grupo_id: selectedGrupoId,
          geocerca_id: selectedGeocercaId,
          fecha: getCurrentDateIso(),
          hora_inicio: getCurrentTimeHm(),
        },
      });
      setInfoMessage(`Sesión #${created.sesion_id} iniciada correctamente.`);
      await loadInitialData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible iniciar la sesión.');
    } finally {
      setBusyAction(false);
    }
  };

  const handlePauseOrResume = async (): Promise<void> => {
    if (!activeSesion) {
      return;
    }

    setBusyAction(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const action = activeSesion.estado === 'PAUSADA' ? 'reanudar' : 'pausar';
    try {
      await apiRequest<unknown>(`/sesiones/${activeSesion.sesion_id}/${action}`, {
        method: 'PATCH',
      });
      setInfoMessage(
        action === 'pausar' ? 'Sesión pausada temporalmente.' : 'Sesión reanudada correctamente.'
      );
      await loadInitialData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `No fue posible ${action} la sesión.`);
    } finally {
      setBusyAction(false);
    }
  };

  const handleFinishSession = async (): Promise<void> => {
    if (!activeSesion) {
      return;
    }
    const confirmed = await confirmFinishDialog();
    if (!confirmed) {
      return;
    }

    setBusyAction(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await apiRequest<unknown>(`/sesiones/${activeSesion.sesion_id}/finalizar`, {
        method: 'PATCH',
      });
      setInfoMessage('Sesión finalizada correctamente.');
      setActiveSesion(null);
      setListaAsistencia(null);
      await loadInitialData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible finalizar la sesión.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleSaveAttendance = async (): Promise<void> => {
    if (!activeSesion || !listaAsistencia) {
      return;
    }

    setBusyAction(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const registros: ConfirmarAsistenciaItem[] = listaAsistencia.estudiantes.map((est) => {
        const estado = draftStates[est.estudiante_id] ?? 'AUSENTE';
        const usedVoiceGps = est.evidencia_id !== null && est.ubicacion_valida === 1 && est.voz_valida === 1;
        return {
          estudiante_id: est.estudiante_id,
          evidencia_id: est.evidencia_id,
          estado,
          metodo_confirmacion: usedVoiceGps ? 'VOZ_GPS_FOTO' : 'MANUAL_DOCENTE',
          observacion: est.observacion,
        };
      });

      await apiRequest<unknown>(`/sesiones/${activeSesion.sesion_id}/asistencias`, {
        method: 'PUT',
        body: { registros },
        queueOnNetworkError: true,
      });

      setInfoMessage(`Lista de asistencia guardada (${registros.length} estudiante(s)).`);
      await loadAttendanceList(activeSesion.sesion_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible guardar la lista de asistencia.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDownloadPdf = async (): Promise<void> => {
    if (!activeSesion) {
      return;
    }
    setBusyAction(true);
    setErrorMessage(null);
    try {
      await downloadPdfReport(`sesion_id=${activeSesion.sesion_id}`);
      setInfoMessage('Reporte PDF generado y listo para compartir o imprimir.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible descargar el reporte PDF.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    router.replace('/login');
  };

  const summaryCounts = useMemo(() => {
    const estudiantes = listaAsistencia?.estudiantes ?? [];
    let presentes = 0;
    let tardes = 0;
    let ausentes = 0;
    let excusas = 0;
    estudiantes.forEach((est) => {
      const state = draftStates[est.estudiante_id] ?? 'AUSENTE';
      if (state === 'PRESENTE') presentes += 1;
      else if (state === 'TARDE') tardes += 1;
      else if (state === 'AUSENTE') ausentes += 1;
      else if (state === 'EXCUSA') excusas += 1;
    });
    return { total: estudiantes.length, presentes, tardes, ausentes, excusas };
  }, [draftStates, listaAsistencia]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Encabezado Docente */}
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.brandSmall}>
              <Text style={styles.brandWhite}>Inpa_</Text>
              <Text style={styles.brandOrange}>Go</Text>
              <Text style={styles.roleTag}> · Panel Docente</Text>
            </Text>
            <Text style={styles.userName}>{user?.nombre_completo ?? 'Docente UNINPAHU'}</Text>
            <Text style={styles.userMeta}>{user?.correo_institucional}</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void loadInitialData();
              }}
              style={styles.refreshBtn}
            >
              <Text style={styles.btnText}>Actualizar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void handleSignOut();
              }}
              style={styles.logoutBtn}
            >
              <Text style={styles.btnText}>Salir</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
      {infoMessage ? <Text style={styles.successBanner}>{infoMessage}</Text> : null}

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#F0440B" size="large" />
          <Text style={styles.emptyText}>Cargando grupos, sedes y sesión activa...</Text>
        </View>
      ) : null}

      {/* Ciclo de vida de sesión */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Control de Sesión Académica (RF07)</Text>
          {activeSesion ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: activeSesion.estado === 'PAUSADA' ? '#FEF3C7' : '#DCFCE7' },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: activeSesion.estado === 'PAUSADA' ? '#B45309' : '#15803D' },
                ]}
              >
                {activeSesion.estado}
              </Text>
            </View>
          ) : null}
        </View>

        {!activeSesion ? (
          <View style={styles.formGap}>
            <Text style={styles.label}>Grupo asignado</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {grupos.map((g) => {
                const gid = g.grupo_id as number;
                const active = selectedGrupoId === gid;
                return (
                  <Pressable
                    key={gid}
                    onPress={() => setSelectedGrupoId(gid)}
                    style={[styles.selectPill, active && styles.selectPillActive]}
                  >
                    <Text style={[styles.selectPillText, active && styles.selectPillTextActive]}>
                      {g.codigo} · {g.codigo_grupo} ({g.nombre})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Sede oficial UNINPAHU (Geocerca)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {geocercas.map((geo) => {
                const active = selectedGeocercaId === geo.geocerca_id;
                return (
                  <Pressable
                    key={geo.geocerca_id}
                    onPress={() => setSelectedGeocercaId(geo.geocerca_id)}
                    style={[styles.selectPill, active && styles.selectPillActive]}
                  >
                    <Text style={[styles.selectPillText, active && styles.selectPillTextActive]}>
                      {geo.sede} ({geo.radio_metros} m)
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              disabled={busyAction}
              onPress={() => {
                void handleStartSession();
              }}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              {busyAction ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Iniciar Sesión de Asistencia</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.formGap}>
            <Text style={styles.sessionSummary}>
              Sesión #{activeSesion.sesion_id} · {activeSesion.asignatura_codigo} {activeSesion.asignatura_nombre} (
              Grupo {activeSesion.codigo_grupo})
            </Text>
            <Text style={styles.itemMeta}>
              Fecha: {activeSesion.fecha} · Inicio: {activeSesion.hora_inicio} · Sede:{' '}
              {activeSesion.sede ?? 'UNINPAHU'}
            </Text>

            <View style={styles.actionsRow}>
              <Pressable
                accessibilityRole="button"
                disabled={busyAction}
                onPress={() => {
                  void handlePauseOrResume();
                }}
                style={[styles.amberButton, busyAction && styles.disabled]}
              >
                <Text style={styles.amberButtonText}>
                  {activeSesion.estado === 'PAUSADA' ? 'Reanudar Sesión' : 'Pausar Sesión'}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={busyAction}
                onPress={() => {
                  void handleFinishSession();
                }}
                style={[styles.dangerButton, busyAction && styles.disabled]}
              >
                <Text style={styles.btnText}>Finalizar Sesión</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={busyAction}
                onPress={() => {
                  void handleDownloadPdf();
                }}
                style={[styles.navyButton, busyAction && styles.disabled]}
              >
                <Text style={styles.btnText}>Descargar Reporte PDF</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Lista de Asistencia Foto + Voz + GPS */}
      {activeSesion && listaAsistencia ? (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Lista de Verificación ({summaryCounts.total} estudiante(s))
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void loadAttendanceList(activeSesion.sesion_id);
              }}
              style={styles.smallOutlineBtn}
            >
              <Text style={styles.smallOutlineText}>Refrescar evidencias</Text>
            </Pressable>
          </View>

          <Text style={styles.itemMeta}>
            Presentes: {summaryCounts.presentes} · Tarde: {summaryCounts.tardes} · Ausentes:{' '}
            {summaryCounts.ausentes} · Excusas: {summaryCounts.excusas}
          </Text>

          {listaAsistencia.estudiantes.length === 0 ? (
            <Text style={styles.emptyText}>No hay estudiantes matriculados en este grupo.</Text>
          ) : (
            listaAsistencia.estudiantes.map((est) => {
              const selectedState = draftStates[est.estudiante_id] ?? 'AUSENTE';
              const fotoUri = buildProtectedAssetUrl(est.foto_url);
              const showPhoto = Boolean(fotoUri && accessToken && !failedAvatars[est.estudiante_id]);

              const gpsColor =
                est.ubicacion_valida === 1
                  ? { bg: '#DCFCE7', fg: '#15803D' }
                  : est.ubicacion_valida === 0
                    ? { bg: '#FEE2E2', fg: '#B42318' }
                    : { bg: '#F1F5F9', fg: '#475569' };

              const voiceColor =
                est.voz_valida === 1
                  ? { bg: '#DCFCE7', fg: '#15803D' }
                  : est.voz_valida === 0
                    ? { bg: '#FEF3C7', fg: '#B45309' }
                    : { bg: '#F1F5F9', fg: '#475569' };

              return (
                <View key={est.estudiante_id} style={styles.studentCard}>
                  <View style={styles.studentTopRow}>
                    {showPhoto ? (
                      <Image
                        source={{
                          uri: fotoUri,
                          headers: { Authorization: `Bearer ${accessToken}` },
                        }}
                        onError={() =>
                          setFailedAvatars((prev) => ({ ...prev, [est.estudiante_id]: true }))
                        }
                        style={styles.studentAvatar}
                      />
                    ) : (
                      <View style={styles.studentAvatarFallback}>
                        <Text style={styles.studentAvatarInitials}>
                          {getInitials(est.nombre_completo)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.studentInfo}>
                      <Text style={styles.itemTitle}>{est.nombre_completo}</Text>
                      <Text style={styles.itemMeta}>
                        Doc: {est.documento}
                        {est.codigo_institucional ? ` · ${est.codigo_institucional}` : ''}
                      </Text>

                      <View style={styles.badgeRow}>
                        <View style={[styles.badge, { backgroundColor: gpsColor.bg }]}>
                          <Text style={[styles.badgeText, { color: gpsColor.fg }]}>
                            {est.distancia_metros !== null
                              ? `GPS: ${est.distancia_metros} m`
                              : 'GPS: Pendiente'}
                          </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: voiceColor.bg }]}>
                          <Text style={[styles.badgeText, { color: voiceColor.fg }]}>
                            {est.similitud_espectro !== null
                              ? `Voz: ${est.similitud_espectro}%`
                              : 'Voz: Pendiente'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        void speakSpanish(est.nombre_completo);
                      }}
                      style={styles.ttsBtn}
                    >
                      <Text style={styles.ttsBtnText}>Llamar</Text>
                    </Pressable>
                  </View>

                  <View style={styles.stateSelectorRow}>
                    {ATTENDANCE_STATES.map((state) => {
                      const active = selectedState === state;
                      const colors = getStateColors(state);
                      return (
                        <Pressable
                          key={state}
                          accessibilityRole="button"
                          onPress={() =>
                            setDraftStates((prev) => ({ ...prev, [est.estudiante_id]: state }))
                          }
                          style={[
                            styles.stateButton,
                            active && { backgroundColor: colors.bg, borderColor: colors.border },
                          ]}
                        >
                          <Text style={[styles.stateButtonText, active && { color: colors.fg }]}>
                            {state}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}

          {listaAsistencia.estudiantes.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              disabled={busyAction}
              onPress={() => {
                void handleSaveAttendance();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                busyAction && styles.disabled,
              ]}
            >
              {busyAction ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Guardar Lista de Asistencia</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => setLegalVisible(true)}
        style={styles.footerLegalLink}
      >
        <Text style={styles.footerLegalText}>Aviso de Privacidad, Términos y Contacto</Text>
      </Pressable>

      <LegalPrivacyModal onClose={() => setLegalVisible(false)} visible={legalVisible} />
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
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  headerCard: {
    backgroundColor: '#07152F',
    borderRadius: 16,
    padding: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerTitleBox: {
    flex: 1,
    minWidth: 200,
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
    gap: 8,
  },
  refreshBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnText: {
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
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 10,
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
  formGap: {
    gap: 10,
  },
  label: {
    color: '#07152F',
    fontSize: 13,
    fontWeight: '700',
  },
  pillRow: {
    gap: 8,
  },
  selectPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectPillActive: {
    backgroundColor: '#07152F',
    borderColor: '#07152F',
  },
  selectPillText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  selectPillTextActive: {
    color: '#FFFFFF',
  },
  sessionSummary: {
    color: '#07152F',
    fontSize: 14,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#F0440B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  amberButton: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#B45309',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  amberButtonText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
  },
  dangerButton: {
    backgroundColor: '#B42318',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  navyButton: {
    backgroundColor: '#07152F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  smallOutlineBtn: {
    borderWidth: 1,
    borderColor: '#07152F',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallOutlineText: {
    color: '#07152F',
    fontSize: 11,
    fontWeight: '700',
  },
  studentCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  studentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  studentAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#07152F',
  },
  studentAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#07152F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  studentInfo: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    color: '#07152F',
    fontSize: 14,
    fontWeight: '700',
  },
  itemMeta: {
    color: '#475569',
    fontSize: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  ttsBtn: {
    backgroundColor: '#07152F',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  ttsBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  stateSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stateButton: {
    flexGrow: 1,
    minWidth: 74,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  stateButtonText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
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
