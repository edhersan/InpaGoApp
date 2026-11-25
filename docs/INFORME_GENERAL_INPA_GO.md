# Informe Técnico Ejecutivo — Cliente Móvil y Web **Inpa_Go** (`UNINPAHU`)

- **Proyecto:** Inpa_Go — Sistema Institucional de Control de Asistencia Académica
- **Institución:** Fundación Universitaria UNINPAHU (Bogotá D.C., Colombia)
- **Fecha:** 24 de noviembre de 2026
- **Stack Frontend:** React Native `0.88.1` · Expo SDK `58` · Expo Router · TypeScript `5.8` Estricto (`.tsx` / `.ts`)
- **Backend Conectado:** `https://inpa-go-backend.vercel.app/api/v1` (Vercel Serverless + TiDB Cloud `inpa_go_db` + Vercel Blob `inpa-go-store`)

---

## 1. Resumen Ejecutivo

El cliente multiplataforma (**Android**, **iOS** y **Web**) de **Inpa_Go** fue diseñado, implementado, probado de extremo a extremo (E2E) y auditado bajo criterios de **OWASP Mobile Top 10** y **Ley 1581 de 2012 (Habeas Data)**. Todos los módulos compilan con **0 errores** en TypeScript estricto (`npx tsc --noEmit`) y empaquetan limpiamente para Web (`npx expo export -p web`, 876 módulos) y Android APK vía EAS Build (`eas.json` perfil `preview`).

---

## 2. Arquitectura y Módulos Implementados

| Capa | Archivos Principales | Responsabilidad |
| :--- | :--- | :--- |
| **Enrutamiento (`app/`)** | `_layout.tsx`, `index.tsx`, `login.tsx`, `admin.tsx`, `teacher.tsx`, `student.tsx` | Navegación Expo Router con identidad visual UNINPAHU (`#07152F` / `#F0440B`), recuperación de contraseña y protección por rol (`RoleGuard`). |
| **API y Red (`src/api/`)** | `config.ts`, `client.ts`, `pending-sync-banner.tsx` | Validación HTTPS obligatoria, pinning de origen para JWT, `apiRequest<T>()`, auto-refresh 401, `appendFileToFormData()` compatible con Expo SDK 58 (`bytes()`), descarga PDF y cola offline. |
| **Sesión y Roles (`src/auth/`)** | `storage.ts`, `auth-context.tsx`, `role-guard.tsx` | Persistencia cifrada con `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), biometría (`expo-local-authentication` + `POST /auth/refresh`) y logout revocable. |
| **Sensores (`src/location/`, `src/voice/`)** | `validate-location.ts`, `voice-recorder-panel.tsx`, `audio-wave-visualizer.tsx`, `tts-helper.ts` | Consentimiento explícito (`RNF06`), GPS de alta precisión en primer plano (`expo-location`), grabación de voz `expo-audio` (3–5 s) con visualizador de ondas y síntesis TTS `es-CO`. |
| **Dashboards (`src/dashboards/`)** | `student-dashboard.tsx`, `teacher-dashboard.tsx`, `admin-dashboard.tsx` | Paneles completos conectados a los endpoints `/api/v1` para `ESTUDIANTE`, `DOCENTE` y `ADMIN_BIENESTAR`. |
| **Legal y Privacidad (`src/components/`)** | `legal-privacy-modal.tsx` | Modal con **Aviso de Privacidad**, **Términos de Uso** y **Derechos ARCO** (Ley 1581 de 2012, Decreto 1377 de 2013 y SIC). |

---

## 3. Cumplimiento de Pruebas End-to-End (E2E)

Los resultados completos se documentan en [`INFORME_PRUEBAS_E2E_INPA_GO.md`](./INFORME_PRUEBAS_E2E_INPA_GO.md):

- **Compilación y Empaquetado:** `npx tsc --noEmit` (**0 errores**), `npx expo export -p web` (**876 módulos**, `dist/` generado), **0** archivos `.js`/`.jsx`.
- **Acceso, Registro con Foto y Tokens (`CP-01`–`CP-06`):** Registro `201 Created` con subida a Vercel Blob (`35,791 bytes`), rechazo `400` sin foto o con imagen `> 3 MB`, login `200`, refresh JWT `200`, foto protegida con `Authorization: Bearer` `200` y logout revocable (`200` / `401`).
- **Bienestar Institucional (`CP-07`–`CP-13`):** Listado de usuarios, creación de docentes (`201`), asignaturas (`201`), grupos (`201`), importación masiva Excel `.xlsx` (`200`, `1/1` exitosa) y geocercas UNINPAHU (`200`/`201`).
- **Docente y Reporte PDF (`CP-14`–`CP-19`):** Ciclo completo de sesión (`POST /sesiones`, `PATCH /pausar`, `PATCH /reanudar`, `PATCH /finalizar`), verificación visual + voz + GPS, guardado `PUT /asistencias` y descarga de PDF binario válido (`%PDF-`, `1,899 bytes`).
- **Estudiante Voz + GPS e Historial (`CP-20`–`CP-23`):** Enrolamiento base de voz WAV (`186` frames activos), bloqueo `409` en sesión pausada, validación GPS fuera de sede (`3555.42 m`, `ubicacion_valida=0`) y dentro de sede (`0 m`, `ubicacion_valida=1`, `100%` similitud FFT), e historial reflejando `PRESENTE`.

---

## 4. Cumplimiento de Seguridad (OWASP Mobile Top 10) y Privacidad

Los hallazgos y remediaciones se documentan en [`INFORME_AUDITORIA_SEGURIDAD_FRONTEND.md`](./INFORME_AUDITORIA_SEGURIDAD_FRONTEND.md):

- **Almacenamiento seguro:** Exclusivamente `expo-secure-store` en iOS/Android (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), sin `AsyncStorage` ni `console.log`.
- **Transporte y credenciales:** Bloqueo de `http://` en producción/release y verificación `isTrustedApiOrigin()` para que `Authorization: Bearer` nunca se envíe fuera del dominio institucional.
- **Privacidad y minimización:** `android.permission.ACCESS_BACKGROUND_LOCATION` bloqueado en `app.json`, checkboxes de consentimiento desmarcados por defecto (con carácter facultativo biométrico y alternativa `MANUAL_DOCENTE`), enlaces `mailto:` para Derechos ARCO y limpieza automática de archivos temporales en caché (`cleanupTempFileSafe()`).
- **Cero secretos expuestos:** Sin claves privadas ni tokens de infraestructura en el bundle.

---

## 5. Recursos Listos para la Exposición / Demo

| Recurso | Ruta en el Repositorio | Uso en la Demo |
| :--- | :--- | :--- |
| **Plantilla Excel Demo (5 estudiantes)** | `docs/plantilla_demo_expo_inpago.xlsx` | Subir en *Admin → Importación Excel* para mostrar carga masiva `5/5` exitosa |
| **Ejemplo de Reporte PDF Real** | `docs/ejemplo_reporte_asistencia.pdf` | Referencia del reporte oficial UNINPAHU generado por el backend |
| **Informe Técnico E2E** | `docs/INFORME_PRUEBAS_E2E_INPA_GO.md` | Evidencia detallada de casos `CP-01` a `CP-26` |
| **Informe de Seguridad OWASP** | `docs/INFORME_AUDITORIA_SEGURIDAD_FRONTEND.md` | Evidencia de controles de seguridad móvil y privacidad |
| **Cuenta Admin verificada** | `edhersan@uninpahu.edu.co` | Acceso completo al panel de Bienestar Institucional |
