import { useState, useMemo } from 'react';
import { Plus, Building2, Calendar, FileText, User, AlertTriangle, Edit, X, Search, MapPin, Trash2, ExternalLink, Eye, Filter } from 'lucide-react';
import { supabase } from '../../../shared/services/supabase';
import type { SutranVisit } from '../../../shared/services/supabase';
import { BUSINESS_TYPE_LABELS } from '../../../shared/types/inventory.types';
import { generateExcel, generatePDF } from '../../../shared/utils/exportUtils';
import { useSupabaseQuery } from '../../../shared/hooks/useSupabaseQuery';
import SutranVisitForm from '../forms/SutranVisitForm';
import { useAuth } from '../../../app/providers/AuthContext';
import Pagination from '../../../shared/components/ui/Pagination';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import { useNotify } from '../../../shared/hooks/useNotify';
import DetailModal, {
  DetailModalHeader,
  DetailModalBody,
  StandardModalFooter,
} from '../../../shared/components/ui/DetailModal';
import ActionToolbar from '../../../shared/components/ui/ActionToolbar';
import ActionsDropdown from '../../../shared/components/ui/ActionsDropdown';
import { useSelectionMode } from '../../../shared/hooks/useSelectionMode';
import FilterBar from '../../../shared/components/ui/FilterBar';
import ViewToggle from '../../../shared/components/ui/ViewToggle';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCellPrimary, TableCellSecondary, TableActionButton } from '../../../shared/components/ui/Table';

export default function Sutran() {
  const { canEdit } = useAuth();
  const { success: notifySuccess, error: notifyError, confirm } = useNotify();

  // — Todos los estados declarados antes de ser usados —
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [visitTypeFilter, setVisitTypeFilter] = useState<string[]>([]);
  const [selectedRubros, setSelectedRubros] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVisit, setEditingVisit] = useState<SutranVisit | undefined>();
  const [viewingVisit, setViewingVisit] = useState<SutranVisit | undefined>();
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { selectionMode, setSelectionMode } = useSelectionMode();

  const handleToggleSelectionMode = () => {
    if (selectionMode) setSelectedIds([]);
    setSelectionMode(!selectionMode);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedVisits.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedVisits.map(v => v.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm(`¿Eliminar ${selectedIds.length} visitas seleccionadas?`, 'Eliminación por Lote');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('sutran_visits').delete().in('id', selectedIds);
      if (error) {
        notifyError(`Error al eliminar: ${error.message}`);
      } else {
        setSelectedIds([]);
        await refetchVisits();
        notifySuccess(`Visitas eliminadas correctamente`);
      }
    } catch (err) {
      notifyError('Error inesperado al eliminar las visitas');
    }
  };
  // Tipo correcto: wrapper con data[] y count para paginación del servidor
  const { data: visitsData, loading, refetch: refetchVisits } = useSupabaseQuery<{ data: SutranVisit[]; count: number }>(
    `sutran_visits:p${currentPage}-l${itemsPerPage}-s${statusFilter.join(',')}-t${visitTypeFilter.join(',')}-q${searchTerm}-loc${selectedLocations.join(',')}-k${sortConfig?.key}-d${sortConfig?.direction}`,
    async () => {
      let query = supabase
        .from('sutran_visits')
        .select('id, visit_date, location_id, visit_type, status, inspector_name, findings, observations, locations(id, name, type, region)', { count: 'exact' });

      if (statusFilter.length > 0) query = query.in('status', statusFilter);
      if (visitTypeFilter.length > 0) query = query.in('visit_type', visitTypeFilter);
      if (selectedLocations.length > 0) query = query.in('location_id', selectedLocations);
      if (searchTerm) query = query.or(`inspector_name.ilike.%${searchTerm}%,observations.ilike.%${searchTerm}%,findings.ilike.%${searchTerm}%`);

      if (sortConfig) {
        query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });
      } else {
        query = query.order('visit_date', { ascending: false });
      }

      const from = (currentPage - 1) * itemsPerPage;
      query = query.range(from, from + itemsPerPage - 1);

      const result = await query;
      return {
        data: { data: (result.data as unknown as SutranVisit[]) ?? [], count: result.count ?? 0 },
        error: result.error,
      };
    }
  );

  const { data: locationsData } = useSupabaseQuery<any[]>(
    'locations:all',
    async () => await supabase.from('locations').select('*, companies(id, name)').eq('is_active', true).order('name')
  );

  const paginatedVisits = visitsData?.data ?? [];
  const locations = locationsData ?? [];

  const filteredLocations = useMemo(() => {
    if (selectedRubros.length === 0) return locations;
    return locations.filter(loc => loc.business_type && selectedRubros.includes(loc.business_type));
  }, [locations, selectedRubros]);
  const totalPages = Math.ceil((visitsData?.count ?? 0) / itemsPerPage);

  const statusColors: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-slate-100 text-slate-600',
  };

  const statusLabels: Record<string, string> = {
    completed: 'Completada',
    pending: 'Pendiente',
    in_progress: 'En Progreso',
    cancelled: 'Cancelada',
  };

  const typeColors: Record<string, string> = {
    programada: 'text-slate-500',
    no_programada: 'text-slate-500',
    de_gabinete: 'text-slate-500',
  };

  const getVisitTypeLabel = (type: string) => {
    switch (type) {
      case 'programada': return 'Programada';
      case 'no_programada': return 'No programada';
      case 'de_gabinete': return 'De gabinete';
      default: return type;
    }
  };

  const handleEditVisit = (visit: SutranVisit) => {
    setEditingVisit(visit);
    setShowForm(true);
  };

  const handleViewVisit = (visit: SutranVisit) => {
    setViewingVisit(visit);
  };

  const handleDeleteVisit = async (id: string) => {
    const confirmed = await confirm(
      'Esta acción no se puede deshacer.',
      '¿Eliminar visita?'
    );
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from('sutran_visits')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('? Error al eliminar visita:', error);
        notifyError(`Error al eliminar la visita: ${error.message}`, 'Error');
      } else {
        await refetchVisits();
        notifySuccess('Visita eliminada correctamente', 'Eliminada');
      }
    } catch (err) {
      console.error('? Error inesperado al eliminar visita:', err);
      notifyError('Error inesperado al eliminar la visita', 'Error');
    }
  };

  const handleSaveVisit = async () => {
    setShowForm(false);
    setEditingVisit(undefined);
    await refetchVisits();
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingVisit(undefined);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortableHeader = (label: string, sortKey: string) => {
    const isSorted = sortConfig?.key === sortKey;
    return (
      <button
        onClick={() => handleSort(sortKey)}
        className="flex items-center gap-1.5 hover:text-[#002855] text-slate-400 transition-colors"
      >
        <span className="text-[12px] font-medium text-[#002855] tracking-[0.2em]">{label}</span>
        {isSorted ? (
          <span className="text-[#002855] text-[10px]">
            {sortConfig.direction === 'asc' ? '?' : '?'}
          </span>
        ) : (
          <span className="text-slate-300 text-[10px] opacity-50">??</span>
        )}
      </button>
    );
  };

  const handleGenerateExcel = async () => {
    try {
      const visitsToExport = selectedIds.length > 0
        ? paginatedVisits.filter(v => selectedIds.includes(v.id))
        : paginatedVisits;

      const data = visitsToExport.map(visit => ({
        visit_date: new Date(String(visit.visit_date).includes('T') ? String(visit.visit_date) : `${visit.visit_date}T12:00:00`).toLocaleDateString(),
        inspector_name: visit.inspector_name || '',
        location_name: (visit as any).locations?.name || '',
        visit_type: getVisitTypeLabel(visit.visit_type),
        status: statusLabels[visit.status] || visit.status,
        findings: visit.findings || 'Sin hallazgos'
      }));

      await generateExcel({
        title: 'Reporte de Visitas SUTRAN',
        filename: 'Visitas SUTRAN',
        columns: [
          { header: 'Fecha', key: 'visit_date', width: 15 },
          { header: 'Inspector', key: 'inspector_name', width: 25 },
          { header: 'Ubicación', key: 'location_name', width: 20 },
          { header: 'Tipo', key: 'visit_type', width: 15 },
          { header: 'Estado', key: 'status', width: 12 },
          { header: 'Hallazgos', key: 'findings', width: 30 }
        ],
        data
      });
    } catch (error) {
      console.error('Error exportando Excel:', error);
      notifyError('Error al exportar a Excel', 'Error de exportación');
    }
  };

  const handleGeneratePDF = async () => {
    try {
      const visitsToExport = selectedIds.length > 0
        ? paginatedVisits.filter(v => selectedIds.includes(v.id))
        : paginatedVisits;

      const data = visitsToExport.map(v => ({
        visit_date: new Date(String(v.visit_date).includes('T') ? String(v.visit_date) : `${v.visit_date}T12:00:00`).toLocaleDateString(),
        inspector_name: v.inspector_name || '',
        location_name: (v as any).locations?.name || '—',
        visit_type: getVisitTypeLabel(v.visit_type),
        status: statusLabels[v.status] || v.status,
        findings: v.findings || 'Sin hallazgos'
      }));

      await generatePDF({
        title: 'Reporte de Visitas SUTRAN',
        filename: 'Visitas SUTRAN',
        columns: [
          { header: 'Fecha', key: 'visit_date' },
          { header: 'Inspector', key: 'inspector_name' },
          { header: 'Ubicación', key: 'location_name' },
          { header: 'Tipo', key: 'visit_type' },
          { header: 'Estado', key: 'status' },
          { header: 'Hallazgos', key: 'findings' }
        ],
        data
      });
    } catch (error) {
      console.error('Error exportando PDF:', error);
      notifyError('Error al exportar a PDF', 'Error de exportación');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">


      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        <ActionToolbar
          totalItems={visitsData?.count ?? 0}
          label="Visitas"
          searchComponent={
            <>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-12 pr-4 py-3 text-[12px] text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 tracking-[0.1em]"
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
              { key: 'status', placeholder: 'TODOS LOS ESTADOS', options: Object.entries(statusLabels).map(([val, label]) => ({ value: val, label })) },
              {
                key: 'visitType', placeholder: 'TODOS LOS TIPOS', options: [
                  { value: 'programada', label: 'PROGRAMADA' },
                  { value: 'no_programada', label: 'NO PROGRAMADA' },
                  { value: 'de_gabinete', label: 'DE GABINETE' },
                ]
              },
            ]}
            values={{ business_type: selectedRubros, location: selectedLocations, status: statusFilter, visitType: visitTypeFilter }}
            onChange={(key, value) => {
              if (key === 'business_type') {
                const newRubros = value as string[];
                setSelectedRubros(newRubros);
                if (newRubros.length > 0) {
                  const validIds = new Set(locations.filter(l => l.business_type && newRubros.includes(l.business_type)).map(l => l.id));
                  setSelectedLocations(selectedLocations.filter(id => validIds.has(id)));
                }
              } else if (key === 'location') {
                setSelectedLocations(value as string[]);
              } else if (key === 'status') {
                setStatusFilter(value as string[]);
              } else if (key === 'visitType') {
                setVisitTypeFilter(value as string[]);
              }
              setCurrentPage(1);
            }}
            onClearAll={() => {
              setSelectedRubros([]);
              setSelectedLocations([]);
              setStatusFilter([]);
              setVisitTypeFilter([]);
              setCurrentPage(1);
            }}
          />

          <ViewToggle viewMode={viewMode} onChange={setViewMode} />

          {canEdit() && (
            <button
              onClick={() => { setEditingVisit(undefined); setShowForm(true); }}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-[#002855] text-white text-[10px] font-normal uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
            >
              <Plus size={14} />
              Nuevo Registro
            </button>
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
            onExportExcel={handleGenerateExcel}
            onExportPDF={handleGeneratePDF}
          />

          {canEdit() && selectionMode && selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 hover:text-rose-700 transition-all text-[10px] font-black uppercase tracking-widest"
            >
              <Trash2 size={14} />
              Eliminar ({selectedIds.length})
            </button>
          )}
        </ActionToolbar>

        {showForm && (
          <SutranVisitForm
            visit={editingVisit}
            onSave={handleSaveVisit}
            onClose={handleCloseForm}
          />
        )}

        <div className="space-y-6 animate-in fade-in duration-500">
          {loading ? (
            <LoadingSpinner label="Cargando SUTRAN..." />
          ) : viewMode === 'table' ? (
            <div className="bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col rounded-none">
              <div className="bg-slate-50/50 border-b border-slate-100 relative z-20">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={visitsData?.count ?? 0}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              </div>
              {/* Mobile card view */}
              <div className="block md:hidden divide-y divide-slate-100">
                {paginatedVisits.map(visit => (
                  <div key={visit.id} className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedIds.includes(visit.id) ? 'bg-blue-50/40' : ''}`} onClick={() => handleViewVisit(visit)}>
                    <div className="flex items-center gap-2">
                      {canEdit() && selectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(visit.id)}
                          onChange={() => toggleSelect(visit.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black text-slate-800 leading-tight">
                          {new Date(String(visit.visit_date).includes('T') ? String(visit.visit_date) : `${visit.visit_date}T12:00:00`).toLocaleDateString()}
                        </p>
                        <p className="text-[14px] font-semibold text-slate-800">{getVisitTypeLabel(visit.visit_type)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                      <MapPin size={10} className="text-rose-400 shrink-0" />
                      <span className="truncate">{(visit as any).locations?.name}</span>
                    </div>
                    {visit.findings && (
                      <p className="text-[10px] text-slate-600 mt-1 line-clamp-2">{visit.findings}</p>
                    )}
                    <div className="flex gap-1.5 mt-1.5" onClick={e => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); handleViewVisit(visit); }} className="text-[10px] font-semibold text-blue-600 hover:underline">Ver Detalle</button>
                      {visit.evidence_url && (
                        <>
                          <span className="text-slate-300">|</span>
                          <button onClick={() => window.open(visit.evidence_url!, '_blank')} className="text-[10px] font-semibold text-blue-600 hover:underline">Evidencias</button>
                        </>
                      )}
                      {canEdit() && (
                        <>
                          <span className="text-slate-300">|</span>
                          <button onClick={(e) => { e.stopPropagation(); handleEditVisit(visit); }} className="text-[10px] font-semibold text-slate-600 hover:underline">Editar</button>
                          <span className="text-slate-300">|</span>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteVisit(visit.id); }} className="text-[10px] font-semibold text-rose-500 hover:underline">Eliminar</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <tr>
                      {canEdit() && selectionMode && (
                        <TableHead className="text-center w-12">
                          <input
                            type="checkbox"
                            checked={paginatedVisits.length > 0 && selectedIds.length === paginatedVisits.length}
                            onChange={toggleSelectAll}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                          />
                        </TableHead>
                      )}
                      <TableHead>{renderSortableHeader('FECHA', 'visit_date')}</TableHead>
                      <TableHead>{renderSortableHeader('UBICACIÓN', 'location_name')}</TableHead>
                      <TableHead>{renderSortableHeader('TIPO', 'visit_type')}</TableHead>
                      <TableHead>{renderSortableHeader('PRINCIPALES HALLAZGOS', 'findings')}</TableHead>
                      <TableHead className="text-center"><span className="text-[12px] font-medium text-[#002855] tracking-[0.2em]">Acciones</span></TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {paginatedVisits.map(visit => (
                      <TableRow key={visit.id} className={`cursor-pointer ${selectedIds.includes(visit.id) ? 'bg-blue-50/50' : ''}`} onClick={() => handleViewVisit(visit)} onDoubleClick={() => handleViewVisit(visit)}>
                        {canEdit() && selectionMode && (
                          <TableCell className="text-center w-12">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(visit.id)}
                              onChange={() => toggleSelect(visit.id)}
                              onClick={e => e.stopPropagation()}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <TableCellPrimary>
                            {new Date(String(visit.visit_date).includes('T') ? String(visit.visit_date) : `${visit.visit_date}T12:00:00`).toLocaleDateString()}
                          </TableCellPrimary>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <MapPin size={14} className="text-rose-500 shrink-0" />
                            <TableCellSecondary>{(visit as any).locations?.name}</TableCellSecondary>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TableCellPrimary>
                            {getVisitTypeLabel(visit.visit_type)}
                          </TableCellPrimary>
                        </TableCell>
                        <TableCell>
                          {visit.findings ? (
                            <TableCellPrimary className="line-clamp-2 max-w-[300px]">{visit.findings}</TableCellPrimary>
                          ) : (
                            <TableCellSecondary className="italic">Sin hallazgos registrados</TableCellSecondary>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <TableActionButton
                              icon={<Eye size={14} />}
                              onClick={(e) => { e.stopPropagation(); handleViewVisit(visit); }}
                              title="Ver Detalle"
                            />
                            {visit.evidence_url && (
                              <TableActionButton
                                icon={<FileText size={14} />}
                                onClick={(e) => { e.stopPropagation(); window.open(visit.evidence_url!, '_blank'); }}
                                title="Ver Evidencias"
                              />
                            )}
                            {canEdit() && (
                              <>
                                <TableActionButton
                                  icon={<Edit size={14} />}
                                  onClick={(e) => { e.stopPropagation(); handleEditVisit(visit); }}
                                  title="Editar"
                                />
                                <TableActionButton
                                  icon={<AlertTriangle size={14} />}
                                  onClick={(e) => { e.stopPropagation(); handleDeleteVisit(visit.id); }}
                                  title="Eliminar"
                                  variant="danger"
                                />
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={visitsData?.count ?? 0}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {paginatedVisits.map(visit => (
                  <div key={visit.id} className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 flex flex-col group overflow-hidden relative ${selectedIds.includes(visit.id) ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-gray-100 hover:shadow-xl hover:border-slate-300'}`}>
                    {canEdit() && selectionMode && (
                      <div className="absolute top-4 right-4 z-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(visit.id)}
                          onChange={() => toggleSelect(visit.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm"
                        />
                      </div>
                    )}
                    <div className="p-6 flex-1">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-700 transition-colors tracking-tight mb-2">Visita SUTRAN - {(visit as any).locations?.name}</h3>
                          <div className="flex flex-wrap gap-2">
                            <span className={`text-[10px] font-semibold ${typeColors[visit.visit_type]}`}>
                              {getVisitTypeLabel(visit.visit_type)}
                            </span>
                            <span className={`text-[10px] font-semibold ${statusColors[visit.status]}`}>
                              {statusLabels[visit.status]}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4 mb-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100/50">
                            <label className="text-[10px] font-black text-gray-400 tracking-wider block mb-1">FECHA</label>
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                              <Calendar size={14} className="text-blue-500" />
                              {new Date(String(visit.visit_date).includes('T') ? String(visit.visit_date) : `${visit.visit_date}T12:00:00`).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100/50">
                            <label className="text-[10px] font-black text-gray-400 tracking-wider block mb-1">Inspector</label>
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                              <User size={14} className="text-emerald-500" />
                              <span className="truncate">{visit.inspector_name}</span>
                            </div>
                          </div>
                        </div>
                        {visit.evidence_url && (
                          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                            <label className="text-[10px] font-black text-indigo-400 tracking-wider block mb-1">Evidencias</label>
                            <a href={visit.evidence_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-2">
                              <FileText size={14} />
                              Ver Archivos Adjuntos
                            </a>
                          </div>
                        )}
                        {visit.findings && (
                          <div className="bg-amber-50/30 p-4 rounded-xl border border-amber-100/30">
                            <label className="text-[10px] font-black text-amber-600 tracking-wider block mb-2">Hallazgos principales</label>
                            <p className="text-sm text-amber-900 font-medium leading-relaxed line-clamp-3">{visit.findings}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-50 flex gap-2">
                      {canEdit() && (
                        <div className="flex gap-2">
                          <button onClick={() => handleEditVisit(visit)} className="p-2 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-800 hover:text-white transition-all active:scale-95 shadow-sm"><Edit size={16} /></button>
                          <button onClick={() => handleDeleteVisit(visit.id)} className="p-2 bg-white text-rose-500 border border-rose-100 rounded-lg hover:bg-rose-500 hover:text-white transition-all active:scale-95 shadow-sm"><AlertTriangle size={16} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && paginatedVisits.length === 0 && (
            <div className="text-left py-12">
              <p className="text-gray-500 font-medium">No se encontraron visitas registradas.</p>
            </div>
          )}

          {viewingVisit && (
            <DetailModal maxWidth="3xl" onClose={() => setViewingVisit(undefined)} closeOnBackdrop>
              <DetailModalHeader>
                <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 pr-1">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <Building2 size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xs sm:text-base md:text-[18px] font-normal text-white uppercase tracking-tight leading-snug truncate">
                      Detalle de Inspección SUTRAN
                    </h2>
                    <p className="text-[9px] sm:text-[10px] font-normal text-slate-300 uppercase tracking-wide mt-0.5 flex items-center gap-1.5 truncate">
                      <span>{(viewingVisit as any).locations?.name || 'Sede no especificada'}</span>
                      <span>•</span>
                      <span>{new Date(String(viewingVisit.visit_date).includes('T') ? String(viewingVisit.visit_date) : `${viewingVisit.visit_date}T12:00:00`).toLocaleDateString('es-PE')}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingVisit(undefined)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 text-white/50 hover:text-white hover:bg-white/10 transition-all -mr-1"
                  aria-label="Cerrar detalle"
                >
                  <X size={20} />
                </button>
              </DetailModalHeader>

              <DetailModalBody>
                <div className="space-y-4">
                  {/* Badges de Tipo y Estado */}
                  <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-slate-100">
                    <span className={`text-[11px] font-semibold ${statusColors[viewingVisit.status]}`}>
                      {statusLabels[viewingVisit.status]}
                    </span>
                    <span className={`text-[11px] font-semibold ${typeColors[viewingVisit.visit_type]}`}>
                      {getVisitTypeLabel(viewingVisit.visit_type)}
                    </span>
                    <span className="ml-auto text-[9px] font-mono text-slate-500 flex items-center gap-1">
                      <MapPin size={11} className="text-rose-500 shrink-0" />
                      {(viewingVisit as any).locations?.name || 'N/A'}
                    </span>
                  </div>

                  {/* Grilla principal 2 columnas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Datos de la visita */}
                    <div className="bg-slate-50 border border-slate-200 p-3 space-y-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/60 pb-1">
                        Información de Inspección
                      </p>
                      <div className="space-y-1.5">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-semibold">Fecha de Visita</span>
                          <p className="text-[11px] font-mono font-medium text-[#002855]">
                            {new Date(String(viewingVisit.visit_date).includes('T') ? String(viewingVisit.visit_date) : `${viewingVisit.visit_date}T12:00:00`).toLocaleDateString('es-PE')}
                          </p>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-semibold">Inspector Asignado</span>
                          <p className="text-[11px] font-semibold text-slate-700 uppercase">{viewingVisit.inspector_name || 'N/A'}</p>
                        </div>
                        {viewingVisit.inspector_email && (
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-semibold">Contacto del Inspector</span>
                            <p className="text-[11px] font-mono text-slate-700 break-all">{viewingVisit.inspector_email}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Documentación y Evidencias */}
                    <div className="bg-slate-50 border border-slate-200 p-3 space-y-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/60 pb-1">
                        Evidencias y Adjuntos
                      </p>
                      <div className="space-y-1.5">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-semibold">Enlace de Evidencias</span>
                          {viewingVisit.evidence_url ? (
                            <a
                              href={viewingVisit.evidence_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1.5 break-all mt-0.5"
                            >
                              Ver Evidencias en Google Drive <ExternalLink size={12} className="shrink-0" />
                            </a>
                          ) : (
                            <p className="text-[11px] text-slate-500 italic">No hay archivos adjuntos</p>
                          )}
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase font-semibold">Tipo de Acta / Visita</span>
                          <p className="text-[11px] text-slate-700">{getVisitTypeLabel(viewingVisit.visit_type)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hallazgos */}
                  {viewingVisit.findings && (
                    <div className="bg-slate-50 border border-slate-200 p-3">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hallazgos Identificados</p>
                      <p className="text-[10px] text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingVisit.findings}</p>
                    </div>
                  )}

                  {/* Observaciones */}
                  {viewingVisit.observations && (
                    <div className="bg-slate-50 border border-slate-200 p-3">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observaciones Técnicas</p>
                      <p className="text-[10px] text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingVisit.observations}</p>
                    </div>
                  )}
                </div>
              </DetailModalBody>

              <StandardModalFooter
                onClose={() => setViewingVisit(undefined)}
                onEdit={canEdit() ? () => { setViewingVisit(undefined); handleEditVisit(viewingVisit); } : undefined}
                editLabel="Editar"
              />
            </DetailModal>
          )}
        </div>
      </div>
    </div>
  );
}