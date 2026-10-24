import { useEffect, useState, useMemo } from 'react';
import { Trash2, MapPin, X, Building, ChevronDown, Search, Plus, Filter, Edit } from 'lucide-react';
import FilterBar from '../../../shared/components/ui/FilterBar';
import { generateExcel, generatePDF } from '../../../shared/utils/exportUtils';
import { supabase, Location } from '../../../shared/services/supabase';
import { BUSINESS_TYPE_LABELS } from '../../../shared/types/inventory.types';
import { useAuth } from '../../../app/providers/AuthContext';
import LocationForm from '../forms/LocationForm';
import {
  ActionToolbar,
  ActionsDropdown,
  ViewToggle,
  LoadingSpinner,
  PrimaryButton,
  RowActions,
  Pagination,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCellPrimary,
  TableCellSecondary,
  TableCellBadge,
  TableActionButton,
} from '../../../shared/components/ui';
import DetailModal, {
  DetailModalHeader,
  DetailModalBody,
  StandardModalFooter,
  DetailModalGrid,
  DetailModalSection,
  DetailModalCard,
  DetailModalRow,
} from '../../../shared/components/ui/DetailModal';
import { useNotify } from '../../../shared/hooks/useNotify';
import { useSelectionMode } from '../../../shared/hooks/useSelectionMode';

export default function Sedes() {
  const { canEdit } = useAuth();
  const { confirm, success: notifySuccess, error: notifyError } = useNotify();
  const [locations, setLocations] = useState<Location[]>([]);
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [cameraCounts, setCameraCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Location | undefined>();
  const [showDetails, setShowDetails] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | undefined>();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedRubros, setSelectedRubros] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { selectionMode, toggleSelectionMode } = useSelectionMode();

  const handleToggleSelectionMode = () => {
    setSelectedIds([]);
    toggleSelectionMode();
  };
  const [sortField, setSortField] = useState<'name' | 'cameras'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchLocations(), fetchCameraCounts(), fetchCompanies()]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const handleNew = () => openCreate();
    const handleExport = () => exportToExcel();
    const handleExportPdf = () => exportToPdf();

    window.addEventListener('locations:new', handleNew);
    window.addEventListener('locations:export', handleExport);
    window.addEventListener('locations:export-pdf', handleExportPdf);
    return () => {
      window.removeEventListener('locations:new', handleNew);
      window.removeEventListener('locations:export', handleExport);
      window.removeEventListener('locations:export-pdf', handleExportPdf);
    };
  }, [locations, cameraCounts]);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase.from('locations').select('*').eq('is_active', true).order('name');
      if (error) {
        console.error('Error al cargar sedes:', error);
      }
      if (data) setLocations(data);
    } catch (err) {
      console.error('Error inesperado al cargar sedes:', err);
    }
  };

  const fetchCameraCounts = async () => {
    try {
      const { data, error } = await supabase.from('cameras').select('location_id');
      if (error) {
        console.error('Error al obtener conteo de cámaras:', error);
        return;
      }
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach(c => { if (c.location_id) counts[c.location_id] = (counts[c.location_id] || 0) + 1; });
        setCameraCounts(counts);
      }
    } catch (err) {
      console.error('Error en fetchCameraCounts:', err);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase.from('companies').select('id, name').eq('is_active', true).order('name');
      if (error) {
        console.error('Error al cargar unidades de negocio:', error);
        return;
      }
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(c => { map[c.id] = c.name; });
        setCompanies(map);
      }
    } catch (err) {
      console.error('Error en fetchCompanies:', err);
    }
  };

  const openCreate = () => { setEditing(undefined); setShowForm(true); };
  const openEdit = (loc: Location) => { setEditing(loc); setShowForm(true); };

  const del = async (loc: Location) => {
    const confirmed = await confirm(`¿Eliminar sede "${loc.name}"?`, 'Eliminar Sede');
    if (!confirmed) return;
    try {
      const { data: deletedRows, error } = await supabase
        .from('locations')
        .delete()
        .eq('id', loc.id)
        .select('id');
      console.log('[sedes] Resultado delete:', { deletedRows, error });

      if (error) {
        if (error.code === '23503') {
          const { data: updatedRows, error: deactivateError } = await supabase
            .from('locations')
            .update({ is_active: false })
            .eq('id', loc.id)
            .select('id');
          if (deactivateError) return notifyError('Error al eliminar: ' + deactivateError.message);
          if (!updatedRows || updatedRows.length === 0) {
            return notifyError(
              'La sede no se pudo eliminar: los permisos de la base de datos (RLS) bloquean la operación. Ejecuta la migración de políticas en Supabase.',
              'Permiso denegado'
            );
          }
          setSelectedIds(prev => prev.filter(id => id !== loc.id));
          await Promise.all([fetchLocations(), fetchCameraCounts()]);
          return notifySuccess(
            `"${loc.name}" tiene registros asociados (activos, tickets, cámaras, etc.), así que se desactivó en lugar de eliminarse.`,
            'Sede desactivada'
          );
        }
        return notifyError('Error al eliminar: ' + error.message);
      }

      if (!deletedRows || deletedRows.length === 0) {
        const { data: updatedRows, error: deactivateError } = await supabase
          .from('locations')
          .update({ is_active: false })
          .eq('id', loc.id)
          .select('id');
        if (deactivateError || !updatedRows || updatedRows.length === 0) {
          console.error('[sedes] No se pudo eliminar ni desactivar:', { deactivateError, updatedRows });
          return notifyError(
            'La sede no se pudo eliminar: los permisos de la base de datos (RLS) lo bloquean. Ejecuta la migración de políticas en Supabase.',
            'Permiso denegado'
          );
        }
        setSelectedIds(prev => prev.filter(id => id !== loc.id));
        await Promise.all([fetchLocations(), fetchCameraCounts()]);
        return notifySuccess(
          `"${loc.name}" tiene registros asociados, así que se desactivó en lugar de eliminarse.`,
          'Sede desactivada'
        );
      }

      setSelectedIds(prev => prev.filter(id => id !== loc.id));
      await Promise.all([fetchLocations(), fetchCameraCounts()]);
      notifySuccess(`Sede "${loc.name}" eliminada correctamente.`, 'Sede eliminada');
    } catch (err: any) {
      console.error('Error inesperado al eliminar sede:', err);
      notifyError('Error inesperado al eliminar la sede: ' + (err?.message || String(err)));
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedData.length) setSelectedIds([]);
    else setSelectedIds(paginatedData.map(l => l.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    const confirmed = await confirm(`¿Eliminar ${selectedIds.length} sedes seleccionadas?`, 'Eliminación por Lote');
    if (!confirmed) return;
    try {
      const { data: deletedRows, error } = await supabase
        .from('locations')
        .delete()
        .in('id', selectedIds)
        .select('id');
      console.log('[sedes] Resultado delete por lote:', { deletedRows, error });

      if (!error && deletedRows && deletedRows.length > 0) {
        setSelectedIds([]);
        await Promise.all([fetchLocations(), fetchCameraCounts()]);
        notifySuccess(`${deletedRows.length} sedes eliminadas correctamente.`, 'Sedes eliminadas');
        return;
      }

      if (!error && (!deletedRows || deletedRows.length === 0)) {
        const { data: updatedRows, error: deactivateError } = await supabase
          .from('locations')
          .update({ is_active: false })
          .in('id', selectedIds)
          .select('id');
        if (deactivateError || !updatedRows || updatedRows.length === 0) {
          console.error('[sedes] No se pudo eliminar ni desactivar por lote:', { deactivateError, updatedRows });
          return notifyError(
            'Las sedes no se pudieron eliminar: los permisos de la base de datos (RLS) lo bloquean. Ejecuta la migración de políticas en Supabase.',
            'Permiso denegado'
          );
        }
        setSelectedIds([]);
        await Promise.all([fetchLocations(), fetchCameraCounts()]);
        return notifySuccess(
          `${updatedRows.length} sedes se desactivaron en lugar de eliminarse (tienen registros asociados o los permisos lo impiden).`,
          'Sedes desactivadas'
        );
      }

      if (error?.code === '23503') {
        const { data: updatedRows, error: deactivateError } = await supabase
          .from('locations')
          .update({ is_active: false })
          .in('id', selectedIds)
          .select('id');
        if (deactivateError || !updatedRows || updatedRows.length === 0) {
          return notifyError('Error al eliminar: ' + (deactivateError?.message || 'no se pudo desactivar'));
        }
        setSelectedIds([]);
        await Promise.all([fetchLocations(), fetchCameraCounts()]);
        return notifySuccess(
          `${updatedRows.length} sedes tienen registros asociados, así que se desactivaron en lugar de eliminarse.`,
          'Sedes desactivadas'
        );
      }

      if (error) return notifyError('Error al eliminar: ' + error.message);
    } catch (err: any) {
      console.error('Error inesperado al eliminar sedes:', err);
      notifyError('Error inesperado al eliminar las sedes: ' + (err?.message || String(err)));
    }
  };

  const handleSort = (field: 'name' | 'cameras') => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
    setCurrentPage(1);
  };

  const companyEntries = Object.keys(companies);
  const rubroEntries = Object.keys(BUSINESS_TYPE_LABELS);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...locations]
      .filter(loc => {
        const matchesSearch = loc.name?.toLowerCase().includes(q) ||
          loc.address?.toLowerCase().includes(q) ||
          loc.notes?.toLowerCase().includes(q);
        const matchesCompany = selectedCompanies.length === 0 || selectedCompanies.length === companyEntries.length ||
          selectedCompanies.includes(loc.company_id || '');
        const matchesRubro = selectedRubros.length === 0 || selectedRubros.length === rubroEntries.length ||
          selectedRubros.includes(loc.business_type || '');
        return matchesSearch && matchesCompany && matchesRubro;
      })
      .sort((a, b) => {
        let av: string | number = '', bv: string | number = '';
        if (sortField === 'name') { av = a.name || ''; bv = b.name || ''; }
        else if (sortField === 'cameras') { av = cameraCounts[a.id] || 0; bv = cameraCounts[b.id] || 0; }
        if (av < bv) return sortDirection === 'asc' ? -1 : 1;
        if (av > bv) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [locations, search, selectedCompanies, selectedRubros, sortField, sortDirection, cameraCounts, companyEntries, rubroEntries]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  const exportToExcel = async () => {
    try {
      const locationsToExport = selectedIds.length > 0
        ? filtered.filter(loc => selectedIds.includes(loc.id))
        : filtered;

      const data = locationsToExport.map(loc => ({
        name: loc.name,
        business_type: BUSINESS_TYPE_LABELS[loc.business_type as keyof typeof BUSINESS_TYPE_LABELS] || loc.business_type || '—',
        company: companies[loc.company_id || ''] || 'Sin asignar',
        address: loc.address || '—',
        cameras: (cameraCounts[loc.id] || 0).toString(),
        notes: loc.notes || '—'
      }));

      await generateExcel({
        title: 'Reporte de Sedes',
        filename: 'Sedes',
        columns: [
          { header: 'Nombre', key: 'name', width: 30 },
          { header: 'Rubro', key: 'business_type', width: 25 },
          { header: 'Unidad de Negocio', key: 'company', width: 25 },
          { header: 'Dirección', key: 'address', width: 40 },
          { header: 'Cámaras', key: 'cameras', width: 15 },
          { header: 'Notas', key: 'notes', width: 40 }
        ],
        data
      });
    } catch (e) {
      console.error('Error exportando Excel:', e);
      notifyError('Error al exportar Excel');
    }
  };

  const exportToPdf = async () => {
    try {
      const locationsToExport = selectedIds.length > 0
        ? filtered.filter(loc => selectedIds.includes(loc.id))
        : filtered;

      const data = locationsToExport.map(loc => ({
        name: loc.name,
        business_type: BUSINESS_TYPE_LABELS[loc.business_type as keyof typeof BUSINESS_TYPE_LABELS] || loc.business_type || '—',
        company: companies[loc.company_id || ''] || 'Sin asignar',
        address: loc.address || '—',
        cameras: (cameraCounts[loc.id] || 0).toString()
      }));

      await generatePDF({
        title: 'Reporte de Sedes',
        filename: 'Sedes',
        columns: [
          { header: 'Nombre', key: 'name' },
          { header: 'Rubro', key: 'business_type' },
          { header: 'Unidad de Negocio', key: 'company' },
          { header: 'Dirección', key: 'address' },
          { header: 'Cámaras', key: 'cameras' }
        ],
        data
      });
    } catch (e) {
      console.error('Error exportando PDF:', e);
      notifyError('Error al exportar PDF');
    }
  };

  const renderSortableHeader = (label: string, sortKey: 'name' | 'cameras') => {
    const isSorted = sortField === sortKey;
    return (
      <button
        onClick={() => handleSort(sortKey)}
        className="flex items-center gap-1.5 hover:text-[#002855] text-slate-400 transition-colors"
      >
        <span className="text-[12px] font-black text-[#002855] tracking-[0.2em]">{label}</span>
        {isSorted ? (
          <span className="text-[#002855] text-[10px]">
            {sortDirection === 'asc' ? '▲' : '▼'}
          </span>
        ) : (
          <span className="text-slate-300 text-[10px] opacity-50">▲▼</span>
        )}
      </button>
    );
  };

  return (
    <>
      <div className="flex flex-col h-full bg-[#f8fafc]">
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">

          <ActionToolbar
            totalItems={filtered.length}
            label="Sedes"
            searchComponent={
              <>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-12 pr-4 py-3 text-[12px] font-black text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 tracking-[0.1em]"
                />
              </>
            }
          >
            <FilterBar
              filters={[
                { key: 'business_type', placeholder: 'TODOS LOS RUBROS', icon: Filter, iconClassName: 'text-rose-500', wrapperClassName: 'md:min-w-[220px]', options: rubroEntries.map(type => ({ value: type, label: BUSINESS_TYPE_LABELS[type as keyof typeof BUSINESS_TYPE_LABELS] })) },
                { key: 'company_id', placeholder: 'TODAS LAS UNIDADES DE NEGOCIO', icon: Building, iconClassName: 'text-blue-500', wrapperClassName: 'md:min-w-[220px]', options: companyEntries.map(id => ({ value: id, label: companies[id] })) },
              ]}
              values={{ company_id: selectedCompanies, business_type: selectedRubros }}
              onChange={(key, value) => {
                if (key === 'company_id') setSelectedCompanies(value as string[]);
                if (key === 'business_type') setSelectedRubros(value as string[]);
                setCurrentPage(1);
              }}
            />

            <ViewToggle viewMode={viewMode} onChange={setViewMode} />

            {canEdit() && (
              <PrimaryButton icon={Plus} onClick={openCreate}>
                Nueva Sede
              </PrimaryButton>
            )}

            <ActionsDropdown
              selectionMode={
                canEdit()
                  ? {
                      active: selectionMode,
                      onToggle: handleToggleSelectionMode,
                      selectedCount: selectedIds.length,
                    }
                  : undefined
              }
              onExportExcel={exportToExcel}
              onExportPDF={exportToPdf}
            />
          </ActionToolbar>

          {loading ? (
            <LoadingSpinner label="Cargando sedes..." />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-1">
              {paginatedData.map(loc => {
                const camCount = cameraCounts[loc.id] || 0;
                const isSelected = selectedIds.includes(loc.id);
                return (
                  <div
                    key={loc.id}
                    onClick={() => { setSelectedLocation(loc); setShowDetails(true); }}
                    className={`bg-white rounded-none shadow-sm border transition-all duration-300 flex flex-col group overflow-hidden relative cursor-pointer hover:bg-slate-50/80 hover:border-blue-200/50 hover:shadow-md ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-slate-100'}`}
                  >
                    {canEdit() && selectionMode && (
                      <div className="absolute top-4 left-4 z-20">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(loc.id)} onClick={e => e.stopPropagation()} className="w-3.5 h-3.5 rounded border-slate-200 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm animate-in fade-in slide-in-from-right-2 duration-200" />
                      </div>
                    )}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-blue-500/10 transition-colors" />

                    <div className="p-4 flex-1 relative z-10">
                      <div className="flex items-center gap-3 mb-4 pt-1">
                        <div className={`w-10 h-10 rounded-none flex items-center justify-center transition-all duration-300 ${canEdit() ? 'md:ml-8' : ''} bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-600/20`}>
                          <MapPin size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[13px] font-black text-[#002855] tracking-tight truncate leading-tight group-hover:text-blue-700 transition-colors">{loc.name}</h3>
                          <div className="flex gap-2 flex-wrap">
                            <span className="text-[14px] font-semibold text-slate-800 mt-1">
                              {BUSINESS_TYPE_LABELS[loc.business_type as keyof typeof BUSINESS_TYPE_LABELS] || loc.business_type || 'Sin Rubro'}
                            </span>
                            <span className="text-[10px] font-semibold text-blue-600 mt-1">
                              {companies[loc.company_id || ''] || 'Sin Unidad de Negocio'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="p-2 rounded-none border bg-slate-50 border-slate-100">
                          <label className="text-[10px] font-black text-slate-400 tracking-wider block mb-0.5 ml-1">Dirección</label>
                          <p className="text-[11px] font-mono font-black text-slate-600 truncate">{loc.address || '—'}</p>
                        </div>
                        <div className={`p-2 rounded-none border transition-all ${camCount > 0 ? 'bg-emerald-50/20 border-emerald-100/50' : 'bg-slate-50 border-slate-100'}`}>
                          <label className="text-[10px] font-black text-slate-400 tracking-wider block mb-0.5 ml-1">Cámaras</label>
                          <p className={`text-[11px] font-mono font-black ${camCount > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{camCount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-center gap-2 z-10">
                      <RowActions
                        canEdit={canEdit()}
                        onEdit={(e) => { e.stopPropagation(); openEdit(loc); }}
                        onDelete={(e) => { e.stopPropagation(); del(loc); }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col rounded-none">
              {/* Pagination Header */}
              <div className="bg-slate-50/50 border-b border-slate-100 relative z-20">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filtered.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                >
                  {selectionMode && selectedIds.length > 0 && canEdit() && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-300">
                      <span className="hidden xl:block text-[10px] font-black text-rose-600 tracking-wider">{selectedIds.length} marcados</span>
                      <button onClick={handleBulkDelete} className="flex items-center gap-2 px-3 py-2 bg-rose-500 text-white text-[10px] font-black tracking-wider rounded-md hover:bg-rose-600 transition-all shadow-sm active:scale-95" title="Eliminar seleccionados">
                        <Trash2 size={14} /><span className="hidden sm:inline">Eliminar</span>
                      </button>
                    </div>
                  )}
                </Pagination>
              </div>

              <div className="flex-1">
                {/* Mobile Accordion */}
                <div className="md:hidden space-y-3">
                  {paginatedData.map(loc => {
                    const isExpanded = expandedId === loc.id;
                    const camCount = cameraCounts[loc.id] || 0;
                    const isSelected = selectedIds.includes(loc.id);
                    return (
                      <div key={loc.id} className={`bg-white border border-slate-200 p-4 transition-all duration-300 ${isSelected ? 'border-[#002855] bg-[#002855]/5' : ''}`}>
                        <div className={`flex items-center justify-between`}>
                          <div className="flex items-center gap-4">
                            {canEdit() && selectionMode && (
                              <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(loc.id)} onClick={e => e.stopPropagation()} className="w-3.5 h-3.5 rounded border-slate-200 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm animate-in fade-in slide-in-from-right-2 duration-200" />
                            )}
                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : loc.id)}>
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm bg-slate-50 border border-slate-100 text-slate-400">
                                <MapPin size={18} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[13px] font-black text-[#002855] leading-tight">{loc.name}</span>
                                <span className="text-[10px] font-semibold text-slate-400 tracking-wider mt-0.5">
                                  {BUSINESS_TYPE_LABELS[loc.business_type as keyof typeof BUSINESS_TYPE_LABELS] || loc.business_type} • {companies[loc.company_id || ''] || 'Sin Unidad de Negocio'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <ChevronDown onClick={() => setExpandedId(isExpanded ? null : loc.id)} className={`text-slate-300 transition-transform duration-500 cursor-pointer ${isExpanded ? 'rotate-180' : ''}`} size={16} />
                        </div>

                        {isExpanded && (
                          <div className="space-y-4 border-t border-slate-100 mt-4 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 rounded-xl border bg-slate-50 border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 tracking-wider block mb-1">Dirección</label>
                                <span className="text-[11px] font-mono font-black text-[#002855]">{loc.address || '—'}</span>
                              </div>
                              <div className={`p-3 rounded-xl border ${camCount > 0 ? 'bg-emerald-50/30 border-emerald-100/50' : 'bg-slate-50 border-slate-100'}`}>
                                <label className="text-[10px] font-black text-slate-400 tracking-wider block mb-1">Cámaras</label>
                                <span className={`text-[11px] font-mono font-black ${camCount > 0 ? 'text-emerald-700' : 'text-slate-300'}`}>{camCount}</span>
                              </div>
                            </div>
                            <div className="flex gap-1.5 border-t border-slate-100 pt-3">
                              {canEdit() && (
                                <>
                                  <button onClick={() => openEdit(loc)} className="text-[10px] font-bold text-[#002855] hover:underline bg-[#002855]/5 px-2 py-1 rounded-sm w-full text-center">Editar</button>
                                  <button onClick={() => del(loc)} className="text-[10px] font-bold text-rose-600 hover:underline bg-rose-50 px-2 py-1 rounded-sm w-full text-center">Eliminar</button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-hidden relative group/table">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <tr>
                          {canEdit() && selectionMode && (
                            <TableHead className="w-12 animate-in fade-in slide-in-from-right-2 duration-200">
                              <input type="checkbox" checked={paginatedData.length > 0 && selectedIds.length === paginatedData.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 cursor-pointer" />
                            </TableHead>
                          )}
                          <TableHead>
                            {renderSortableHeader('SEDE', 'name')}
                          </TableHead>
                          <TableHead>
                            <span className="text-[12px] font-black text-[#002855] tracking-[0.15em]">Rubro</span>
                          </TableHead>
                          <TableHead>
                            <span className="text-[12px] font-black text-[#002855] tracking-[0.15em]">Unidad de Negocio</span>
                          </TableHead>
                          <TableHead>
                            <span className="text-[12px] font-black text-[#002855] tracking-[0.15em]">Dirección</span>
                          </TableHead>
                          <TableHead>
                            {renderSortableHeader('CÁMARAS', 'cameras')}
                          </TableHead>
                          <TableHead className="text-center">
                            <span className="text-[12px] font-black text-[#002855] tracking-[0.15em]">Acciones</span>
                          </TableHead>
                        </tr>
                      </TableHeader>
                      <TableBody>
                        {paginatedData.map(loc => {
                          const camCount = cameraCounts[loc.id] || 0;
                          return (
                            <TableRow
                              key={loc.id}
                              className={`${selectedIds.includes(loc.id) ? 'bg-blue-50/40' : ''}`}
                              onClick={() => { setSelectedLocation(loc); setShowDetails(true); }}
                            >
                              {canEdit() && selectionMode && (
                                <TableCell className="w-12 animate-in fade-in slide-in-from-right-2 duration-200">
                                  <input type="checkbox" checked={selectedIds.includes(loc.id)} onChange={() => toggleSelect(loc.id)} onClick={e => e.stopPropagation()} className="w-4 h-4 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 cursor-pointer" />
                                </TableCell>
                              )}
                              <TableCell>
                                <div className="flex flex-col">
                                  <TableCellPrimary>{loc.name}</TableCellPrimary>
                                  <TableCellSecondary className="md:hidden">
                                    {BUSINESS_TYPE_LABELS[loc.business_type as keyof typeof BUSINESS_TYPE_LABELS] || loc.business_type}
                                  </TableCellSecondary>
                                </div>
                              </TableCell>
                              <TableCell>
                                <TableCellBadge>
                                  {BUSINESS_TYPE_LABELS[loc.business_type as keyof typeof BUSINESS_TYPE_LABELS] || loc.business_type || '—'}
                                </TableCellBadge>
                              </TableCell>
                              <TableCell>
                                <TableCellBadge>
                                  {companies[loc.company_id || ''] || '—'}
                                </TableCellBadge>
                              </TableCell>
                              <TableCell>
                                <TableCellPrimary className="truncate max-w-xs">{loc.address || '—'}</TableCellPrimary>
                              </TableCell>
                              <TableCell>
                                <TableCellBadge>
                                  {camCount} Instaladas
                                </TableCellBadge>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                  {canEdit() && (
                                    <>
                                      <TableActionButton
                                        icon={<Edit size={14} />}
                                        onClick={(e) => { e.stopPropagation(); openEdit(loc); }}
                                        title="Editar"
                                      />
                                      <TableActionButton
                                        icon={<Trash2 size={14} />}
                                        onClick={(e) => { e.stopPropagation(); del(loc); }}
                                        title="Eliminar"
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
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectionMode && selectedIds.length > 0 && canEdit() && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[60] pointer-events-none w-full flex justify-center px-6">
          <div className="bg-[#002855]/95 backdrop-blur-md text-white px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 border border-white/10 pointer-events-auto">
            <div className="flex items-center gap-2 pr-4 border-r border-white/10">
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-black">{selectedIds.length}</div>
              <span className="text-[8px] font-black tracking-widest opacity-80">Marcadas</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-[8px] font-black tracking-widest text-rose-400 hover:text-rose-100 transition-colors">
                <Trash2 size={12} /> Eliminar lote
              </button>
              <button onClick={() => setSelectedIds([])} className="text-[8px] font-black tracking-widest text-slate-400 hover:text-white transition-colors">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Location Form Modal */}
      {showForm && (
        <LocationForm
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          onSave={async () => {
            await Promise.all([fetchLocations(), fetchCameraCounts()]);
            setShowForm(false);
            setEditing(undefined);
          }}
          editLocation={editing}
        />
      )}

      {showDetails && selectedLocation && (
        <DetailModal maxWidth="5xl" onClose={() => setShowDetails(false)} closeOnBackdrop>
          <DetailModalHeader>
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 pr-1">
              <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <Building size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xs sm:text-base md:text-[18px] font-normal text-white tracking-tight leading-snug line-clamp-2 sm:line-clamp-1">
                  {selectedLocation.name}
                </h2>
                <p className="text-[9px] sm:text-[10px] font-normal text-blue-200 tracking-wide mt-1 flex items-start sm:items-center gap-1.5">
                  <MapPin size={10} className="shrink-0 mt-0.5 sm:mt-0" />
                  <span className="line-clamp-2 sm:truncate">{companies[selectedLocation.company_id || ''] || 'Sin Unidad de Negocio'}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDetails(false)}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 text-white/50 hover:text-white hover:bg-white/10 transition-all -mr-1"
              aria-label="Cerrar detalle"
            >
              <X size={22} />
            </button>
          </DetailModalHeader>

          <DetailModalBody>
            <DetailModalGrid layout="stack-until-xl">
              <DetailModalSection title="Información General">
                <DetailModalCard className="space-y-2.5 sm:space-y-3">
                  <DetailModalRow label="Unidad de Negocio">
                    <span className="text-[14px] font-semibold text-slate-800">
                      {companies[selectedLocation.company_id || ''] || 'Sin asignar'}
                    </span>
                  </DetailModalRow>
                  <DetailModalRow label="Rubro">
                    <span className="text-[10px] sm:text-[11px] font-normal text-slate-700">
                      {BUSINESS_TYPE_LABELS[selectedLocation.business_type as keyof typeof BUSINESS_TYPE_LABELS] || selectedLocation.business_type || '—'}
                    </span>
                  </DetailModalRow>
                  <DetailModalRow label="Cámaras Instaladas">
                    <span className="text-[10px] sm:text-[11px] font-normal text-[#002855]">{cameraCounts[selectedLocation.id] || 0} CÁMARAS</span>
                  </DetailModalRow>
                </DetailModalCard>

                <DetailModalCard className="space-y-2.5 sm:space-y-3">
                  <DetailModalRow label="Dirección">
                    <span className="text-[10px] sm:text-[11px] font-normal text-slate-700 break-words">
                      {selectedLocation.address || '—'}
                    </span>
                  </DetailModalRow>
                </DetailModalCard>
              </DetailModalSection>

              {selectedLocation.notes && (
                <DetailModalSection title="Observaciones">
                  <DetailModalCard className="bg-amber-50 border-amber-100">
                    <p className="text-[10px] sm:text-[11px] font-medium text-amber-900 leading-relaxed">
                      {selectedLocation.notes}
                    </p>
                  </DetailModalCard>
                </DetailModalSection>
              )}
            </DetailModalGrid>
          </DetailModalBody>

          <StandardModalFooter
            onClose={() => setShowDetails(false)}
            onEdit={canEdit() ? () => { setShowDetails(false); openEdit(selectedLocation); } : undefined}
            editLabel="Editar"
          />
        </DetailModal>
      )}
    </>
  );
}