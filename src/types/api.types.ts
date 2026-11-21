export type RolCodigo = 'ADMIN_BIENESTAR' | 'DOCENTE' | 'ESTUDIANTE';
export type EstadoSesion = 'ABIERTA' | 'PAUSADA' | 'CERRADA';
export type EstadoAsistencia = 'PRESENTE' | 'AUSENTE' | 'TARDE' | 'EXCUSA';
export type MetodoConfirmacion = 'VOZ_GPS_FOTO' | 'MANUAL_DOCENTE';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown;
}

export interface UsuarioAuth {
  usuario_id: number;
  rol_id: number;
  rol_codigo: RolCodigo;
  rol_nombre: string;
  documento: string;
  codigo_institucional: string | null;
  nombre_completo: string;
  correo_institucional: string;
  tiene_perfil_voz: boolean;
  biometria_habilitada: boolean;
}

export interface LoginResponseData {
  access_token: string;
  refresh_token: string;
  usuario: UsuarioAuth;
}

export interface PerfilVozResponse {
  usuario_id: number;
  perfil_voz_hash_sha256: string;
  metodo_analisis: string;
  frames_activos: number;
}

export interface GeocercaItem {
  geocerca_id: number;
  sede: string;
  latitud: string | number;
  longitud: string | number;
  radio_metros: number;
  activa?: 0 | 1;
}

export interface AsignaturaGrupoItem {
  asignatura_id: number;
  codigo: string;
  nombre: string;
  creditos: number | null;
  activa?: 0 | 1;
  grupo_id: number | null;
  codigo_grupo: string | null;
  periodo_academico: string | null;
  grupo_activo?: 0 | 1;
  docente_id?: number | null;
  docente_nombre?: string | null;
}

export interface SesionAbiertaItem {
  sesion_id: number;
  fecha: string;
  hora_inicio: string;
  estado: EstadoSesion;
  grupo_id: number;
  codigo_grupo: string;
  asignatura_id: number;
  asignatura_codigo: string;
  asignatura_nombre: string;
  docente_nombre?: string;
  geocerca_id?: number;
  sede?: string;
  radio_metros?: number;
  evidencia_id?: number | null;
  ubicacion_valida?: 0 | 1 | null;
  voz_valida?: 0 | 1 | null;
}

export interface EvidenciaVozGpsResponse {
  evidencia_id: number;
  sesion_id: number;
  estudiante_id: number;
  distancia_metros: number;
  radio_autorizado_metros: number;
  ubicacion_valida: boolean;
  similitud_espectro: number;
  voz_valida: boolean;
  metodo_analisis: string;
  enrolamiento_inicial: boolean;
}

export interface EstudianteListaAsistencia {
  estudiante_id: number;
  documento: string;
  codigo_institucional: string | null;
  nombre_completo: string;
  foto_url: string;
  evidencia_id: number | null;
  distancia_metros: string | null;
  ubicacion_valida: 0 | 1 | null;
  transcripcion_voz: string | null;
  similitud_espectro: string | null;
  voz_valida: 0 | 1 | null;
  evidencia_enviada_en: string | null;
  asistencia_id: number | null;
  estado_asistencia: EstadoAsistencia | null;
  metodo_confirmacion: MetodoConfirmacion | null;
  observacion: string | null;
}

export interface ListaAsistenciaResponse {
  sesion: {
    sesion_id: number;
    grupo_id: number;
    fecha: string;
    hora_inicio: string;
    hora_fin: string | null;
    estado: EstadoSesion;
  };
  estudiantes: EstudianteListaAsistencia[];
}

export interface ConfirmarAsistenciaItem {
  estudiante_id: number;
  evidencia_id?: number | null;
  estado: EstadoAsistencia;
  metodo_confirmacion?: MetodoConfirmacion;
  observacion?: string | null;
}

export interface HistorialAsistenciaItem {
  asistencia_id: number;
  estado: EstadoAsistencia;
  metodo_confirmacion: MetodoConfirmacion;
  observacion: string | null;
  confirmado_en: string;
  sesion_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string | null;
  grupo_id: number;
  codigo_grupo: string;
  periodo_academico: string;
  asignatura_id: number;
  asignatura_codigo: string;
  asignatura_nombre: string;
  estudiante_id: number;
  estudiante_documento: string;
  estudiante_nombre: string;
}

export interface ImportacionExcelResponse {
  importacion_id: number;
  total_filas: number;
  filas_exitosas: number;
  filas_con_error: number;
  errores: Array<{ fila: number; documento?: string; error: string }>;
}
