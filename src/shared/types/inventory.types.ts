// Multi-Enterprise Inventory Types
// This file contains all TypeScript types for the multi-company inventory system

export type BusinessType =
  | 'revisiones_tecnicas'
  | 'polclinico'
  | 'escuela_conductores'
  | 'oficinas_administrativas'
  | 'circuito_de_manejo'
  | 'almacen_general'

export interface Company {
  id: string;
  name: string;
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  categories?: Category;
}

export interface Location {
  id: string;
  company_id: string;
  name: string;
  business_type: BusinessType;
  address?: string;
  city?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  companies?: Company;
}

export interface Area {
  id: string;
  location_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  locations?: Location;
}

export type AssetStatus = 'active' | 'inactive' | 'maintenance' | 'extracted' | 'lost' | 'damaged';

export interface Asset {
  id: string;
  company_id: string;
  location_id: string;
  category_id?: string;
  subcategory_id?: string;
  area_id?: string;
  asset_type_id?: string;
  codigo_unico?: string;
  brand: string;
  model?: string;
  serial_number?: string;
  descripcion?: string;
  cantidad?: number;
  unidad_medida?: string;
  status: AssetStatus;
  estado_uso?: string;
  purchase_date?: string;
  purchase_price?: number;
  supplier?: string;
  warranty_expiry?: string;
  notes?: string;
  image_url?: string;
  is_deleted: boolean;
  deleted_at?: string;
  deleted_by?: string;
  created_at: string;
  updated_at: string;

  // Joined fields from relationships
  categories?: Category;
  subcategories?: Subcategory;
  locations?: Location;
  areas?: Area;
  companies?: Company;
  asset_types?: AssetType;
}

export interface AssetType {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface AssetWithDetails extends Asset {
  category_name?: string;
  category_slug?: string;
  subcategory_name?: string;
  subcategory_slug?: string;
  location_name?: string;
  location_company_id?: string;
  location_business_type?: BusinessType;
  company_name?: string;
  area_name?: string;
  asset_type_name?: string;
}

export interface AssetStatistics {
  category_id: string;
  category_name: string;
  category_slug: string;
  total_assets: number;
  active_assets: number;
  maintenance_assets: number;
  inactive_assets: number;
  total_value: number;
}

export interface MaintenanceRecord {
  id: string;
  asset_id: string;
  maintenance_type: 'preventive' | 'corrective' | 'technical_review' | 'repair';
  status: 'pending' | 'in_progress' | 'completed' | 'waiting_parts';
  priority?: 'high' | 'medium' | 'low';
  description: string;
  scheduled_date?: string;
  completed_date?: string;
  technician?: string;
  notes?: string;
  failure_cause?: string;
  solution_applied?: string;
  work_hours?: number;
  labor_cost?: number;
  service_provider?: string;
  invoice_number?: string;
  other_costs?: number;
  parts_used?: PartUsed[];
  next_maintenance_date?: string;
  maintenance_frequency?: number;
  total_cost?: number;
  warranty_claim?: boolean;
  warranty_details?: string;
  location_id?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;

  // Joined fields
  assets?: AssetWithDetails;
  locations?: Location;
}

export interface PartUsed {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_cost: number;
}

export interface MaintenanceStatistics {
  total_maintenance_records: number;
  active_maintenance_records: number;
  completed_maintenance_records: number;
  total_maintenance_cost: number;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
}

export interface AssetWithMaintenanceHistory {
  asset: AssetWithDetails;
  maintenanceRecords: MaintenanceRecord[];
  totalRecords: number;
  latestStatus: MaintenanceRecord['status'];
  latestMaintenanceType: MaintenanceRecord['maintenance_type'];
  latestDate: string;
}

export interface InventoryMovement {
  id: string;
  asset_id: string;
  type: 'entry' | 'exit' | 'transfer' | 'maintenance' | 'adjustment';
  origin_location_id?: string;
  origin_area_id?: string;
  destination_location_id?: string;
  destination_area_id?: string;
  quantity?: number;
  reason?: string;
  performed_by?: string;
  movement_date: string;
  created_at: string;

  // Joined fields
  assets?: AssetWithDetails;
  origin_locations?: Location;
  origin_areas?: Area;
  destination_locations?: Location;
  destination_areas?: Area;
}

export interface InventoryFilter {
  company_id?: string;
  location_id?: string;
  category_id?: string;
  subcategory_id?: string;
  status?: AssetStatus;
  search_term?: string;
  date_from?: string;
  date_to?: string;
}

export interface DashboardMetrics {
  total_assets: number;
  total_companies: number;
  total_locations: number;
  assets_by_status: Record<string, number>;
  assets_by_category: AssetStatistics[];
  recent_maintenance: MaintenanceRecord[];
  assets_needing_maintenance: AssetWithDetails[];
  total_maintenance_cost: number;
  assets_value_by_company: Array<{
    company_name: string;
    total_value: number;
    asset_count: number;
  }>;
  assets_by_location: Array<{
    location_name: string;
    total_assets: number;
    total_value: number;
  }>;
  total_inventory_value: number;
  recent_assets?: AssetWithDetails[];
}

export interface CategoryTree {
  category: Category;
  subcategories: Subcategory[];
  asset_count: number;
}

// Form types
export interface AssetFormData {
  company_id?: string;
  location_id: string;
  category_id?: string;
  subcategory_id?: string;
  area_id?: string;
  asset_type_id?: string;
  codigo_unico?: string;
  brand: string;
  model?: string;
  serial_number?: string;
  descripcion?: string;
  cantidad?: number;
  unidad_medida?: string;
  status: AssetStatus;
  purchase_date?: string;
  purchase_price?: number;
  supplier?: string;
  warranty_expiry?: string;
  notes?: string;
  image_url?: string;
}

export interface CompanyFormData {
  name: string;
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  is_active?: boolean;
}

export interface CategoryFormData {
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface SubcategoryFormData {
  category_id: string;
  name: string;
  slug: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Constants
export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  almacen_general: 'ALMACÉN GENERAL',
  oficinas_administrativas: 'OFICINAS CENTRALES',
  circuito_de_manejo: 'CIRCUITOS DE MANEJO',
  revisiones_tecnicas: 'REVISIONES TÉCNICAS',
  escuela_conductores: 'ESCUELAS DE CONDUCTORES',
  polclinico: 'POLICLÍNICOS',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  maintenance: 'En Mantenimiento',
  extracted: 'Extraído',
  lost: 'Perdido',
  damaged: 'Dañado',
};

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceRecord['maintenance_type'], string> = {
  preventive: 'Preventivo',
  corrective: 'Correctivo',
  technical_review: 'Revisión Técnica',
  repair: 'Reparación',
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceRecord['status'], string> = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  completed: 'Completado',
  waiting_parts: 'Esperando Repuestos',
};

export const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};
