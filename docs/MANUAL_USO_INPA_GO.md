# Manual de uso de Inpa_Go

## 1. Propósito de la aplicación

Inpa_Go es el sistema institucional móvil y web de UNINPAHU para gestionar usuarios, asignaturas, grupos, sesiones de clase y asistencia.

La aplicación cuenta con tres perfiles:

- **Administrador de Bienestar:** administra usuarios, asignaturas, grupos, importaciones y geocercas.
- **Docente:** inicia y controla sesiones, revisa evidencias y guarda la asistencia.
- **Estudiante:** registra su voz, confirma asistencia con voz y GPS y consulta su historial.

---

## 2. Requisitos para usar la aplicación

Para utilizar Inpa_Go no es necesario configurar archivos ni ejecutar comandos.

Instala el archivo APK proporcionado por UNINPAHU, abre la aplicación y asegúrate de tener:

- Una cuenta institucional activa.
- Conexión a Internet.
- Permisos disponibles para cámara, ubicación y micrófono según la función que uses.
- Un dispositivo compatible con huella o reconocimiento facial, si deseas usar biometría.

### Permisos necesarios

La aplicación puede solicitar:

- **Cámara:** para la fotografía de registro.
- **Galería:** para seleccionar una fotografía.
- **Micrófono:** para la muestra vocal y la confirmación de asistencia.
- **Ubicación:** para validar que el estudiante está dentro de la geocerca.
- **Biometría:** huella o Face ID, cuando el dispositivo lo admite.

Estos permisos se solicitan únicamente al utilizar la función correspondiente. La ubicación y el micrófono no funcionan como rastreo en segundo plano.

---

## 3. Acceso a la aplicación

### Iniciar sesión

1. Abre Inpa_Go.
2. Selecciona la pestaña **Iniciar Sesión**.
3. Ingresa el correo institucional.
4. Ingresa la contraseña.
5. Pulsa **Ingresar**.
6. La aplicación verifica tu rol y abre el dashboard correspondiente:
   - `ADMIN_BIENESTAR` abre el panel de Bienestar.
   - `DOCENTE` abre el panel docente.
   - `ESTUDIANTE` abre el panel estudiantil.

Si la sesión expira, el sistema intenta renovar el token automáticamente. Si no puede renovarla, deberás iniciar sesión nuevamente.

### Desbloqueo con huella o Face ID

Esta opción aparece en Android e iOS solamente cuando el dispositivo tiene biometría disponible y configurada.

1. Pulsa **Desbloquear con Huella / Face ID**.
2. Completa la verificación local.
3. La aplicación renovará la sesión con el servidor antes de abrir el dashboard.

El desbloqueo biométrico debe haberse activado previamente por el usuario.

### Recuperar contraseña

1. En la pantalla de inicio selecciona **¿Olvidaste tu contraseña?**.
2. Ingresa tu correo institucional.
3. Pulsa **Solicitar Recuperación**.

Si el backend admite recuperación automática, enviará las instrucciones al correo registrado.

Si la recuperación automática todavía no está disponible, la aplicación indicará solicitar el cambio ante Bienestar Institucional UNINPAHU en `soporte@uninpahu.edu.co`, incluyendo documento y correo.

### Crear una cuenta

1. Selecciona la pestaña **Iniciar Sesión** o **Registro** disponible junto al formulario.
2. Elige el rol:
   - **Estudiante**
   - **Docente**
3. Completa:
   - Número de documento.
   - Código institucional, si existe.
   - Nombre completo.
   - Correo institucional.
   - Contraseña de al menos 8 caracteres.
4. Pulsa **Tomar Foto** o **Elegir de Galería**.
5. Confirma una fotografía clara de máximo 3 MB.
6. Verifica la vista previa.
7. Acepta:
   - Términos de Uso.
   - Aviso de Privacidad.
   - Tratamiento facultativo de datos biométricos y geolocalización, si deseas utilizar esas funciones.
8. Pulsa **Crear Cuenta e Ingresar**.

> La fotografía es obligatoria. La autorización de datos biométricos es facultativa y permite usar el método manual docente como alternativa.

### Cerrar sesión

Pulsa **Salir** en el encabezado del dashboard correspondiente.

La aplicación informa al servidor cuando existe conexión y elimina siempre el token, el perfil y los datos locales de sesión.

---

## 4. Manual para el Administrador de Bienestar

Al ingresar como `ADMIN_BIENESTAR`, el panel presenta cuatro pestañas horizontales:

- Usuarios y Docentes.
- Asignaturas y Grupos.
- Importación Excel.
- Geocercas UNINPAHU.

Pulsa **Actualizar** para volver a consultar los datos del servidor.

### 4.1 Usuarios y Docentes

#### Registrar un docente

1. Abre **Usuarios y Docentes**.
2. En **Crear Cuenta Docente**, completa:
   - Documento.
   - Código institucional opcional.
   - Nombre completo.
   - Correo institucional.
   - Contraseña inicial de al menos 8 caracteres.
3. La aplicación puede sugerir el correo `@uninpahu.edu.co` al escribir el nombre.
4. Pulsa **Registrar Docente**.

#### Consultar usuarios

En **Directorio de Usuarios** se muestran los usuarios registrados.

Puedes filtrar por:

- Todos.
- `DOCENTE`.
- `ESTUDIANTE`.
- `ADMIN_BIENESTAR`.

También puedes usar el filtro de estado para mostrar usuarios activos o inactivos.

#### Activar o desactivar un usuario

1. Localiza el usuario en el directorio.
2. Pulsa su estado actual.
3. Confirma la acción si aparece una solicitud de confirmación.
4. Pulsa **Actualizar** si necesitas refrescar la lista.

Los usuarios desactivados no deben poder continuar su acceso institucional.

### 4.2 Asignaturas y Grupos

#### Crear una asignatura

1. Abre **Asignaturas y Grupos**.
2. En **Nueva Asignatura**, completa:
   - Código, por ejemplo `ING-301`.
   - Nombre de la asignatura.
   - Número de créditos.
3. Pulsa **Crear Asignatura**.

#### Crear un grupo académico

1. En **Crear Grupo Académico**, selecciona una asignatura.
2. Selecciona el docente asignado.
3. Escribe el código del grupo, por ejemplo `G01`.
4. Escribe el período académico, por ejemplo `2026-2`.
5. Pulsa **Crear Grupo**.

#### Cambiar el estado de asignaturas y grupos

En **Catálogo de Asignaturas y Grupos**:

- Pulsa **Asig. Activa** o **Asig. Inactiva** para cambiar el estado de la asignatura.
- Pulsa **Grupo On** o **Grupo Off** para activar o desactivar el grupo.

### 4.3 Importación masiva Excel

1. Abre la pestaña **Importación Excel**.
2. Pulsa **Seleccionar y Subir Archivo Excel**.
3. Selecciona un archivo `.xlsx` o `.xls` de máximo 4 MB.
4. Espera a que el servidor procese el archivo.
5. Revisa el resumen:
   - Total de filas.
   - Filas exitosas.
   - Filas con error.
6. Si existen errores, revisa el detalle por número de fila y corrige el archivo antes de volver a importar.

### 4.4 Configuración de geocercas

1. Abre **Geocercas UNINPAHU**.
2. Completa:
   - Nombre de la sede.
   - Latitud.
   - Longitud.
   - Radio autorizado en metros.
3. Pulsa **Guardar Geocerca**.

Para editar una sede registrada:

1. Pulsa la tarjeta correspondiente en **Sedes Registradas**.
2. Los datos aparecerán en el formulario.
3. Modifícalos.
4. Pulsa **Guardar Geocerca**.

Las coordenadas deben corresponder a la ubicación real de la sede y el radio debe expresarse en metros.

---

## 5. Manual para el Docente

### 5.1 Actualizar información

Pulsa **Actualizar** para consultar nuevamente los grupos, sedes y sesión activa.

Pulsa **Salir** para cerrar sesión.

### 5.2 Iniciar una sesión de asistencia

Si no hay una sesión activa:

1. Selecciona el **Grupo asignado**.
2. Selecciona la **Sede oficial UNINPAHU**.
3. Pulsa **Iniciar Sesión de Asistencia**.
4. El panel mostrará el número de sesión, asignatura, grupo, fecha, hora y sede.

Solo puede haber una sesión activa controlada por el sistema según la respuesta del servidor.

### 5.3 Pausar una sesión

1. Con la sesión activa, pulsa **Pausar Sesión**.
2. El estado cambiará a `PAUSADA`.
3. Los estudiantes verán un aviso y no podrán enviar una nueva confirmación mientras esté pausada.

### 5.4 Reanudar una sesión

1. Pulsa **Reanudar Sesión** mientras la sesión esté pausada.
2. La sesión vuelve al estado `ABIERTA`.
3. Los estudiantes podrán confirmar nuevamente su asistencia.

### 5.5 Consultar y revisar la lista

Cuando existe una sesión activa, el docente puede consultar **Lista de Verificación**.

Cada estudiante puede mostrar:

- Fotografía de registro.
- Documento y código institucional.
- Evidencia de GPS.
- Distancia respecto a la geocerca.
- Evidencia de voz.
- Porcentaje de similitud espectral.
- Estado de asistencia guardado.

Pulsa **Refrescar evidencias** para consultar los datos más recientes sin salir de la sesión.

Pulsa **Llamar** junto al nombre del estudiante para reproducirlo mediante síntesis de voz, cuando esta opción esté disponible en el dispositivo.

### 5.6 Interpretar la evidencia

#### GPS

- **Válido:** la ubicación está dentro de la geocerca.
- **Fuera de rango:** la ubicación está fuera del radio autorizado.
- **Pendiente:** todavía no existe una evidencia registrada.

#### Voz

- Porcentaje verde: la voz fue considerada válida.
- Porcentaje ámbar o rojo: requiere revisión docente.
- Gris: no existe evidencia suficiente.

La validación automática no reemplaza obligatoriamente la decisión final del docente.

### 5.7 Guardar la asistencia

1. Revisa cada estudiante de la lista.
2. Selecciona uno de los estados:
   - `PRESENTE`
   - `TARDE`
   - `AUSENTE`
   - `EXCUSA`
3. Si ambos factores son válidos, el sistema puede sugerir `PRESENTE` automáticamente mientras no exista un registro guardado.
4. Pulsa **Guardar Lista de Asistencia**.

El servidor guarda los registros enviados por el docente.

### 5.8 Descargar el reporte PDF

1. Pulsa **Descargar Reporte PDF**.
2. En móvil, el sistema generará el archivo y mostrará opciones para compartir o imprimir.
3. En Web, el navegador iniciará la descarga.

El reporte corresponde a la sesión actualmente seleccionada.

### 5.9 Finalizar una sesión

1. Pulsa **Finalizar Sesión**.
2. Confirma en el cuadro de diálogo.
3. El estado pasa a `CERRADA`.
4. La lista activa deja de estar disponible para modificaciones según la respuesta del servidor.

La finalización es irreversible desde el flujo principal de la aplicación. Verifica la asistencia antes de continuar.

---

## 6. Manual para el Estudiante

### 6.1 Encabezado y perfil

El panel muestra:

- Fotografía o iniciales del usuario.
- Nombre completo.
- Código institucional.
- Rol Estudiante.
- Estado de la muestra de voz.

Pulsa **Actualizar** para recargar sesiones e historial.

Pulsa **Activar Huella** para habilitar el desbloqueo biométrico en dispositivos compatibles.

Pulsa **Salir** para cerrar sesión.

### 6.2 Registrar o actualizar el perfil de voz

1. En **Perfil Base de Voz**, verifica si el estado aparece como `Pendiente` o `Registrado`.
2. Pulsa **Iniciar grabación**.
3. Acepta el consentimiento y el permiso del micrófono.
4. Di claramente:

   > “Soy `[nombre completo]`, estudiante de UNINPAHU”.

5. La grabación debe durar aproximadamente 3 a 4 segundos y se detendrá automáticamente en el límite configurado.
6. Revisa el clip; también puedes pulsar **Detener grabación** antes del límite.
7. Pulsa **Grabar de nuevo** si necesitas reemplazar el clip.
8. Pulsa **Guardar Perfil de Voz**.

El clip no debe superar 4 MB.

### 6.3 Confirmar asistencia con voz y GPS

1. Abre **Sesiones Abiertas**.
2. Busca la asignatura y el grupo correspondiente.
3. Revisa el estado, docente, sede y radio autorizado.
4. Si la sesión está `PAUSADA`, espera a que el docente la reanude.
5. Pulsa **Confirmar Asistencia (Voz + GPS)**.
6. Acepta el consentimiento de ubicación.
7. Permite el acceso al GPS si el dispositivo lo solicita.
8. Espera a que aparezca la posición capturada y su precisión.
9. Escribe opcionalmente la frase verbal en **Frase verbal de confirmación**.
10. Pulsa **Iniciar grabación**.
11. Di “Presente” seguido de tu nombre completo.
12. Detén la grabación o espera a que finalice automáticamente.
13. Pulsa **Enviar Evidencia Voz + GPS**.

La grabación de confirmación tiene un máximo aproximado de 5 segundos.

### 6.4 Leer el resultado de validación

El panel **Resultado de Validación Voz + GPS** muestra:

- Distancia medida desde la geocerca.
- Radio autorizado.
- `Dentro de geocerca` o `Fuera de geocerca`.
- Porcentaje de similitud espectral.
- `Voz válida` o `Revisión docente`.
- Método espectral utilizado.

La evidencia sirve como apoyo para el registro del docente. Un resultado inválido puede requerir revisión manual.

### 6.5 Consultar historial y KPIs

En **KPIs e Historial de Asistencia** puedes:

- Filtrar por asignatura usando los botones horizontales.
- Seleccionar **Todas** para ver el historial completo.
- Revisar el porcentaje de **Asistencia Global**.
- Consultar el número de presentes.
- Consultar el número de tardanzas.
- Consultar el número de ausencias.

Los estados se muestran como:

- Verde: `PRESENTE`.
- Ámbar: `TARDE`.
- Rojo: `AUSENTE`.
- Púrpura: `EXCUSA`.

Si el porcentaje global cae por debajo del 80 %, la aplicación muestra una alerta académica.

### 6.6 Privacidad y derechos ARCO

En **Privacidad y Derechos ARCO (Ley 1581 de 2012)** encontrarás:

- **Ver Política Completa:** abre el aviso de privacidad y términos.
- **Revocar Autorización Biométrica:** abre el correo para solicitar el cambio al método manual docente.
- **Solicitar Eliminación de Cuenta:** abre el correo para solicitar cancelación y eliminación de datos.

La autorización biométrica es facultativa. Los usuarios pueden solicitar el método `MANUAL_DOCENTE`.

---

## 7. Sincronización sin conexión

Algunas operaciones de escritura pueden mantenerse pendientes cuando no hay conexión con el servidor.

Cuando existe una operación pendiente, aparece un banner con:

- Número de operaciones pendientes.
- Estado de sincronización.
- Botón **Sincronizar**.

Para completar la sincronización:

1. Recupera la conexión a Internet.
2. Pulsa **Sincronizar**.
3. Espera el resumen de operaciones enviadas y pendientes.

Las lecturas, grabaciones o operaciones que dependen directamente del backend pueden seguir requiriendo conexión.

---

## 8. Mensajes y estados comunes

| Mensaje o estado | Acción recomendada |
|---|---|
| Permiso de ubicación denegado | Activa la ubicación en los ajustes del dispositivo y vuelve a pulsar el botón de asistencia. |
| Permiso de micrófono denegado | Activa el micrófono en los ajustes del dispositivo y vuelve a iniciar la grabación. |
| Servicios de ubicación desactivados | Activa el GPS del dispositivo. |
| Sesión expirada | Inicia sesión nuevamente con correo y contraseña. |
| Sesión pausada | Espera a que el docente reanude la sesión. |
| Archivo demasiado grande | Reduce la fotografía o el clip por debajo de 3 MB o 4 MB según corresponda. |
| Sin conexión | Verifica Internet y usa el botón de sincronización si aparece una operación pendiente. |
| Archivo Excel con errores | Corrige las filas indicadas en el detalle y vuelve a subir el archivo. |

---

## 9. Contacto de apoyo

Para solicitar ayuda sobre cuentas, contraseñas, eliminación de datos o cambios en permisos institucionales, contacta a Bienestar Institucional UNINPAHU:

- Correo: `soporte@uninpahu.edu.co`
- Incluye tu nombre completo, número de documento y correo institucional.
