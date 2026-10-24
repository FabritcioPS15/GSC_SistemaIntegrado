import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, User, MapPin, FileText, Save, Eye, CheckSquare, Settings } from 'lucide-react';
import { supabase } from '../../../shared/services/supabase';
import { useAuth } from '../../../app/providers/AuthContext';
import { useNotify } from '../../../shared/hooks/useNotify';
import { useNavigate } from 'react-router-dom';
import TemplateManager from '../../../shared/components/TemplateManager';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';

type ChecklistItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  required: boolean;
  order: number;
};

type ChecklistResponse = {
  id: string;
  checklist_id: string;
  user_id: string;
  location_id: string;
  responses: Record<string, any>;
  status: 'in_progress' | 'completed' | 'pending';
  started_at: string;
  completed_at?: string;
  created_at: string;
  locations?: { name: string };
  users?: { full_name: string };
};

type ChecklistTemplate = {
  id: string;
  name: string;
  type: 'escon' | 'ecsal' | 'citv';
  description: string;
  items: ChecklistItem[];
};

const checklistTemplates: Record<string, ChecklistTemplate> = {
  escon: {
    id: 'escon',
    name: 'ESCON - Escuela de Conductores',
    type: 'escon',
    description: 'Checklist de verificación integral para Escuela de Conductores',
    items: [
      // Personal(Conectar con la DB Que se tenía)
      { id: 'DNI', category: 'Personal', title: 'Documento de Identidad (DNI)', description: 'Verificar DNI vigente, legible y sin deterioro', required: true, order: 1 },
      { id: 'Nombre', category: 'Personal', title: 'Nombre', description: 'Nombre completo del colaborador', required: true, order: 2 },
      { id: 'Cargo', category: 'Personal', title: 'Cargo', description: 'Cargo que ocupa en la empresa', required: true, order: 3 },


      // Flota Vehicular (directamente vinculada con la flota vehicular, solo tiene que ser observable)
      { id: 'Flota vehicular activa', category: 'Flota Vehicular', title: 'Flota vehicular activa', description: 'Flota vehicular activa', required: true, order: 4 },
      { id: 'certificados_cursos', category: 'Documentación Académica', title: 'Certificados de Cursos', description: 'Cursos de actualización y capacitación', required: false, order: 5 },
      { id: 'registro_mtc', category: 'Documentación Académica', title: 'Registro MTC', description: 'Registro en Ministerio de Transportes', required: true, order: 6 },

      // Equipamiento y Uniforme (Para marcar completo excepto caso de CITV)
      { id: 'uniforme_completo', category: 'Equipamiento', title: 'Uniforme Completo', description: 'Uniforme reglamentario completo y en buen estado', required: true, order: 7 },
      { id: 'calzado_seguridad', category: 'Equipamiento', title: 'Calzado de Seguridad', description: 'Zapatos de seguridad adecuados y en buen estado', required: true, order: 8 },
      { id: 'identificacion_visible', category: 'Equipamiento', title: 'Identificación Visible', description: 'Gafete o identificación visible y legible', required: true, order: 9 },
      { id: 'material_didactico', category: 'Equipamiento', title: 'Material Didáctico', description: 'Material de enseñanza disponible y organizado', required: true, order: 10 },

      // Instalaciones y Seguridad
      { id: 'aula_enseñanza', category: 'Instalaciones', title: 'Aula de Enseñanza', description: 'Aula limpia, ordenada y en buen estado', required: true, order: 13 },
      { id: 'extintores', category: 'Instalaciones', title: 'Extintores', description: 'Extintores cargados y con certificado vigente', required: true, order: 14 },
      { id: 'señalizacion_seguridad', category: 'Instalaciones', title: 'Señalización de Seguridad', description: 'Salidas de emergencia y rutas señalizadas', required: true, order: 15 },
      { id: 'iluminacion_adequada', category: 'Instalaciones', title: 'Iluminación Adecuada', description: 'Iluminación suficiente en todas las áreas', required: true, order: 16 },

      // Evaluación Práctica
      { id: 'estado_fisico', category: 'Evaluación Práctica', title: 'Estado Físico', description: 'Evaluación del estado físico del instructor', required: true, order: 17 },
      { id: 'practica_manejo', category: 'Evaluación Práctica', title: 'Evaluación de Manejo', description: 'Evaluación práctica de habilidades de conducción', required: true, order: 18 },
      { id: 'conocimiento_normas', category: 'Evaluación Práctica', title: 'Conocimiento de Normas', description: 'Evaluación de conocimiento de reglas de tránsito', required: true, order: 19 },
      { id: 'habilidades_pedagogicas', category: 'Evaluación Práctica', title: 'Habilidades Pedagógicas', description: 'Capacidad de enseñanza y comunicación', required: true, order: 20 }
    ]
  },
  ecsal: {
    id: 'ecsal',
    name: 'ECSAL - Policlínico',
    type: 'ecsal',
    description: 'Checklist de verificación integral para Policlínico Médico',
    items: [
      // Licencias y Certificaciones
      { id: 'licencia_funcionamiento', category: 'Licencias y Certificaciones', title: 'Licencia de Funcionamiento', description: 'Licencia municipal de funcionamiento vigente', required: true, order: 1 },
      { id: 'certificado_sanitario', category: 'Licencias y Certificaciones', title: 'Certificado Sanitario', description: 'Certificado sanitario del establecimiento', required: true, order: 2 },
      { id: 'registro_digit', category: 'Licencias y Certificaciones', title: 'Registro DIGEMID', description: 'Registro en Dirección de Medicamentos', required: true, order: 3 },
      { id: 'certificados_profesionales', category: 'Licencias y Certificaciones', title: 'Certificados Profesionales', description: 'Certificados del personal médico', required: true, order: 4 },

      // Personal Médico
      { id: 'personal_medico', category: 'Personal', title: 'Personal Médico Completo', description: 'Médicos y especialistas disponibles', required: true, order: 5 },
      { id: 'enfermeria', category: 'Personal', title: 'Personal de Enfermería', description: 'Enfermeras certificadas y disponibles', required: true, order: 6 },
      { id: 'personal_administrativo', category: 'Personal', title: 'Personal Administrativo', description: 'Personal de atención y administración', required: true, order: 7 },
      { id: 'capacitacion_personal', category: 'Personal', title: 'Capacitación del Personal', description: 'Capacitación continua y actualizada', required: true, order: 8 },

      // Equipamiento Médico
      { id: 'equipamiento_basico', category: 'Equipamiento Médico', title: 'Equipamiento Básico', description: 'Equipo médico básico completo y funcional', required: true, order: 9 },
      { id: 'equipamiento_especializado', category: 'Equipamiento Médico', title: 'Equipamiento Especializado', description: 'Equipos especializados en buen estado', required: true, order: 10 },
      { id: 'equipamiento_laboratorio', category: 'Equipamiento Médico', title: 'Laboratorio', description: 'Equipos de laboratorio calibrados', required: true, order: 11 },
      { id: 'equipamiento_emergencia', category: 'Equipamiento Médico', title: 'Equipos de Emergencia', description: 'Carro de paro y equipos de emergencia', required: true, order: 12 },

      // Medicamentos e Insumos
      { id: 'medicamentos_basicos', category: 'Medicamentos e Insumos', title: 'Medicamentos Básicos', description: 'Stock adecuado de medicamentos esenciales', required: true, order: 13 },
      { id: 'medicamentos_controlados', category: 'Medicamentos e Insumos', title: 'Medicamentos Controlados', description: 'Control y registro de medicamentos controlados', required: true, order: 14 },
      { id: 'insumos_medicos', category: 'Medicamentos e Insumos', title: 'Insumos Médicos', description: 'Insumos y materiales médicos suficientes', required: true, order: 15 },
      { id: 'vacunas', category: 'Medicamentos e Insumos', title: 'Vacunas', description: 'Stock de vacunas y cadena de frío', required: true, order: 16 },

      // Instalaciones Físicas
      { id: 'consulta_externa', category: 'Instalaciones', title: 'Consulta Externa', description: 'Consultorios limpios y equipados', required: true, order: 17 },
      { id: 'area_emergencia', category: 'Instalaciones', title: 'Área de Emergencia', description: 'Área de emergencia señalizada y equipada', required: true, order: 18 },
      { id: 'laboratorio_clinico', category: 'Instalaciones', title: 'Laboratorio Clínico', description: 'Laboratorio con condiciones adecuadas', required: true, order: 19 },
      { id: 'farmacia', category: 'Instalaciones', title: 'Farmacia', description: 'Área de farmacia organizada y segura', required: true, order: 20 },

      // Seguridad e Higiene
      { id: 'bioseguridad', category: 'Seguridad e Higiene', title: 'Protocolos de Bioseguridad', description: 'Protocolos de bioseguridad implementados', required: true, order: 21 },
      { id: 'manejo_residuos', category: 'Seguridad e Higiene', title: 'Manejo de Residuos', description: 'Clasificación y disposición de residuos', required: true, order: 22 },
      { id: 'limpieza_esterilizacion', category: 'Seguridad e Higiene', title: 'Limpieza y Esterilización', description: 'Procedimientos de limpieza adecuados', required: true, order: 23 },
      { id: 'control_plagas', category: 'Seguridad e Higiene', title: 'Control de Plagas', description: 'Programa de control de plagas', required: true, order: 24 },

      // Procedimientos Médicos
      { id: 'protocolos_emergencia', category: 'Procedimientos Médicos', title: 'Protocolos de Emergencia', description: 'Protocolos actualizados y accesibles', required: true, order: 25 },
      { id: 'procedimientos_quirurgicos', category: 'Procedimientos Médicos', title: 'Procedimientos Quirúrgicos Menores', description: 'Protocolos para procedimientos menores', required: true, order: 26 },
      { id: 'triage', category: 'Procedimientos Médicos', title: 'Sistema de Triaje', description: 'Sistema de clasificación de pacientes', required: true, order: 27 },
      { id: 'referencia_contra', category: 'Procedimientos Médicos', title: 'Sistema de Referencia', description: 'Procedimientos de referencia y contra-referencia', required: true, order: 28 },

      // Historia Clínica y Registros
      { id: 'historia_clinica', category: 'Historia Clínica', title: 'Historia Clínica', description: 'Registros médicos actualizados y completos', required: true, order: 29 },
      { id: 'estadisticas_salud', category: 'Historia Clínica', title: 'Estadísticas de Salud', description: 'Sistema de registro de estadísticas', required: true, order: 30 },
      { id: 'consentimiento_informado', category: 'Historia Clínica', title: 'Consentimiento Informado', description: 'Formularios de consentimiento disponibles', required: true, order: 31 },
      { id: 'libro_reclamaciones', category: 'Historia Clínica', title: 'Libro de Reclamaciones', description: 'Libro de reclamaciones disponible', required: true, order: 32 }
    ]
  },
  citv: {
    id: 'citv',
    name: 'CITV - Revisión Técnica Vehicular',
    type: 'citv',
    description: 'Checklist de verificación integral para Revisión Técnica Vehicular',
    items: [
      // Documentación del Vehículo
      { id: 'tarjeta_propiedad', category: 'Documentación', title: 'Tarjeta de Propiedad', description: 'Tarjeta de propiedad original y vigente', required: true, order: 1 },
      { id: 'soat_vigente', category: 'Documentación', title: 'SOAT Vigente', description: 'Seguro obligatorio actualizado', required: true, order: 2 },
      { id: 'revision_tecnica_anterior', category: 'Documentación', title: 'Revisión Técnica Anterior', description: 'Certificado de revisión anterior', required: false, order: 3 },
      { id: 'documentacion_importacion', category: 'Documentación', title: 'Documentación de Importación', description: 'Documentos de importación si aplica', required: false, order: 4 },

      // Identificación del Vehículo
      { id: 'numero_motor', category: 'Identificación', title: 'Número de Motor', description: 'Número de motor legible y coincide con documentación', required: true, order: 5 },
      { id: 'numero_chasis', category: 'Identificación', title: 'Número de Chasis', description: 'Número de chasis legible y coincide', required: true, order: 6 },
      { id: 'placa_vehiculo', category: 'Identificación', title: 'Placa del Vehículo', description: 'Placa en buen estado y visible', required: true, order: 7 },
      { id: 'vin_vehiculo', category: 'Identificación', title: 'VIN del Vehículo', description: 'VIN visible y legible', required: true, order: 8 },

      // Sistema de Frenos
      { id: 'frenos_delanteros', category: 'Sistema de Frenos', title: 'Frenos Delanteros', description: 'Discos y pastillas en buen estado', required: true, order: 9 },
      { id: 'frenos_traseros', category: 'Sistema de Frenos', title: 'Frenos Traseros', description: 'Tambores o discos traseros funcionales', required: true, order: 10 },
      { id: 'freno_emergencia', category: 'Sistema de Frenos', title: 'Freno de Emergencia', description: 'Freno de mano funcional y ajustado', required: true, order: 11 },
      { id: 'liquido_frenos', category: 'Sistema de Frenos', title: 'Líquido de Frenos', description: 'Nivel y estado del líquido de frenos', required: true, order: 12 },
      { id: 'abs_funcional', category: 'Sistema de Frenos', title: 'Sistema ABS', description: 'Sistema ABS funcional si aplica', required: true, order: 13 },

      // Sistema Eléctrico
      { id: 'luces_delanteras', category: 'Sistema Eléctrico', title: 'Luces Delanteras', description: 'Luces altas y bajas funcionando', required: true, order: 14 },
      { id: 'luces_traseras', category: 'Sistema Eléctrico', title: 'Luces Traseras', description: 'Luces de freno y reversa funcionando', required: true, order: 15 },
      { id: 'luces_direccionales', category: 'Sistema Eléctrico', title: 'Luces Direccionales', description: 'Intermitentes funcionando correctamente', required: true, order: 16 },
      { id: 'luces_emergencia', category: 'Sistema Eléctrico', title: 'Luces de Emergencia', description: 'Intermitentes de emergencia funcionando', required: true, order: 17 },
      { id: 'sistema_ignicion', category: 'Sistema Eléctrico', title: 'Sistema de Ignición', description: 'Sistema de encendido funcional', required: true, order: 18 },
      { id: 'bateria_vehiculo', category: 'Sistema Eléctrico', title: 'Batería', description: 'Batería en buen estado y cargada', required: true, order: 19 },

      // Neumáticos y Ruedas
      { id: 'neumaticos_delanteros', category: 'Neumáticos', title: 'Neumáticos Delanteros', description: 'Estado y presión correctos', required: true, order: 20 },
      { id: 'neumaticos_traseros', category: 'Neumáticos', title: 'Neumáticos Traseros', description: 'Estado y presión correctos', required: true, order: 21 },
      { id: 'neumatico_repuesto', category: 'Neumáticos', title: 'Neumático de Repuesto', description: 'Repuesto en buen estado y con presión', required: true, order: 22 },
      { id: 'valvulas_neumaticos', category: 'Neumáticos', title: 'Válvulas de Neumáticos', description: 'Válvulas en buen estado y sin fugas', required: true, order: 23 },
      { id: 'alineacion_balanceo', category: 'Neumáticos', title: 'Alineación y Balanceo', description: 'Alineación y balanceo correctos', required: true, order: 24 },

      // Motor y Transmisión
      { id: 'motor_funcionamiento', category: 'Motor y Transmisión', title: 'Funcionamiento del Motor', description: 'Motor funciona sin ruidos anormales', required: true, order: 25 },
      { id: 'niveles_fluidos', category: 'Motor y Transmisión', title: 'Niveles de Fluidos', description: 'Aceite, refrigerante y otros fluidos', required: true, order: 26 },
      { id: 'sistema_transmision', category: 'Motor y Transmisión', title: 'Sistema de Transmisión', description: 'Cambio de marchas suave y sin ruidos', required: true, order: 27 },
      { id: 'sistema_escape', category: 'Motor y Transmisión', title: 'Sistema de Escape', description: 'Escape sin fugas y silencioso', required: true, order: 28 },
      { id: 'sistema_enfriamiento', category: 'Motor y Transmisión', title: 'Sistema de Enfriamiento', description: 'Sistema de refrigeración funcional', required: true, order: 29 },

      // Emisiones Ambientales
      { id: 'gases_escape', category: 'Emisiones', title: 'Gases de Escape', description: 'Niveles de emisiones dentro de límites', required: true, order: 30 },
      { id: 'control_polucion', category: 'Emisiones', title: 'Sistema de Control de Contaminación', description: 'Catalizador y sistemas de control', required: true, order: 31 },
      { id: 'filtro_aire', category: 'Emisiones', title: 'Filtro de Aire', description: 'Filtro de aire limpio y en buen estado', required: true, order: 32 },
      { id: 'sistema_pcv', category: 'Emisiones', title: 'Sistema PCV', description: 'Sistema de ventilación del cárter', required: true, order: 33 },

      // Sistema de Dirección
      { id: 'direccion_mecanica', category: 'Sistema de Dirección', title: 'Dirección Mecánica', description: 'Dirección sin juego excesivo', required: true, order: 34 },
      { id: 'direccion_hidraulica', category: 'Sistema de Dirección', title: 'Dirección Hidráulica', description: 'Sistema hidráulico sin fugas', required: true, order: 35 },
      { id: 'bomba_direccion', category: 'Sistema de Dirección', title: 'Bomba de Dirección', description: 'Bomba de dirección funcionando', required: true, order: 36 },
      { id: 'alineacion_direccion', category: 'Sistema de Dirección', title: 'Alineación de Dirección', description: 'Alineación de dirección correcta', required: true, order: 37 },

      // Suspensión
      { id: 'amortiguadores_delanteros', category: 'Suspensión', title: 'Amortiguadores Delanteros', description: 'Amortiguadores en buen estado', required: true, order: 38 },
      { id: 'amortiguadores_traseros', category: 'Suspensión', title: 'Amortiguadores Traseros', description: 'Amortiguadores traseros funcionales', required: true, order: 39 },
      { id: 'resortes_suspension', category: 'Suspensión', title: 'Resortes de Suspensión', description: 'Resortes sin deformaciones', required: true, order: 40 },
      { id: 'brazos_control', category: 'Suspensión', title: 'Brazos de Control', description: 'Brazos de control y bujes en buen estado', required: true, order: 41 },

      // Seguridad Pasiva
      { id: 'cinturones_seguridad', category: 'Seguridad Pasiva', title: 'Cinturones de Seguridad', description: 'Cinturones funcionales y sin daños', required: true, order: 42 },
      { id: 'airbags', category: 'Seguridad Pasiva', title: 'Airbags', description: 'Sistema de airbags operativo', required: true, order: 43 },
      { id: 'apoyacabezas', category: 'Seguridad Pasiva', title: 'Apoyacabezas', description: 'Apoyacabezas regulables y en buen estado', required: true, order: 44 },
      { id: 'parachoques', category: 'Seguridad Pasiva', title: 'Parachoques', description: 'Parachoques fijos y sin daños graves', required: true, order: 45 },

      // Seguridad Activa
      { id: 'espejos_retrovisores', category: 'Seguridad Activa', title: 'Espejos Retrovisores', description: 'Espejos completos y ajustables', required: true, order: 46 },
      { id: 'limpiaparabrisas', category: 'Seguridad Activa', title: 'Limpiaparabrisas', description: 'Limpiaparabrisas funcionando', required: true, order: 47 },
      { id: 'sistema_lavado', category: 'Seguridad Activa', title: 'Sistema de Lavado', description: 'Sistema de lavaparabrisas funcional', required: true, order: 48 },
      { id: 'claxon_bocina', category: 'Seguridad Activa', title: 'Claxon/Bocina', description: 'Bocina funcionando correctamente', required: true, order: 49 },

      // Chasis y Carrocería
      { id: 'estructura_chasis', category: 'Chasis y Carrocería', title: 'Estructura del Chasis', description: 'Chasis sin deformaciones ni corrosión', required: true, order: 50 },
      { id: 'carroceria_puertas', category: 'Chasis y Carrocería', title: 'Carrocería y Puertas', description: 'Puertas abren y cierran correctamente', required: true, order: 51 },
      { id: 'vidrios_ventanillas', category: 'Chasis y Carrocería', title: 'Vidrios y Ventanillas', description: 'Vidrios sin grietas y funcionales', required: true, order: 52 },
      { id: 'sellado_cajuela', category: 'Chasis y Carrocería', title: 'Sellado de Cajuela', description: 'Cajuela cierra correctamente y sella', required: true, order: 53 },

      // Accesorios y Equipamiento
      { id: 'tablero_instrumentos', category: 'Accesorios', title: 'Tablero de Instrumentos', description: 'Indicadores funcionando correctamente', required: true, order: 54 },
      { id: 'acondicionado_aire', category: 'Accesorios', title: 'Aire Acondicionado', description: 'Sistema de aire a/c funcionando', required: false, order: 55 },
      { id: 'sistema_audio', category: 'Accesorios', title: 'Sistema de Audio', description: 'Sistema de audio funcional si aplica', required: false, order: 56 },
      { id: 'triangulo_seguridad', category: 'Accesorios', title: 'Triángulo de Seguridad', description: 'Triángulo y kit de emergencia', required: true, order: 57 },
      { id: 'extintor_vehiculo', category: 'Accesorios', title: 'Extintor de Vehículo', description: 'Extintor cargado y vigente', required: true, order: 58 }
    ]
  }
};

export default function ChecklistInteractive() {
  const { user, hasPermission } = useAuth();
  const { info: notifyInfo, success: notifySuccess } = useNotify();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [selectedType, setSelectedType] = useState<'escon' | 'ecsal' | 'citv'>('escon');
  const [currentChecklist, setCurrentChecklist] = useState<ChecklistResponse | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [history, setHistory] = useState<ChecklistResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templates, setTemplates] = useState(checklistTemplates);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const startNewChecklist = () => {
    const template = templates[selectedType];
    const initialResponses: Record<string, any> = {};

    template.items.forEach(item => {
      initialResponses[item.id] = {
        completed: false,
        notes: '',
        images: [],
        timestamp: null
      };
    });

    setResponses(initialResponses);
    setCurrentChecklist({
      id: '',
      checklist_id: template.id,
      user_id: user?.id || '',
      location_id: user?.location_id || '',
      responses: initialResponses,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('checklist_responses')
        .select('*, locations(name), users(full_name)')
        .order('created_at', { ascending: false });

      if (user?.role === 'administradores' && user?.location_id) {
        query = query.eq('location_id', user.location_id);
      }

      const { data, error } = await query;
      if (!error && data) {
        setHistory(data as ChecklistResponse[]);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveChecklist = async () => {
    if (!currentChecklist) return;

    setSaving(true);
    try {
      const template = checklistTemplates[currentChecklist.checklist_id];
      const isComplete = Object.values(responses).every((response: any) => response.completed);

      // Validaciones específicas por tipo
      const validationResult = validateChecklist(currentChecklist.checklist_id, responses, template);
      if (!validationResult.valid) {
        notifyInfo(validationResult.message);
        setSaving(false);
        return;
      }

      const status = isComplete ? 'completed' : 'in_progress';

      const checklistData = {
        checklist_id: currentChecklist.checklist_id,
        user_id: user?.id,
        location_id: user?.location_id,
        responses,
        status,
        started_at: currentChecklist.started_at,
        completed_at: isComplete ? new Date().toISOString() : null
      };

      if (currentChecklist.id) {
        // Update existing
        const { error } = await supabase
          .from('checklist_responses')
          .update(checklistData)
          .eq('id', currentChecklist.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('checklist_responses')
          .insert(checklistData);

        if (error) throw error;
      }

      const updatedChecklistData = {
        ...checklistData,
        user_id: checklistData.user_id || '',
        location_id: checklistData.location_id || '',
        status: (checklistData.status as 'in_progress' | 'completed' | 'pending'),
        completed_at: checklistData.completed_at || undefined
      };

      setCurrentChecklist(prev => prev ? { ...prev, ...updatedChecklistData } : null);
    } catch (error) {
      console.error('Error saving checklist:', error);
    } finally {
      setSaving(false);
    }
  };

  const validateChecklist = (checklistId: string, responses: Record<string, any>, template: ChecklistTemplate): { valid: boolean; message: string } => {
    const requiredItems = template.items.filter(item => item.required);
    const completedRequired = requiredItems.filter(item => responses[item.id]?.completed);

    if (completedRequired.length < requiredItems.length) {
      const missingItems = requiredItems.filter(item => !responses[item.id]?.completed).map(item => item.title);
      return {
        valid: false,
        message: `Faltan ítems requeridos obligatorios:\n\n${missingItems.join('\n')}\n\nPor favor complete todos los ítems requeridos antes de guardar.`
      };
    }

    // Validaciones específicas por tipo
    if (checklistId === 'escon') {
      // Validar que todos los documentos legales estén completos
      const legalDocs = ['doc_identidad', 'licencia_conducir', 'certificado_medico', 'antecedentes_penales'];
      const missingLegalDocs = legalDocs.filter(doc => !responses[doc]?.completed);

      if (missingLegalDocs.length > 0) {
        return {
          valid: false,
          message: 'Para ESCON es obligatorio completar toda la Documentación Legal antes de finalizar el checklist.'
        };
      }
    }

    if (checklistId === 'ecsal') {
      // Validar licencias y certificaciones
      const licenses = ['licencia_funcionamiento', 'certificado_sanitario', 'registro_digit'];
      const missingLicenses = licenses.filter(license => !responses[license]?.completed);

      if (missingLicenses.length > 0) {
        return {
          valid: false,
          message: 'Para ECSAL es obligatorio tener todas las Licencias y Certificaciones al día.'
        };
      }
    }

    if (checklistId === 'citv') {
      // Validar documentación básica del vehículo
      const basicDocs = ['tarjeta_propiedad', 'soat_vigente'];
      const missingBasicDocs = basicDocs.filter(doc => !responses[doc]?.completed);

      if (missingBasicDocs.length > 0) {
        return {
          valid: false,
          message: 'Para CITV es obligatorio tener la Tarjeta de Propiedad y SOAT vigentes.'
        };
      }

      // Validar sistemas críticos de seguridad
      const criticalSystems = ['frenos_delanteros', 'luces_delanteras', 'neumaticos_delanteros', 'cinturones_seguridad'];
      const missingCriticalSystems = criticalSystems.filter(system => !responses[system]?.completed);

      if (missingCriticalSystems.length > 0) {
        return {
          valid: false,
          message: 'Sistemas críticos de seguridad incompletos. Es obligatorio verificar:\n- Sistema de frenos\n- Sistema de luces\n- Neumáticos\n- Cinturones de seguridad'
        };
      }
    }

    return { valid: true, message: '' };
  };

  const updateResponse = (itemId: string, field: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const loadChecklist = async (checklist: ChecklistResponse) => {
    setCurrentChecklist(checklist);
    setResponses(checklist.responses);
    setActiveTab('new');
    const type = checklist.checklist_id as 'escon' | 'ecsal' | 'citv';
    setSelectedType(type);
  };

  const getProgress = () => {
    if (!currentChecklist) return 0;
    const total = Object.keys(responses).length;
    const completed = Object.values(responses).filter((response: any) => response.completed).length;
    return (completed / total) * 100;
  };

  const getCategoryItems = (category: string) => {
    const template = templates[selectedType];
    return template.items.filter(item => item.category === category);
  };

  const categories = Array.from(new Set(templates[selectedType].items.map(item => item.category)));

  const handleSaveTemplate = (templateId: string, updatedTemplate: ChecklistTemplate) => {
    setTemplates(prev => ({
      ...prev,
      [templateId]: updatedTemplate
    }));
    notifySuccess('Plantilla guardada exitosamente');
  };

  const canManageTemplates = hasPermission('checklist-edit');

  return (
    <div className="min-h-screen bg-[#f8f9fc] p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-none border border-slate-200 shadow-sm p-6 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#002855]" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-50 flex items-center justify-center border border-slate-100">
                <CheckSquare className="w-6 h-6 text-[#002855]" />
              </div>
              <div>
                <h1 className="text-[18px] font-normal text-[#002855] uppercase tracking-tight">Checklist Interactivo</h1>
                <p className="text-[11px] font-normal text-slate-400 uppercase tracking-widest mt-1">Formularios digitales y gestión de cumplimiento</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate('/checklist')}
                className="px-5 py-2 bg-slate-100 text-slate-600 rounded-none border border-slate-200 hover:bg-slate-200 transition-all font-normal text-[10px] uppercase tracking-[0.2em]"
              >
                Vista Tradicional
              </button>
              {canManageTemplates && (
                <button
                  onClick={() => setShowTemplateManager(true)}
                  className="px-5 py-2 bg-amber-500 text-white rounded-none hover:bg-amber-600 transition-all font-normal text-[10px] uppercase tracking-[0.2em] shadow-sm flex items-center gap-2"
                >
                  <Settings size={14} />
                  Plantillas
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex mt-8 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('new')}
              className={`px-8 py-4 font-normal text-[11px] uppercase tracking-[0.2em] transition-all relative ${activeTab === 'new'
                ? 'text-blue-600'
                : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Nuevo Checklist
              {activeTab === 'new' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-8 py-4 font-normal text-[11px] uppercase tracking-[0.2em] transition-all relative ${activeTab === 'history'
                ? 'text-blue-600'
                : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Historial
              {activeTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />}
            </button>
          </div>
        </div>

        {activeTab === 'new' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Panel - Type Selection */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-none border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-blue-600" />
                  <h3 className="text-[12px] font-normal text-[#002855] tracking-[0.2em]">Selección</h3>
                </div>

                <div className="space-y-2">
                  {Object.entries(templates).map(([key, template]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedType(key as 'escon' | 'ecsal' | 'citv')}
                      className={`w-full text-left p-4 rounded-none border transition-all ${selectedType === key
                        ? `border-${key === 'escon' ? 'blue' : key === 'ecsal' ? 'emerald' : 'orange'}-500 bg-${key === 'escon' ? 'blue' : key === 'ecsal' ? 'emerald' : 'orange'}-50/30`
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      <div className={`text-[11px] font-normal uppercase tracking-widest mb-1 ${selectedType === key ? `text-${key === 'escon' ? 'blue' : key === 'ecsal' ? 'emerald' : 'orange'}-600` : 'text-[#002855]'}`}>{template.name}</div>
                      <div className="text-[9px] font-normal text-slate-400 uppercase tracking-tighter leading-tight">{template.description}</div>
                    </button>
                  ))}
                </div>

                {currentChecklist && (
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-normal text-slate-500 uppercase tracking-widest">Progreso</span>
                        <span className={`text-[10px] font-normal uppercase tracking-widest ${getProgress() === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{Math.round(getProgress())}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-none h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${getProgress() === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${getProgress()}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={saveChecklist}
                      disabled={saving}
                      className={`w-full py-3 rounded-none font-normal text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group ${
                        getProgress() === 100 
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md' 
                          : 'bg-[#002855] text-white hover:bg-blue-800 shadow-md'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Save className="w-14 h-14 group-hover:scale-110 transition-transform" size={14} />
                      {saving ? 'PROCESANDO...' : 'GUARDAR CAMBIOS'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Checklist Form */}
            <div className="lg:col-span-3">
              {!currentChecklist ? (
                <div className="bg-white rounded-none border border-slate-200 border-dashed p-16 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-none flex items-center justify-center mx-auto mb-6 border border-slate-100">
                    <CheckSquare className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-[16px] font-normal text-[#002855] uppercase tracking-tight mb-2">Completar nuevo checklist</h3>
                  <p className="text-[11px] font-normal text-slate-400 uppercase tracking-widest mb-8">Seleccione un tipo de unidad para iniciar el proceso de verificación</p>
                  <button
                    onClick={startNewChecklist}
                    className="px-10 py-3 bg-[#002855] text-white rounded-none font-normal text-[10px] uppercase tracking-[0.2em] hover:bg-blue-800 transition-all shadow-lg"
                  >
                    Iniciar Formulario
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {categories.map(category => (
                    <div key={category} className="bg-white rounded-none border border-slate-200 shadow-sm overflow-hidden">
                      <div className={`p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3`}>
                        <div className={`w-1.5 h-6 ${selectedType === 'escon' ? 'bg-blue-600' : selectedType === 'ecsal' ? 'bg-emerald-600' : 'bg-orange-600'} rounded-none`} />
                        <h4 className="text-[12px] font-normal text-[#002855] tracking-[0.2em]">
                          {category}
                        </h4>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {getCategoryItems(category).map(item => {
                          const response = responses[item.id] || { completed: false, notes: '', images: [] };
                          return (
                            <div key={item.id} className={`p-6 transition-colors ${response.completed ? 'bg-emerald-50/10' : 'hover:bg-slate-50/30'}`}>
                              <div className="flex items-start gap-5">
                                <button
                                  onClick={() => updateResponse(item.id, 'completed', !response.completed)}
                                  className={`mt-1 w-6 h-6 rounded-none border-2 flex items-center justify-center transition-all ${response.completed
                                    ? `bg-emerald-600 border-emerald-600 text-white shadow-md`
                                    : 'bg-white border-slate-200 hover:border-blue-400'
                                    }`}
                                >
                                  {response.completed && <CheckCircle2 className="w-4 h-4" />}
                                </button>

                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-3">
                                    <h5 className="text-[13px] font-normal text-[#002855] leading-tight">{item.title}</h5>
                                    {item.required && (
                                      <span className="text-[14px] font-semibold bg-amber-100 text-amber-700">Requerido</span>
                                    )}
                                  </div>
                                  <p className="text-[11px] font-normal text-slate-400 uppercase tracking-widest mb-6 leading-relaxed italic">{item.description}</p>

                                  <div className="relative">
                                    <textarea
                                      value={response.notes || ''}
                                      onChange={(e) => updateResponse(item.id, 'notes', e.target.value)}
                                      placeholder="OBSERVACIONES Y NOTAS DETALLADAS..."
                                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-none text-[11px] font-normal uppercase tracking-widest placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all h-24 resize-none"
                                    />
                                    <div className="absolute top-2 right-2">
                                      <FileText size={14} className="text-slate-200" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-none border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-blue-600" />
                <h3 className="text-[12px] font-normal text-[#002855] tracking-[0.2em]">Registros Históricos</h3>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 text-[10px] font-normal text-slate-500 uppercase tracking-widest">
                <Clock className="w-3.5 h-3.5" />
                {history.length} Registros
              </div>
            </div>

            {loading ? (
              <LoadingSpinner label="Cargando checklist..." />
            ) : history.length === 0 ? (
              <div className="text-center py-24">
                <div className="w-16 h-16 bg-slate-50 rounded-none flex items-center justify-center mx-auto mb-6 border border-slate-100">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <h4 className="text-[13px] font-normal text-[#002855] leading-tight tracking-tight mb-2">Base de datos vacía</h4>
                <p className="text-[11px] font-normal text-slate-400 uppercase tracking-widest">No se han encontrado registros previos de inspección</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-6 text-[12px] font-normal text-[#002855] tracking-[0.2em]">Cuestionario</th>
                      <th className="px-4 py-6 text-[12px] font-normal text-[#002855] tracking-[0.2em]">Ubicación / Información</th>
                      <th className="px-4 py-6 text-[12px] font-normal text-[#002855] tracking-[0.2em]">Progreso</th>
                      <th className="px-4 py-6 text-[12px] font-normal text-[#002855] tracking-[0.2em]">Estado</th>
                      <th className="px-6 py-6 text-[12px] font-normal text-[#002855] tracking-[0.2em] text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map(checklist => {
                      const template = templates[checklist.checklist_id as keyof typeof templates];
                      const completed = Object.values(checklist.responses).filter((response: any) => response.completed).length;
                      const total = Object.keys(checklist.responses).length;
                      const percentage = Math.round((completed / total) * 100);
                      const type = checklist.checklist_id;
                      const colorClass = type === 'escon' ? 'blue' : type === 'ecsal' ? 'emerald' : 'orange';

                      return (
                        <tr key={checklist.id} className="hover:bg-slate-50 transition-colors group relative border-b border-slate-50 last:border-0">
                          <td className="px-6 py-5 font-normal">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-none flex items-center justify-center shadow-sm transition-all duration-300 bg-${colorClass}-50 text-${colorClass}-500 group-hover:bg-${colorClass}-600 group-hover:text-white`}>
                                <CheckSquare size={18} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[13px] font-normal text-[#002855] leading-tight">{template?.name.split(' - ')[0]}</span>
                                <p className="text-[11px] font-normal text-slate-400 tracking-wider mt-1 italic">{template?.name.split(' - ')[1]}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5 font-normal">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <User size={12} className="text-slate-400" />
                                <span className="text-[11px] font-normal text-slate-600 uppercase tracking-widest">{checklist.users?.full_name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin size={12} className="text-rose-500" />
                                <span className="text-[11px] font-normal text-slate-600 uppercase tracking-widest">{checklist.locations?.name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5 font-normal">
                            <div className="flex flex-col gap-2 min-w-[120px]">
                              <div className="flex items-center justify-between">
                                <span className="text-[12px] font-normal text-[#002855] tracking-[0.2em]">{completed}/{total} ítems</span>
                                <span className="text-[10px] font-normal text-[#002855]">{percentage}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-none h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full bg-${colorClass}-500 transition-all duration-500`} 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-5 font-normal">
                                            <span className={`text-[14px] font-semibold ${checklist.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                              {checklist.status === 'completed' ? 'FINALIZADO' : 'EN CURSO'}
                                            </span>
                          </td>
                          <td className="px-6 py-5 text-right font-normal">
                            <button
                              onClick={() => loadChecklist(checklist)}
                              className={`px-4 py-2 border border-${colorClass}-200 bg-white text-${colorClass}-600 hover:bg-${colorClass}-600 hover:text-white transition-all font-normal text-[10px] uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 ml-auto`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              VER REGISTRO
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Template Manager Modal */}
      {showTemplateManager && (
        <TemplateManager
          templates={templates}
          onSaveTemplate={handleSaveTemplate}
          onClose={() => setShowTemplateManager(false)}
        />
      )}
    </div>
  );
}
