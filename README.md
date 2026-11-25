# Inpa_Go — Cliente Móvil y Web (UNINPAHU)

Aplicación cliente multiplataforma (**Android**, **iOS** y **Web**) desarrollada con **React Native**, **Expo SDK 58**, **Expo Router** y **TypeScript estricto (`.tsx` / `.ts`)**, conectada a la API REST institucional `/api/v1`.

## Especificación y Reglas
- Manual de uso de la aplicación: [`docs/MANUAL_USO_INPA_GO.md`](docs/MANUAL_USO_INPA_GO.md)
- Requisitos funcionales y no funcionales: [`docs/specs/INPA_GO_REQUIREMENTS.md`](docs/specs/INPA_GO_REQUIREMENTS.md)
- Especificación técnica completa: [`docs/specs/INPA_GO_FRONTEND_SPEC.md`](docs/specs/INPA_GO_FRONTEND_SPEC.md)
- Reglas de desarrollo frontend: [`.agent/rules/inpago-frontend.md`](.agent/rules/inpago-frontend.md)
- Directorio oficial de skills: [`.agent/skills/`](.agent/skills/)

## Variables de Entorno
Copia `.env.example` a `.env` y configura la URL base del backend:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_API_URL=https://tu-backend-inpago.vercel.app/api/v1
```

## Scripts Disponibles

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo Expo
npm run start

# Ejecutar en Web
npm run web

# Compilar bundle Web para despliegue (Vercel)
npm run build:web

# Verificación de tipos TypeScript estricto
npm run typecheck
```

## Estructura Principal
- `app/` — Rutas protegidas de Expo Router (`_layout.tsx`, `index.tsx`, `login.tsx`, `admin.tsx`, `teacher.tsx`, `student.tsx`).
- `src/types/` — Contratos TypeScript 1:1 con el backend (`/api/v1`).
- `src/api/` — Configuración de API, cliente HTTP tipado y banner de sincronización.
- `src/auth/` — Almacenamiento seguro, contexto de autenticación y guardia por rol.
- `src/location/` — Consentimiento y validación GPS de geocerca.
- `src/voice/` — Grabador de voz, visualizador de ondas y síntesis TTS.
- `src/dashboards/` — Paneles por rol (`ADMIN_BIENESTAR`, `DOCENTE`, `ESTUDIANTE`).
- `assets/` — Logotipo institucional (`assets/logo.jpg`).
