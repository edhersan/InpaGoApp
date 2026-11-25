# Informe Técnico de Auditoría y Pruebas End-to-End (E2E) — Inpa_Go

- **Fecha de ejecución:** 24 de noviembre de 2026
- **Entorno evaluado:** `EXPO_PUBLIC_API_URL=https://inpa-go-backend.vercel.app/api/v1` (Vercel Serverless + TiDB Cloud `inpa_go_db` + Vercel Blob `inpa-go-store`)
- **Cliente evaluado:** `inpago-mobile` (`Expo SDK 58` + `Expo Router` + `TypeScript 5.8` estricto)
- **Identificador de corrida E2E:** `RUN_TAG=124899`

---

## 1. Fase 1 — Verificación de Compilación y Empaquetado Frontend

| Verificación | Comando / Validación | Resultado | Detalle |
| :--- | :--- | :---: | :--- |
| Configuración `.env` | `EXPO_PUBLIC_API_URL` HTTPS `/api/v1` | ✅ PASS | `https://inpa-go-backend.vercel.app/api/v1` |
| Regla 100% TypeScript | Búsqueda de `.js`/`.jsx` en `app/` y `src/` | ✅ PASS | `0` archivos `.js`/`.jsx` encontrados |
| Compilación estricta | `npx tsc --noEmit` | ✅ PASS | `0` errores de compilación (`strict: true`) |
| Empaquetado Web | `npx expo export -p web` | ✅ PASS | `876` módulos compilados en `3939 ms`, `9` bundles web (`_layout`, `index`, `login`, `admin`, `teacher`, `student`, `entry`, `__common`, `__expo-metro-runtime`) y `19` assets exportados a `dist/` |

---

## 2. Fase 2 — Matriz de Resultados End-to-End (`CP-01` a `CP-26`)

> **Leyenda:** `✅ PASS` = Validado automáticamente contra la API real en Vercel · `📱 MANUAL EN DISPOSITIVO` = Requiere interacción nativa del sistema operativo (diálogo biométrico OS, diálogo de permisos nativos, modo avión o cliente de correo nativo).

| Caso | Módulo / Flujo Evaluado | Estado | HTTP | Tiempo | Evidencia / Resultado |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **CP-01** | Registro `ESTUDIANTE` y `DOCENTE` con foto JPEG (`< 100 KB`) en `POST /auth/registro` | ✅ PASS | `201` / `201` | `989 ms` / `735 ms` | Estudiante `usuario_id=606144`, Docente `usuario_id=606145`, `foto_hash_sha256=f882509e9a9c...` |
| **CP-02** | Rechazo al registrar sin `foto_perfil` y con imagen `> 3.2 MB` (`RF14`) | ✅ PASS | `400` / `400` | `133 ms` / `1263 ms` | Sin foto: *"La fotografía de registro (foto_perfil) es obligatoria."* · `>3.2 MB`: *"El archivo excede el tamaño máximo permitido de 3 MB."* |
| **CP-03** | Inicio de sesión `POST /auth/login` y contrato `ApiResponse<LoginResponseData>` | ✅ PASS | `200` | `558 ms` | `access_token`, `refresh_token` y `usuario.rol_codigo="ESTUDIANTE"` válidos |
| **CP-04** | Renovación JWT (`POST /auth/refresh`) y foto protegida (`GET /usuarios/:id/foto`) | ✅ PASS | `200` / `200` | `132 ms` / `210 ms` | Token renovado y descarga `image/jpeg` de `35,791 bytes` con `Authorization: Bearer` |
| **CP-05** | Diálogo nativo de Huella / Face ID (`expo-local-authentication`) | 📱 MANUAL EN DISPOSITIVO | N/A | N/A | Flujo backend `POST /auth/refresh` validado en `CP-04`; el prompt biométrico del SO se valida en dispositivo físico |
| **CP-06** | Cierre de sesión revocable (`POST /auth/logout`) + rechazo de `refresh_token` | ✅ PASS | `200` / `401` | `275 ms` | `logout=200` y reintento posterior con `refresh_token` revocado devolvió `401 Unauthorized` |
| **CP-07** | Login `ADMIN_BIENESTAR` (`edhersan@uninpahu.edu.co`) | ✅ PASS | `200` | `519 ms` | `rol_codigo="ADMIN_BIENESTAR"`, redirección protegida a `/admin` |
| **CP-08** | Consulta de directorio de usuarios (`GET /usuarios`) | ✅ PASS | `200` | `141 ms` | `total_usuarios=11` devueltos en `data.usuarios` |
| **CP-09** | Creación de cuenta docente (`POST /usuarios/docentes`) | ✅ PASS | `201` | `612 ms` | Docente creado con `usuario_id=606146` enviando `password_temporal` |
| **CP-10** | Creación y consulta de asignaturas (`POST /asignaturas`, `GET /asignaturas`) | ✅ PASS | `201` / `200` | `273 ms` | `asignatura_id=5`, código `E2E-4899` |
| **CP-11** | Creación de grupo académico y asignación docente (`POST /grupos` + `PATCH /grupos/:id`) | ✅ PASS | `201` / `200` | `157 ms` | `grupo_id=5`, `codigo_grupo="G899"`, `docente_id=606145` |
| **CP-12** | Importación masiva Excel `.xlsx` (`POST /importaciones/excel`, `FormData`) | ✅ PASS | `200` | `253 ms` | `importacion_id=3`, `filas_exitosas=1/1`, `filas_con_error=0` |
| **CP-13** | Consulta y actualización de geocercas (`GET /configuracion/geocercas`, `PUT /configuracion/geocerca`) | ✅ PASS | `200` / `201` | `264 ms` | `4` sedes; principal *UNINPAHU - Sede Principal (Cl. 44 # 16-40, Teusaquillo)* (`radio_metros=300`) |
| **CP-14** | Docente inicia sesión académica (`POST /sesiones`) | ✅ PASS | `201` | `141 ms` | `sesion_id=2`, estado `ABIERTA` |
| **CP-15** | Docente pausa sesión (`PATCH /sesiones/2/pausar`) | ✅ PASS | `200` | `155 ms` | Estado actualizado a `PAUSADA` |
| **CP-16** | Docente reanuda sesión (`PATCH /sesiones/2/reanudar`) | ✅ PASS | `200` | `146 ms` | Estado restablecido a `ABIERTA` |
| **CP-17** | Docente consulta lista (`GET /sesiones/2/lista-asistencia`) y guarda (`PUT /sesiones/2/asistencias`) | ✅ PASS | `200` / `200` | `300 ms` | `estudiantes_en_lista=1`, asistencia guardada como `PRESENTE` (`VOZ_GPS_FOTO`) |
| **CP-18** | Exportación de reporte PDF (`GET /reportes/asistencia/pdf?sesion_id=2`) | ✅ PASS | `200` | `199 ms` | `Content-Type: application/pdf`, cabecera binaria `%PDF-`, tamaño `1,899 bytes` |
| **CP-19** | Docente finaliza sesión (`PATCH /sesiones/2/finalizar`) | ✅ PASS | `200` | `131 ms` | *"Sesión académica finalizada definitivamente."* |
| **CP-20** | Enrolamiento de perfil base de voz (`POST /usuarios/me/perfil-voz`, WAV PCM 16-bit 3 s) | ✅ PASS | `200` | `515 ms` | `perfil_voz_hash_sha256=db9d6c8818e8...`, `active_frames=186` |
| **CP-21** | Estudiante consulta abiertas y envía Voz + GPS **dentro** y **fuera** de geocerca (`POST /sesiones/2/evidencia-estudiante`) | ✅ PASS | `200` / `201` | `790 ms` / `543 ms` | **Dentro:** `distancia_metros=0 m`, `ubicacion_valida=1`, `similitud_espectro=100%`, `voz_valida=1` · **Fuera:** `distancia_metros=3555.42 m`, `ubicacion_valida=0`, `similitud_espectro=100%` |
| **CP-22** | Bloqueo de evidencia estudiantil mientras sesión está `PAUSADA` | ✅ PASS | `409` | `359 ms` | *"No es posible enviar evidencia porque la sesión está en estado PAUSADA."* |
| **CP-23** | Consulta de historial personal (`GET /asistencias/historial`) | ✅ PASS | `200` | `159 ms` | `total=1` en `data.registros`, `sesion_id=2`, `estado_asistencia="PRESENTE"` |
| **CP-24** | Diálogos nativos de consentimiento explícito GPS/Micrófono/Cámara (`RNF06`) | 📱 MANUAL EN DISPOSITIVO | N/A | N/A | Implementados en `validate-location.ts`, `voice-recorder-panel.tsx` y `app/login.tsx`; verificar interacción visual en Android/iOS |
| **CP-25** | Resiliencia sin conexión y banner de sincronización (`PendingSyncBanner`) | 📱 MANUAL EN DISPOSITIVO | N/A | N/A | Cola offline implementada en `src/api/client.ts` y `src/api/pending-sync-banner.tsx`; verificar con modo avión en dispositivo |
| **CP-26** | Modal Legal (Ley 1581/2012), checkboxes desmarcados y enlaces `mailto:` ARCO | 📱 MANUAL EN DISPOSITIVO | N/A | N/A | Implementado en `src/components/legal-privacy-modal.tsx`, `app/login.tsx` y los 3 dashboards; validar apertura del cliente de correo nativo |

---

## 3. Evidencias Reales Obtenidas en Producción (Vercel + TiDB + Blob)

- **Usuarios creados en la corrida:**
  - Estudiante: `usuario_id=606144` (`est.e2e.124899@uninpahu.edu.co`, `documento=880124899`)
  - Docente: `usuario_id=606145` (`doc.e2e.124899@uninpahu.edu.co`, `documento=770124899`)
  - Docente creado por Admin: `usuario_id=606146`
- **Fotografía protegida (`inpa-go-store`):** `GET /usuarios/606144/foto` devolvió `35,791 bytes` (`image/jpeg`) con `Authorization: Bearer`.
- **Estructura académica e importación Excel:** `asignatura_id=5` (`E2E-4899`), `grupo_id=5` (`G899`), `importacion_id=3` (`1/1` fila exitosa, `0` errores).
- **Análisis espectral de voz y cálculo GPS (Haversine):**
  - Perfil base WAV 16 kHz / 3 s: `active_frames=186`, SHA-256 `db9d6c8818e8933bafd91364b77b95c3d9acf5aefa3eb0701d280ef84d6a3dcd`.
  - Evidencia fuera de sede: `distancia_metros=3555.42 m`, `ubicacion_valida=0`, `similitud_espectro=100%`, `voz_valida=1`.
  - Evidencia dentro de sede: `distancia_metros=0 m`, `ubicacion_valida=1`, `similitud_espectro=100%`, `voz_valida=1`.
- **Reporte PDF (`RF12`):** `GET /reportes/asistencia/pdf?sesion_id=2` generó un archivo binario válido con cabecera `%PDF-` y `1,899 bytes`.

---

## 4. Hallazgos Detectados y Corregidos Durante la Auditoría

1. **Campo de contraseña en `POST /api/v1/usuarios/docentes` (`CP-09`):**
   - *Hallazgo:* El backend exige `password_temporal` en lugar de `password`.
   - *Corrección:* Actualizado `src/dashboards/admin-dashboard.tsx` para enviar `password_temporal`.
2. **Nombres de campos en `GET /api/v1/asignaturas` (`CP-10`):**
   - *Hallazgo:* El backend devuelve `asignatura_codigo` y `asignatura_nombre` dentro de `data.asignaturas`.
   - *Corrección:* Actualizados `src/types/api.types.ts`, `src/dashboards/admin-dashboard.tsx` y `src/dashboards/teacher-dashboard.tsx` para leer ambos nombres con respaldo seguro.
3. **Estructura de `GET /api/v1/asistencias/historial` (`CP-23`):**
   - *Hallazgo:* El backend devuelve `data.registros` (en lugar de `data.historial`) y el campo `estado_asistencia` (en lugar de `estado`).
   - *Corrección:* Actualizados `src/types/api.types.ts` y `src/dashboards/student-dashboard.tsx` para leer `data.registros` y `item.estado_asistencia ?? item.estado`.
4. **Tipado numérico `0 | 1` en `EvidenciaVozGpsResponse` y `active_frames` en `PerfilVozResponse` (`CP-20`, `CP-21`):**
   - *Hallazgo:* TiDB/MySQL serializa `ubicacion_valida` y `voz_valida` como `0 | 1` y el enrolamiento de voz devuelve `active_frames`.
   - *Corrección:* Actualizados `src/types/api.types.ts` y `src/dashboards/student-dashboard.tsx` para soportar `boolean | 0 | 1` y `active_frames`.
5. **Reasignación de docente al importar Excel (`CP-12` → `CP-14`):**
   - *Observación operativa:* Al crear un grupo vía Excel sin columna de docente, el backend asigna temporalmente al usuario que importa; se recomienda confirmar el docente titular desde la pestaña *Asignaturas y Grupos* (`PATCH /grupos/:id`) tras importar matrículas nuevas.

---

## 5. Conclusión

La auditoría E2E confirma que **todos los flujos críticos de negocio** (autenticación JWT + refresh + logout revocable, registro con foto en Vercel Blob privado, panel de Bienestar Institucional, importación masiva Excel, ciclo de vida completo de sesiones docentes, enrolamiento y verificación espectral de voz + geocerca GPS, historial de asistencia y exportación binaria PDF) operan correctamente en producción y el cliente Expo TypeScript compila con **0 errores** tanto en `tsc --noEmit` como en `expo export -p web`.
