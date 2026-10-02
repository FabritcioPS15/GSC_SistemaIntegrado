// =============================================================================
// TicketForm.tsx — Formulario de creación de nuevos tickets
// Funcionalidades:
//   - Campos: título, descripción, prioridad, categoría, sede, AnyDesk
//   - El solicitante NO ve ni elige la complejidad técnica: se resuelve sola a
//     partir del asunto (catálogo de problemas frecuentes o palabras clave)
//   - El asunto es el campo principal porque define el tipo de soporte que recibe
//   - Auto-sugerencia de problemas frecuentes al escribir el título
//   - Auto-asignación de la sede del usuario actual
//   - Validación de campos obligatorios antes de enviar
//   - Al crear: inserta ticket, guarda AnyDesk como comentario si aplica,
//     auto-asigna al creador via ticket_assignments, y notifica a los roles
// =============================================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '../../../shared/services/supabase';
import { useAuth } from '../../../app/providers/AuthContext';
import BaseForm, { FormSection, FormField, FormInput, FormSelect, FormTextarea } from '../../../shared/components/forms/BaseForm';
import { notifyTicketCreated } from '../../../shared/services/notifications';
import { useNotify } from '../../../shared/hooks/useNotify';
import {
  COMPLEXITY_CATEGORY,
  DEFAULT_COMPLEXITY,
  FREQUENT_TECH_ISSUES,
  resolveComplexityFromTitle,
} from '../tickets.types';

// Props del componente
// onClose: Función para cerrar el modal/formulario
// onSave: Función para recargar la lista después de guardar
type TicketFormProps = {
  onClose: () => void;
  onSave: () => void;
};

export default function TicketForm({ onClose, onSave }: TicketFormProps) {
  const { user } = useAuth(); // Usuario actual autenticado
  const { success: notifySuccess } = useNotify();
  const [loading, setLoading] = useState(false); // Indicador de envío en progreso
  const [locations, setLocations] = useState<any[]>([]); // Lista de sedes disponibles
  const [errors, setErrors] = useState<Record<string, string>>({}); // Errores de validación por campo
  const [showSuggestions, setShowSuggestions] = useState(false); // Visibilidad del menú de sugerencias
  const suggestionRef = useRef<HTMLDivElement>(null); // Referencia al contenedor de sugerencias (para detectar clics fuera)

  // Estado del formulario con valores iniciales
  // location_id se auto-asigna del usuario actual si está disponible
  // La complejidad no vive aquí: se deriva del asunto en cada render
  const [formData, setFormData] = useState({
    title: '', // Título del incidente
    description: '', // Descripción detallada del problema
    priority: 'medium', // Prioridad por defecto
    category: 'sistemas', // Categoría por defecto
    location_id: user?.location_id || '', // Sede del usuario (auto-asignada)
    anydesk: '' // ID de AnyDesk opcional
  });

  // Opción de prioridad para el selector
  // Cada valor corresponde a un nivel SLA específico
  const priorities = [
    { value: 'critical', label: 'P1 - Crítica' }, // 4h SLA
    { value: 'high', label: 'P2 - Alta' }, // 8h SLA
    { value: 'medium', label: 'P3 - Media' }, // 24h SLA
    { value: 'low', label: 'P4 - Baja' }, // 72h SLA
  ];

  // Opciones de categorías para el selector
  // Cada categoría dirige el ticket al equipo correspondiente
  const categories = [
    { value: 'sistemas', label: 'Área de Sistemas' }, // Soporte técnico
    { value: 'contable', label: 'Área contable' }, // Facturación y pagos
    { value: 'legal', label: 'Área legal' }, // Documentación legal
    { value: 'operaciones', label: 'Área de operaciones' }, // Procesos operativos
  ];

  // La complejidad técnica solo tiene sentido para el área de Sistemas
  // En las demás áreas el valor se ignora y no se envía al crear el ticket
  const isComplexityApplicable = formData.category === COMPLEXITY_CATEGORY;

  // El nivel se resuelve en vivo a partir del asunto sin mostrarlo al solicitante:
  // primero busca el asunto en el listado de problemas frecuentes y, si es un
  // caso personalizado, recurre a la estimación por palabras clave
  const complexityEstimate = useMemo(
    () => resolveComplexityFromTitle(formData.title, formData.category),
    [formData.title, formData.category]
  );

  // Carga la lista de sedes disponibles al montar el componente
  useEffect(() => {
    fetchLocations();
  }, []);

  // Auto-asigna la sede del usuario actual
  // Si el usuario tiene una sede asignada, la usa por defecto
  useEffect(() => {
    if (user?.location_id && !formData.location_id) {
      setFormData(prev => ({
        ...prev,
        location_id: user.location_id || ''
      }));
    }
  }, [user?.location_id]);

  // Obtiene todas las sedes desde la base de datos
  // Se usa para el selector de ubicación del ticket
  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');

      if (!error && data) {
        setLocations(data);
      }
    } catch (error) {
      console.error('Error al cargar ubicaciones:', error);
    }
  };

  // Cierra el menú de sugerencias al hacer clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtra las sugerencias basándose en lo que el usuario escribe en el título
  const filteredSuggestions = FREQUENT_TECH_ISSUES.filter(issue =>
    issue.title.toLowerCase().includes(formData.title.toLowerCase())
  );

  // Selecciona una sugerencia de problema frecuente
  // Autocompleta el formulario con los datos predefinidos
  // La complejidad no se copia: se resuelve sola desde el título elegido
  const handleSelectIssue = (issue: typeof FREQUENT_TECH_ISSUES[0]) => {
    setFormData({
      ...formData,
      title: issue.title,
      description: issue.description,
      category: COMPLEXITY_CATEGORY,
      priority: issue.priority
    });
    setShowSuggestions(false);
  };

  // Valida y envía el formulario para crear un nuevo ticket
  // Flujo completo:
  // 1. Validación de campos requeridos (título, descripción, ubicación)
  // 2. Inserta el ticket en la tabla 'tickets' con estado 'open'
  // 3. Si se proporcionó AnyDesk, lo guarda como comentario inicial
  //    (el hook useTicketComments lo detecta y lo muestra en el detalle)
  // 4. Auto-asigna al creador via ticket_assignments
  // 5. Envía notificación a los roles correspondientes
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'El título es requerido';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'La descripción es requerida';
    }

    if (!formData.location_id) {
      newErrors.location_id = 'La ubicación es requerida';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      // Crear el ticket
      // La complejidad NO se envía en el insert: se aplica después como
      // actualización de mejor esfuerzo. Así una migración pendiente nunca
      // impide crear el ticket (y tickets previos nunca se tocan).
      const { data: ticketData, error: submitError } = await supabase
        .from('tickets')
        .insert([
          {
            title: formData.title.trim(),
            description: formData.description.trim(),
            priority: formData.priority,
            category: formData.category,
            location_id: formData.location_id,
            requester_id: user?.id,
            status: 'open'
          }
        ])
        .select()
        .single();

      if (submitError) throw submitError;

      // Clasificar el caso de forma independiente: el nivel se resolvió a
      // partir del asunto y solo aplica al área de Sistemas. Si la columna
      // aún no existe en la base de datos (migración pendiente) el ticket
      // queda sin clasificar, pero se creó de todas formas.
      if (ticketData && isComplexityApplicable) {
        await supabase
          .from('tickets')
          .update({ complexity_level: complexityEstimate.level ?? DEFAULT_COMPLEXITY })
          .eq('id', ticketData.id);
      }

      // Si se proporcionó AnyDesk, agregarlo como comentario para que sea detectado por el modal
      if (ticketData && formData.anydesk.trim()) {
        await supabase
          .from('ticket_comments')
          .insert([{
            ticket_id: ticketData.id,
            user_id: user?.id,
            content: `Anydesk de mi PC: ${formData.anydesk.trim()}`
          }]);
      }

      // Auto-asignar el creador al ticket
      if (ticketData) {
        await supabase
          .from('ticket_assignments')
          .insert([{
            ticket_id: ticketData.id,
            user_id: user?.id,
            assigned_at: new Date().toISOString()
          }]);
      }

      // Enviar notificación de ticket creado
      if (ticketData) {
        await notifyTicketCreated(
          ticketData.id,
          ticketData.title,
          user?.id || '',
          user?.full_name || 'Usuario',
          locations.find(l => l.id === formData.location_id)?.name || 'Sin ubicación'
        );
      }

      notifySuccess('Ticket creado correctamente', 'Creado');
      onSave();
      onClose();
    } catch (err: any) {
      setErrors({ submit: 'Error al crear el ticket: ' + err.message });
      setLoading(false);
    }
  };

  // Maneja los cambios en los campos del formulario
  // Actualiza el estado, limpia errores y muestra sugerencias
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Mostrar sugerencias cuando se escribe en el título
    if (name === 'title') {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="relative">
      {/* Información de usuario y ubicación fija en esquina superior derecha */}
      <div className="absolute top-4 right-4 z-10 bg-slate-50 border border-slate-200 rounded-none px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#002855] rounded-none"></div>
          <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">Usuario:</span>
          <span className="text-[10px] font-normal text-[#002855] uppercase tracking-tight">{user?.full_name}</span>
        </div>
        {user?.location_id ? (
          <div className="flex items-center gap-2 mt-1">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-none"></div>
            <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">Sede:</span>
            <span className="text-[10px] font-normal text-[#002855] uppercase tracking-tight">
              {locations.find(loc => loc.id === user.location_id)?.name || 'Cargando...'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-none"></div>
            <span className="text-[10px] font-normal text-orange-600 uppercase tracking-widest">Sin sede asignada</span>
          </div>
        )}
      </div>

      <BaseForm
        title="Nuevo Reporte de Incidencia"
        subtitle="Mesa de Ayuda Técnica"
        onClose={onClose}
        onSubmit={handleSubmit}
        loading={loading}
        error={errors.submit}
        icon={<Send size={20} className="text-white" />}
      >
      {/* Section: Información del Ticket */}
      <FormSection title="Detalles del Incidente" color="blue" columns={3}>
          {/* El asunto ocupa todo el ancho: es el campo que define el tipo de
              soporte que recibe el ticket, por eso va primero y destacado */}
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="block text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-2">
              Asunto o Título <span className="text-red-500">*</span>
            </span>

            <div className="relative" ref={suggestionRef}>
              <FormInput
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Ej. La impresora de recepción no imprime"
                required
                error={errors.title}
                className="h-12 pt-3 text-[12px]"
              />

              {showSuggestions && formData.title && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-0 bg-white border border-slate-200 shadow-2xl z-20 overflow-hidden py-0 animate-in fade-in slide-in-from-top-2">
                  {filteredSuggestions.map((issue, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectIssue(issue)}
                      className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors flex items-center justify-between border-b border-slate-100 last:border-0"
                    >
                      <div className="flex flex-col">
                        <span className="text-[12px] font-normal text-[#002855] uppercase">{issue.title}</span>
                        <span className="text-[12px] font-normal text-slate-400 uppercase tracking-widest mt-0.5">{issue.description.slice(0, 60)}...</span>
                      </div>
                      <span className="text-[12px] font-normal text-slate-500">{COMPLEXITY_CATEGORY}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {errors.title ? (
              <p className="mt-1.5 text-[10px] font-normal text-red-600 uppercase tracking-wide">{errors.title}</p>
            ) : (
              <p className="mt-1.5 text-[9px] font-normal text-slate-400 uppercase tracking-wide leading-snug">
                Escribe el asunto de forma clara y específica: es lo que determina el tipo de soporte que se asignará a tu caso.
              </p>
            )}
          </div>

          <FormField label="Área dirigida:" required error={errors.category}>
            <FormSelect
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              error={errors.category}
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </FormSelect>
          </FormField>

          <FormField label="Prioridad Técnica" required error={errors.priority}>
            <FormSelect
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              required
              error={errors.priority}
            >
              {priorities.map((pri) => (
                <option key={pri.value} value={pri.value}>
                  {pri.label}
                </option>
              ))}
            </FormSelect>
          </FormField>

          <FormField label="Acceso AnyDesk" error={errors.anydesk}>
            <FormInput
              type="text"
              name="anydesk"
              value={formData.anydesk}
              onChange={handleChange}
              placeholder="ID de AnyDesk (si aplica)"
              error={errors.anydesk}
            />
          </FormField>
      </FormSection>

      {/* Section: Información de Ubicación */}
      <FormSection title="Origen del Reporte" color="emerald">
        <FormField label="Sede de la Incidencia">
          <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-none text-[11px] font-normal text-[#002855] uppercase tracking-tight">
            {locations.find(loc => loc.id === formData.location_id)?.name || 'ASIGNANDO SEDE...'}
          </div>
        </FormField>
      </FormSection>

      {/* Section: Descripción */}
      <FormSection title="Análisis y Descripción" color="emerald">
        <FormField label="Descripción Detallada del Fallo" required error={errors.description}>
          <FormTextarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe el problema, mensajes de error y pasos para reproducirlo..."
            rows={8}
            required
            error={errors.description}
          />
        </FormField>
      </FormSection>
    </BaseForm>

    </div>
  );
}
