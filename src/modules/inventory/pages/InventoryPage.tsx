import { useState, useEffect, useMemo } from 'react';
import { Edit, Trash2, MapPin, Upload, Package, Layers, LayoutGrid, List, BarChart3, FileSpreadsheet, Circle, Plus, Filter } from 'lucide-react';
import { useNotify } from '../../../shared/hooks/useNotify';
import { supabase, AssetWithDetails } from '../../../shared/services/supabase';
import { generateExcel, generatePDF } from '../../../shared/utils/exportUtils';
import AssetForm from '../forms/AssetForm';
import AssetDetails from '../components/AssetDetails';
import DecoupleModal from '../components/DecoupleModal';
import ExcelImportModal from '../../../shared/components/ExcelImportModal';
import { generateAndDownloadTemplate } from '../../../shared/utils/excelTemplate';
import Pagination from '../../../shared/components/ui/Pagination';
import { useAuth } from '../../../app/providers/AuthContext';
import SelectionModeButton from '../../../shared/components/ui/SelectionModeButton';
import { useSelectionMode } from '../../../shared/hooks/useSelectionMode';
import SearchBar from '../../../shared/components/ui/SearchBar';
import { useInventory } from '../hooks/useInventory';
import { useAllowedLocations } from '../../../shared/hooks/useAllowedLocations';
import { PATH_CATEGORY_MAP, SUBCATEGORY_SLUG_MAP, STATUS_MAP } from '../constants/inventory.constants';
import InventoryDashboard from '../components/InventoryDashboard';
import { InventoryFilter, BUSINESS_TYPE_LABELS } from '../../../shared/types/inventory.types';
import ActionToolbar from '../../../shared/components/ui/ActionToolbar';
import FilterBar from '../../../shared/components/ui/FilterBar';
import ExportButtons from '../../../shared/components/ui/ExportButtons';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableCellPrimary,
  TableCellSecondary,
  TableActionButton,
} from '../../../shared/components/ui/Table';

type InventoryProps = {
  categoryFilter?: string;
  subcategoryFilter?: string;
};

const STATUS_COLOR_CLASSES: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  slate: 'bg-slate-100 text-slate-600',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  violet: 'bg-violet-100 text-violet-700',
  teal: 'bg-teal-100 text-teal-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  green: 'bg-green-100 text-green-700',
  purple: 'bg-purple-100 text-purple-700',
};

const getStatusColorClass = (estado_uso?: string | null): string =>
  STATUS_COLOR_CLASSES[STATUS_MAP[estado_uso || '']?.color] || STATUS_COLOR_CLASSES.slate;

export default function Inventory({ categoryFilter, subcategoryFilter }: InventoryProps) {
  const { success: notifySuccess, error: notifyError, confirm } = useNotify();
  const { canEdit, hasPermission, user } = useAuth();
  const allowedLocations = useAllowedLocations();

  // UI-only state
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showAssetDetails, setShowAssetDetails] = useState(false);
  const [showDecoupleModal, setShowDecoupleModal] = useState(false);
  const [decoupleAssetData, setDecoupleAssetData] = useState<AssetWithDetails | undefined>();
  const [selectedAsset, setSelectedAsset] = useState<AssetWithDetails | undefined>();
  const [editingAsset, setEditingAsset] = useState<AssetWithDetails | undefined>();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectingAll, setSelectingAll] = useState(false);
  const { selectionMode, setSelectionMode } = useSelectionMode();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [showDashboard, setShowDashboard] = useState(false);

  const handleToggleSelectionMode = () => {
    if (selectionMode) setSelectedIds(new Set());
    setSelectionMode(!selectionMode);
  };

  // Permite editar/eliminar activos si el usuario puede editarlos globalmente
  // o si tiene permisos específicos de editar/eliminar inventario
  const canEditAsset = (asset: AssetWithDetails): boolean => {
    return canEdit() || hasPermission('inventory-edit') || hasPermission('inventory-delete');
  };

  // Determinar los filtros de empresa/sede según el rol y accesos del usuario
  const multiEnterpriseFilters: InventoryFilter = (() => {
    // Roles con acceso total ven todo
    if (allowedLocations === null) {
      return {};
    }
    // Otros roles solo ven sus sedes asignadas
    if (allowedLocations.length > 0) {
      return {
        location_id: allowedLocations[0] // Usar la primera sede para el dashboard
      };
    }
    // Sin sedes asignadas = no ve nada
    return { location_id: 'none' };
  })();

  // Use hook for inventory logic
  const {
    inventory,
    categories,
    subcategories,
    locations,
    loading,
    totalCount,
    searchTerm,
    selectedLocations,
    filterStatus,
    filterRubro,
    currentPage,
    itemsPerPage,
    totalPages,
    sortConfig,
    setSearchTerm,
    setSelectedLocations,
    setFilterStatus,
    setFilterRubro,
    setCurrentPage,
    setItemsPerPage,
    refresh,
    handleSort,
    fetchAllFilteredIds,
    fetchAllFilteredData,
  } = useInventory({ categoryFilter, subcategoryFilter });

  const filteredLocations = useMemo(() => {
    if (!filterRubro || filterRubro.length === 0) return locations;
    return locations.filter(loc => loc.business_type && filterRubro.includes(loc.business_type));
  }, [locations, filterRubro]);

  // Listen to TopHeader action events
  useEffect(() => {
    const onNew = () => setShowAssetForm(true);
    const onExport = () => handleExportExcel();
    const onExportPdf = () => handleExportPdf();
    const onSearch = (e: Event) => setSearchTerm((e as CustomEvent).detail ?? '');

    window.addEventListener('inventory:new', onNew);
    window.addEventListener('inventory:export', onExport);
    window.addEventListener('inventory:export-pdf', onExportPdf);
    window.addEventListener('inventory:search', onSearch);

    return () => {
      window.removeEventListener('inventory:new', onNew);
      window.removeEventListener('inventory:export', onExport);
      window.removeEventListener('inventory:export-pdf', onExportPdf);
      window.removeEventListener('inventory:search', onSearch);
    };
  }, [inventory]); // Use inventory dependency to ensure export uses latest data

  const handleDeleteAsset = async (asset: AssetWithDetails) => {
    const confirmed = await confirm(
      `Se eliminará permanentemente ${asset.codigo_unico} — ${asset.brand} ${asset.model}. Esta acción no se puede deshacer.`,
      '¿Eliminar activo?'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('assets').delete().eq('id', asset.id);
      if (error) throw error;
      await refresh();
      notifySuccess(`"${asset.brand} ${asset.model}" se eliminó correctamente`, '¡Eliminado!');
    } catch (err: any) {
      notifyError('Error al eliminar: ' + err.message, 'Error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await confirm(
      `Se eliminarán ${selectedIds.size} activos seleccionados. Esta acción no se puede deshacer.`,
      `¿Eliminar ${selectedIds.size} activos?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('assets').delete().in('id', Array.from(selectedIds));
      if (error) throw error;
      const count = selectedIds.size;
      setSelectedIds(new Set());
      await refresh();
      notifySuccess(`${count} activos eliminados correctamente`, '¡Eliminación masiva!');
    } catch (err: any) {
      notifyError('Error al eliminar: ' + err.message, 'Error');
    }
  };

  const handleDecoupleAsset = (asset: AssetWithDetails) => {
    setDecoupleAssetData(asset);
    setShowDecoupleModal(true);
  };

  // FIX: esta función se usaba en el checkbox "seleccionar todo" de la tabla
  // de escritorio pero nunca estaba definida. Ahora marca TODOS los items que
  // coinciden con los filtros actuales (no solo los de la página visible).
  const handleSelectAll = async () => {
    if (selectingAll) return;
    const allSelected = totalCount > 0 && selectedIds.size === totalCount;
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectingAll(true);
    try {
      const ids = await fetchAllFilteredIds();
      setSelectedIds(new Set(ids));
    } catch {
      notifyError('Error al seleccionar todos los items');
    } finally {
      setSelectingAll(false);
    }
  };

  const getExportItems = async () => {
    const allFiltered = await fetchAllFilteredData();
    if (selectedIds.size > 0) {
      return allFiltered.filter((a: any) => selectedIds.has(a.id));
    }
    return allFiltered;
  };

  // Ordena los activos para el reporte: Categoría → Sede → Nombre del activo → Código
  const sortForExport = (items: any[]) => {
    return [...items].sort((a: any, b: any) => {
      const catA = a.categories?.name || '';
      const catB = b.categories?.name || '';
      if (catA !== catB) return catA.localeCompare(catB, 'es');
      const locA = a.locations?.name || '';
      const locB = b.locations?.name || '';
      if (locA !== locB) return locA.localeCompare(locB, 'es');
      const itemA = a.item || a.descripcion || '';
      const itemB = b.item || b.descripcion || '';
      if (itemA !== itemB) return itemA.localeCompare(itemB, 'es');
      return (a.codigo_unico || '').localeCompare(b.codigo_unico || '', 'es');
    });
  };

  const getSedeNameById = (id: string) => locations.find(l => l.id === id)?.name;

  // Sedes efectivamente aplicadas en la exportación: las del filtro activo o,
  // si no hay filtro, las restringidas por los permisos del usuario (allowedLocations).
  const getEffectiveFilteredSedes = (): string[] => {
    if (selectedLocations.length > 0) return selectedLocations;
    if (allowedLocations !== null && allowedLocations.length > 0) return allowedLocations;
    return [];
  };

  // Nombre de la sede a usar en el encabezado y el nombre de archivo del reporte.
  const getSedeNameForExport = (): string | undefined => {
    const sedes = getEffectiveFilteredSedes();
    if (sedes.length === 1) return getSedeNameById(sedes[0]);
    return undefined;
  };

  // Construye el resumen de filtros activos para mostrarlo en el reporte
  const buildExportFilters = () => {
    const activos: string[] = [];
    if (searchTerm) activos.push(`Búsqueda: "${searchTerm}"`);
    const sedes = getEffectiveFilteredSedes();
    if (sedes.length > 0) {
      const nombres = sedes.map(getSedeNameById).filter((n): n is string => !!n);
      if (nombres.length > 0) activos.push(`Sedes: ${nombres.join(', ')}`);
    }
    if (filterStatus.length > 0) activos.push(`Estados: ${filterStatus.join(', ')}`);
    if (filterRubro.length > 0) {
      activos.push(`Rubros: ${filterRubro.map(r => BUSINESS_TYPE_LABELS[r as keyof typeof BUSINESS_TYPE_LABELS] || r).join(', ')}`);
    }
    if (categoryFilter || subcategoryFilter) activos.push('Categoría activa');
    return activos;
  };

  const handleExportExcel = async () => {
    try {
      const itemsToExport = sortForExport(await getExportItems());
      const sedeName = getSedeNameForExport();
      const filtros = buildExportFilters();

      const data = itemsToExport.map((a: any) => ({
        code: a.codigo_unico || '—',
        equipo: a.item || a.descripcion || a.subcategories?.name || '—',
        category: a.categories?.name || '—',
        subcategory: a.subcategories?.name || '—',
        brand: a.brand || '—',
        model: a.model || '—',
        serial: a.serial_number || '—',
        location: a.locations?.name || '—',
        area: a.areas?.name || a.area_ubicacion || 'Otros',
        cost: a.valor_estimado != null ? `S/ ${Number(a.valor_estimado).toFixed(2)}` : (a.purchase_price != null ? `S/ ${Number(a.purchase_price).toFixed(2)}` : '—'),
        status: a.status || a.estado_uso || '—',
        purchase_date: a.fecha_adquisicion ? new Date(String(a.fecha_adquisicion).includes('T') ? String(a.fecha_adquisicion) : `${a.fecha_adquisicion}T12:00:00`).toLocaleDateString('es-PE') : '—',
        notes: a.notes || ''
      }));

      await generateExcel({
        title: 'Reporte de Inventario de Activos',
        filename: 'Inventario',
        sede: sedeName,
        sheetBy: 'category',
        filters: filtros,
        registros: itemsToExport.length,
        columns: [
          { header: 'CÓDIGO', key: 'code', width: 15 },
          { header: 'NOMBRE DEL EQUIPO', key: 'equipo', width: 28 },
          { header: 'CATEGORÍA', key: 'category', width: 25 },
          { header: 'SUBCATEGORÍA', key: 'subcategory', width: 25 },
          { header: 'MARCA', key: 'brand', width: 15 },
          { header: 'MODELO', key: 'model', width: 20 },
          { header: 'SERIE', key: 'serial', width: 20 },
          { header: 'UBICACIÓN', key: 'location', width: 25 },
          { header: 'ÁREA', key: 'area', width: 20 },
          { header: 'COSTO (S/)', key: 'cost', width: 15 },
          { header: 'ESTADO', key: 'status', width: 15 },
          { header: 'FECHA ADQ.', key: 'purchase_date', width: 15 },
          { header: 'OBSERVACIONES', key: 'notes', width: 30 }
        ],
        data
      });
    } catch (e) {
      console.error(e);
      notifyError('Error al exportar a Excel', 'Error de exportación');
    }
  };

  const handleExportPdf = async () => {
    try {
      const itemsToExport = sortForExport(await getExportItems());
      const sedeName = getSedeNameForExport();
      const filtros = buildExportFilters();

      const data = itemsToExport.map((a: any) => ({
        equipo: a.item || a.descripcion || a.subcategories?.name || '—',
        category: a.categories?.name || '—',
        marca_modelo: `${a.brand || ''} ${a.model || ''}`.trim() || '—',
        serial: a.serial_number || '—',
        location: a.locations?.name || '—',
        area: a.areas?.name || a.area_ubicacion || 'Otros',
        cost: a.valor_estimado != null ? `S/ ${Number(a.valor_estimado).toFixed(2)}` : (a.purchase_price != null ? `S/ ${Number(a.purchase_price).toFixed(2)}` : '—')
      }));

      await generatePDF({
        title: 'Reporte de Inventario de Activos',
        filename: 'Inventario',
        sede: sedeName,
        groupBy: 'category',
        filters: filtros,
        registros: itemsToExport.length,
        columns: [
          { header: 'Nombre del Equipo', key: 'equipo' },
          { header: 'Categoría', key: 'category' },
          { header: 'Marca/Modelo', key: 'marca_modelo' },
          { header: 'Serie', key: 'serial' },
          { header: 'Ubicación', key: 'location' },
          { header: 'Área', key: 'area' },
          { header: 'Costo (S/)', key: 'cost' }
        ],
        data
      });
    } catch (e) {
      console.error(e);
      notifyError('Error al exportar a PDF', 'Error de exportación');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        <ActionToolbar
          totalItems={totalCount}
          label="Activos"
          searchComponent={
            <SearchBar
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(value) => { setSearchTerm(value); setCurrentPage(1); }}
            />
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
                multiple: true,
                options: filteredLocations.map(loc => ({
                  value: loc.id,
                  label: loc.companies?.name ? `${loc.name} (${loc.companies.name})` : loc.name
                }))
              },
              {
                key: 'status', placeholder: 'Todos los estados', icon: Circle, iconClassName: 'text-emerald-500', wrapperClassName: 'md:min-w-[170px]', options: [
                  { value: 'Operativo', label: 'Operativo' },
                  { value: 'Inoperativo', label: 'Inoperativo' },
                  { value: 'En Reparación', label: 'En Reparación' },
                  { value: 'Baja', label: 'De Baja' },
                ]
              },
            ]}
            values={{ business_type: filterRubro, location: selectedLocations, status: filterStatus }}
            onChange={(key, value) => {
              if (key === 'business_type') {
                const newRubros = value as string[];
                setFilterRubro(newRubros);
                if (newRubros.length > 0 && selectedLocations.length > 0) {
                  const validIds = new Set(
                    locations.filter(l => l.business_type && newRubros.includes(l.business_type)).map(l => l.id)
                  );
                  setSelectedLocations(selectedLocations.filter(id => validIds.has(id)));
                }
              } else if (key === 'location') {
                setSelectedLocations(value as string[]);
              } else if (key === 'status') {
                setFilterStatus(value as string[]);
              }
              setCurrentPage(1);
            }}
            onClearAll={() => {
              setFilterRubro([]);
              setSelectedLocations([]);
              setFilterStatus([]);
              setCurrentPage(1);
            }}
          />

          {hasPermission('inventory-create') && (
            <button
              onClick={() => setShowAssetForm(true)}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-[#002855] text-white text-[10px] font-normal uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
            >
              <Plus size={14} />
              Agregar Activo
            </button>
          )}

          {canEdit() && (
            <SelectionModeButton
              active={selectionMode}
              onClick={handleToggleSelectionMode}
              selectedCount={selectedIds.size}
            />
          )}

          <div className="flex bg-slate-100 p-1 border border-slate-200 w-full md:w-auto justify-center">
            <button
              onClick={() => {
                setViewMode('grid');
                setShowDashboard(false);
              }}
              className={`flex-1 md:flex-none p-1.5 transition-all flex items-center justify-center ${viewMode === 'grid' && !showDashboard ? 'bg-white text-[#002855] shadow-sm' : 'text-slate-400 hover:text-[#002855]'}`}
              title="Vista Cuadrícula"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => {
                setViewMode('table');
                setShowDashboard(false);
              }}
              className={`flex-1 md:flex-none p-1.5 transition-all flex items-center justify-center ${viewMode === 'table' && !showDashboard ? 'bg-white text-[#002855] shadow-sm' : 'text-slate-400 hover:text-[#002855]'}`}
              title="Vista Tabla"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className={`flex-1 md:flex-none p-1.5 transition-all flex items-center justify-center ${showDashboard ? 'bg-white text-[#002855] shadow-sm' : 'text-slate-400 hover:text-[#002855]'}`}
              title="Dashboard"
            >
              <BarChart3 size={16} />
            </button>
          </div>

          <ExportButtons onExportExcel={handleExportExcel} onExportPDF={handleExportPdf} />
          {canEdit() && (
            <>
              <button
                onClick={async () => {
                  try {
                    await generateAndDownloadTemplate();
                  } catch (err) {
                    notifyError('Error al descargar plantilla');
                  }
                }}
                className="flex-1 md:flex-none group flex items-center justify-center h-10 px-4 bg-white text-slate-400 border border-slate-200 hover:text-indigo-700 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
                title="Descargar Plantilla"
              >
                <FileSpreadsheet size={20} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex-1 md:flex-none group flex items-center justify-center h-10 px-4 bg-white text-slate-400 border border-slate-200 hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm"
                title="Importar Excel"
              >
                <Upload size={20} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
              </button>
            </>
          )}
        </ActionToolbar>

        {/* Dashboard View */}
        {showDashboard ? (
          <InventoryDashboard
            companyId={multiEnterpriseFilters.company_id}
            locationId={multiEnterpriseFilters.location_id}
          />
        ) : loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-slate-800"></div>
          </div>
        ) : viewMode === 'table' ? (
          <>
            <div className="md:hidden space-y-4 animate-in fade-in duration-300">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalCount}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                selectedCount={selectionMode ? selectedIds.size : 0}
                onDeleteSelected={handleBulkDelete}
              />

              {selectionMode && (
                <label className="flex items-center gap-2.5 px-1 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-colors cursor-pointer"
                    checked={totalCount > 0 && selectedIds.size === totalCount}
                    onChange={handleSelectAll}
                    disabled={selectingAll}
                  />
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                    Seleccionar todos ({totalCount} registros)
                  </span>
                </label>
              )}

              <div className="space-y-3">
                {inventory.map((asset: any) => (
                  <div
                    key={asset.id}
                    onClick={() => { setSelectedAsset(asset); setShowAssetDetails(true); }}
                    className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden ${selectedIds.has(asset.id) ? 'border-[#002855] bg-[#002855]/5' : ''}`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {selectionMode && (
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-colors cursor-pointer shrink-0 mt-0.5"
                              checked={selectedIds.has(asset.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => {
                                const newSelected = new Set(selectedIds);
                                if (newSelected.has(asset.id)) newSelected.delete(asset.id);
                                else newSelected.add(asset.id);
                                setSelectedIds(newSelected);
                              }}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-slate-800 leading-tight">
                              {asset.item || asset.descripcion || 'Sin descripción'}
                            </p>
                            {(asset.brand || asset.model) && (
                              <p className="text-[11px] font-semibold text-slate-400 tracking-wide mt-1 truncate">
                                {asset.brand} {asset.model}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`text-[14px] font-semibold ${getStatusColorClass(asset.estado_uso)} whitespace-nowrap shrink-0`}>
                          {asset.estado_uso || 'Sin estado'}
                        </span>
                      </div>

                      {asset.codigo_unico && (
                        <span className="text-[9px] font-semibold text-slate-400 font-mono">
                          CÓD: {asset.codigo_unico}
                        </span>
                      )}

                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Categoría</p>
                          <p className="text-[12px] font-semibold text-slate-700 truncate mt-0.5">{asset.categories?.name || '—'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ubicación</p>
                          <p className="text-[12px] font-semibold text-slate-700 truncate mt-0.5">{asset.locations?.name || 'No asignada'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Stock</p>
                          <p className="text-[12px] font-semibold text-slate-700 mt-0.5">{asset.cantidad || 1} {asset.unidad_medida || 'UNIDAD(ES)'}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Costo</p>
                          <p className="text-[12px] font-semibold text-slate-700 mt-0.5">{asset.valor_estimado != null ? `S/ ${Number(asset.valor_estimado).toFixed(2)}` : '—'}</p>
                        </div>
                      </div>
                    </div>

                    {canEdit() && (
                      <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); handleDecoupleAsset(asset); }} className="flex-1 text-[10px] font-bold text-emerald-600 hover:underline bg-emerald-50 px-2 py-2 rounded-sm text-center" title="Desacoplar">
                          Desacoplar
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingAsset(asset); setShowAssetForm(true); }} className="flex-1 text-[10px] font-bold text-[#002855] hover:underline bg-[#002855]/5 px-2 py-2 rounded-sm text-center">
                          Editar
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset); }} className="flex-1 text-[10px] font-bold text-rose-600 hover:underline bg-rose-50 px-2 py-2 rounded-sm text-center">
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden md:block bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-300">
              <div className="bg-slate-50/50 border-b border-slate-100 shrink-0">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                  selectedCount={selectionMode ? selectedIds.size : 0}
                  onDeleteSelected={handleBulkDelete}
                />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canEdit() && selectionMode && (
                        <TableHead className="w-12 text-center animate-in fade-in slide-in-from-right-2 duration-200">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 transition-all cursor-pointer"
                            checked={totalCount > 0 && selectedIds.size === totalCount}
                            onChange={handleSelectAll}
                            disabled={selectingAll}
                          />
                        </TableHead>
                      )}
                      <TableHead sortable isSorted={sortConfig?.key === 'item'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('item')}>Detalle / Códigos</TableHead>
                      <TableHead sortable isSorted={sortConfig?.key === 'category_id'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('category_id')}>Categoría</TableHead>
                      <TableHead sortable isSorted={sortConfig?.key === 'location_id'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('location_id')}>Ubicación</TableHead>
                      <TableHead sortable isSorted={sortConfig?.key === 'cantidad'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('cantidad')}>Stock</TableHead>
                      <TableHead sortable isSorted={sortConfig?.key === 'valor_estimado'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('valor_estimado')}>Costo</TableHead>
                      <TableHead sortable isSorted={sortConfig?.key === 'estado_uso'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('estado_uso')}>Estado</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.map((asset: any) => {
                      return (
                        <TableRow key={asset.id} className={`cursor-pointer transition-colors duration-150 group/row relative ${selectedIds.has(asset.id) ? 'bg-blue-50/40' : ''}`} onClick={() => { setSelectedAsset(asset); setShowAssetDetails(true); }}>
                          {canEdit() && selectionMode && (
                            <TableCell className="text-center w-12 animate-in fade-in slide-in-from-right-2 duration-200" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="w-3.5 h-3.5 rounded-none border-slate-300 text-[#002855] focus:ring-[#002855]/30 transition-all cursor-pointer"
                                checked={selectedIds.has(asset.id)}
                                onChange={() => {
                                  const newSelected = new Set(selectedIds);
                                  if (newSelected.has(asset.id)) newSelected.delete(asset.id);
                                  else newSelected.add(asset.id);
                                  setSelectedIds(newSelected);
                                }}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-bold">
                            <div className="flex flex-col min-w-0">
                              <TableCellPrimary className="truncate max-w-[350px]">
                                {asset.item || asset.descripcion || 'Sin descripción'}
                              </TableCellPrimary>
                              {(asset.brand || asset.model) && (
                                <TableCellSecondary className="truncate max-w-[350px] mt-1">
                                  {asset.brand} {asset.model}
                                </TableCellSecondary>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col min-w-0">
                              <TableCellPrimary className="truncate max-w-[180px]">{asset.categories?.name}</TableCellPrimary>
                              <TableCellSecondary className="truncate max-w-[180px] mt-1">{asset.subcategories?.name}</TableCellSecondary>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col min-w-0">
                              <TableCellPrimary className="truncate max-w-[180px]">{asset.locations?.name || 'No asignada'}</TableCellPrimary>
                               <TableCellSecondary className="truncate max-w-[180px] mt-1">{asset.areas?.name || (asset as any).area_ubicacion || 'Otros'}</TableCellSecondary>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex flex-col">
                              <TableCellPrimary>{asset.cantidad || 1}</TableCellPrimary>
                              <TableCellSecondary className="truncate max-w-[120px] mt-1">{asset.unidad_medida || 'UNIDAD(ES)'}</TableCellSecondary>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TableCellPrimary>
                              {asset.valor_estimado != null ? `S/ ${Number(asset.valor_estimado).toFixed(2)}` : '—'}
                            </TableCellPrimary>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TableCellSecondary>
                            <span className={getStatusColorClass(asset.estado_uso)}>
                              {asset.estado_uso || 'Sin estado'}
                            </span>
                          </TableCellSecondary>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              {canEditAsset(asset) && (
                                <>
                                  <TableActionButton
                                    icon={<Layers size={14} />}
                                    onClick={(e) => { e.stopPropagation(); handleDecoupleAsset(asset); }}
                                    title="Desacoplar Activos"
                                  />
                                  <TableActionButton
                                    icon={<Edit size={14} />}
                                    onClick={(e) => { e.stopPropagation(); setEditingAsset(asset); setShowAssetForm(true); }}
                                    title="Editar Activo"
                                  />
                                  <TableActionButton
                                    icon={<Trash2 size={14} />}
                                    onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset); }}
                                    title="Eliminar Activo"
                                    variant="danger"
                                  />
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalCount}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                selectedCount={selectionMode ? selectedIds.size : 0}
                onDeleteSelected={handleBulkDelete}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {inventory.map((asset: any) => {
                const status = STATUS_MAP[asset.estado_uso] || { label: asset.estado_uso || 'Desconocido', color: 'slate' };
                return (
                  <div
                    key={asset.id}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col group overflow-hidden hover:-translate-y-0.5"
                    onDoubleClick={() => { setSelectedAsset(asset); setShowAssetDetails(true); }}
                  >
                    <div className="p-6 flex-1">
                      <div className="flex justify-between items-center mb-5">
                        <div className="flex items-center gap-3">
                          {selectionMode && (
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-colors cursor-pointer animate-in fade-in slide-in-from-right-2 duration-200"
                              checked={selectedIds.has(asset.id)}
                              onChange={() => {
                                const newSelected = new Set(selectedIds);
                                if (newSelected.has(asset.id)) newSelected.delete(asset.id);
                                else newSelected.add(asset.id);
                                setSelectedIds(newSelected);
                              }}
                            />
                          )}
                          <span className="text-[10px] font-semibold text-[#002855] font-mono">
                            CÓD: {asset.codigo_unico || 'N/A'}
                          </span>
                        </div>
                        <span className={`text-[14px] font-semibold ${STATUS_COLOR_CLASSES[status.color] || STATUS_COLOR_CLASSES.slate}`}>
                          {status.label}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-[14px] font-semibold text-slate-800 leading-none truncate">{asset.brand}</h3>
                        <p className="text-[11px] font-semibold text-slate-400 tracking-wider mt-1">{asset.model}</p>
                      </div>

                      <div className="space-y-3 mt-5">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                          <Layers size={14} className="text-blue-500 shrink-0" />
                          <span className="truncate">{asset.categories?.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                          <MapPin size={14} className="text-rose-500 shrink-0" />
                          <span className="truncate">{asset.locations?.name || 'No asignada'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                          <Package size={14} className="text-emerald-500 shrink-0" />
                          <span>{asset.cantidad || 1} {asset.unidad_medida || 'UNIDADES'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex gap-2">
                      {canEditAsset(asset) && (
                        <>
                          <button
                            onClick={() => handleDecoupleAsset(asset)}
                            className="p-2 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                            title="Desacoplar Activos"
                          >
                            <Layers size={16} />
                          </button>
                          <button
                            onClick={() => { setEditingAsset(asset); setShowAssetForm(true); }}
                            className="p-2 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-800 hover:text-white transition-all shadow-sm"
                            title="Editar Activo"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteAsset(asset)}
                            className="p-2 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAssetForm && (
        <AssetForm
          onClose={() => setShowAssetForm(false)}
          onSave={async () => { setShowAssetForm(false); await refresh(); }}
          editAsset={editingAsset}
          initialCategoryId={!editingAsset && categoryFilter ? categories.find(c => c.name === PATH_CATEGORY_MAP[categoryFilter.replace('inventory-', '')])?.id : undefined}
          initialSubcategoryId={!editingAsset && subcategoryFilter ? subcategories.find(s => SUBCATEGORY_SLUG_MAP[subcategoryFilter]?.includes(s.name))?.id : undefined}
        />
      )}

      {showAssetDetails && selectedAsset && (
        <AssetDetails
          asset={selectedAsset!}
          onClose={() => {
            setShowAssetDetails(false);
            setSelectedAsset(undefined);
          }}
          onEdit={() => { setShowAssetDetails(false); setEditingAsset(selectedAsset); setShowAssetForm(true); }}
        />
      )}

      {showDecoupleModal && decoupleAssetData && (
        <DecoupleModal
          asset={decoupleAssetData}
          onClose={() => {
            setShowDecoupleModal(false);
            setDecoupleAssetData(undefined);
          }}
          onConfirm={() => {
            setShowDecoupleModal(false);
            setDecoupleAssetData(undefined);
            refresh();
          }}
        />
      )}

      {showUploadModal && (
        <ExcelImportModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={async () => { setShowUploadModal(false); await refresh(); }}
          assetTypes={[]}
          locations={locations}
        />
      )}
    </div>
  );
}