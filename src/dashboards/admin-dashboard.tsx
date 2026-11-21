import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import type {
  AsignaturaGrupoItem,
  GeocercaItem,
  ImportacionExcelResponse,
  RolCodigo,
  UsuarioAuth,
} from '@/types/api.types';
import { apiRequest, appendFileToFormData } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { LegalPrivacyModal } from '@/components/legal-privacy-modal';

type AdminTab = 'usuarios' | 'asignaturas' | 'excel' | 'geocercas';

interface AdminUsuarioItem extends UsuarioAuth {
  activo?: 0 | 1 | boolean;
}

const MAX_EXCEL_BYTES = 4 * 1024 * 1024;

function buildSuggestedUninpahuEmail(fullName: string): string {
  const normalized = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .trim();
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  const localPart = parts.length >= 2 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0];
  return `${localPart}@uninpahu.edu.co`;
}

function isRecordActive(value: 0 | 1 | boolean | undefined): boolean {
  if (value === undefined) {
    return true;
  }
  return value === 1 || value === true;
}

export function AdminDashboard(): ReactElement {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('usuarios');
  const [loading, setLoading] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Usuarios y Docentes (RF03)
  const [usuarios, setUsuarios] = useState<AdminUsuarioItem[]>([]);
  const [filterRol, setFilterRol] = useState<RolCodigo | ''>('');
  const [filterActivo, setFilterActivo] = useState<'' | '1' | '0'>('');
  const [docDocumento, setDocDocumento] = useState<string>('');
  const [docCodigo, setDocCodigo] = useState<string>('');
  const [docNombre, setDocNombre] = useState<string>('');
  const [docCorreo, setDocCorreo] = useState<string>('');
  const [docPassword, setDocPassword] = useState<string>('');

  // Asignaturas y Grupos (RF05, RF06)
  const [asignaturas, setAsignaturas] = useState<AsignaturaGrupoItem[]>([]);
  const [asigCodigo, setAsigCodigo] = useState<string>('');
  const [asigNombre, setAsigNombre] = useState<string>('');
  const [asigCreditos, setAsigCreditos] = useState<string>('3');

  const [grupoAsignaturaId, setGrupoAsignaturaId] = useState<number | null>(null);
  const [grupoDocenteId, setGrupoDocenteId] = useState<number | null>(null);
  const [grupoCodigo, setGrupoCodigo] = useState<string>('');
  const [grupoPeriodo, setGrupoPeriodo] = useState<string>('2026-2');

  // Importación Excel (RF04, RF06)
  const [excelResult, setExcelResult] = useState<ImportacionExcelResponse | null>(null);

  // Geocercas (RF09)
  const [geocercas, setGeocercas] = useState<GeocercaItem[]>([]);
  const [geoSede, setGeoSede] = useState<string>('');
  const [geoLatitud, setGeoLatitud] = useState<string>('');
  const [geoLongitud, setGeoLongitud] = useState<string>('');
  const [geoRadio, setGeoRadio] = useState<string>('100');
  const [legalVisible, setLegalVisible] = useState<boolean>(false);

  const loadUsuarios = useCallback(async (): Promise<void> => {
    const params = new URLSearchParams();
    if (filterRol) params.append('rol_codigo', filterRol);
    if (filterActivo) params.append('activo', filterActivo);
    const query = params.toString();
    const data = await apiRequest<AdminUsuarioItem[] | { usuarios: AdminUsuarioItem[] }>(
      `/usuarios${query ? `?${query}` : ''}`
    );
    const list = Array.isArray(data) ? data : Array.isArray(data?.usuarios) ? data.usuarios : [];
    setUsuarios(list);
  }, [filterActivo, filterRol]);

  const loadAsignaturas = useCallback(async (): Promise<void> => {
    const data = await apiRequest<AsignaturaGrupoItem[] | { asignaturas: AsignaturaGrupoItem[] }>(
      '/asignaturas'
    );
    const list = Array.isArray(data) ? data : Array.isArray(data?.asignaturas) ? data.asignaturas : [];
    setAsignaturas(list);
    if (list[0] && grupoAsignaturaId === null) {
      setGrupoAsignaturaId(list[0].asignatura_id);
    }
  }, [grupoAsignaturaId]);

  const loadGeocercas = useCallback(async (): Promise<void> => {
    const data = await apiRequest<GeocercaItem[] | { geocercas: GeocercaItem[] }>(
      '/configuracion/geocercas'
    );
    const list = Array.isArray(data) ? data : Array.isArray(data?.geocercas) ? data.geocercas : [];
    setGeocercas(list);
    if (list[0] && !geoSede) {
      setGeoSede(list[0].sede);
      setGeoLatitud(String(list[0].latitud));
      setGeoLongitud(String(list[0].longitud));
      setGeoRadio(String(list[0].radio_metros));
    }
  }, [geoSede]);

  const loadAll = useCallback(async (): Promise<void> => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await Promise.all([loadUsuarios(), loadAsignaturas(), loadGeocercas()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error al cargar datos de administración.');
    } finally {
      setLoading(false);
    }
  }, [loadAsignaturas, loadGeocercas, loadUsuarios]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const docentesList = useMemo(
    () => usuarios.filter((u) => u.rol_codigo === 'DOCENTE' && isRecordActive(u.activo)),
    [usuarios]
  );

  const uniqueAsignaturas = useMemo(() => {
    const map = new Map<number, AsignaturaGrupoItem>();
    asignaturas.forEach((item) => {
      if (!map.has(item.asignatura_id)) {
        map.set(item.asignatura_id, item);
      }
    });
    return Array.from(map.values());
  }, [asignaturas]);

  const handleCreateDocente = async (): Promise<void> => {
    setErrorMessage(null);
    setInfoMessage(null);

    if (!docDocumento.trim() || !docNombre.trim() || !docCorreo.trim() || docPassword.length < 8) {
      setErrorMessage('Completa documento, nombre, correo institucional y contraseña (mín. 8 caracteres).');
      return;
    }

    setBusy(true);
    try {
      await apiRequest<unknown>('/usuarios/docentes', {
        method: 'POST',
        queueOnNetworkError: true,
        body: {
          documento: docDocumento.trim(),
          codigo_institucional: docCodigo.trim() || null,
          nombre_completo: docNombre.trim(),
          correo_institucional: docCorreo.trim().toLowerCase(),
          password: docPassword,
        },
      });
      setDocDocumento('');
      setDocCodigo('');
      setDocNombre('');
      setDocCorreo('');
      setDocPassword('');
      setInfoMessage('Cuenta docente creada correctamente.');
      await loadUsuarios();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible crear la cuenta docente.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleUsuario = async (item: AdminUsuarioItem): Promise<void> => {
    setBusy(true);
    setErrorMessage(null);
    setInfoMessage(null);
    const nextActive = !isRecordActive(item.activo);
    try {
      await apiRequest<unknown>(`/usuarios/${item.usuario_id}`, {
        method: 'PATCH',
        queueOnNetworkError: true,
        body: { activo: nextActive ? 1 : 0 },
      });
      setInfoMessage(`Usuario ${item.nombre_completo} ${nextActive ? 'activado' : 'desactivado'}.`);
      await loadUsuarios();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo actualizar el estado del usuario.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAsignatura = async (): Promise<void> => {
    setErrorMessage(null);
    setInfoMessage(null);

    if (!asigCodigo.trim() || !asigNombre.trim()) {
      setErrorMessage('Ingresa el código y nombre de la asignatura.');
      return;
    }

    setBusy(true);
    try {
      await apiRequest<unknown>('/asignaturas', {
        method: 'POST',
        queueOnNetworkError: true,
        body: {
          codigo: asigCodigo.trim().toUpperCase(),
          nombre: asigNombre.trim(),
          creditos: Number(asigCreditos) || 3,
        },
      });
      setAsigCodigo('');
      setAsigNombre('');
      setInfoMessage('Asignatura creada correctamente.');
      await loadAsignaturas();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible crear la asignatura.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAsignatura = async (item: AsignaturaGrupoItem): Promise<void> => {
    setBusy(true);
    setErrorMessage(null);
    const nextActive = item.activa === 0 ? 1 : 0;
    try {
      await apiRequest<unknown>(`/asignaturas/${item.asignatura_id}`, {
        method: 'PATCH',
        queueOnNetworkError: true,
        body: { activa: nextActive },
      });
      setInfoMessage(`Asignatura ${item.codigo} actualizada.`);
      await loadAsignaturas();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible actualizar la asignatura.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateGrupo = async (): Promise<void> => {
    setErrorMessage(null);
    setInfoMessage(null);

    if (!grupoAsignaturaId || !grupoCodigo.trim() || !grupoPeriodo.trim()) {
      setErrorMessage('Selecciona una asignatura e ingresa código de grupo y período académico.');
      return;
    }

    setBusy(true);
    try {
      await apiRequest<unknown>('/grupos', {
        method: 'POST',
        queueOnNetworkError: true,
        body: {
          asignatura_id: grupoAsignaturaId,
          docente_id: grupoDocenteId,
          codigo_grupo: grupoCodigo.trim().toUpperCase(),
          periodo_academico: grupoPeriodo.trim(),
        },
      });
      setGrupoCodigo('');
      setInfoMessage('Grupo académico creado correctamente.');
      await loadAsignaturas();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible crear el grupo.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleGrupo = async (item: AsignaturaGrupoItem): Promise<void> => {
    if (!item.grupo_id) {
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    const nextActive = item.grupo_activo === 0 ? 1 : 0;
    try {
      await apiRequest<unknown>(`/grupos/${item.grupo_id}`, {
        method: 'PATCH',
        queueOnNetworkError: true,
        body: { activo: nextActive },
      });
      setInfoMessage(`Grupo ${item.codigo_grupo} actualizado.`);
      await loadAsignaturas();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible actualizar el grupo.');
    } finally {
      setBusy(false);
    }
  };

  const uploadExcelFormData = async (formData: FormData): Promise<void> => {
    setBusy(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const result = await apiRequest<ImportacionExcelResponse>('/importaciones/excel', {
        method: 'POST',
        body: formData,
      });
      setExcelResult(result);
      setInfoMessage(
        `Importación #${result.importacion_id} procesada: ${result.filas_exitosas}/${result.total_filas} filas exitosas.`
      );
      await loadUsuarios();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error al procesar el archivo Excel.');
    } finally {
      setBusy(false);
    }
  };

  const handlePickExcelNative = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const file = result.assets[0];
      if (file.size !== undefined && file.size > MAX_EXCEL_BYTES) {
        setErrorMessage('El archivo Excel supera el límite máximo permitido de 4 MB.');
        return;
      }

      const formData = new FormData();
      await appendFileToFormData(formData, 'archivo_excel', {
        uri: file.uri,
        name: file.name,
        type:
          file.mimeType ??
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      await uploadExcelFormData(formData);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible seleccionar el archivo Excel.');
    }
  };

  const handlePickExcelWeb = (): void => {
    if (typeof document === 'undefined') {
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = () => {
      const selected = input.files?.[0];
      if (!selected) {
        return;
      }
      if (selected.size > MAX_EXCEL_BYTES) {
        setErrorMessage('El archivo Excel supera el límite máximo permitido de 4 MB.');
        return;
      }
      void (async () => {
        const objectUrl = URL.createObjectURL(selected);
        try {
          const formData = new FormData();
          await appendFileToFormData(formData, 'archivo_excel', {
            uri: objectUrl,
            name: selected.name,
            type:
              selected.type ||
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            blob: selected,
          });
          await uploadExcelFormData(formData);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      })();
    };
    input.click();
  };

  const handleSaveGeocerca = async (): Promise<void> => {
    setErrorMessage(null);
    setInfoMessage(null);

    const lat = Number(geoLatitud);
    const lng = Number(geoLongitud);
    const radio = Number(geoRadio);

    if (!geoSede.trim() || Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radio) || radio <= 0) {
      setErrorMessage('Ingresa una sede, latitud, longitud y radio en metros válidos.');
      return;
    }

    setBusy(true);
    try {
      await apiRequest<unknown>('/configuracion/geocerca', {
        method: 'PUT',
        queueOnNetworkError: true,
        body: {
          sede: geoSede.trim(),
          latitud: lat,
          longitud: lng,
          radio_metros: Math.round(radio),
        },
      });
      setInfoMessage(`Geocerca "${geoSede.trim()}" guardada correctamente.`);
      await loadGeocercas();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible guardar la geocerca.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    router.replace('/login');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Encabezado Administración */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.brandSmall}>
              <Text style={styles.brandWhite}>Inpa_</Text>
              <Text style={styles.brandOrange}>Go</Text>
              <Text style={styles.roleTag}> · Bienestar Institucional</Text>
            </Text>
            <Text style={styles.userName}>{user?.nombre_completo ?? 'Administrador UNINPAHU'}</Text>
            <Text style={styles.userMeta}>{user?.correo_institucional}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => void loadAll()} style={styles.refreshBtn}>
              <Text style={styles.btnText}>Actualizar</Text>
            </Pressable>
            <Pressable onPress={() => void handleSignOut()} style={styles.logoutBtn}>
              <Text style={styles.btnText}>Salir</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Navegación por 4 pestañas */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {(
          [
            { key: 'usuarios', label: 'Usuarios y Docentes' },
            { key: 'asignaturas', label: 'Asignaturas y Grupos' },
            { key: 'excel', label: 'Importación Excel' },
            { key: 'geocercas', label: 'Geocercas UNINPAHU' },
          ] as const
        ).map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            onPress={() => {
              setActiveTab(tab.key);
              setErrorMessage(null);
            }}
            style={[styles.tabPill, activeTab === tab.key && styles.tabPillActive]}
          >
            <Text style={[styles.tabPillText, activeTab === tab.key && styles.tabPillTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
      {infoMessage ? <Text style={styles.successBanner}>{infoMessage}</Text> : null}
      {loading ? <ActivityIndicator color="#F0440B" /> : null}

      {/* TAB 1: Usuarios y Docentes */}
      {activeTab === 'usuarios' ? (
        <View style={styles.stackGap}>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Crear Cuenta Docente (RF03)</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setDocDocumento}
              placeholder="Documento *"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={docDocumento}
            />
            <TextInput
              autoCapitalize="characters"
              onChangeText={setDocCodigo}
              placeholder="Código institucional (opcional)"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={docCodigo}
            />
            <TextInput
              onChangeText={(value) => {
                setDocNombre(value);
                if (!docCorreo || docCorreo.endsWith('@uninpahu.edu.co')) {
                  setDocCorreo(buildSuggestedUninpahuEmail(value));
                }
              }}
              placeholder="Nombre completo *"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={docNombre}
            />
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setDocCorreo}
              placeholder="docente@uninpahu.edu.co *"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={docCorreo}
            />
            <TextInput
              autoCapitalize="none"
              onChangeText={setDocPassword}
              placeholder="Contraseña inicial (mín. 8 caracteres) *"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              style={styles.input}
              value={docPassword}
            />
            <Pressable
              disabled={busy}
              onPress={() => void handleCreateDocente()}
              style={[styles.primaryButton, busy && styles.disabled]}
            >
              <Text style={styles.primaryButtonText}>Registrar Docente</Text>
            </Pressable>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Directorio de Usuarios ({usuarios.length})</Text>
            <View style={styles.filterRow}>
              {(['', 'DOCENTE', 'ESTUDIANTE', 'ADMIN_BIENESTAR'] as const).map((rol) => (
                <Pressable
                  key={rol || 'ALL'}
                  onPress={() => setFilterRol(rol)}
                  style={[styles.smallPill, filterRol === rol && styles.smallPillActive]}
                >
                  <Text style={[styles.smallPillText, filterRol === rol && styles.smallPillTextActive]}>
                    {rol || 'Todos los roles'}
                  </Text>
                </Pressable>
              ))}
              {(['', '1', '0'] as const).map((act) => (
                <Pressable
                  key={act || 'ALL_STATUS'}
                  onPress={() => setFilterActivo(act)}
                  style={[styles.smallPill, filterActivo === act && styles.smallPillActive]}
                >
                  <Text style={[styles.smallPillText, filterActivo === act && styles.smallPillTextActive]}>
                    {act === '' ? 'Todos' : act === '1' ? 'Activos' : 'Inactivos'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {usuarios.map((u) => {
              const active = isRecordActive(u.activo);
              return (
                <View key={u.usuario_id} style={styles.rowCard}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.itemTitle}>{u.nombre_completo}</Text>
                    <Text style={styles.itemMeta}>
                      {u.rol_codigo} · {u.correo_institucional} · Doc: {u.documento}
                    </Text>
                  </View>
                  <Pressable
                    disabled={busy}
                    onPress={() => void handleToggleUsuario(u)}
                    style={[
                      styles.toggleBtn,
                      { backgroundColor: active ? '#DCFCE7' : '#FEE2E2' },
                    ]}
                  >
                    <Text style={[styles.toggleBtnText, { color: active ? '#15803D' : '#B42318' }]}>
                      {active ? 'Activo' : 'Inactivo'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* TAB 2: Asignaturas y Grupos */}
      {activeTab === 'asignaturas' ? (
        <View style={styles.stackGap}>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Nueva Asignatura (RF05)</Text>
            <TextInput
              autoCapitalize="characters"
              onChangeText={setAsigCodigo}
              placeholder="Código (ej. ING-301)"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={asigCodigo}
            />
            <TextInput
              onChangeText={setAsigNombre}
              placeholder="Nombre de la asignatura"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={asigNombre}
            />
            <TextInput
              keyboardType="number-pad"
              onChangeText={setAsigCreditos}
              placeholder="Créditos"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={asigCreditos}
            />
            <Pressable
              disabled={busy}
              onPress={() => void handleCreateAsignatura()}
              style={[styles.primaryButton, busy && styles.disabled]}
            >
              <Text style={styles.primaryButtonText}>Crear Asignatura</Text>
            </Pressable>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Crear Grupo Académico (RF06)</Text>
            <Text style={styles.label}>Asignatura</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {uniqueAsignaturas.map((a) => (
                <Pressable
                  key={a.asignatura_id}
                  onPress={() => setGrupoAsignaturaId(a.asignatura_id)}
                  style={[styles.smallPill, grupoAsignaturaId === a.asignatura_id && styles.smallPillActive]}
                >
                  <Text
                    style={[
                      styles.smallPillText,
                      grupoAsignaturaId === a.asignatura_id && styles.smallPillTextActive,
                    ]}
                  >
                    {a.codigo} · {a.nombre}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>Docente asignado</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {docentesList.map((d) => (
                <Pressable
                  key={d.usuario_id}
                  onPress={() => setGrupoDocenteId(d.usuario_id)}
                  style={[styles.smallPill, grupoDocenteId === d.usuario_id && styles.smallPillActive]}
                >
                  <Text
                    style={[
                      styles.smallPillText,
                      grupoDocenteId === d.usuario_id && styles.smallPillTextActive,
                    ]}
                  >
                    {d.nombre_completo}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <TextInput
              autoCapitalize="characters"
              onChangeText={setGrupoCodigo}
              placeholder="Código de grupo (ej. G01)"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={grupoCodigo}
            />
            <TextInput
              onChangeText={setGrupoPeriodo}
              placeholder="Período académico (ej. 2026-2)"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={grupoPeriodo}
            />
            <Pressable
              disabled={busy}
              onPress={() => void handleCreateGrupo()}
              style={[styles.navyButton, busy && styles.disabled]}
            >
              <Text style={styles.primaryButtonText}>Crear Grupo</Text>
            </Pressable>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Catálogo de Asignaturas y Grupos</Text>
            {asignaturas.map((item, idx) => (
              <View key={`${item.asignatura_id}-${item.grupo_id ?? idx}`} style={styles.rowCard}>
                <View style={styles.rowInfo}>
                  <Text style={styles.itemTitle}>
                    {item.codigo} · {item.nombre}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {item.grupo_id
                      ? `Grupo ${item.codigo_grupo} (${item.periodo_academico ?? ''}) · Docente: ${item.docente_nombre ?? 'Sin asignar'}`
                      : 'Sin grupos creados aún'}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable
                    onPress={() => void handleToggleAsignatura(item)}
                    style={[
                      styles.toggleBtn,
                      { backgroundColor: item.activa === 0 ? '#FEE2E2' : '#DCFCE7' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        { color: item.activa === 0 ? '#B42318' : '#15803D' },
                      ]}
                    >
                      {item.activa === 0 ? 'Asig. Inactiva' : 'Asig. Activa'}
                    </Text>
                  </Pressable>
                  {item.grupo_id ? (
                    <Pressable
                      onPress={() => void handleToggleGrupo(item)}
                      style={[
                        styles.toggleBtn,
                        { backgroundColor: item.grupo_activo === 0 ? '#FEE2E2' : '#EDE9FE' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          { color: item.grupo_activo === 0 ? '#B42318' : '#6D28D9' },
                        ]}
                      >
                        {item.grupo_activo === 0 ? 'Grupo Off' : 'Grupo On'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* TAB 3: Importación Masiva Excel */}
      {activeTab === 'excel' ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Importación Masiva Excel (RF04 / RF06)</Text>
          <Text style={styles.itemMeta}>
            Selecciona un archivo .xlsx o .xls (máx. 4 MB) para matricular estudiantes y crear usuarios en lote.
          </Text>

          <Pressable
            disabled={busy}
            onPress={() => {
              if (Platform.OS === 'web') {
                handlePickExcelWeb();
              } else {
                void handlePickExcelNative();
              }
            }}
            style={[styles.primaryButton, busy && styles.disabled]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Seleccionar y Subir Archivo Excel</Text>
            )}
          </Pressable>

          {excelResult ? (
            <View style={styles.stackGap}>
              <View style={styles.kpiRow}>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiVal}>{excelResult.total_filas}</Text>
                  <Text style={styles.kpiLbl}>Total filas</Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={[styles.kpiVal, { color: '#15803D' }]}>{excelResult.filas_exitosas}</Text>
                  <Text style={styles.kpiLbl}>Exitosas</Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={[styles.kpiVal, { color: '#B42318' }]}>{excelResult.filas_con_error}</Text>
                  <Text style={styles.kpiLbl}>Con error</Text>
                </View>
              </View>

              {excelResult.errores.length > 0 ? (
                <View style={styles.stackGap}>
                  <Text style={styles.label}>Detalle de errores por fila</Text>
                  {excelResult.errores.map((err, idx) => (
                    <View key={`${err.fila}-${idx}`} style={styles.errorRow}>
                      <Text style={styles.errorRowTitle}>
                        Fila {err.fila}
                        {err.documento ? ` · Doc ${err.documento}` : ''}
                      </Text>
                      <Text style={styles.errorRowText}>{err.error}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* TAB 4: Geocercas Institucionales */}
      {activeTab === 'geocercas' ? (
        <View style={styles.stackGap}>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Configurar Geocerca UNINPAHU (RF09)</Text>
            <TextInput
              onChangeText={setGeoSede}
              placeholder="Nombre de la sede (ej. Sede Principal Calle 39)"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={geoSede}
            />
            <TextInput
              keyboardType="numbers-and-punctuation"
              onChangeText={setGeoLatitud}
              placeholder="Latitud (ej. 4.6281)"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={geoLatitud}
            />
            <TextInput
              keyboardType="numbers-and-punctuation"
              onChangeText={setGeoLongitud}
              placeholder="Longitud (ej. -74.0654)"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={geoLongitud}
            />
            <TextInput
              keyboardType="number-pad"
              onChangeText={setGeoRadio}
              placeholder="Radio autorizado en metros (ej. 100)"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={geoRadio}
            />
            <Pressable
              disabled={busy}
              onPress={() => void handleSaveGeocerca()}
              style={[styles.primaryButton, busy && styles.disabled]}
            >
              <Text style={styles.primaryButtonText}>Guardar Geocerca</Text>
            </Pressable>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Sedes Registradas ({geocercas.length})</Text>
            {geocercas.map((geo) => (
              <Pressable
                key={geo.geocerca_id}
                onPress={() => {
                  setGeoSede(geo.sede);
                  setGeoLatitud(String(geo.latitud));
                  setGeoLongitud(String(geo.longitud));
                  setGeoRadio(String(geo.radio_metros));
                }}
                style={styles.rowCard}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.itemTitle}>{geo.sede}</Text>
                  <Text style={styles.itemMeta}>
                    Lat: {geo.latitud} · Lng: {geo.longitud} · Radio: {geo.radio_metros} m
                  </Text>
                </View>
                <Text style={styles.editLink}>Editar</Text>
              </Pressable>
            ))}
          </View>
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
    maxWidth: 980,
    width: '100%',
    alignSelf: 'center',
  },
  headerCard: {
    backgroundColor: '#07152F',
    borderRadius: 16,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerInfo: {
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
  tabsRow: {
    gap: 8,
  },
  tabPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tabPillActive: {
    backgroundColor: '#07152F',
    borderColor: '#07152F',
  },
  tabPillText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
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
  stackGap: {
    gap: 12,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    color: '#07152F',
    fontSize: 16,
    fontWeight: '800',
  },
  label: {
    color: '#07152F',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  primaryButton: {
    backgroundColor: '#F0440B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  navyButton: {
    backgroundColor: '#07152F',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  smallPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallPillActive: {
    backgroundColor: '#07152F',
  },
  smallPillText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  smallPillTextActive: {
    color: '#FFFFFF',
  },
  rowCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 6,
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
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  editLink: {
    color: '#F0440B',
    fontSize: 12,
    fontWeight: '800',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  kpiVal: {
    color: '#07152F',
    fontSize: 20,
    fontWeight: '800',
  },
  kpiLbl: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  errorRow: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  errorRowTitle: {
    color: '#B42318',
    fontSize: 12,
    fontWeight: '800',
  },
  errorRowText: {
    color: '#991B1B',
    fontSize: 12,
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
