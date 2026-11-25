import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { EstudianteGrupoItem } from '@/types/api.types';
import { apiRequest } from '@/api/client';

export interface GroupStudentsModalProps {
  visible: boolean;
  grupoId: number | null;
  grupoLabel: string;
  onClose: () => void;
  onMembershipChanged?: () => Promise<void> | void;
}

type RawStudentItem = EstudianteGrupoItem & {
  estudiante_id?: number;
};

function normalizeStudentItem(item: RawStudentItem): EstudianteGrupoItem {
  return {
    usuario_id: item.usuario_id ?? item.estudiante_id ?? 0,
    documento: item.documento,
    codigo_institucional: item.codigo_institucional ?? null,
    nombre_completo: item.nombre_completo,
    correo_institucional: item.correo_institucional,
    foto_url: item.foto_url,
  };
}

function unwrapStudentList(
  payload:
    | RawStudentItem[]
    | { estudiantes?: RawStudentItem[]; usuarios?: RawStudentItem[] }
    | null
    | undefined
): EstudianteGrupoItem[] {
  if (!payload) {
    return [];
  }
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.estudiantes)
      ? payload.estudiantes
      : Array.isArray(payload.usuarios)
        ? payload.usuarios
        : [];
  return raw.map(normalizeStudentItem).filter((s) => s.usuario_id > 0);
}

export function GroupStudentsModal({
  visible,
  grupoId,
  grupoLabel,
  onClose,
  onMembershipChanged,
}: GroupStudentsModalProps): ReactElement {
  const [loading, setLoading] = useState<boolean>(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [enrolled, setEnrolled] = useState<EstudianteGrupoItem[]>([]);
  const [allActiveStudents, setAllActiveStudents] = useState<EstudianteGrupoItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadGroupData = useCallback(async (): Promise<void> => {
    if (!grupoId) {
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    try {
      const [enrolledRes, activeRes] = await Promise.all([
        apiRequest<
          RawStudentItem[] | { estudiantes?: RawStudentItem[]; usuarios?: RawStudentItem[] }
        >(`/grupos/${grupoId}/estudiantes`),
        apiRequest<
          RawStudentItem[] | { usuarios?: RawStudentItem[]; estudiantes?: RawStudentItem[] }
        >('/usuarios?rol_codigo=ESTUDIANTE&activo=1'),
      ]);

      setEnrolled(unwrapStudentList(enrolledRes));
      setAllActiveStudents(unwrapStudentList(activeRes));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No fue posible cargar los estudiantes del grupo.'
      );
    } finally {
      setLoading(false);
    }
  }, [grupoId]);

  useEffect(() => {
    if (visible && grupoId) {
      setSearchQuery('');
      setInfoMessage(null);
      setErrorMessage(null);
      void loadGroupData();
    }
  }, [grupoId, loadGroupData, visible]);

  const enrolledIdSet = useMemo(
    () => new Set<number>(enrolled.map((s) => s.usuario_id)),
    [enrolled]
  );

  const availableStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allActiveStudents.filter((est) => {
      if (enrolledIdSet.has(est.usuario_id)) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        est.nombre_completo.toLowerCase().includes(query) ||
        est.documento.toLowerCase().includes(query) ||
        (est.codigo_institucional ?? '').toLowerCase().includes(query) ||
        est.correo_institucional.toLowerCase().includes(query)
      );
    });
  }, [allActiveStudents, enrolledIdSet, searchQuery]);

  const handleIncludeStudent = async (est: EstudianteGrupoItem): Promise<void> => {
    if (!grupoId) {
      return;
    }
    setBusyId(est.usuario_id);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await apiRequest<unknown>(`/grupos/${grupoId}/estudiantes`, {
        method: 'POST',
        body: { estudiante_id: est.usuario_id },
      });
      setInfoMessage(`${est.nombre_completo} fue incluido en el grupo.`);
      await loadGroupData();
      if (onMembershipChanged) {
        await onMembershipChanged();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No fue posible incluir el estudiante en el grupo.'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveStudent = async (est: EstudianteGrupoItem): Promise<void> => {
    if (!grupoId) {
      return;
    }
    setBusyId(est.usuario_id);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await apiRequest<unknown>(`/grupos/${grupoId}/estudiantes/${est.usuario_id}`, {
        method: 'DELETE',
      });
      setInfoMessage(`${est.nombre_completo} fue retirado del grupo.`);
      await loadGroupData();
      if (onMembershipChanged) {
        await onMembershipChanged();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No fue posible retirar el estudiante del grupo.'
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>Gestionar Estudiantes del Grupo</Text>
              <Text style={styles.headerSubtitle} numberOfLines={2}>
                {grupoLabel}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
            {infoMessage ? <Text style={styles.successBanner}>{infoMessage}</Text> : null}

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#F0440B" />
                <Text style={styles.mutedText}>Cargando nómina del grupo...</Text>
              </View>
            ) : null}

            {/* Matriculados actualmente */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Estudiantes Matriculados ({enrolled.length})
              </Text>
              {enrolled.length === 0 ? (
                <Text style={styles.mutedText}>
                  Aún no hay estudiantes matriculados en este grupo.
                </Text>
              ) : (
                enrolled.map((est) => {
                  const isBusy = busyId === est.usuario_id;
                  return (
                    <View key={est.usuario_id} style={styles.rowCard}>
                      <View style={styles.rowInfo}>
                        <Text style={styles.itemTitle}>{est.nombre_completo}</Text>
                        <Text style={styles.itemMeta}>
                          Doc: {est.documento}
                          {est.codigo_institucional ? ` · ${est.codigo_institucional}` : ''}
                        </Text>
                        <Text style={styles.itemMeta}>{est.correo_institucional}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => void handleRemoveStudent(est)}
                        style={[styles.removeBtn, isBusy && styles.disabled]}
                      >
                        <Text style={styles.removeBtnText}>
                          {isBusy ? '...' : 'Retirar'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>

            {/* Buscador para incluir estudiantes activos */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Incluir Estudiantes Activos ({availableStudents.length})
              </Text>
              <TextInput
                onChangeText={setSearchQuery}
                placeholder="Buscar por nombre, documento o código institucional..."
                placeholderTextColor="#94A3B8"
                style={styles.input}
                value={searchQuery}
              />

              {availableStudents.length === 0 ? (
                <Text style={styles.mutedText}>
                  {searchQuery.trim()
                    ? 'No se encontraron estudiantes activos con ese criterio.'
                    : 'Todos los estudiantes activos ya están incluidos en este grupo.'}
                </Text>
              ) : (
                availableStudents.slice(0, 25).map((est) => {
                  const isBusy = busyId === est.usuario_id;
                  return (
                    <View key={est.usuario_id} style={styles.rowCard}>
                      <View style={styles.rowInfo}>
                        <Text style={styles.itemTitle}>{est.nombre_completo}</Text>
                        <Text style={styles.itemMeta}>
                          Doc: {est.documento}
                          {est.codigo_institucional ? ` · ${est.codigo_institucional}` : ''}
                        </Text>
                        <Text style={styles.itemMeta}>{est.correo_institucional}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy}
                        onPress={() => void handleIncludeStudent(est)}
                        style={[styles.includeBtn, isBusy && styles.disabled]}
                      >
                        <Text style={styles.includeBtnText}>
                          {isBusy ? '...' : 'Incluir en el Grupo'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 21, 47, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: '88%',
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    backgroundColor: '#07152F',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  closeBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    padding: 16,
    gap: 14,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    color: '#B42318',
    padding: 10,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
    padding: 10,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: '#07152F',
    fontSize: 14,
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  rowCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    color: '#07152F',
    fontSize: 13,
    fontWeight: '700',
  },
  itemMeta: {
    color: '#475569',
    fontSize: 11,
  },
  mutedText: {
    color: '#64748B',
    fontSize: 12,
  },
  includeBtn: {
    backgroundColor: '#F0440B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  includeBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  removeBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#B42318',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  removeBtnText: {
    color: '#B42318',
    fontSize: 11,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
});
