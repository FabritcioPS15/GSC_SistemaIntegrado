# Documentación del Módulo de Tickets

## 📋 Índice
- [Overview](#overview)
- [Arquitectura](#arquitectura)
- [Estructura de Archivos](#estructura-de-archivos)
- [Tipos y Datos](#tipos-y-datos)
- [Componentes de UI](#componentes-de-ui)
- [Hooks Personalizados](#hooks-personalizados)
- [Flujo de Trabajo](#flujo-de-trabajo)
- [Tiempo Real](#tiempo-real)
- [Automatización](#automatización)
- [SLA y Prioridades](#sla-y-prioridades)
- [Complejidad Técnica (N1/N2/N3)](#complejidad-técnica-n1n2n3)
- [Permisos y Roles](#permisos-y-roles)

---

## Overview

El módulo de tickets es un sistema completo de gestión de incidencias de soporte técnico que permite:
- Crear y gestionar tickets de soporte
- Priorizar los tickets según urgencia (P1–P4) y SLA
- Estimar automáticamente la complejidad técnica (N1–N3) de los tickets de Sistemas a partir del asunto
- Reclasificar y escalar el nivel durante la atención (N1 → N2 → N3) por parte de quien atiende
- Asignar técnicos a incidentes
- Chat en tiempo real entre solicitantes y técnicos
- Seguimiento de estado con automatización
- Reportes y exportación a PDF/Excel
- Historial de tickets archivados
- Notificaciones en tiempo real

---

## Arquitectura

```
src/modules/tickets/
├── tickets.types.ts           # Definiciones de tipos y constantes
├── pages/
│   ├── TicketsPage.tsx       # Dashboard principal con Kanban
│   ├── TicketDetailPage.tsx   # Vista detallada de un ticket
│   ├── TicketHistoryPage.tsx # Historial de tickets archivados
│   └── TicketForm.tsx        # Formulario de creación (en forms/)
├── components/
│   ├── TicketDetailModal.tsx # Modal compacto de detalle
│   ├── ComplexityBadge.tsx   # Badge del nivel de complejidad (N1/N2/N3)
│   └── SLATimer.tsx          # Cuenta regresiva del SLA
├── hooks/
│   ├── useTicketComments.ts  # Gestión de comentarios y datos
│   ├── useTicketRealtime.ts  # Suscripciones en tiempo real
│   └── useTicketNotifications.ts # Notificaciones push
└── forms/
    └── TicketForm.tsx        # Formulario de creación de tickets
```

---

## Estructura de Archivos

### 1. tickets.types.ts
Define todas las estructuras de datos del sistema:

**Tipos principales:**
- `TicketPriority`: Niveles de prioridad (critical, high, medium, low)
- `TicketStatus`: Estados del ciclo de vida (open, in_progress, resolved, closed, archived)
- `TicketCategory`: Categorías de tickets (sistemas, contable, legal, operaciones)
- `TicketComplexity`: Niveles de complejidad técnica (N1, N2, N3)

**Interfaces:**
- `Ticket`: Estructura principal de un ticket
- `TicketComment`: Comentarios del chat
- `TicketAssignment`: Asignaciones múltiples de usuarios
- `TicketFormData`: Datos del formulario de creación
- `SLAConfig`: Configuración de tiempos de respuesta

**Constantes:**
- `SLA_LIMITS`: Límites de tiempo por prioridad (4h, 8h, 24h, 72h)
- `PRIORITY_LABELS`: Etiquetas legibles para UI
- `STATUS_LABELS`: Etiquetas de estados para UI
- `COMPLEXITY_LEVELS`: Niveles de complejidad ordenados (N1, N2, N3)
- `COMPLEXITY_LABELS`: Etiquetas legibles de los niveles de complejidad
- `COMPLEXITY_DESCRIPTIONS`: Descripción del tipo de caso de cada nivel
- `COMPLEXITY_CASES`: Casos de referencia de cada nivel
- `DEFAULT_COMPLEXITY`: Nivel asignado cuando el asunto no aporta señales (N1)
- `COMPLEXITY_CATEGORY`: Única categoría a la que aplica la clasificación (sistemas)
- `FREQUENT_TECH_ISSUES`: Listado de problemas frecuentes de Sistemas (asunto, prioridad y complejidad curada)

**Funciones auxiliares:**
- `normalizeComplexity(value)`: Normaliza el valor persistido en BD y devuelve `null` si no está clasificado
- `isComplexityEscalation(from, to)`: Indica si el cambio es un escalamiento (N1 → N2/N3)
- `estimateComplexityFromTitle(title)`: Estima el nivel por palabras clave del asunto
- `resolveComplexityFromTitle(title, category)`: Resuelve el nivel (listado → palabras clave → provisional)
- `describeComplexityEstimate(estimate)`: Explica en lenguaje natural cómo se obtuvo el nivel

---

## Tipos y Datos

### Prioridades y SLA

| Prioridad | Etiqueta | SLA | Uso |
|-----------|----------|-----|-----|
| critical | P1 - Crítica | 4 horas | Problemas que afectan operaciones vitales |
| high | P2 - Alta | 8 horas | Problemas importantes en funcionalidad principal |
| medium | P3 - Media | 24 horas | Problemas con workaround disponible |
| low | P4 - Baja | 72 horas | Problemas menores sin impacto inmediato |

### Estados del Ticket

| Estado | Etiqueta | Descripción | Transición automática |
|--------|----------|-------------|----------------------|
| open | Pendiente | Ticket creado, espera atención | → in_progress (manual) |
| in_progress | En Proceso | Técnico asignado y trabajando | → resolved (manual) |
| resolved | Resuelto | Solución implementada | → closed (3 min) |
| closed | Cerrado | Validado por usuario | → archived (10 min) |
| archived | Archivado | Almacenado en historial | - |

---

## Componentes de UI

### 1. TicketsPage.tsx
**Dashboard principal del sistema de tickets**

**Funcionalidades:**
- Vista Kanban con columnas por estado
- Filtros por búsqueda, fecha y estado
- Pestañas: Dashboard, Mis Tickets, Reportes
- Drag & drop para cambiar estado de tickets
- Métricas en tiempo real (tasa de resolución, tiempo promedio)
- Distribución por nivel de complejidad (N1/N2/N3) y tabla por ticket con filtro por nivel del área de Sistemas
- Exportación a PDF y Excel
- Automatización de estados (resolved→closed→archived)

**Estado local relevante:**
- `startDate` / `endDate`: Rango de fechas del reporte
- `reportComplexity`: Filtro de complejidad del reporte (`''`, `N1`, `N2`, `N3` o `__none__`)
- `metricsData.complexityDistribution`: Conteo por nivel en el periodo
- `metricsData.unclassifiedComplexity`: Tickets de Sistemas sin clasificar
- `reportComplexityRows`: Filas de la tabla de detalle, ya filtradas

**Estado local:**
- `tickets`: Lista de todos los tickets
- `searchTerm`: Término de búsqueda
- `activeTab`: Pestaña activa
- `startDate/endDate`: Rango de fechas para reportes

**Funciones clave:**
- `fetchTickets()`: Carga tickets con relaciones
- `handleAutomation()`: Procesa cambios automáticos de estado
- `filteredTickets`: Filtra y categoriza tickets
- `metricsData`: Calcula métricas del periodo
- `generatePDF()` / `generateExcel()`: Exporta reportes

---

### 2. TicketDetailPage.tsx
**Vista detallada de un ticket individual**

**Funcionalidades:**
- Chat en tiempo real con editor de texto enriquecido
- Gestión de estado (atender, resolver, cerrar, finalizar)
- Clasificación de complejidad técnica (N1/N2/N3) con escalamiento durante la atención
- Panel de participantes y asignaciones
- Subida de imágenes con pegado desde portapapeles
- Detección de @menciones para notificaciones
- Reapertura de tickets cerrados
- Contacto por WhatsApp para prioridades altas
- Auto-asignación de técnicos
- Eliminación con limpieza de adjuntos

**Estado local:**
- `newComment`: Texto del comentario en edición
- `sending`: Indicador de envío
- `showEmojiPicker`: Visibilidad del selector de emojis
- `activeFormats`: Formatos activos del editor
- `mobileTab`: Pestaña activa en móvil

**Funciones clave:**
- `uploadFile()`: Sube imágenes al storage
- `handleCommentSubmit()`: Envía comentarios
- `htmlToMarkdown()`: Convierte HTML a Markdown
- `renderMarkdown()`: Renderiza Markdown a HTML seguro
- `addEmoji()`: Inserta emojis en el editor

---

### 3. TicketHistoryPage.tsx
**Historial de tickets archivados**

**Funcionalidades:**
- Lista de tickets con estado "archived"
- Filtros por búsqueda, prioridad, nivel de complejidad y rango de fechas
- Exportación a PDF y Excel del historial
- Cálculo de tiempo de resolución por ticket
- Refresco manual de datos

**Estado local:**
- `archivedTickets`: Lista de tickets archivados
- `searchTerm`: Término de búsqueda
- `filterPriority`: Filtro por prioridad
- `filterComplexity`: Filtro por nivel de complejidad
- `filterDateRange`: Rango de fechas predefinido
- `startDate/endDate`: Rango personalizado

**Funciones clave:**
- `fetchArchivedTickets()`: Carga tickets archivados
- `filteredTickets`: Filtra por múltiples criterios
- `getTimeToClose()`: Calcula tiempo de resolución
- `generateHistoryPDF()` / `generateHistoryExcel()`: Exporta

---

### 4. TicketForm.tsx
**Formulario de creación de nuevos tickets**

**Funcionalidades:**
- El asunto ocupa todo el ancho y va primero: determina el tipo de soporte
- Campos: asunto, descripción, prioridad, categoría, sede, AnyDesk
- El solicitante NO ve ni elige el nivel de complejidad: se resuelve sola por asunto
- Auto-sugerencia de problemas frecuentes (listado de Sistemas)
- Auto-asignación de sede del usuario
- Validación de campos obligatorios
- Guarda AnyDesk como comentario inicial
- Auto-asigna al creador via ticket_assignments
- Notifica a roles correspondientes

**Estado local:**
- `formData`: Datos del formulario
- `locations`: Lista de sedes disponibles
- `errors`: Errores de validación
- `showSuggestions`: Visibilidad de sugerencias
- `complexityEstimate`: Nivel resuelto en vivo (no se muestra, solo se persiste)

**Funciones clave:**
- `fetchLocations()`: Carga sedes desde DB
- `handleSelectIssue()`: Selecciona una sugerencia del listado
- `handleSubmit()`: Crea ticket con validación y persiste el nivel resuelto
- `handleChange()`: Maneja cambios en campos y muestra sugerencias

---

### 5. TicketDetailModal.tsx
**Modal compacto de detalle de ticket**

**Funcionalidades:**
- Vista compacta con pestañas (detalles/chat)
- Badge de prioridad y de complejidad (N1/N2/N3)
- Chat en tiempo real básico
- Gestión de estado del ticket
- Subida de imágenes
- Eliminación de ticket
- Diseñado para uso desde listas (no desde página completa)

**Estado local:**
- `currentTicket`: Datos del ticket actual
- `comments`: Lista de comentarios
- `newComment`: Texto en edición
- `activeTab`: Pestaña activa en móvil

**Funciones clave:**
- `uploadFile()`: Sube imágenes
- `handleSendComment()`: Envía comentarios
- `handleDeleteTicket()`: Elimina con permisos
- `handleStatusUpdate()`: Cambia estado

---

### 6. ComplexityBadge.tsx
**Badge visual del nivel de complejidad técnica**

**Funcionalidades:**
- Muestra `N1`, `N2`, `N3` o la etiqueta completa (`variant="full"`)
- Paleta propia del eje de complejidad (verde / azul / violeta)
- `title` con la descripción del nivel
- Renderiza "Sin clasificar" cuando el ticket aún no tiene nivel
- Ignora de forma segura valores nulos o no reconocidos

**Props:**
```typescript
{
  level?: string | null;   // Valor persistido en tickets.complexity_level
  variant?: 'code' | 'full';
  className?: string;
}
```

---

## Hooks Personalizados

### 1. useTicketComments.ts
**Gestiona datos y comentarios de un ticket**

**Responsabilidades:**
- Carga ticket completo con relaciones
- Busca ID de AnyDesk en comentarios
- Carga comentarios ordenados cronológicamente
- Agrega nuevos comentarios
- Auto-scroll al último comentario

**Retorna:**
```typescript
{
  ticket: any;              // Datos del ticket
  comments: any[];          // Lista de comentarios
  loading: boolean;         // Estado de carga
  commentsEndRef: RefObject; // Referencia para scroll
  fetchTicket: () => Promise<void>;   // Recargar ticket
  fetchComments: () => Promise<void>; // Recargar comentarios
  addComment: (content: string) => Promise<void>; // Agregar comentario
  scrollToBottom: () => void; // Scroll al final
}
```

**Funciones clave:**
- `fetchTicket()`: Carga ticket + AnyDesk de comentarios
- `fetchComments()`: Carga comentarios con autores
- `addComment()`: Inserta nuevo comentario
- `scrollToBottom()`: Auto-scroll suave

---

### 2. useTicketRealtime.ts
**Suscripciones en tiempo real con Supabase**

**Responsabilidades:**
- Escucha cambios en el ticket (estado, asignaciones)
- Escucha nuevos comentarios
- Rastrea presencia de usuarios online

**Retorna:**
```typescript
{
  onlineUsers: Set<string>;  // IDs de usuarios online
  isSubscribed: boolean;    // Estado de suscripción
}
```

**Suscripciones:**
1. **ticket-status-{id}**: Escucha UPDATE en tabla 'tickets'
2. **comments-feed-{id}**: Escucha INSERT en 'ticket_comments'
3. **presence-ticket-{id}**: Rastrea usuarios online

**Funciones clave:**
- Suscripción a cambios de ticket
- Suscripción a nuevos comentarios
- Sistema de presencia con Supabase Presence

---

### 3. useTicketNotifications.ts
**Notificaciones push para tickets**

**Responsabilidades:**
- Escucha asignaciones de tickets al usuario
- Escucha nuevos comentarios en tickets del usuario
- Escucha cambios de estado de tickets asignados
- Muestra notificaciones toast

**Funciones clave:**
- `notifyNewAssignment()`: Notifica nueva asignación
- `notifyNewComment()`: Notifica nuevo comentario
- `notifyStatusChange()`: Notifica cambio de estado

**Suscripciones:**
- UPDATE en 'tickets' donde assigned_to = user.id
- INSERT en 'ticket_comments' donde usuario participa

---

## Flujo de Trabajo

### 1. Creación de Ticket

```
Usuario → TicketForm.tsx
  ↓
Validación de campos
  ↓
Insert en tabla 'tickets' (status: 'open', complexity_level: N1/N2/N3 si category = 'sistemas')
  ↓
Insert en 'ticket_comments' (si hay AnyDesk)
  ↓
Insert en 'ticket_assignments' (auto-asignación creador)
  ↓
Notificación a roles correspondientes
  ↓
Redirección a TicketDetailPage.tsx
```

### 2. Gestión de Estado

```
Técnico → TicketDetailPage.tsx
  ↓
Clic en botón de estado (ej. "Atender")
  ↓
UPDATE en 'tickets' (status: 'in_progress', assigned_to: técnico)
  ↓
Insert en 'ticket_comments' (registro automático de cambio)
  ↓
Notificación en tiempo real a participantes
  ↓
Actualización de UI vía Supabase Realtime
```

### 3. Clasificación por Complejidad

```
Solicitante escribe el asunto (campo principal del formulario)
  ↓
resolveComplexityFromTitle(asunto, categoría)
  ├── fuera de Sistemas → null
  ├── asunto en FREQUENT_TECH_ISSUES (exacto o parcial) → complejidad curada
  └── asunto personalizado → estimateComplexityFromTitle(asunto)
  ↓
TicketForm: INSERT 'tickets' con complexity_level (silencioso, sin mostrarlo)
  ↓
Técnico → TicketDetailPage.tsx (sección "Complejidad Técnica")
  ↓
Clic en N1 / N2 / N3 (solo quien atiende, no el creador, no archivados)
  ↓
UPDATE en 'tickets' (complexity_level)
  ↓
Insert en 'ticket_comments' (**ESCALADO** o **CLASIFICADO**)
  ↓
Badge actualizado en dashboard, historial y modal
```

### 4. Chat en Tiempo Real

```
Usuario → TicketDetailPage.tsx
  ↓
Escribe comentario + envía
  ↓
INSERT en 'ticket_comments'
  ↓
Supabase Realtime detecta inserción
  ↓
useTicketRealtime dispara onCommentsUpdate
  ↓
useTicketComments recarga comentarios
  ↓
Auto-scroll al último mensaje
```

---

## Tiempo Real

### Supabase Realtime Channels

**Canal 1: ticket-status-{id}**
- Evento: UPDATE
- Tabla: tickets
- Filtro: id = ticket_id
- Callback: onTicketUpdate()

**Canal 2: comments-feed-{id}**
- Evento: INSERT
- Tabla: ticket_comments
- Filtro: ticket_id = ticket_id
- Callback: onCommentsUpdate()

**Canal 3: presence-ticket-{id}**
- Tipo: Presence
- Key: user.id
- Evento: sync
- Callback: Actualiza onlineUsers

### Flujo de Actualización

```
Cambio en DB → Supabase Realtime
  ↓
Payload recibido en cliente
  ↓
Callback ejecutado (onTicketUpdate/onCommentsUpdate)
  ↓
Recarga de datos (fetchTicket/fetchComments)
  ↓
Actualización de estado local
  ↓
Re-render de componente
```

---

## Automatización

### Cambios Automáticos de Estado

**Resuelto → Cerrado (3 minutos)**
```
useEffect en TicketsPage.tsx (cada 1 minuto)
  ↓
Busca tickets con status = 'resolved' y resolved_at > 3 min
  ↓
UPDATE status = 'closed', closed_at = NOW()
```

**Cerrado → Archivado (10 minutos)**
```
useEffect en TicketsPage.tsx (cada 1 minuto)
  ↓
Busca tickets con status = 'closed' y closed_at > 10 min
  ↓
UPDATE status = 'archived'
  ↓
DELETE archivos adjuntos del storage
```

### Limpieza de Storage

```
Tickets archivados → Limpieza de adjuntos
  ↓
List archivos en bucket 'chat-attachments/ticket_{id}'
  ↓
DELETE todos los archivos del ticket
  ↓
Libera espacio de storage
```

---

## SLA y Prioridades

### Cálculo de SLA

```typescript
// Límites de tiempo por prioridad
const SLA_LIMITS = {
  critical: { hours: 4, label: '4h' },
  high: { hours: 8, label: '8h' },
  medium: { hours: 24, label: '24h' },
  low: { hours: 72, label: '72h' }
};

// Tiempo restante = SLA - (NOW - created_at)
const timeRemaining = SLA_LIMITS[priority].hours - hoursElapsed;
```

### Alertas de SLA

- **Crítico**: Alerta si > 2 horas sin atención
- **Alto**: Alerta si > 4 horas sin atención
- **Medio**: Alerta si > 12 horas sin atención
- **Bajo**: Alerta si > 48 horas sin atención

---

## Complejidad Técnica (N1/N2/N3)

### Concepto

La prioridad y la complejidad son **ejes ortogonales**:

| Eje | Campo | Responde a | Efecto |
|-----|-------|------------|--------|
| Urgencia | `priority` | ¿Cuánto afecta ahora? | Define el SLA de respuesta (P1–P4) |
| Complejidad | `complexity_level` | ¿Qué tipo de soporte requiere? | Define el nivel de atención y si interviene un proveedor |

Un caso puede ser **urgente y simple** (P1 + N1: caída de un servicio de recepción con procedimiento conocido) o
**urgente y complejo** (P1 + N3: caída de un servidor que afecta a una sede completa).

### Alcance

La clasificación aplica **únicamente a `category = 'sistemas'`**. Las áreas contable, legal y operaciones
conservan su `complexity_level` en `NULL` porque el nivel de complejidad técnico no las describe.

### Niveles

| Nivel | Etiqueta | Descripción | Casos de referencia |
|-------|----------|-------------|---------------------|
| N1 | N1 - Soporte básico | Casos conocidos, repetitivos y con procedimiento definido. | Cambio de usuario, configuración básica, problemas con periféricos, problemas básicos de impresión, acceso básico a determinados recursos |
| N2 | N2 - Soporte técnico | Casos que requieren diagnóstico técnico e intervención remota o presencial. | Computadoras lentas, problemas de internet y conectividad, fallas de impresoras que requieren diagnóstico, instalación/configuración de impresoras, problemas de cámaras, fallas de biométricos, problemas de Check List, configuración de biométricos, problemas de acceso a sistemas |
| N3 | N3 - Soporte especializado | Casos que requieren intervención avanzada, infraestructura, administración de sistemas o participación de proveedores. | Intervención sobre servidores o infraestructura, administración avanzada de sistemas, modificaciones o intervenciones a nivel de sistemas, incidencias que requieren proveedor especializado, incidencias que afectan a una sede completa o a varios usuarios, fallas de servicios tecnológicos críticos |

### Estimación automática por asunto

El **solicitante nunca ve ni elige el nivel**. El formulario no muestra N1/N2/N3 en ningún momento:
el sistema resuelve la complejidad internamente a partir del asunto (título).

El asunto es, por eso, el campo principal del formulario: ocupa todo el ancho, va primero y lleva una
ayuda que indica que de él depende el tipo de soporte que se asignará.

```
Asunto escrito
  ↓
¿El área es "Sistemas"?
  ├── No → complexity_level = NULL (no se clasifica)
  └── Sí → ¿El asunto está en el listado de problemas frecuentes?
              ├── Sí → se usa la complejidad ya curada de ese caso
              └── No (asunto personalizado) → estimación por palabras clave
                      ↓
              sin señales → N1 provisional
  ↓
INSERT tickets.complexity_level
```

El listado de referencia es `FREQUENT_TECH_ISSUES` (6 casos curados de Sistemas). La coincidencia con el
listado acepta el asunto exacto o una versión recortada del mismo, de modo que el solicitante obtiene la
clasificación correcta aun sin seleccionar la sugerencia.

Si el asunto **no está en el listado** y es un caso personalizado, entra el motor de palabras clave:

- Las palabras **fuertes** (peso 2) describen señales inequívocas: `servidor`, `base de datos`, `virus`,
  `proveedor`, `todos los usuarios`, `contrasena`, `toner`, `no imprime`, `instalar`, etc.
- Las palabras de contexto (peso 1) suman apoyo: `impresora`, `internet`, `excel`, `camara`, `error`.
- En empate gana el **nivel más alto**: el técnico siempre puede bajar la clasificación, nunca tiene que
  adivinar que el caso era más complejo.
- Si el asunto no contiene ninguna señal, se asigna `N1` de forma provisional (`source: 'default'`).

Ejemplos:

| Asunto | Área | Nivel | Origen |
|--------|------|-------|--------|
| Impresora no enciende / no imprime | Sistemas | N2 | listado |
| olvide mi contraseña | Sistemas | N1 | listado (coincidencia parcial) |
| No hay tóner en la impresora | Sistemas | N1 | palabras clave (personalizado) |
| La computadora de la recepción está muy lenta | Sistemas | N2 | palabras clave (personalizado) |
| El servidor se cayó y afecta a toda la sede | Sistemas | N3 | palabras clave (personalizado) |
| Factura duplicada del cliente | Contable | — | sin complejidad |
| Hola buen día | Sistemas | N1 | provisional |

Durante la atención, `TicketDetailPage` vuelve a resolver la estimación desde el asunto persistido para
mostrar por qué se asignó ese nivel (`describeComplexityEstimate`).

### Visibilidad del nivel

| Momento | Quién ve el nivel | Qué puede hacer |
|---------|-------------------|-----------------|
| Creación del ticket | Nadie. Ni un badge, ni un texto, ni un selector. | — |
| Detalle del ticket | Todos | Solo lectura del nivel y de su razón |
| Detalle del ticket | Quien puede atender y no es el creador | Reclasificar N1 / N2 / N3 por diagnóstico |
| Dashboard, historial y modal | Todos | Solo lectura (badge) |

### Ticket previos (migración aplicada)

La migración **no modifica ninguna fila existente**:

- La columna se agrega como `NULL` y sin valor por defecto.
- No hay `UPDATE` ni backfill: los tickets anteriores quedan exactamente como estaban.
- Los tickets de Sistemas previos se muestran como **"Sin clasificar"** hasta que un técnico los clasifique.
- Los tickets de otras áreas siempre muestran `—` (no aplican).

### Estado pendiente de la migración

Mientras `20261001000001_add_complexity_level_to_tickets.sql` no esté aplicada en el proyecto, la aplicación
degrada sin romperse:

- El insert del ticket **no** incluye `complexity_level`; la clasificación se aplica después como
  actualización de mejor esfuerzo, cuyo error se ignora.
- Las lecturas usan `select('*')` en lugar de una lista explícita de columnas, para que una columna
  ausente no invalide la consulta completa del dashboard.

Si ves el error `Could not find the 'complexity_level' column of 'tickets' in the schema cache`, aplica la
migración. Si el error persiste después de aplicarla, ejecuta `NOTIFY pgrst, 'reload schema';` para
recargar el cache de PostgREST.

### Escalamiento

La clasificación parte de la estimación automática y **puede escalarse durante la atención**
de N1 a N2 o N3 cuando el diagnóstico revele que se requiere una intervención de mayor nivel.

```
Ticket creado (nivel estimado por el asunto)
  ↓
El técnico atiende y diagnostica
  ↓
¿Requiere mayor nivel de intervención?
  ├── No → se mantiene el nivel
  └── Sí → TicketDetailPage: botones N1 / N2 / N3
              ↓
          UPDATE tickets SET complexity_level = 'N2'
              ↓
          INSERT ticket_comments (**ESCALADO**: ... N1 → N2)
              ↓
          Registros de Sistema en el feed + badge actualizado en el dashboard
```

Detalles de la implementación:

- Solo quien puede atender el ticket (rol con `canManageStatus` **y** que no sea el creador) reclasifica.
- No se permite reclasificar tickets archivados.
- Cada cambio queda auditado en `ticket_comments` con los prefijos `**ESCALADO**` (subida de nivel) o
  `**CLASIFICADO**` (reevaluación), que el chat renderiza como "Registro de Sistema".
- La columna es `NULL` cuando el ticket aún no fue clasificado; la UI muestra "Sin clasificar".

### Persistencia

```sql
-- Migración: 20261001000001_add_complexity_level_to_tickets.sql
ALTER TABLE tickets ADD COLUMN complexity_level text;

ALTER TABLE tickets ADD CONSTRAINT tickets_complexity_level_check
    CHECK (complexity_level IS NULL OR complexity_level IN ('N1', 'N2', 'N3'));

CREATE INDEX idx_tickets_complexity_level ON tickets (complexity_level);
CREATE INDEX idx_tickets_category_complexity_level ON tickets (category, complexity_level);
```

Se persisten los códigos (`'N1'`, `'N2'`, `'N3'`) como texto, igual que `status` y `priority`.

### Paleta visual

La complejidad usa una paleta propia para no confundirse con la escala de prioridad:

| Nivel | Color | Uso |
|-------|-------|-----|
| N1 | Verde (`emerald`) | Soporte básico |
| N2 | Azul (`sky`) | Soporte técnico |
| N3 | Violeta (`violet`) | Soporte especializado |

### Visualización

| Superficie | Comportamiento |
|------------|----------------|
| `TicketForm.tsx` | El asunto ocupa todo el ancho con una ayuda que explica que define el tipo de soporte. Ninguna referencia a N1/N2/N3. El nivel se resuelve y persiste en silencio |
| `TicketDetailPage.tsx` | Sección compacta: badge del nivel + combo "Cambiar nivel" (solo quien atiende). El detalle (descripción, casos de referencia y razón de la estimación) queda oculto tras "Mostrar más información" |
| `TicketsPage.tsx` | Badge en las tarjetas Kanban, columna "Complejidad" en las tablas, panel de distribución + tabla por ticket con filtro por nivel en Reportes, y columna en PDF/Excel |
| `TicketHistoryPage.tsx` | Badge en móvil y escritorio, filtro por nivel y columna en PDF/Excel |
| `TicketDetailModal.tsx` | Badge junto a la prioridad en el encabezado |

La sección de complejidad del detalle es deliberadamente escueta: la acción (el combo "Cambiar nivel") está
siempre visible y todo el texto explicativo se colapsa en el desplegable `showComplexityInfo`, para no
distraer durante la atención.

### Reportes por nivel

La pestaña **Reportes** incluye dos bloques sobre complejidad, ambos restringidos al área de Sistemas:

1. **Distribución por Nivel de Complejidad**: tres tarjetas con el volumen de N1, N2 y N3 del periodo,
   más un aviso con los tickets aún sin clasificar.
2. **Detalle por Nivel de Complejidad**: tabla con los tickets del periodo y su nivel (ID, incidente,
   complejidad, prioridad, estado, atendido por, fecha). Filas navegables al detalle.

El segundo bloque tiene un filtro por nivel: `Todos`, `N1`, `N2`, `N3` y `Sin clasificar`
(`reportComplexity`). Al elegir un nivel, las áreas distintas de Sistemas quedan fuera del reporte porque
no manejan complejidad.

### Descargas (PDF / Excel)

Ambas descargas usan el mismo alcance que la tabla en pantalla (`reportFilteredTickets`): rango de fechas
+ filtro de complejidad. Lo que ves en pantalla es lo que se descarga.

**PDF** (`generatePDF`):
- Encabezado con rango de fechas y el nivel filtrado (`Nivel de Complejidad: ...`).
- Métricas del periodo y **Distribución por Nivel de Complejidad** calculada sobre las filas exportadas,
  para que cuadre con la tabla.
- Tabla `ID | Incidente | Estado | Prioridad | Complejidad | Fecha` con los primeros 100 tickets; si hay
  más, deja un aviso en el documento indique cuántos son.
- Posiciones verticales calculadas a partir del bloque anterior, para que el contenido no se solape.

**Excel** (`generateExcel`), tres hojas:
1. `Filtros` — rango, filtro de complejidad, tickets en el reporte y tickets de Sistemas.
2. `Tickets` — una fila por ticket, incluyendo `Área`, `Complejidad`, `Solicitante`, `Ubicación`, `Atendido Por`
   y fechas de creación/cierre.
3. `Resumen Complejidad` — conteo y porcentaje por N1/N2/N3 más `Sin clasificar`.

**Helper de fechas** (`parseTicketDate`): las fechas guardadas como texto simple (`2026-05-04`) se parsean
al mediodía para no mostrar el día anterior por desfase de zona horaria. Aplica a la tabla, al PDF y al Excel.

**Helper de etiqueta** (`complexityReportLabel`): Sistemas sin nivel → `Sin clasificar`; otras áreas → `N/A`.

---

## Permisos y Roles

### Roles del Sistema

| Rol | Permisos en Tickets |
|-----|---------------------|
| super_admin | Todo (crear, editar, eliminar, asignar) |
| sistemas | Todo (crear, editar, eliminar, asignar) |
| gerencia | Ver, asignar, cambiar estado |
| supervisores | Ver, asignar, cambiar estado |
| administradores | Ver, crear, cambiar estado propio |
| personalizado | Ver, crear tickets propios |

### Reglas de Eliminación

**Puede eliminar ticket si:**
- Es staff (super_admin, sistemas, gerencia, supervisores)
- Es creador y han pasado ≤ 3 minutos desde creación

**Proceso de eliminación:**
1. Verificar permisos
2. Confirmación del usuario
3. Limpiar archivos adjuntos del storage
4. DELETE en tabla 'tickets'
5. Notificar a participantes

---

## Exportación de Datos

### PDF (generatePDF)

**Incluye:**
- N°, ID del ticket
- Título del incidente
- Solicitante y técnico asignado
- Ubicación y prioridad
- Fechas de creación y cierre
- Tiempo de resolución

**Utilidad:** `src/shared/utils/exportUtils.ts`

### Excel (generateExcel)

**Incluye:**
- Todo lo del PDF +
- Descripción completa
- Todas las fechas en formato local
- Más columnas de detalle

**Utilidad:** `src/shared/utils/exportUtils.ts`

---

## Buenas Prácticas

### Para Desarrolladores

1. **Usar los hooks personalizados:**
   - `useTicketComments` para datos del ticket
   - `useTicketRealtime` para tiempo real
   - `useTicketNotifications` para notificaciones

2. **Mantener comentarios actualizados:**
   - Cada función debe tener un comentario explicativo
   - Documentar lógica de negocio compleja
   - Explicar por qué se toman ciertas decisiones

3. **Manejo de errores:**
   - Siempre usar try-catch en operaciones async
   - Mostrar notificaciones al usuario
   - Loggear errores en consola

4. **Tiempo real:**
   - Limpiar suscripciones al desmontar
   - Usar filtros específicos en canales
   - Evitar suscripciones duplicadas

### Para Usuarios

1. **Crear tickets:**
   - Usar títulos descriptivos: el asunto determina el nivel de complejidad
   - Incluir detalles del problema
   - Proporcionar ID de AnyDesk si aplica
   - Seleccionar prioridad adecuada

2. **Gestión de tickets:**
   - Atender tickets críticos primero
   - Actualizar estado al progresar
   - Documentar soluciones en comentarios
   - Cerrar tickets cuando estén resueltos
   - Reclasificar la complejidad (N1 → N2 → N3) si el diagnóstico exige mayor nivel

---

## Troubleshooting

### Problema: El chat no se actualiza en tiempo real

**Solución:**
1. Verificar que Supabase Realtime esté habilitado
2. Revisar que el usuario tenga permisos de lectura
3. Comprobar que el canal tenga el filtro correcto
4. Verificar que el callback se esté ejecutando

### Problema: Los estados no cambian automáticamente

**Solución:**
1. Verificar que el useEffect de automatización esté activo
2. Comprobar que los timestamps sean correctos
3. Revisar logs de consola para errores
4. Verificar permisos de escritura en DB

### Problema: Las notificaciones no llegan

**Solución:**
1. Verificar permisos de notificación del navegador
2. Comprobar que el usuario esté suscrito al canal correcto
3. Revisar que el filtro de usuario sea correcto
4. Verificar configuración de Supabase Realtime

---

## Futuras Mejoras

- [ ] Dashboard de métricas avanzadas
- [ ] Reportes personalizados
- [ ] Integración con WhatsApp Business
- [ ] Sistema de encuestas de satisfacción
- [ ] Plantillas de respuestas predefinidas
- [ ] Análisis de tendencias de incidentes
- [ ] Integración con sistemas externos (Jira, ServiceNow)
- [ ] Móvil nativo (React Native)
- [ ] Chat con voz y video
- [ ] Sistema de conocimiento base (KB)

---

## Contacto

Para preguntas o sugerencias sobre el módulo de tickets, contactar al equipo de desarrollo.

**Última actualización:** Julio 2026
**Versión:** 1.0.0
