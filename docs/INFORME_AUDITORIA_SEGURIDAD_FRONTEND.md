# Informe de Auditoría de Seguridad Móvil (OWASP Mobile Top 10) — Frontend `inpa-go-mobile`

- **Fecha de auditoría:** 24 de noviembre de 2026
- **Alcance:** Todo el código TypeScript (`.tsx` y `.ts`) en `app/` y `src/`, configuración nativa (`app.json`, `eas.json`) y variables de entorno (`.env.example`).
- **Marco de referencia:** OWASP Mobile Top 10 (2024) + Ley 1581 de 2012 / Decreto 1377 de 2013 (Colombia).
- **Verificación de compilación posterior a remediaciones:** `npx tsc --noEmit` (**0 errores**).

---

## 1. Resumen Ejecutivo por Dominio Evaluado

| Dominio OWASP Mobile | Categoría | Estado Inicial | Estado Final | Archivos Auditados / Endurecidos |
| :--- | :--- | :---: | :---: | :--- |
| **1. Almacenamiento Seguro de Credenciales** | M9: Insecure Data Storage | ⚠️ Endurecible | ✅ CONFORME | `src/auth/storage.ts`, `src/auth/auth-context.tsx` |
| **2. Seguridad de Red y Transporte** | M5: Insecure Communication / M1 | ⚠️ 2 Hallazgos | ✅ CONFORME | `src/api/config.ts`, `src/api/client.ts` |
| **3. Privacidad y Minimización de Permisos** | M6: Inadequate Privacy Controls | ⚠️ 1 Hallazgo | ✅ CONFORME | `app.json`, `src/location/validate-location.ts`, `src/api/client.ts`, `src/voice/voice-recorder-panel.tsx`, `app/login.tsx` |
| **4. Fuga de Secretos en el Bundle** | M1: Improper Credential Usage / M8 | ✅ Limpio | ✅ CONFORME | `app/`, `src/`, `app.json`, `eas.json`, `.env.example` |

---

## 2. Hallazgos Detallados y Remediaciones Aplicadas

### 2.1 Almacenamiento Seguro de Credenciales (`src/auth/storage.ts`)
- **Verificación:**
  - En iOS y Android, `access_token`, `refresh_token` y `usuario` se persisten exclusivamente mediante `expo-secure-store` (Keychain / Android Keystore cifrado).
  - **0** usos de `AsyncStorage` y **0** llamadas `console.log`/`console.debug`/`console.warn`/`console.error` en `app/` y `src/` que pudieran exponer tokens o PII en logs del dispositivo.
  - Al cerrar sesión (`signOut()`), se revoca el `refresh_token` en el backend (`POST /auth/logout`) y se eliminan `ACCESS_KEY`, `REFRESH_KEY` y `USER_KEY`.
- **Endurecimiento aplicado:**
  - En `src/auth/storage.ts`, se añadió `{ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }` en `SecureStore.setItemAsync`, evitando sincronización de tokens en respaldos en la nube (iCloud Keychain) y restringiendo la lectura únicamente con el dispositivo desbloqueado.

### 2.2 Seguridad de Red, Transporte y Protección del Token Bearer (`src/api/config.ts`, `src/api/client.ts`)
- **Hallazgo 1 (Severidad Media — M5):** `getApiBaseUrl()` permitía `http://` hacia hosts remotos en compilaciones de producción o release.
  - **Remediación:** En `src/api/config.ts`, se bloquea explícitamente cualquier protocolo distinto a `https:` cuando `NODE_ENV === 'production'`, `!__DEV__` o el host no es local (`localhost`/`127.0.0.1`), lanzando un error inmediato de conexión insegura.
- **Hallazgo 2 (Severidad Alta — M1/M5):** `buildProtectedAssetUrl()` aceptaba URLs absolutas arbitrarias y `apiRequest()` no validaba el origen destino antes de adjuntar `Authorization: Bearer`. Si un campo `foto_url` o ruta relativa malformada apuntara a un dominio externo, el JWT podría filtrarse fuera del dominio institucional.
  - **Remediación:**
    - Se implementó `isTrustedApiOrigin(targetUrl)` en `src/api/config.ts`, que exige coincidencia exacta de `URL.origin` contra `getServerOrigin()`.
    - `buildProtectedAssetUrl()` rechaza URLs absolutas externas y rutas `//` (protocol-relative), devolviendo `''` para impedir que `<Image />` envíe `Authorization: Bearer` a terceros.
    - `normalizePath()` en `src/api/client.ts` rechaza cualquier ruta absoluta (`http://`, `https://`, `//`), y tanto `apiRequest()` como `downloadPdfReport()` validan `isTrustedApiOrigin(url)` antes de adjuntar el token `Bearer`.

### 2.3 Privacidad, Minimización de Permisos y Limpieza de Caché (`app.json`, `src/location/`, `src/api/`, `src/voice/`, `app/login.tsx`)
- **Permisos nativos (`app.json`):**
  - Confirmado `android.blockedPermissions: ["android.permission.ACCESS_BACKGROUND_LOCATION"]`.
  - Solo se declaran los 6 permisos estrictamente necesarios para el alcance funcional (`CAMERA`, `RECORD_AUDIO`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `USE_BIOMETRIC`, `USE_FINGERPRINT`) y descripciones iOS `infoPlist` explícitas de uso puntual en primer plano.
  - Confirmado diálogo explícito de consentimiento (`RNF06`) antes de solicitar GPS (`src/location/validate-location.ts`), micrófono (`src/voice/voice-recorder-panel.tsx`) y cámara/galería (`app/login.tsx`).
- **Hallazgo 3 (Severidad Media — M9/M6):** Los archivos temporales descargados o capturados en caché local (reportes PDF en `Paths.cache`, clips de voz biométricos y fotos temporales de registro) permanecían en caché después de su envío o compartición.
  - **Remediación:**
    - Se creó el helper seguro `cleanupTempFileSafe(uri)` en `src/api/client.ts` (revoca `blob:` URLs en web y elimina únicamente archivos ubicados dentro de `Paths.cache` en móvil nativo, sin tocar nunca la galería personal del usuario).
    - `downloadPdfReport()` limpia el PDF temporal en bloque `finally` tras `Sharing.shareAsync` / `Print.printAsync`.
    - `VoiceRecorderPanel` elimina el archivo de audio temporal tras subirlo exitosamente y al iniciar una nueva grabación.
    - `app/login.tsx` elimina la copia temporal en caché de `foto_perfil` inmediatamente después de completar el registro.

### 2.4 Escaneo de Fuga de Secretos en el Bundle
- **Escaneo ejecutado** sobre `app/`, `src/`, `app.json`, `eas.json` y `.env.example`:
  - **0** llaves privadas, tokens de infraestructura (`BLOB_READ_WRITE_TOKEN`, `JWT_SECRET`, `EXPO_TOKEN`, AWS keys) ni contraseñas hardcodeadas.
  - La única variable `EXPO_PUBLIC_*` presente en el bundle es `EXPO_PUBLIC_API_URL`, que corresponde exclusivamente a la URL pública HTTPS del backend (`/api/v1`).
  - Se eliminó el script temporal `scripts/e2e-audit.mjs` utilizado durante la auditoría funcional previa para evitar remanentes de datos de prueba en el repositorio.

---

## 3. Verificación Final
- `npx tsc --noEmit`: **0 errores**.
- Código 100% TypeScript estricto (`.tsx`/`.ts`) sin `any` implícitos ni `console.log` con datos sensibles.
