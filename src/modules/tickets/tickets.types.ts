// Niveles de prioridad de los tickets
// critical: P1 - Problemas críticos que afectan operaciones vitales
// high: P2 - Problemas importantes que afectan funcionalidad principal
// medium: P3 - Problemas moderados con workaround disponible 
// low: P4 - Problemas menores sin impacto inmediato 
export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';
// Estados del ciclo de vida de un ticket
// open: Pendiente - Ticket creado y esperando atención
// in_progress: En Proceso - Técnico asignado y trabajando en el ticket
// resolved: Resuelto - Solución implementada, espera validación del usuario (3 min → closed)
// closed: Cerrado - Ticket validado y finalizado (10 min → archived)
// archived: Archivado - Ticket almacenado en historial para referencia futura
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'archived';
// Categorías de tickets para clasificación y routing
// sistemas: Problemas de tecnología, software, hardware, redes
// contable: Problemas de facturación, pagos, contabilidad
// legal: Problemas legales, contratos, documentación
// operaciones: Problemas operativos, logística, procesos
export type TicketCategory = 'sistemas' | 'contable' | 'legal' | 'operaciones';
// Niveles de complejidad técnica del caso (solo para category = 'sistemas')
// Complementa a `priority`: la prioridad mide urgencia/SLA, la complejidad el tipo
// de soporte requerido. Un caso puede ser urgente (P1) y simple (N1).
// N1 - Soporte básico: casos conocidos, repetitivos y con procedimiento definido
// N2 - Soporte técnico: requieren diagnóstico técnico e intervención remota o presencial
// N3 - Soporte especializado: intervención avanzada, infraestructura,
//      administración de sistemas o participación de proveedores
export type TicketComplexity = 'N1' | 'N2' | 'N3';

// Niveles de complejidad en orden ascendente de esfuerzo técnico
// Útil para iterar selectores y para validar que el escalamiento sea progresivo
export const COMPLEXITY_LEVELS: TicketComplexity[] = ['N1', 'N2', 'N3'];

// Nivel asignado por defecto cuando el solicitante no indica la complejidad
// y el técnico aún no ha refinado la clasificación durante la atención
export const DEFAULT_COMPLEXITY: TicketComplexity = 'N1';

// Categoría a la que aplica la clasificación por complejidad
export const COMPLEXITY_CATEGORY: TicketCategory = 'sistemas';

// Etiquetas legibles de los niveles de complejidad
export const COMPLEXITY_LABELS: Record<TicketComplexity, string> = {
  N1: 'N1 - Soporte básico',
  N2: 'N2 - Soporte técnico',
  N3: 'N3 - Soporte especializado',
};

// Descripción del tipo de caso que corresponde a cada nivel
export const COMPLEXITY_DESCRIPTIONS: Record<TicketComplexity, string> = {
  N1: 'Casos conocidos, repetitivos y con procedimiento definido.',
  N2: 'Casos que requieren diagnóstico técnico e intervención remota o presencial.',
  N3: 'Casos que requieren intervención avanzada, infraestructura, administración de sistemas o participación de proveedores.',
};

// Casos de referencia de cada nivel
// Se muestran como ayuda en el formulario y como referencia en el detalle del ticket
export const COMPLEXITY_CASES: Record<TicketComplexity, string[]> = {
  N1: [
    'Cambio de usuario',
    'Configuración básica',
    'Problemas con periféricos',
    'Problemas básicos de impresión',
    'Acceso básico a determinados recursos',
  ],
  N2: [
    'Computadoras lentas',
    'Problemas de internet y conectividad',
    'Fallas de impresoras que requieren diagnóstico',
    'Instalación / configuración de impresoras',
    'Problemas de cámaras',
    'Fallas de biométricos',
    'Problemas de Check List',
    'Configuración de biométricos',
    'Problemas de acceso a sistemas',
  ],
  N3: [
    'Intervención sobre servidores o infraestructura',
    'Administración avanzada de sistemas',
    'Modificaciones o intervenciones a nivel de sistemas',
    'Incidencias que requieren proveedor especializado',
    'Incidencias que afectan a una sede completa o a varios usuarios',
    'Fallas de servicios tecnológicos críticos',
  ],
};

// Normaliza el valor persistido en base de datos a un nivel válido
// Devuelve null cuando el ticket no está clasificado o el valor no es reconocido
export function normalizeComplexity(value?: string | null): TicketComplexity | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return COMPLEXITY_LEVELS.includes(normalized as TicketComplexity)
    ? (normalized as TicketComplexity)
    : null;
}

// Indica si un nivel representa mayor complejidad que otro
// Se usa para etiquetar los cambios como "escalamiento" y no como "reevaluación"
export function isComplexityEscalation(
  from?: string | null,
  to?: string | null
): boolean {
  const current = normalizeComplexity(from);
  const next = normalizeComplexity(to);
  if (!next) return false;
  if (!current) return false;
  return COMPLEXITY_LEVELS.indexOf(next) > COMPLEXITY_LEVELS.indexOf(current);
}

// =============================================================================
// CATÁLOGO DE PROBLEMAS FRECUENTES DEL ÁREA DE SISTEMAS
// Es el "listado" de referencia: si el asunto coincide con uno de estos casos se
// usa su complejidad ya curada; si el asunto es personalizado se estima por
// palabras clave. Vive aquí para que el formulario y el detalle resuelvan igual.
// =============================================================================

export type FrequentTechIssue = {
  title: string;
  priority: TicketPriority;
  complexity: TicketComplexity;
  description: string;
};

export const FREQUENT_TECH_ISSUES: FrequentTechIssue[] = [
  { title: 'Impresora no enciende / no imprime', priority: 'critical', complexity: 'N2', description: 'La impresora de la sede no responde a los comandos de impresión o está apagada.' },
  { title: 'Olvidé mi contraseña de acceso del MTC / Correo', priority: 'high', complexity: 'N1', description: 'Requiero un reset de contraseña para ingresar al sistema.' },
  { title: 'Sistema ERP está lento o se cierra', priority: 'high', complexity: 'N2', description: 'El sistema principal presenta lentitud extrema o cierres inesperados.' },
  { title: 'Sin conexión a Internet en recepción', priority: 'critical', complexity: 'N2', description: 'Toda el área de recepción está sin conexión a red.' },
  { title: 'Falla en cámara de seguridad', priority: 'medium', complexity: 'N2', description: 'Una de las cámaras no muestra imagen en el monitor.' },
  { title: 'Configuración de correo corporativo', priority: 'low', complexity: 'N1', description: 'Solicito apoyo para configurar mi firma o bandeja de entrada.' },
];

// =============================================================================
// ESTIMACIÓN AUTOMÁTICA DE COMPLEJIDAD A PARTIR DEL ASUNTO
// El solicitante nunca elige el nivel: se calcula por palabras clave del título
// para que el técnico no reciba casos subclasificados de entrada.
// =============================================================================

// Normaliza texto para comparar sin acentos, mayúsculas ni puntuación
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Un patrón de detección: la palabra buscada y su peso en la puntuación
// Las palabras "fuertes" describen una señal inequívoca del nivel (peso 2)
type ComplexityPattern = { keyword: string; weight: number; test: RegExp };

// Convierte la lista de palabras de un nivel en patrones precompilados
// Las frases de varias palabras se buscan como substring; las palabras
// sueltas se buscan con límites para evitar coincidencias parciales
function buildPatterns(entries: Array<[string, number]>): ComplexityPattern[] {
  return entries.map(([keyword, weight]) => {
    const normalized = normalizeText(keyword);
    return {
      keyword,
      weight,
      test: normalized.includes(' ')
        ? new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        : new RegExp(`\\b${normalized}\\b`),
    };
  });
}

// Palabras clave por nivel derivadas de COMPLEXITY_CASES
const COMPLEXITY_KEYWORDS: Record<TicketComplexity, ComplexityPattern[]> = {
  N1: buildPatterns([
    // Credenciales y accesos de primer nivel
    ['contrasena', 2], ['password', 2], ['credencial', 2], ['pin', 2],
    ['olvide la clave', 2], ['olvide mi contrasena', 2], ['perdi mi clave', 2],
    ['restablecer contrasena', 2], ['reset de contrasena', 2], ['cambiar contrasena', 2],
    // Altas y bajas de usuario
    ['nuevo usuario', 2], ['alta de usuario', 2], ['crear usuario', 2], ['usuario nuevo', 2],
    ['baja de usuario', 2], ['activar usuario', 2], ['desactivar usuario', 2],
    ['cambio de usuario', 2], ['cambiar de usuario', 2], ['dar de alta', 2],
    // Consumibles y peripherals
    ['toner', 2], ['tinta', 2], ['cartucho', 2], ['consumible', 2],
    ['periferico', 1], ['teclado', 1], ['mouse', 1], ['auricular', 1], ['audifono', 1],
    ['firma de correo', 2], ['firma de correo electronico', 2],
    ['acceso basico', 1], ['acceso a carpeta', 1], ['carpeta compartida', 1], ['permisos', 1],
    // Consultas de uso
    ['no se como', 1], ['como puedo', 1], ['como se hace', 1], ['duda de como', 1],
    ['no encuentro la opcion', 1], ['no encuentro el boton', 1], ['ayuda para usar', 1],
    ['capacitacion', 1], ['entrenamiento', 1],
  ]),
  N2: buildPatterns([
    // Conectividad
    ['internet', 1], ['wifi', 1], ['wi fi', 1], ['inalambrica', 1], ['inalambrico', 1],
    ['conexion', 1], ['conectividad', 1], ['red no funciona', 2], ['sin conexion', 2],
    ['no me puedo conectar', 2], ['no puedo conectarme', 2], ['se cae la conexion', 2],
    ['navegador', 1], ['chrome', 1], ['safari', 1], ['edge', 1],
    // Rendimiento
    ['lenta', 2], ['lento', 2], ['lentitud', 2], ['va lento', 2], ['rendimiento', 1],
    ['se traba', 2], ['se cuelga', 2], ['se cuelgan', 2], ['se cierra solo', 2],
    ['se cierra', 1], ['demora mucho', 2],
    // Impresoras
    ['impresora', 1], ['impresor', 1], ['escaner', 1], ['multifuncional', 1],
    ['imprimir', 1], ['no imprime', 2], ['atasco', 1], ['papel atascado', 2],
    // Periféricos con diagnóstico
    ['camara', 1], ['webcam', 1], ['microfono', 1], ['audio', 1], ['no se escucha', 2],
    ['sonido', 1], ['altavoz', 1],
    // Biometría y control de acceso
    ['biometrico', 1], ['biometrica', 1], ['huella', 1], ['lector de huella', 2],
    ['reloj de asistencia', 2], ['control de asistencia', 2], ['control de acceso', 1],
    ['check list', 1], ['checklist', 1],
    // Office
    ['excel', 1], ['word', 1], ['powerpoint', 1], ['outlook', 1], ['correo', 1],
    ['correo electronico', 1], ['email', 1], ['office', 1], ['microsoft 365', 1],
    ['no abre', 1],
    // Soporte remoto e instalaciones
    ['anydesk', 1], ['acceso remoto', 1], ['escritorio remoto', 1], ['teamviewer', 1],
    ['instalar', 2], ['instalacion', 2], ['configurar', 2], ['configuracion', 2],
    ['archivo no abre', 2], ['no abre documento', 2], ['documento corrupto', 2],
    ['archivo corrupto', 2], ['no puedo abrir el archivo', 2],
    // Fallos genéricos
    ['error', 2], ['mensaje de error', 2], ['falla', 1], ['fallo', 1],
    ['no funciona', 2], ['no me funciona', 2], ['problema con', 1], ['problemas con', 1],
  ]),
  N3: buildPatterns([
    // Infraestructura
    ['servidor', 2], ['server', 2], ['data center', 2], ['datacenter', 2],
    ['infraestructura', 2], ['infraestructura de red', 2], ['red estructurada', 2],
    ['cableado', 2], ['cablingado', 2], ['fibra troncal', 2], ['backbone', 2],
    ['firewall', 2], ['switch', 2], ['router', 1], ['core del switch', 2],
    ['puerta de enlace', 2], ['gateway', 2],
    // Datos y dominio
    ['base de datos', 2], ['sql server', 2], ['postgres', 2], ['mysql', 2], ['oracle', 1],
    ['backup', 2], ['respaldo', 2], ['restauracion de respaldo', 2],
    ['dominio', 2], ['active directory', 2], ['administrador de dominio', 2],
    ['politica de grupo', 2],
    // Hardware de reemplazo
    ['hardware', 2], ['placa madre', 2], ['motherboard', 2], ['disco duro', 2], ['ssd', 2],
    ['fuente de poder', 2], ['memoria ram', 2], ['procesador', 1], ['tarjeta grafica', 2],
    ['bateria de laptop', 2], ['cambio de hardware', 2],
    // Seguridad
    ['virus', 2], ['malware', 2], ['ransomware', 2], ['hackeo', 2], ['hackear', 2],
    ['intruso', 2], ['suplantacion', 2], ['phishing', 2], ['robo de contrasena', 2],
    ['perdida de informacion', 2], ['perdi informacion', 2], ['informacion perdida', 2],
    ['no encuentro mi archivo', 2], ['borraron', 2], ['eliminado sin querer', 2],
    ['formateo sin querer', 2], ['perdi todo', 2],
    // Proyectos e intermediarios
    ['proveedor', 2], ['outsource', 2], ['tercero', 1], ['garantia', 1],
    ['migracion', 2], ['migrar', 2], ['traspaso de sistema', 2], ['cambio de sistema', 2],
    ['renovacion de equipos', 2], ['compra de equipos', 2],
    // Videovigilancia a nivel centralizado
    ['dvr', 2], ['nvr', 2], ['grabador', 2], ['central de camaras', 2],
    ['sistema de videovigilancia', 2],
    // Caídas generales de plataforma
    ['erp no abre', 2], ['erp caido', 2], ['erp no inicia', 2], ['erp se cae', 2],
    ['sistema no abre', 2], ['sistema caido', 2], ['no puedo trabajar', 2],
    ['bloqueo total', 2], ['se cayo todo', 2], ['caida general', 2],
    ['actualizacion mayor', 2], ['upgrade de version', 2], ['actualizar sistema operativo', 2],
    // Impacto colectivo
    ['afecta a todos', 2], ['afecta a toda la sede', 2], ['sede completa', 2],
    ['toda la sede', 2], ['sucursal completa', 2], ['todos los usuarios', 2],
    ['varios usuarios', 1], ['toda la empresa', 2], ['toda la compania', 2],
    ['todas las sedes', 2],
  ]),
};

// Resultado de la estimación automática por asunto
export interface ComplexityEstimate {
  level: TicketComplexity | null; // Nivel estimado (null si no aplica o el asunto está vacío)
  matchedKeywords: string[]; // Palabras clave que sustentan la estimación
  source: 'catalog' | 'keywords' | 'default' | 'empty' | 'not-applicable';
}

// Estima la complejidad técnica a partir del asunto o título del ticket
// Regla: puntúa cada nivel con las palabras clave detectadas y gana el de mayor
// puntaje. En empate gana el nivel más alto, para que el técnico всегда pueda
// bajar la clasificación y nunca tenga que adivinar que era más complejo
export function estimateComplexityFromTitle(title?: string | null): ComplexityEstimate {
  const normalized = normalizeText(title || '');

  if (!normalized) {
    return { level: null, matchedKeywords: [], source: 'empty' };
  }

  let bestLevel: TicketComplexity = DEFAULT_COMPLEXITY;
  let bestScore = 0;
  let bestMatches: string[] = [];

  COMPLEXITY_LEVELS.forEach((level) => {
    let score = 0;
    const matches: string[] = [];

    COMPLEXITY_KEYWORDS[level].forEach((pattern) => {
      if (pattern.test.test(normalized)) {
        score += pattern.weight;
        matches.push(pattern.keyword);
      }
    });

    // COMPLEXITY_LEVELS viene en orden ascendente, así que un empate
    // conserva el nivel superior (N3 sobre N2, N2 sobre N1)
    if (score >= bestScore && score > 0) {
      bestLevel = level;
      bestScore = score;
      bestMatches = matches;
    }
  });

  if (bestScore === 0) {
    return { level: DEFAULT_COMPLEXITY, matchedKeywords: [], source: 'default' };
  }

  return { level: bestLevel, matchedKeywords: bestMatches, source: 'keywords' };
}

// Busca el asunto dentro del catálogo de problemas frecuentes
// Acepta coincidencia exacta o parcial (el usuario puede escribir una versión
// recortada del caso sin llegar a seleccionarlo de las sugerencias)
function findCatalogMatch(title: string): FrequentTechIssue | null {
  const normalized = normalizeText(title);

  const exact = FREQUENT_TECH_ISSUES.find((issue) => normalizeText(issue.title) === normalized);
  if (exact) return exact;

  return (
    FREQUENT_TECH_ISSUES.find((issue) => {
      const candidate = normalizeText(issue.title);
      // Se exige una longitud mínima para no casar coincidencias demasiado vagas
      if (normalized.length < 8 || candidate.length < 8) return false;
      return normalized.includes(candidate) || candidate.includes(normalized);
    }) || null
  );
}

// Resuelve la complejidad de un ticket a partir de su asunto y categoría
// Prioridad de resolución:
//   1. Categoría distinta de Sistemas → sin complejidad (null)
//   2. Asunto presente en el listado de problemas frecuentes → complejidad curada
//   3. Asunto personalizado → estimación por palabras clave
export function resolveComplexityFromTitle(
  title?: string | null,
  category?: string | null
): ComplexityEstimate {
  if (category !== COMPLEXITY_CATEGORY) {
    return { level: null, matchedKeywords: [], source: 'not-applicable' };
  }

  if (!normalizeText(title || '')) {
    return { level: null, matchedKeywords: [], source: 'empty' };
  }

  const catalogMatch = findCatalogMatch(title || '');
  if (catalogMatch) {
    return { level: catalogMatch.complexity, matchedKeywords: [catalogMatch.title], source: 'catalog' };
  }

  return estimateComplexityFromTitle(title);
}

// Explica en lenguaje natural cómo se obtuvo el nivel estimado
// Se muestra como texto informativo en el detalle del ticket
export function describeComplexityEstimate(estimate: ComplexityEstimate): string {
  if (estimate.source === 'empty') {
    return 'El nivel se define a partir del asunto del ticket.';
  }

  if (estimate.source === 'not-applicable') {
    return 'El área solicitada no maneja niveles de complejidad técnica.';
  }

  if (estimate.source === 'catalog') {
    return 'Nivel tomado del catálogo de problemas frecuentes del área de Sistemas.';
  }

  if (estimate.source === 'default') {
    return `El asunto no contiene señales de complejidad, por lo que se asigna ${DEFAULT_COMPLEXITY} de forma provisional.`;
  }

  return `Nivel estimado a partir del asunto (${estimate.matchedKeywords.join(', ')}).`;
}

// Información básica de un usuario relacionado con un ticket
// Se usa para solicitante (requester) y técnico asignado (attendant)
export interface TicketUser {
  full_name: string; // Nombre completo del usuario
  avatar_url?: string; // URL de la foto de perfil (opcional)
}

// Información de la ubicación/sede donde ocurrió el incidente
export interface TicketLocation {
  name: string; // Nombre de la sede (ej. "Sede Central", "Sucursal Norte")
}

// Estructura principal de un ticket de soporte
// Contiene toda la información del incidente y su estado actual
export interface Ticket {
  id: string; // ID único del ticket (UUID)
  title: string; // Título breve del incidente
  description?: string; // Descripción detallada del problema
  status: TicketStatus; // Estado actual del ticket
  priority: TicketPriority; // Nivel de prioridad para SLA
  category?: TicketCategory; // Categoría para routing
  complexity_level?: TicketComplexity; // Nivel de complejidad técnica (solo category = 'sistemas')
  location_id?: string; // ID de la sede donde ocurrió
  requester_id?: string; // ID del usuario que creó el ticket
  assigned_to?: string; // ID del técnico asignado (técnico principal)
  created_at: string; // Timestamp de creación del ticket
  updated_at: string; // Timestamp de última actualización
  attended_at?: string; // Timestamp de primera atención (cuando pasa a in_progress)
  resolved_at?: string; // Timestamp cuando se marca como resuelto
  closed_at?: string; // Timestamp cuando se cierra el ticket
  requester?: TicketUser; // Datos del solicitante (relación)
  attendant?: TicketUser; // Datos del técnico asignado (relación)
  locations?: TicketLocation; // Datos de la ubicación (relación)
}

// Comentario o mensaje en el chat de un ticket
// Soporta texto plano, markdown básico y referencias a imágenes
export interface TicketComment {
  id: string; // ID único del comentario
  ticket_id: string; // ID del ticket al que pertenece
  user_id: string; // ID del usuario que escribió el comentario
  content: string; // Contenido del mensaje (puede incluir markdown)
  created_at: string; // Timestamp de creación del comentario
  author?: TicketUser; // Datos del autor (relación)
}

// Asignación de un usuario a un ticket
// Permite multi-colaboración (máximo 4 personas por ticket)
// Diferente de assigned_to: este es para colaboradores adicionales
export interface TicketAssignment {
  id: string; // ID único de la asignación
  ticket_id: string; // ID del ticket asignado
  user_id: string; // ID del usuario asignado
  assigned_at: string; // Timestamp de la asignación
}

// Datos del formulario para crear un nuevo ticket
// Validados antes de insertar en la base de datos
export interface TicketFormData {
  title: string; // Título del incidente (requerido)
  description: string; // Descripción detallada (requerido)
  category: TicketCategory; // Categoría del ticket (requerido)
  priority: TicketPriority; // Prioridad técnica (requerido)
  complexity_level?: TicketComplexity; // Complejidad técnica estimada (solo category = 'sistemas')
  anydesk?: string; // ID de AnyDesk para acceso remoto (opcional)
  location_id?: string; // ID de la sede (requerido, auto-asignado del usuario)
}

// Configuración de SLA (Service Level Agreement)
// Define tiempos máximos de respuesta según prioridad
export interface SLAConfig {
  critical: { hours: number; label: string }; // 4 horas para críticos
  high: { hours: number; label: string }; // 8 horas para alta
  medium: { hours: number; label: string }; // 24 horas para media
  low: { hours: number; label: string }; // 72 horas para baja
}

// Límites de tiempo SLA para cada nivel de prioridad
// Usados para calcular tiempo restante y mostrar alertas
export const SLA_LIMITS: SLAConfig = {
  critical: { hours: 4, label: '4h' }, // Máximo 4 horas para responder
  high: { hours: 8, label: '8h' }, // Máximo 8 horas para responder
  medium: { hours: 24, label: '24h' }, // Máximo 24 horas para responder
  low: { hours: 72, label: '72h' }, // Máximo 72 horas para responder
};

// Etiquetas legibles para mostrar en la UI
// Formato estándar: P[Nivel] - Descripción
export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  critical: 'P1 - Crítica', // Prioridad más alta
  high: 'P2 - Alta', // Segunda prioridad
  medium: 'P3 - Media', // Prioridad normal
  low: 'P4 - Baja', // Prioridad más baja
};

// Etiquetas legibles para los estados en la UI
// Usadas en badges, filtros y reportes
export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Pendiente', // Ticket creado sin atención
  in_progress: 'En Proceso', // Técnico trabajando
  resolved: 'Resuelto', // Solución implementada
  closed: 'Cerrado', // Validado por usuario
  archived: 'Archivado', // Almacenado en historial
};
