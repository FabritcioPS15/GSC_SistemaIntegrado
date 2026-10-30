/**
 * Servicio central de Supabase.
 * Exporta el cliente `supabase` y TODOS los tipos (compartidos) del sistema.
 *
 * ⚠️ REGLA: Cualquier tabla nueva de Supabase debe tener su tipo aquí.
 * ⚠️ REGLA: No pongas interfaces específicas de un módulo aquí (ponlas en su
 *            propio archivo .types.ts dentro del módulo).
 *
 * @see src/shared/types/ — tipos cross-module adicionales
 */

import { createClient } from '@supabase/supabase-js';



// Messaging System Types

export type Conversation = {

  id: string;

  created_at: string;

  updated_at: string;

};



export type ConversationParticipant = {

  id: string;

  conversation_id: string;

  user_id: string;

  last_read_at?: string;

  created_at: string;

};



export type Message = {

  id: string;

  conversation_id: string;

  sender_id: string;

  content: string;

  created_at: string;

  read_at?: string;

};



const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;



// Debug: verificar variables de entorno



if (!supabaseUrl || !supabaseAnonKey) {

  console.error('❌ Variables de entorno de Supabase faltantes');

  console.error('VITE_SUPABASE_URL:', supabaseUrl);

  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Presente' : 'Faltante');

}



export const supabase = createClient(supabaseUrl, supabaseAnonKey);



export type Company = {
  id: string;
  name: string;
  business_type: 'revisiones_tecnicas' | 'policlinico' | 'escuela_conductores' | 'oficinas_administrativas';
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Location = {

  id: string;

  name: string;

  type: 'revision' | 'policlinico' | 'escuela_conductores' | 'central' | 'circuito';

  address?: string;

  notes?: string;

  created_at: string;

  updated_at: string;

  region?: 'lima' | 'provincia';

  checklist_url?: string;

  history_url?: string;

  company_id?: string;
  is_active?: boolean;

  business_type?: 'revisiones_tecnicas' | 'polclinico' | 'escuela_conductores' | 'oficinas_administrativas' | 'circuito_de_manejo';

  companies?: { id: string; name: string } | null;

};

/**
 * Observación de checklist ingestada desde Google Sheets.
 *
 * La escribe la Edge Function `checklist-ingest` (service role) cuando el
 * Apps Script "Sistema Centralizado Multisede - ESCON" exporta el checklist.
 * Solo se generan filas para las secciones que TIENEN comentario escrito:
 * las secciones en blanco no llegan a existir en la tabla.
 *
 * `sede` es texto plano y no FK a locations.id a propósito: los nombres de
 * sede del Excel ("ESCON MBS ATE") no tienen por qué coincidir 1:1 con los
 * registros de locations, y un FK las rechazaría.
 */
export type ChecklistObservacion = {

  id: string;

  sede: string;

  /**
   * Sede real en `locations`, resuelta por la Edge Function a partir del
   * nombre de la hoja. NULL cuando no hubo coincidencia: la fila se sigue
   * guardando (para que gerencia vea el dato) pero solo gerencia la ve.
   * El filtro por permisos de la app usa ESTE campo, no `sede`.
   */
  location_id: string | null;

  /** ISO date: 'YYYY-MM-DD' */
  fecha: string;

  /** 'PERSONAL' | 'EQUIPOS' — bloque del checklist del que salió la fila */
  bloque: string;

  seccion: string;

  comentario: string;

   origen: string;

   /**
    * Soft-delete. La columna sigue existiendo pero la interfaz ya no la usa:
    * el listado muestra todo junto y el borrado es definitivo.
    */
   archivado: boolean;

   created_at: string;

   updated_at: string;

};



export type Category = {

  id: string;

  name: string;

  slug?: string;

  description?: string;

  created_at: string;

  updated_at: string;

};



export type Subcategory = {

  id: string;

  category_id: string;

  name: string;

  slug?: string;

  description?: string;

  created_at: string;

  updated_at: string;

};



export type Area = {

  id: string;

  name: string;

  location_id: string;

  description?: string;

  created_at: string;

  updated_at: string;

};



export type InventoryMovement = {

  id: string;

  asset_id: string;

  type: 'entry' | 'exit' | 'transfer' | 'maintenance' | 'adjustment';

  origin_location_id?: string;

  origin_area_id?: string;

  destination_location_id?: string;

  destination_area_id?: string;

  quantity: number;

  reason?: string;

  performed_by?: string;

  movement_date: string;

  created_at: string;

};



export type AssetType = {

  id: string;

  name: string;

  created_at: string;

};



export type Asset = {

  id: string;

  asset_type_id: string;

  company_id?: string;

  category_id?: string;

  subcategory_id?: string;

  location_id?: string;

  area_id?: string;

  codigo_unico?: string;

  brand?: string;

  model?: string;

  serial_number?: string;

  anydesk_id?: string;

  ip_address?: string;

  phone_number?: string;

  camera_url?: string;

  camera_username?: string;

  camera_password?: string;

  capacity?: string;

  status: 'active' | 'inactive' | 'maintenance' | 'extracted';

  notes?: string;

  image_url?: string;

  created_at: string;

  updated_at: string;



  // Campos adicionales para maquinarias

  item?: string;

  descripcion?: string;

  unidad_medida?: string;

  cantidad?: number;

  condicion?: string;

  color?: string;

  gama?: string;

  fecha_adquisicion?: string;

  valor_estimado?: number;

  estado_uso?: string;



  // Technical fields (generic)

  operating_system?: string;

  processor?: string;

  ram?: string;

  bios_mode?: string;

  mac_address?: string;

  

  // Electrical/Network

  potencia_w?: number;

  estabilizador_w?: number;

  voltage_v?: number;

  frecuencia_hz?: number;

  velocidad_internet?: string;

  tipo_conector?: string;

  

  marca_motor?: string;

  brillo_lumens?: number;

  

  area?: string;

  placa?: string;



  // Campos adicionales para Cámaras

  name?: string;

  url?: string;

  username?: string;

  password?: string;

  port?: string;

  access_type?: 'url' | 'ivms' | 'esviz';

  auth_code?: string;



  // Campos adicionales para Celulares

  imei?: string;

  operator?: string;

  data_plan?: string;

  physical_condition?: string;

  sistema_operativo?: string;

  version_so?: string;

  almacenamiento?: string;

  bateria_estado?: string;

  accesorios?: string;



  // Campos adicionales para Impresoras/Escáneres

  tipo_impresion?: string;

  tecnologia_impresion?: string;

  velocidad_impresion?: string;

  resolucion?: string;



  // Campos adicionales para Monitores/Proyectores

  tamaño_pantalla?: string;

  resolucion_pantalla?: string;

  tipo_conexion?: string;
  luminosidad?: string;

  // Nuevos campos config-driven (Dinámicos)
  campos_especificos?: any;
  tipo_activo?: string;
  responsable_asignado?: string;
  proveedor?: string;
  garantia_hasta?: string;
  area_ubicacion?: string;
};



export type AssetWithDetails = Asset & {

  asset_types?: AssetType;

  categories?: Category;

  subcategories?: Subcategory;

  locations?: Location;

  areas?: Area;

};



export type CameraDisk = {

  id: string;

  camera_id: string;

  disk_number: number;

  total_capacity_gb: number;

  remaining_capacity_gb: number;

  used_space_gb: number;

  disk_type: 'HDD' | 'SSD' | 'NVMe' | 'Other';

  status: 'active' | 'full' | 'error' | 'maintenance' | 'extracted';

  brand?: string;

  serial_number?: string;

  stored_from?: string;

  stored_to?: string;

  notes?: string;

  created_at: string;

  updated_at: string;

};



export type StoredDisk = {

  id: string;

  camera_id?: string;

  disk_number?: number;

  brand?: string;

  serial_number?: string;

  disk_type?: string;

  total_capacity_gb: number;

  used_space_gb: number;

  remaining_capacity_gb: number;

  stored_from?: string;

  stored_to?: string;

  notes?: string;

  created_at: string;

  updated_at: string;

};



export type Camera = {

  id: string;

  name: string;

  location_id?: string;

  url: string;

  username?: string;

  password?: string;

  ip_address?: string;

  port?: string;

  brand?: string;

  model?: string;

  status: 'active' | 'inactive' | 'maintenance';

  notes?: string;

  recording_start_date?: string; // Nuevo campo

  access_type?: 'url' | 'ivms' | 'esviz'; // Tipo de acceso

  auth_code?: string; // Código de autenticación para IVMS y ESVIZ

  display_count?: number;

  created_at: string;

  updated_at: string;

  locations?: Location;

  camera_disks?: CameraDisk[];

};



export type WindowsCredential = {

  username: string;

  password?: string;

  description?: string;

};



export type Server = {

  id: string;

  name: string;

  location_id?: string;

  ip_address?: string;

  anydesk_id?: string;

  anydesk_password?: string;

  username?: string; // Mantener por compatibilidad o como usuario principal

  password?: string; // Mantener por compatibilidad o como contraseña principal

  backup_scanner_password?: string;

  windows_credentials?: WindowsCredential[];

  notes?: string;

  created_at: string;

  updated_at: string;

  locations?: Location;

};



export type SutranVisit = {

  id: string;

  visit_date: string;

  inspector_name: string;

  inspector_email?: string;

  inspector_phone?: string;

  location_id?: string;

  location_name: string;

  visit_type: 'programada' | 'no_programada' | 'de_gabinete';

  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';

  observations?: string;

  findings?: string;

  recommendations?: string;

  documents: string[];

  evidence_url?: string;

  estimated_duration?: string;

  estimated_cost?: number;

  created_by?: string;

  created_at: string;

  updated_at: string;

  locations?: Location;

};



export type BranchAudit = {

  id: string;

  location_id: string;

  auditor_name: string;

  administrator_name?: string;

  audit_date: string;

  status: 'excellent' | 'good' | 'regular' | 'critical';

  score: number;

  responses?: any;

  observations?: string;

  created_at: string;

  updated_at: string;

  locations?: Location;

};



export type VehicleType = {

  id: string;

  placa: string;

  marca: string;

  modelo: string;

  año: number;

  estado: 'activa' | 'inactiva' | 'en_proceso';

  ubicacion_actual: string;

  imagen_url?: string;

  fecha_ultimo_mantenimiento: string;

  notas: string;

  citv_emision?: string;

  citv_vencimiento?: string;

  soat_emision?: string;

  soat_vencimiento?: string;

  poliza_emision?: string;

  poliza_vencimiento?: string;

  contrato_alquiler_emision?: string;

  contrato_alquiler_vencimiento?: string;

  color?: string;

  image_position?: string;

  categoria?: string;

  created_at?: string;

  updated_at?: string;

};



// Re-exportar tipos y funciones de relaciones

export * from './relations';

export * from './sync';

