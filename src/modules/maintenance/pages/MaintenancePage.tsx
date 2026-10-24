import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Wrench, MapPin, ShieldCheck, Search, TrendingUp, DollarSign, Clock, AlertCircle, Edit, Trash2, Calendar, Filter } from 'lucide-react';
import { FaFilePdf } from 'react-icons/fa6';
import { RiFileExcel2Fill } from 'react-icons/ri';
import { supabase, Location } from '../../../shared/services/supabase';
import MaintenanceForm from '../forms/MaintenanceForm';
import { useAuth } from '../../../app/providers/AuthContext';
import { useNotify } from '../../../shared/hooks/useNotify';
import { useAllowedLocations } from '../../../shared/hooks/useAllowedLocations';
import Pagination from '../../../shared/components/ui/Pagination';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import ActionToolbar from '../../../shared/components/ui/ActionToolbar';
import ActionsDropdown from '../../../shared/components/ui/ActionsDropdown';
import { useSelectionMode } from '../../../shared/hooks/useSelectionMode';
import FilterBar from '../../../shared/components/ui/FilterBar';
import ViewToggle from '../../../shared/components/ui/ViewToggle';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableCellPrimary, TableCellSecondary, TableActionButton } from '../../../shared/components/ui/Table';
import { generatePDF, generateExcel } from '../../../shared/utils/exportUtils';
import DetailModal, {
  DetailModalBody,
  StandardModalHeader,
  StandardModalFooter,

} from '../../../shared/components/ui/DetailModal';
import DateRangePicker from '../../../shared/components/ui/DateRangePicker';
import { MaintenanceRecord, AssetWithMaintenanceHistory, PRIORITY_LABELS, BUSINESS_TYPE_LABELS } from '../../../shared/types/inventory.types';

type MaintenanceProps = {
  categoryFilter?: string;
};

export default function Maintenance({ categoryFilter }: MaintenanceProps) {
  const { canEdit, hasPermission, user } = useAuth();
  const allowedLocations = useAllowedLocations();
  const { success: notifySuccess, error: notifyError, confirm } = useNotify();

  // Los administradores pueden ver, crear y editar mantenimiento, pero no eliminar.
  const isAdminRole = user?.role === 'administradores';
  const canEditRecord = canEdit() || hasPermission('maintenance-edit');
  const canDeleteRecord = !isAdminRole && canEdit();
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | undefined>();
  const [viewingRecord, setViewingRecord] = useState<MaintenanceRecord | undefined>();
  const [viewingAssetHistory, setViewingAssetHistory] = useState<AssetWithMaintenanceHistory | undefined>();
  const locationState = useLocation();
  const [searchTerm, setSearchTerm] = useState(locationState.state?.searchTerm || '');
  const [assetFilter, setAssetFilter] = useState(locationState.state?.assetFilter || '');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [rubroFilter, setRubroFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);

  const filteredLocations = useMemo(() => {
    if (rubroFilter.length === 0) return locations;
    return locations.filter(loc => loc.business_type && rubroFilter.includes(loc.business_type));
  }, [locations, rubroFilter]);
  const [machineTypeFilter, setMachineTypeFilter] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { selectionMode, setSelectionMode } = useSelectionMode();

  const handleToggleSelectionMode = () => {
    if (selectionMode) setSelectedIds([]);
    setSelectionMode(!selectionMode);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter.join(','), typeFilter.join(','), machineTypeFilter.join(','), JSON.stringify(allowedLocations)]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchMaintenanceRecords(), fetchLocations()]);
    setLoading(false);
  };

  const fetchMaintenanceRecords = async () => {
    try {
      // Si el usuario tiene restricción de sedes pero ninguna asignada, no hay nada que mostrar
      if (allowedLocations !== null && allowedLocations.length === 0) {
        setMaintenanceRecords([]);
        return;
      }

      let query = supabase
        .from('maintenance_records')
        .select('*, assets!inner(id, location_id, codigo_unico, item, brand, model, descripcion, serial_number, asset_types(*), locations(*)), locations!location_id(*)')
        .order('completed_date', { ascending: false, nullsFirst: false });

      if (statusFilter.length > 0) query = query.in('status', statusFilter);
      if (typeFilter.length > 0) query = query.in('maintenance_type', typeFilter);
      if (machineTypeFilter.length > 0) query = query.in('assets.asset_type_id', machineTypeFilter);

      // Filtrar por sedes permitidas directamente en la query
      if (allowedLocations !== null && allowedLocations.length > 0) {
        query = query.in('assets.location_id', allowedLocations);
      }

      const { data, error } = await query;
      if (error) throw error;

      setMaintenanceRecords((data as MaintenanceRecord[]) ?? []);
    } catch (err: any) {
      console.error('Error loading maintenance records:', err);
      notifyError(`Error al cargar registros: ${err.message}`);
    }
  };

  const fetchLocations = async () => {
    // Sin sedes asignadas y usuario restringido → no hay sedes que mostrar
    if (allowedLocations !== null && allowedLocations.length === 0) {
      setLocations([]);
      return;
    }

    let query = supabase.from('locations').select('*, companies(id, name)').eq('is_active', true).order('name');
    // Filtrar sedes directamente en la query
    if (allowedLocations !== null && allowedLocations.length > 0) {
      query = query.in('id', allowedLocations);
    }
    const { data, error } = await query;
    if (error) console.error('Error fetching locations:', error);
    if (data) setLocations(data);
  };

  // Removed copyToClipboard as it was unused

  const handleEditRecord = (record: MaintenanceRecord) => {
    setViewingRecord(undefined);
    setViewingAssetHistory(undefined);
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleViewAssetHistory = (assetHistory: AssetWithMaintenanceHistory) => {
    setViewingAssetHistory(assetHistory);
  };

  const handleDeleteRecord = async (record: MaintenanceRecord) => {
    const confirmed = await confirm(`¿Estás seguro de que quieres eliminar el registro de mantenimiento "${record.description}"?`, 'Confirmar Eliminación');
    if (confirmed) {
      try {
        const { error } = await supabase.from('maintenance_records').delete().eq('id', record.id);
        if (error) throw error;
        await fetchMaintenanceRecords();
        notifySuccess('Registro de mantenimiento eliminado correctamente');
      } catch (err: any) {
        notifyError('Error al eliminar el registro: ' + err.message);
      }
    }
  };

  const handleDeleteFromHistory = async (record: MaintenanceRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm(`¿Eliminar el registro "${record.description}"? Esta acción no se puede deshacer.`, 'Eliminar Registro');
    if (confirmed) {
      try {
        const { error } = await supabase.from('maintenance_records').delete().eq('id', record.id);
        if (error) throw error;
        // Actualizar el historial local sin cerrar el modal
        setViewingAssetHistory(prev => {
          if (!prev) return prev;
          const updated = prev.maintenanceRecords.filter(r => r.id !== record.id);
          if (updated.length === 0) {
            setViewingAssetHistory(undefined);
            return undefined;
          }
          const latest = [...updated].sort((a, b) => new Date(getRecordDate(b)).getTime() - new Date(getRecordDate(a)).getTime())[0];
          return {
            ...prev,
            maintenanceRecords: updated,
            totalRecords: updated.length,
            latestStatus: latest.status,
            latestMaintenanceType: latest.maintenance_type,
            latestDate: getRecordDate(latest),
          };
        });
        // Refrescar la lista principal en segundo plano
        fetchMaintenanceRecords();
        notifySuccess('Registro eliminado del historial correctamente');
      } catch (err: any) {
        notifyError('Error al eliminar el registro: ' + err.message);
      }
    }
  };

  const handleSaveRecord = async () => {
    setShowForm(false);
    setEditingRecord(undefined);
    setViewingRecord(undefined);
    setViewingAssetHistory(undefined);
    await fetchMaintenanceRecords();
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRecord(undefined);
    setViewingRecord(undefined);
    setViewingAssetHistory(undefined);
  };

  const getMaintenanceCategoryFromFilter = (filter?: string) => {
    if (!filter) return '';
    const categoryMap: Record<string, string> = {
      'maintenance-pending': 'Pendientes',
      'maintenance-in-progress': 'En Progreso',
      'maintenance-completed': 'Completados',
      'maintenance-preventive': 'Preventivo',
      'maintenance-corrective': 'Correctivo',
    };
    return categoryMap[filter] || '';
  };

  const statusLabels: Record<MaintenanceRecord['status'], string> = {
    pending: 'Pendiente',
    in_progress: 'En Progreso',
    completed: 'Completado',
    waiting_parts: 'En espera de repuestos',
  };

  const statusColors: Record<MaintenanceRecord['status'], string> = {
    pending: 'text-amber-600 font-semibold',
    in_progress: 'text-blue-600 font-semibold',
    completed: 'text-emerald-600 font-semibold',
    waiting_parts: 'text-amber-600 font-semibold',
  };

  const typeLabels: Record<MaintenanceRecord['maintenance_type'], string> = {
    preventive: 'Preventivo',
    corrective: 'Correctivo',
    technical_review: 'Revisión técnica',
    repair: 'Reparación',
  };


  // Ordenar por fecha de completado; si el registro aún no tiene fecha de completado, usa la fecha de creación
  const getRecordDate = (r: MaintenanceRecord): string => r.completed_date || r.created_at;

  // Agrupar mantenimientos por activo
  const assetsWithHistory = useMemo(() => {
    const grouped = new Map<string, AssetWithMaintenanceHistory>();

    maintenanceRecords.forEach(record => {
      if (!record.asset_id || !record.assets) return;

      const existing = grouped.get(record.asset_id);
      if (existing) {
        existing.maintenanceRecords.push(record);
        existing.totalRecords = existing.maintenanceRecords.length;
        // Actualizar el estado más reciente
        const latest = existing.maintenanceRecords.sort((a, b) =>
          new Date(getRecordDate(b)).getTime() - new Date(getRecordDate(a)).getTime()
        )[0];
        existing.latestStatus = latest.status;
        existing.latestMaintenanceType = latest.maintenance_type;
        existing.latestDate = getRecordDate(latest);
      } else {
        grouped.set(record.asset_id, {
          asset: record.assets,
          maintenanceRecords: [record],
          totalRecords: 1,
          latestStatus: record.status,
          latestMaintenanceType: record.maintenance_type,
          latestDate: getRecordDate(record),
        });
      }
    });

    return Array.from(grouped.values());
  }, [maintenanceRecords]);

  const sortedRecords = useMemo(() => {
    const filtered = assetsWithHistory.filter(assetHistory => {
      const matchesSearch =
        assetHistory.asset.codigo_unico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assetHistory.asset.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assetHistory.asset.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assetHistory.asset.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assetHistory.asset.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (assetHistory.asset as any).item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assetHistory.maintenanceRecords.some(r =>
          r.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.technician?.toLowerCase().includes(searchTerm.toLowerCase())
        );

      const categoryFromFilter = getMaintenanceCategoryFromFilter(categoryFilter);
      let matchesCategory = true;
      if (categoryFromFilter) {
        switch (categoryFilter) {
          case 'maintenance-pending': matchesCategory = assetHistory.latestStatus === 'pending'; break;
          case 'maintenance-in-progress': matchesCategory = assetHistory.latestStatus === 'in_progress'; break;
          case 'maintenance-completed': matchesCategory = assetHistory.latestStatus === 'completed'; break;
          case 'maintenance-preventive': matchesCategory = assetHistory.maintenanceRecords.some(r => r.maintenance_type === 'preventive'); break;
          case 'maintenance-corrective': matchesCategory = assetHistory.maintenanceRecords.some(r => r.maintenance_type === 'corrective'); break;
        }
      }

      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(assetHistory.latestStatus);
      const matchesType = typeFilter.length === 0 || typeFilter.includes(assetHistory.latestMaintenanceType);
      const matchesRubro = rubroFilter.length === 0 || (
        !!assetHistory.asset.locations?.business_type && rubroFilter.includes(assetHistory.asset.locations.business_type)
      );
      const assetLocId = assetHistory.asset.location_id || assetHistory.asset.locations?.id;
      const matchesLocation = locationFilter.length === 0 || (
        (assetLocId ? locationFilter.includes(assetLocId) : false) ||
        assetHistory.maintenanceRecords.some(r => r.location_id && locationFilter.includes(r.location_id))
      );
      const matchesAsset = !assetFilter || assetHistory.asset.id === assetFilter;
      const matchesMachineType = machineTypeFilter.length === 0 || machineTypeFilter.includes(assetHistory.asset.asset_type_id ?? '');

      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && new Date(assetHistory.latestDate) >= new Date(`${startDate}T00:00:00`);
      }
      if (endDate) {
        matchesDate = matchesDate && new Date(assetHistory.latestDate) <= new Date(`${endDate}T23:59:59.999`);
      }

      return matchesSearch && matchesCategory && matchesStatus && matchesType && matchesRubro && matchesLocation && matchesAsset && matchesMachineType && matchesDate;
    });

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'asset':
          aValue = (a.asset as any).item || a.asset.descripcion || `${a.asset.brand || ''} ${a.asset.model || ''}`.trim();
          bValue = (b.asset as any).item || b.asset.descripcion || `${b.asset.brand || ''} ${b.asset.model || ''}`.trim();
          break;
        case 'status':
          aValue = statusLabels[a.latestStatus as keyof typeof statusLabels];
          bValue = statusLabels[b.latestStatus as keyof typeof statusLabels];
          break;
        case 'type':
          aValue = typeLabels[a.latestMaintenanceType as keyof typeof typeLabels];
          bValue = typeLabels[b.latestMaintenanceType as keyof typeof typeLabels];
          break;
        case 'location':
          aValue = a.asset.locations?.name || '';
          bValue = b.asset.locations?.name || '';
          break;
        case 'date':
          aValue = a.latestDate;
          bValue = b.latestDate;
          break;
        default:
          aValue = (a as any)[sortConfig.key];
          bValue = (b as any)[sortConfig.key];
      }

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const result = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [assetsWithHistory, searchTerm, locationFilter, rubroFilter, statusFilter, typeFilter, categoryFilter, machineTypeFilter, assetFilter, sortConfig, startDate, endDate]);

  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedRecords.slice(startIndex, startIndex + itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedData.length && paginatedData.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedData.map(a => a.asset.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm(`¿Eliminar todos los mantenimientos de los ${selectedIds.length} activos seleccionados?`, 'Eliminación por Lote');
    if (confirmed) {
      try {
        const recordsToDelete = assetsWithHistory
          .filter(ah => selectedIds.includes(ah.asset.id))
          .flatMap(ah => ah.maintenanceRecords.map(r => r.id));

        if (recordsToDelete.length === 0) return;

        const { error } = await supabase.from('maintenance_records').delete().in('id', recordsToDelete);
        if (error) throw error;
        setSelectedIds([]);
        await fetchData();
        notifySuccess(`${recordsToDelete.length} registros eliminados correctamente`);
      } catch (err: any) {
        notifyError('Error: ' + err.message);
      }
    }
  };


  const hasActiveFilters = searchTerm || statusFilter.length > 0 || typeFilter.length > 0 || rubroFilter.length > 0 || locationFilter.length > 0 || machineTypeFilter.length > 0 || categoryFilter || assetFilter || startDate || endDate;

  const handleExportPDF = () => {
    const data = sortedRecords.map((ah, i) => ({
      nro: i + 1,
      activo: (ah.asset as any).item || ah.asset.descripcion || `${ah.asset.brand || ''} ${ah.asset.model || ''}`.trim() || 'Activo',
      codigo: ah.asset.codigo_unico || 'N/A',
      tipo: typeLabels[ah.latestMaintenanceType] || ah.latestMaintenanceType,
      estado: statusLabels[ah.latestStatus] || ah.latestStatus,
      ubicacion: ah.asset.locations?.name || 'N/A',
      responsable: ah.maintenanceRecords[0]?.technician || 'S.A.',
      total_registros: ah.totalRecords,
      costo_total: `S/ ${ah.maintenanceRecords.reduce((sum, r) => sum + (r.total_cost || 0), 0).toFixed(2)}`,
      ultima_fecha: new Date(String(ah.latestDate).includes('T') ? String(ah.latestDate) : `${ah.latestDate}T12:00:00`).toLocaleDateString('es-PE'),
    }));

    generatePDF({
      title: 'Reporte de Mantenimientos',
      filename: 'Mantenimientos',
      columns: [
        { header: 'N°', key: 'nro' },
        { header: 'Activo', key: 'activo' },
        { header: 'Código', key: 'codigo' },
        { header: 'Tipo', key: 'tipo' },
        { header: 'Estado', key: 'estado' },
        { header: 'Ubicación', key: 'ubicacion' },
        { header: 'Responsable', key: 'responsable' },
        { header: 'N° Registros', key: 'total_registros' },
        { header: 'Costo Total', key: 'costo_total' },
        { header: 'Última Fecha', key: 'ultima_fecha' },
      ],
      data,
    });
  };

  const handleExportExcel = async () => {
    const data = sortedRecords.map((ah, i) => {
      const itemOrDesc = (ah.asset as any).item || ah.asset.descripcion;
      const brandModel = `${ah.asset.brand || ''} ${ah.asset.model || ''}`.trim();
      const nombreActivo = itemOrDesc ? (brandModel ? `${itemOrDesc} (${brandModel})` : itemOrDesc) : (brandModel || 'Activo');

      return {
        nro: i + 1,
        activo: nombreActivo,
        codigo: ah.asset.codigo_unico || 'N/A',
        serie: ah.asset.serial_number || 'N/A',
        tipo: typeLabels[ah.latestMaintenanceType] || ah.latestMaintenanceType,
        estado: statusLabels[ah.latestStatus] || ah.latestStatus,
        ubicacion: ah.asset.locations?.name || 'N/A',
        responsable: ah.maintenanceRecords[0]?.technician || 'S.A.',
        total_registros: ah.totalRecords,
        horas_totales: ah.maintenanceRecords.reduce((sum, r) => sum + (r.work_hours || 0), 0).toFixed(1),
        costo_total: ah.maintenanceRecords.reduce((sum, r) => sum + (r.total_cost || 0), 0).toFixed(2),
        ultima_fecha: new Date(String(ah.latestDate).includes('T') ? String(ah.latestDate) : `${ah.latestDate}T12:00:00`).toLocaleDateString('es-PE'),
      };
    });

    await generateExcel({
      title: 'Reporte de Mantenimientos',
      filename: 'Mantenimientos',
      columns: [
        { header: 'N°', key: 'nro', width: 6 },
        { header: 'Activo', key: 'activo', width: 35 },
        { header: 'Código', key: 'codigo', width: 18 },
        { header: 'N° Serie', key: 'serie', width: 22 },
        { header: 'Tipo', key: 'tipo', width: 18 },
        { header: 'Estado', key: 'estado', width: 20 },
        { header: 'Ubicación', key: 'ubicacion', width: 22 },
        { header: 'Responsable', key: 'responsable', width: 25 },
        { header: 'N° Registros', key: 'total_registros', width: 14 },
        { header: 'Horas Totales', key: 'horas_totales', width: 14 },
        { header: 'Costo Total (S/)', key: 'costo_total', width: 18 },
        { header: 'Última Fecha', key: 'ultima_fecha', width: 18 },
      ],
      data,
    });
  };

  // Calcular estadísticas de mantenimiento
  const maintenanceStats = useMemo(() => {
    const totalCost = maintenanceRecords.reduce((sum, r) => sum + (r.total_cost || 0), 0);
    const totalHours = maintenanceRecords.reduce((sum, r) => sum + (r.work_hours || 0), 0);
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    maintenanceRecords.forEach(r => {
      byType[r.maintenance_type] = (byType[r.maintenance_type] || 0) + 1;
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });

    return {
      totalRecords: maintenanceRecords.length,
      totalCost,
      totalHours,
      averageCost: maintenanceRecords.length > 0 ? totalCost / maintenanceRecords.length : 0,
      byType,
      byStatus,
      completedCount: byStatus.completed || 0,
      pendingCount: byStatus.pending || 0,
      inProgressCount: byStatus.in_progress || 0,
    };
  }, [maintenanceRecords]);


  return (
    <div className="flex flex-col h-full bg-[#f8f9fc]">

      <div className="p-6 space-y-6">
        {/* Statistics Dashboard & Status Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-none border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate" title="Total Mantenimientos">Total Mants.</span>
              <Wrench size={14} className="text-blue-600 shrink-0" />
            </div>
            <p className="text-base font-black text-slate-800">{maintenanceStats.totalRecords}</p>
          </div>

          <div className="bg-white rounded-none border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate" title="Costo Total">Costo Total</span>
              <DollarSign size={14} className="text-emerald-600 shrink-0" />
            </div>
            <p className="text-base font-black text-slate-800 truncate">S/ {maintenanceStats.totalCost.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-none border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate" title="Horas Totales">Horas</span>
              <Clock size={14} className="text-amber-600 shrink-0" />
            </div>
            <p className="text-base font-black text-slate-800">{maintenanceStats.totalHours.toFixed(1)}</p>
          </div>

          <div className="bg-white rounded-none border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate" title="Pendientes">Pendientes</span>
              <AlertCircle size={14} className="text-amber-500 shrink-0" />
            </div>
            <p className="text-base font-black text-amber-600">{maintenanceStats.pendingCount}</p>
            <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: `${maintenanceStats.totalRecords > 0 ? (maintenanceStats.pendingCount / maintenanceStats.totalRecords) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-none border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate" title="En Progreso">En Progreso</span>
              <Clock size={14} className="text-blue-500 shrink-0" />
            </div>
            <p className="text-base font-black text-blue-600">{maintenanceStats.inProgressCount}</p>
            <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${maintenanceStats.totalRecords > 0 ? (maintenanceStats.inProgressCount / maintenanceStats.totalRecords) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-none border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate" title="Completados">Completados</span>
              <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            </div>
            <p className="text-base font-black text-emerald-600">{maintenanceStats.completedCount}</p>
            <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${maintenanceStats.totalRecords > 0 ? (maintenanceStats.completedCount / maintenanceStats.totalRecords) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <ActionToolbar
          totalItems={sortedRecords.length}
          searchComponent={
            <>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-12 pr-4 py-3 text-[12px] font-black text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 tracking-[0.1em]"
              />
            </>
          }
        >
          <FilterBar
            filters={[
              {
                key: 'business_type',
                placeholder: 'TODOS LOS RUBROS',
                icon: Filter,
                iconClassName: 'text-blue-500',
                wrapperClassName: 'md:min-w-[220px]',
                options: Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => ({ value, label }))
              },
              {
                key: 'location',
                placeholder: 'TODAS LAS SEDES',
                icon: MapPin,
                iconClassName: 'text-rose-500',
                wrapperClassName: 'md:min-w-[240px]',
                options: filteredLocations.map(loc => ({
                  value: loc.id,
                  label: loc.companies?.name ? `${loc.name} (${loc.companies.name})` : loc.name
                }))
              },
              { key: 'type', placeholder: 'TODOS LOS TIPOS', options: Object.entries(typeLabels).map(([key, label]) => ({ value: key, label })) },
              { key: 'status', placeholder: 'TODOS LOS ESTADOS', options: Object.entries(statusLabels).map(([key, label]) => ({ value: key, label })) },
            ]}
            values={{ business_type: rubroFilter, location: locationFilter, type: typeFilter, status: statusFilter, asset: assetFilter }}
            onChange={(key, value) => {
              if (key === 'business_type') {
                const newRubros = value as string[];
                setRubroFilter(newRubros);
                if (newRubros.length > 0) {
                  const validIds = new Set(locations.filter(l => l.business_type && newRubros.includes(l.business_type)).map(l => l.id));
                  setLocationFilter(locationFilter.filter(id => validIds.has(id)));
                }
              } else if (key === 'location') setLocationFilter(value as string[]);
              else if (key === 'type') setTypeFilter(value as string[]);
              else if (key === 'status') setStatusFilter(value as string[]);
              else if (key === 'asset') setAssetFilter(value as string);
              setCurrentPage(1);
            }}
            onClearAll={() => {
              setRubroFilter([]);
              setStatusFilter([]);
              setTypeFilter([]);
              setLocationFilter([]);
              setMachineTypeFilter([]);
              setAssetFilter('');
              setStartDate('');
              setEndDate('');
              setCurrentPage(1);
            }}
          />

          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
              setCurrentPage(1);
            }}
          />

          <ViewToggle viewMode={viewMode} onChange={setViewMode} />

          <ActionsDropdown
            selectionMode={
              canDeleteRecord
                ? {
                    active: selectionMode,
                    onToggle: handleToggleSelectionMode,
                    selectedCount: selectedIds.length,
                  }
                : undefined
            }
            onExportExcel={sortedRecords.length > 0 ? handleExportExcel : undefined}
            onExportPDF={sortedRecords.length > 0 ? handleExportPDF : undefined}
          />

          {hasPermission('maintenance-create') && (
            <button
              onClick={() => {
                setEditingRecord(undefined);
                setShowForm(true);
              }}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-[#002855] text-white text-[10px] font-normal uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
            >
              <Plus size={14} />
              Nuevo Mantenimiento
            </button>
          )}
          {canDeleteRecord && (
            <div className="flex gap-2">
              {selectionMode && selectedIds.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-none hover:bg-rose-100 transition-colors border border-rose-200"
                >
                  <Trash2 size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">
                    Eliminar ({selectedIds.length})
                  </span>
                </button>
              )}
            </div>
          )}
        </ActionToolbar>

        {
          loading ? (
            <LoadingSpinner label="Cargando mantenimientos..." />
          ) : sortedRecords.length === 0 ? (
            <div className="text-center py-12">
              <Wrench size={48} className="mx-auto mb-4 text-[#002855] opacity-20" />
              <p className="text-[#002855] font-black uppercase text-xs tracking-widest mb-2">Sin mantenimientos</p>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-tight">
                {hasActiveFilters ? 'Intenta ajustando los filtros' : 'Aún no se han registrado mantenimientos'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {paginatedData.map(assetHistory => (
                <div
                  key={assetHistory.asset.id}
                  className={`bg-white border transition-all flex flex-col group overflow-hidden relative hover:bg-slate-50/80 hover:border-blue-200/50 cursor-pointer ${selectedIds.includes(assetHistory.asset.id) ? 'border-blue-500' : 'border-slate-100'}`}
                  onClick={() => handleViewAssetHistory(assetHistory)}
                >
                  <div className="p-2 sm:p-4 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-3">
                      {canEdit() && selectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(assetHistory.asset.id)}
                          onChange={() => toggleSelect(assetHistory.asset.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[11px] sm:text-[13px] font-black text-[#002855] uppercase truncate leading-tight">
                          {(assetHistory.asset as any).item || assetHistory.asset.descripcion || `${assetHistory.asset.brand} ${assetHistory.asset.model}` || 'Activo'}
                        </h3>
                      </div>
                      <span className="shrink-0 hidden xs:inline-block sm:inline-block text-[9px] sm:text-[10px] font-medium text-slate-400">
                        {typeLabels[assetHistory.latestMaintenanceType]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[9px] sm:text-[10px] text-slate-500 flex-wrap">
                      <span className="font-mono font-semibold text-blue-500">{assetHistory.totalRecords} mantenimiento(s)</span>
                      <span className={`font-medium ${statusColors[assetHistory.latestStatus] || statusColors.pending}`}>
                        {statusLabels[assetHistory.latestStatus]}
                      </span>
                      <span className="flex items-center gap-0.5 ml-auto">
                        <MapPin size={9} className="text-rose-400 shrink-0" />
                        <span className="truncate max-w-[80px] sm:max-w-none">{assetHistory.asset.locations?.name || 'N/A'}</span>
                      </span>
                    </div>
                  </div>
                  {(canEditRecord || canDeleteRecord) && (
                    <div className="px-2 sm:px-4 py-1 sm:py-3 bg-slate-50/50 border-t border-slate-100 flex gap-1.5 sm:gap-2" onClick={(e) => e.stopPropagation()}>
                      {canEditRecord && (
                        <button onClick={() => handleEditRecord(assetHistory.maintenanceRecords[0])} className="text-[9px] sm:text-[10px] font-semibold text-blue-600 hover:underline">Editar</button>
                      )}
                      {canEditRecord && canDeleteRecord && <span className="text-slate-300">|</span>}
                      {canDeleteRecord && (
                        <button onClick={() => handleDeleteRecord(assetHistory.maintenanceRecords[0])} className="text-[9px] sm:text-[10px] font-semibold text-rose-500 hover:underline">Eliminar</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col rounded-none">
              <div className="bg-slate-50/50 border-b border-slate-100 relative z-20">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={sortedRecords.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              </div>

              {/* Mobile card view */}
              <div className="block md:hidden space-y-3">
                {paginatedData.map(assetHistory => (
                  <div
                    key={assetHistory.asset.id}
                    className={`bg-white border border-slate-200 p-4 active:bg-slate-50 transition-all cursor-pointer ${selectedIds.includes(assetHistory.asset.id) ? 'border-blue-500 bg-blue-50/20' : ''}`}
                    onClick={() => handleViewAssetHistory(assetHistory)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {canEdit() && selectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(assetHistory.asset.id)}
                          onChange={() => toggleSelect(assetHistory.asset.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-black text-slate-800 truncate leading-tight">
                          {(assetHistory.asset as any).item || assetHistory.asset.descripcion || `${assetHistory.asset.brand} ${assetHistory.asset.model}` || 'Activo'}
                        </p>
                        <p className="text-[10px] font-semibold text-blue-600 font-mono">{assetHistory.totalRecords} mantenimiento(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-[14px] font-semibold text-slate-800">
                        {typeLabels[assetHistory.latestMaintenanceType]}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className={`text-[14px] font-semibold ${statusColors[assetHistory.latestStatus] || statusColors.pending}`}>
                        {statusLabels[assetHistory.latestStatus]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-2">
                      <MapPin size={10} className="text-rose-400 shrink-0" />
                      <span className="truncate">{assetHistory.asset.locations?.name || 'Ubicación N/A'}</span>
                      <span className="ml-auto">{assetHistory.maintenanceRecords[0]?.technician || 'S.A.'}</span>
                    </div>
                    {(canEditRecord || canDeleteRecord) && (
                      <div className="flex gap-1.5 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                        {canEditRecord && (
                          <button onClick={() => handleEditRecord(assetHistory.maintenanceRecords[0])} className="text-[10px] font-bold text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded-sm w-full text-center">Editar</button>
                        )}
                        {canDeleteRecord && (
                          <button onClick={() => handleDeleteRecord(assetHistory.maintenanceRecords[0])} className="text-[10px] font-bold text-rose-600 hover:underline bg-rose-50 px-2 py-1 rounded-sm w-full text-center">Eliminar</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canEdit() && selectionMode && (
                        <TableHead className="w-12 text-center px-4 py-4">
                          <input
                            type="checkbox"
                            checked={paginatedData.length > 0 && selectedIds.length === paginatedData.length}
                            onChange={toggleSelectAll}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                          />
                        </TableHead>
                      )}
                      <TableHead sortable isSorted={sortConfig?.key === 'asset'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('asset')}>
                        Activo
                      </TableHead>
                      <TableHead sortable isSorted={sortConfig?.key === 'type'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('type')}>
                        Tipo
                      </TableHead>
                      <TableHead sortable isSorted={sortConfig?.key === 'location'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('location')}>
                        Ubicación
                      </TableHead>
                      <TableHead sortable isSorted={sortConfig?.key === 'status'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('status')}>
                        Estado
                      </TableHead>
                      <TableHead>
                        Responsable
                      </TableHead>
                      <TableHead className="text-center">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map(assetHistory => (
                      <TableRow
                        key={assetHistory.asset.id}
                        onClick={() => handleViewAssetHistory(assetHistory)}
                      >
                        {canEdit() && selectionMode && (
                          <TableCell className="w-12 text-center px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(assetHistory.asset.id)}
                              onChange={() => toggleSelect(assetHistory.asset.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-bold">
                          <div className="flex flex-col">
                            <TableCellPrimary>
                              {(assetHistory.asset as any).item || assetHistory.asset.descripcion || `${assetHistory.asset.brand} ${assetHistory.asset.model}` || 'Activo'}
                            </TableCellPrimary>
                            <TableCellSecondary>
                              <span className="ml-0">{assetHistory.totalRecords} mantenimiento(s)</span>
                            </TableCellSecondary>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TableCellSecondary>
                            {typeLabels[assetHistory.latestMaintenanceType]}
                          </TableCellSecondary>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <MapPin size={13} className="text-rose-500 shrink-0" />
                            <TableCellSecondary>{assetHistory.asset.locations?.name || 'Ubicación N/A'}</TableCellSecondary>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TableCellSecondary>
                            <span className={statusColors[assetHistory.latestStatus] || statusColors.pending}>
                              {statusLabels[assetHistory.latestStatus]}
                            </span>
                          </TableCellSecondary>
                        </TableCell>
                        <TableCell>
                          <TableCellSecondary>{assetHistory.maintenanceRecords[0]?.technician || 'S.A.'}</TableCellSecondary>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            {canEditRecord && (
                              <TableActionButton
                                icon={<Edit size={14} />}
                                onClick={() => handleEditRecord(assetHistory.maintenanceRecords[0])}
                                title="Editar"
                              />
                            )}
                            {canDeleteRecord && (
                              <TableActionButton
                                icon={<Trash2 size={14} />}
                                onClick={() => handleDeleteRecord(assetHistory.maintenanceRecords[0])}
                                title="Eliminar"
                                variant="danger"
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )
        }

        {
          showForm && (
            <MaintenanceForm editMaintenance={editingRecord} onClose={handleCloseForm} onSave={handleSaveRecord} />
          )
        }

        {
          viewingRecord && (
            <DetailModal maxWidth="3xl" onClose={() => setViewingRecord(undefined)} closeOnBackdrop overlayStyle={{ zIndex: 210 }}>
              <StandardModalHeader
                title={`${(viewingRecord?.assets as any)?.item || (viewingRecord?.assets as any)?.descripcion || (viewingRecord?.assets as any)?.brand || 'Activo'} ${(viewingRecord?.assets as any)?.model}`}
                subtitle={`${viewingRecord?.assets?.asset_types?.name}`}
                icon={Wrench}
                onClose={() => setViewingRecord(undefined)}
              />

              <DetailModalBody className="space-y-4">

                {/* Estado / tipo / prioridad */}
                <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-slate-100">
                  <span className={`text-[14px] font-semibold ${statusColors[viewingRecord?.status || 'pending']}`}>
                    {statusLabels[viewingRecord?.status || 'pending']}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {typeLabels[viewingRecord?.maintenance_type || 'preventive']}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {PRIORITY_LABELS[viewingRecord?.priority || 'medium']}
                  </span>
                  <span className="ml-auto text-[11px] font-mono text-slate-500">
                    {viewingRecord?.completed_date
                      ? new Date(String(viewingRecord.completed_date as any).includes('T') ? String(viewingRecord.completed_date as any) : `${viewingRecord.completed_date as any}T12:00:00`).toLocaleDateString('es-PE')
                      : 'Pendiente'}
                  </span>
                </div>

                {/* Description */}
                <div className="bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descripción / Motivo</p>
                  <p className="text-[11px] text-slate-700 leading-relaxed">{viewingRecord?.description}</p>
                </div>

                {/* Diagnosis section */}
                {(viewingRecord?.failure_cause || viewingRecord?.solution_applied) && (
                  <div className="space-y-2">
                    {viewingRecord?.failure_cause && (
                      <div className="bg-slate-50 border border-slate-200 border-l-2 border-l-slate-400 p-3">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Causa Raíz</p>
                        <p className="text-[11px] text-slate-700 leading-relaxed">{viewingRecord.failure_cause}</p>
                      </div>
                    )}
                    {viewingRecord?.solution_applied && (
                      <div className="bg-slate-50 border border-slate-200 border-l-2 border-l-slate-600 p-3">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Solución Aplicada</p>
                        <p className="text-[11px] text-slate-700 leading-relaxed">{viewingRecord.solution_applied}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Info grid: Technician, Provider, Invoice, Dates */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Responsable</p>
                    <p className="text-[11px] font-medium text-slate-700 truncate">{viewingRecord?.technician || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Proveedor</p>
                    <p className="text-[11px] font-medium text-slate-700 truncate">{viewingRecord?.service_provider || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">N° Factura</p>
                    <p className="text-[11px] font-medium text-slate-600 truncate">{viewingRecord?.invoice_number || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Horas Trabajo</p>
                    <p className="text-[11px] font-medium text-slate-700">{viewingRecord?.work_hours || 0} h</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Próximo Mant.</p>
                    <p className="text-[11px] font-medium text-slate-700">
                      {viewingRecord?.next_maintenance_date
                        ? new Date(String(viewingRecord.next_maintenance_date).includes('T') ? String(viewingRecord.next_maintenance_date) : `${viewingRecord.next_maintenance_date}T12:00:00`).toLocaleDateString('es-PE')
                        : 'No programado'}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Frecuencia</p>
                    <p className="text-[11px] font-medium text-slate-600">
                      {viewingRecord?.maintenance_frequency ? `Cada ${viewingRecord.maintenance_frequency} días` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Costs row (sobrio) */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-3 text-center">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mano de Obra</p>
                    <p className="text-[12px] font-bold text-slate-700 font-mono">S/ {viewingRecord?.labor_cost?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 text-center">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Otros Gastos</p>
                    <p className="text-[12px] font-bold text-slate-700 font-mono">S/ {viewingRecord?.other_costs?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 text-center">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Repuestos</p>
                    <p className="text-[12px] font-bold text-slate-700 font-mono">
                      S/ {(viewingRecord?.parts_used as any[] || []).reduce((s: number, p: any) => s + (p.total_cost || 0), 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-slate-100 border border-slate-300 p-3 text-center">
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total</p>
                    <p className="text-[13px] font-bold text-[#002855] font-mono">S/ {viewingRecord?.total_cost?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>

                {/* Parts used */}
                {viewingRecord?.parts_used && Array.isArray(viewingRecord?.parts_used) && (viewingRecord?.parts_used as any[]).length > 0 && (
                  <div className="border border-slate-200">
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Repuestos Utilizados</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {(viewingRecord?.parts_used as any[]).map((part: any, idx: number) => (
                        <div key={idx} className="px-3 py-2 flex justify-between items-center">
                          <span className="text-[10px] font-medium text-slate-700">{part.name}</span>
                          <span className="text-[10px] font-mono text-slate-500">{part.quantity} {part.unit} × S/ {part.unit_price?.toFixed(2)} = <span className="font-bold text-slate-700">S/ {part.total_cost?.toFixed(2)}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warranty */}
                <div className="flex items-center gap-3 px-3 py-2 border bg-slate-50 border-slate-200">
                  <ShieldCheck size={16} className="text-slate-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-slate-700">
                      {viewingRecord?.warranty_claim ? 'GARANTÍA: RECLAMO ACTIVO' : 'Sin reclamo de garantía'}
                    </span>
                    {viewingRecord?.warranty_details && (
                      <p className="text-[10px] text-slate-600 mt-0.5 truncate">{viewingRecord.warranty_details}</p>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {viewingRecord?.notes && (
                  <div className="bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notas</p>
                    <p className="text-[10px] text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingRecord.notes}</p>
                  </div>
                )}
              </DetailModalBody>

              <StandardModalFooter
                onClose={() => setViewingRecord(undefined)}
                onEdit={canEditRecord ? () => handleEditRecord(viewingRecord) : undefined}
                editLabel="Editar"
              />
            </DetailModal>
          )
        }

        {
          viewingAssetHistory && (
            <DetailModal maxWidth="3xl" onClose={() => setViewingAssetHistory(undefined)} closeOnBackdrop>
              <StandardModalHeader
                title={(viewingAssetHistory?.asset as any)?.item || viewingAssetHistory?.asset.descripcion || `${viewingAssetHistory?.asset.brand} ${viewingAssetHistory?.asset.model}` || 'Activo'}
                subtitle={`${viewingAssetHistory?.asset.asset_types?.name} • ${viewingAssetHistory?.totalRecords} mantenimiento(s)`}
                icon={Wrench}
                onClose={() => setViewingAssetHistory(undefined)}
              />

              <DetailModalBody>
                {/* Asset info summary bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Marca / Modelo</p>
                    <p className="text-[11px] font-semibold text-[#002855] truncate">
                      {viewingAssetHistory?.asset.brand} {viewingAssetHistory?.asset.model}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Serie</p>
                    <p className="text-[11px] font-normal text-slate-600 truncate font-mono">
                      {viewingAssetHistory?.asset.serial_number || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Ubicación</p>
                    <p className="text-[11px] font-normal text-slate-600 truncate flex items-center gap-1">
                      <MapPin size={11} className="text-rose-500 shrink-0" />
                      {viewingAssetHistory?.asset.locations?.name || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 px-3 py-2.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Estado</p>
                    <p className={`text-[14px] font-semibold ${statusColors[viewingAssetHistory?.latestStatus || 'pending']}`}>
                      {statusLabels[viewingAssetHistory?.latestStatus || 'pending']}
                    </p>
                  </div>
                </div>

                {/* History section header */}
                <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                  <div className="w-1 h-4 bg-blue-600 shrink-0" />
                  <h3 className="text-[11px] font-bold text-[#002855] uppercase tracking-widest">
                    Historial de Mantenimientos
                  </h3>
                  <span className="text-[11px] font-bold text-blue-600">
                    {viewingAssetHistory?.totalRecords || 0}
                  </span>
                </div>

                {/* Scrollable compact cards list */}
                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                  {viewingAssetHistory?.maintenanceRecords
                    .sort((a, b) => new Date(getRecordDate(b)).getTime() - new Date(getRecordDate(a)).getTime())
                    .map((record) => {
                      const statusBorderColor: Record<string, string> = {
                        pending: 'border-l-amber-400',
                        in_progress: 'border-l-blue-400',
                        completed: 'border-l-emerald-400',
                        waiting_parts: 'border-l-orange-400',
                      };
                      return (
                        <div
                          key={record.id}
                          onClick={() => setViewingRecord(record)}
                          className={`bg-white border border-slate-200 border-l-[3px] ${statusBorderColor[record.status] || 'border-l-slate-300'} hover:bg-blue-50/40 hover:border-blue-200 cursor-pointer transition-all group`}
                        >
                          <div className="px-4 py-3 flex items-center gap-3">
                            {/* Left: date column */}
                            <div className="shrink-0 text-center w-14">
                              <p className="text-[10px] font-mono font-bold text-slate-700 leading-tight">
                                {new Date(String(getRecordDate(record)).includes('T') ? String(getRecordDate(record)) : `${getRecordDate(record)}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                              </p>
                              <p className="text-[9px] font-mono text-slate-400">
                                {new Date(String(getRecordDate(record)).includes('T') ? String(getRecordDate(record)) : `${getRecordDate(record)}T12:00:00`).getFullYear()}
                              </p>
                            </div>

                            {/* Divider */}
                            <div className="w-px h-8 bg-slate-200 shrink-0" />

                            {/* Center: summary info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-slate-800 truncate leading-tight">
                                {record.description}
                              </p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[14px] font-semibold text-slate-800">
                                  {typeLabels[record.maintenance_type]}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className={`text-[14px] font-semibold ${statusColors[record.status] || statusColors.pending}`}>
                                  {statusLabels[record.status]}
                                </span>
                                {record.technician && (
                                  <span className="text-[9px] text-slate-400 truncate">
                                    • {record.technician}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right: cost + delete + arrow */}
                            <div className="shrink-0 text-right flex items-center gap-2">
                              {(record.total_cost != null && record.total_cost > 0) && (
                                <span className="text-[11px] font-bold text-emerald-700 font-mono">
                                  S/ {record.total_cost.toFixed(2)}
                                </span>
                              )}
                              {canDeleteRecord && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteFromHistory(record, e)}
                                  title="Eliminar este registro"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                              <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </DetailModalBody>

              <StandardModalFooter
                onClose={() => setViewingAssetHistory(undefined)}
              />
            </DetailModal>
          )
        }
      </div>
    </div>
  );
}
