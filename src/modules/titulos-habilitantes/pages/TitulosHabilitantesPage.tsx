import { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2, MapPin, Search, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import Pagination from '../../../shared/components/ui/Pagination';
import { supabase, Location } from '../../../shared/services/supabase';
import { generatePDF, generateExcel } from '../../../shared/utils/exportUtils';
import { BUSINESS_TYPE_LABELS } from '../../../shared/types/inventory.types';
import Swal from 'sweetalert2';
import { useAuth } from '../../../app/providers/AuthContext';
import { useAllowedLocations } from '../../../shared/hooks/useAllowedLocations';
import TituloHabilitanteForm from '../forms/TituloHabilitanteForm';
import TituloHabilitanteDetails from '../components/TituloHabilitanteDetails';
import ActionToolbar from '../../../shared/components/ui/ActionToolbar';
import ActionsDropdown from '../../../shared/components/ui/ActionsDropdown';
import { useSelectionMode } from '../../../shared/hooks/useSelectionMode';
import FilterBar from '../../../shared/components/ui/FilterBar';
import ViewToggle from '../../../shared/components/ui/ViewToggle';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import PrimaryButton from '../../../shared/components/ui/PrimaryButton';
import RowActions from '../../../shared/components/ui/RowActions';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../shared/components/ui/Table';

type TituloHabilitante = {
  id: string;
  titulo: string;
  tipo: string;
  numero: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  vigencia_del?: string;
  vigencia_al?: string;
  vigencia_documento?: string;
  dias_para_vencer?: number;
  ubicacion_id: string;
  estado: 'vigente' | 'por_vencer' | 'vencido';
  notas?: string;
  created_at: string;
  updated_at: string;
  locations?: Location;
};

export default function TitulosHabilitantes() {
  const { canEdit } = useAuth();
  const allowedLocations = useAllowedLocations();
  const [titulos, setTitulos] = useState<TituloHabilitante[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedRubros, setSelectedRubros] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { selectionMode, toggleSelectionMode } = useSelectionMode();

  const handleToggleSelectionMode = () => {
    setSelectedIds([]);
    toggleSelectionMode();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = (paginated: TituloHabilitante[]) => {
    if (selectedIds.length === paginated.length && paginated.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginated.map(t => t.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const result = await Swal.fire({
      title: `¿Eliminar ${selectedIds.length} títulos seleccionados?`,
      text: "Esta acción no se puede deshacer",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from('titulos_habilitantes').delete().in('id', selectedIds);
        if (error) throw error;
        setSelectedIds([]);
        fetchTitulos();
        Swal.fire('Eliminado', 'Los títulos han sido eliminados.', 'success');
      } catch (error) {
        Swal.fire('Error', 'Hubo un error al eliminar los títulos.', 'error');
      }
    }
  };
  const [sortField, setSortField] = useState<'titulo' | 'tipo' | 'fecha_vencimiento' | 'ubicacion'>('titulo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTitulo, setEditingTitulo] = useState<TituloHabilitante | undefined>(undefined);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedTitulo, setSelectedTitulo] = useState<TituloHabilitante | undefined>(undefined);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchTitulos(), fetchLocations()]);
      setLoading(false);
    })();
  }, []);

  const fetchTitulos = async () => {
    // Sin sedes asignadas y usuario restringido → no hay nada que mostrar
    if (allowedLocations !== null && allowedLocations.length === 0) {
      setTitulos([]);
      return;
    }

    let query = supabase.from('titulos_habilitantes').select('*, locations(*)').order('created_at', { ascending: false });

    // Filtrar por sedes permitidas directamente en la query
    if (allowedLocations !== null && allowedLocations.length > 0) {
      query = query.in('ubicacion_id', allowedLocations);
    }

    const { data, error } = await query;
    if (!error && data) {
      // Filtrar para mostrar solo los títulos de sedes tipo CITV, ESCON y ECSAL
      const citvTitulos = (data as TituloHabilitante[]).filter(t => t.locations && ['revision', 'escuela_conductores', 'policlinico'].includes(t.locations.type));
      setTitulos(citvTitulos);
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

    const { data } = await query;
    if (data) {
      setLocations(data as any[]);
    }
  };

  const filteredLocations = useMemo(() => {
    if (selectedRubros.length === 0) return locations;
    return locations.filter(loc => loc.business_type && selectedRubros.includes(loc.business_type));
  }, [locations, selectedRubros]);

  const getDaysUntil = (dateString: string) => {
    if (!dateString) return 0;
    const target = new Date(dateString);
    const today = new Date();
    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const sortedTitulos = [...titulos].sort((a, b) => {
    let aValue: string | number = '';
    let bValue: string | number = '';

    switch (sortField) {
      case 'titulo':
        aValue = a.titulo || '';
        bValue = b.titulo || '';
        break;
      case 'tipo':
        aValue = a.tipo || '';
        bValue = b.tipo || '';
        break;
      case 'fecha_vencimiento': {
        const dateA = a.vigencia_al || a.fecha_vencimiento;
        const dateB = b.vigencia_al || b.fecha_vencimiento;
        aValue = dateA ? new Date(dateA).getTime() : 0;
        bValue = dateB ? new Date(dateB).getTime() : 0;
        break;
      }
      case 'ubicacion':
        aValue = a.locations?.name || '';
        bValue = b.locations?.name || '';
        break;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const filtered = sortedTitulos.filter(t => {
    const q = search.toLowerCase();
    const matchesSearch = t.titulo?.toLowerCase().includes(q) ||
      t.tipo?.toLowerCase().includes(q) ||
      t.numero?.toLowerCase().includes(q) ||
      t.locations?.name?.toLowerCase().includes(q);

    const matchesLocation = selectedLocations.length === 0 ||
      selectedLocations.length === locations.length ||
      selectedLocations.includes(t.ubicacion_id || '');
      
    const rubroEntries = Object.keys(BUSINESS_TYPE_LABELS);
    const matchesRubro = selectedRubros.length === 0 || 
      selectedRubros.length === rubroEntries.length ||
      selectedRubros.includes(t.locations?.business_type || '');

    return matchesSearch && matchesLocation && matchesRubro;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: 'titulo' | 'tipo' | 'fecha_vencimiento' | 'ubicacion') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar título habilitante?',
      text: "Esta acción no se puede deshacer",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'rounded-2xl',
        title: 'text-xl font-normal text-slate-800',
        confirmButton: 'rounded-xl font-normal tracking-wide',
        cancelButton: 'rounded-xl font-normal tracking-wide'
      }
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from('titulos_habilitantes').delete().eq('id', id);
        if (error) throw error;

        Swal.fire({
          title: 'Eliminado',
          text: 'El título habilitante ha sido eliminado.',
          icon: 'success',
          customClass: { popup: 'rounded-2xl' }
        });

        fetchTitulos();
      } catch (error) {
        console.error('Error al eliminar título habilitante:', error);
        Swal.fire({
          title: 'Error',
          text: 'Hubo un error al intentar eliminar el título habilitante.',
          icon: 'error',
          customClass: { popup: 'rounded-2xl' }
        });
      }
    }
  };

  const renderStatus = (titulo: TituloHabilitante) => {
    const targetDate = titulo.vigencia_al || titulo.fecha_vencimiento;
    if (!targetDate) return <span className="text-[10px] text-slate-400 italic">Sin vencimiento</span>;

    const daysLeft = getDaysUntil(targetDate);
    const dateStr = new Date(String(targetDate).includes('T') ? String(targetDate) : `${targetDate}T12:00:00`).toLocaleDateString('es-PE', { timeZone: 'UTC' });

    if (daysLeft <= 0) {
      return (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[14px] font-semibold bg-rose-100 text-rose-700">Vencido ({Math.abs(daysLeft)}d)</span>
          <span className="text-[10px] font-semibold text-rose-600/80 ml-1">{dateStr}</span>
        </div>
      );
    }

    if (daysLeft <= 30) {
      return (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[14px] font-semibold bg-amber-100 text-amber-700">Vence {daysLeft}d</span>
          <span className="text-[10px] font-semibold text-amber-600/80 ml-1">{dateStr}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-[14px] font-semibold bg-emerald-100 text-emerald-700">Vigente ({daysLeft}d)</span>
        <span className="text-[14px] font-semibold text-slate-800 ml-1">{dateStr}</span>
      </div>
    );
  };
  const downloadReport = async () => {
    const data = filtered.map((t, i) => {
      const startDate = t.vigencia_del || t.fecha_emision;
      const targetDate = t.vigencia_al || t.fecha_vencimiento;
      const daysLeft = targetDate ? getDaysUntil(targetDate) : '';
      return {
        nro: i + 1,
        titulo: t.titulo || '',
        tipo: t.tipo || '',
        numero: t.numero || '',
        vigencia_del: startDate ? new Date(String(startDate).includes('T') ? String(startDate) : `${startDate}T12:00:00`).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '',
        vigencia_al: targetDate ? new Date(String(targetDate).includes('T') ? String(targetDate) : `${targetDate}T12:00:00`).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '',
        vigencia_doc: t.vigencia_documento || '',
        dias_vencer: daysLeft !== '' ? `${daysLeft} días` : '—',
        ubicacion: t.locations?.name || '',
        estado: t.estado || ''
      };
    });

    await generateExcel({
      title: 'Reporte de Títulos Habilitantes',
      filename: 'Títulos Habilitantes',
      columns: [
        { header: 'N°', key: 'nro', width: 6 },
        { header: 'Título', key: 'titulo', width: 30 },
        { header: 'Tipo', key: 'tipo', width: 22 },
        { header: 'Número', key: 'numero', width: 18 },
        { header: 'Vigencia Del', key: 'vigencia_del', width: 18 },
        { header: 'Vigencia Al', key: 'vigencia_al', width: 18 },
        { header: 'Vigencia Doc.', key: 'vigencia_doc', width: 18 },
        { header: 'Días Vencer', key: 'dias_vencer', width: 15 },
        { header: 'Ubicación', key: 'ubicacion', width: 22 },
        { header: 'Estado', key: 'estado', width: 15 }
      ],
      data
    });
  };

  const downloadReportPdf = () => {
    const data = filtered.map((t, i) => {
      const startDate = t.vigencia_del || t.fecha_emision;
      const targetDate = t.vigencia_al || t.fecha_vencimiento;
      const daysLeft = targetDate ? getDaysUntil(targetDate) : '';
      return {
        nro: i + 1,
        titulo: t.titulo || '',
        tipo: t.tipo || '',
        numero: t.numero || '',
        vigencia_del: startDate ? new Date(String(startDate).includes('T') ? String(startDate) : `${startDate}T12:00:00`).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '',
        vigencia_al: targetDate ? new Date(String(targetDate).includes('T') ? String(targetDate) : `${targetDate}T12:00:00`).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '',
        dias_vencer: daysLeft !== '' ? `${daysLeft} días` : '—',
        ubicacion: t.locations?.name || '',
        estado: t.estado || ''
      };
    });

    generatePDF({
      title: 'Reporte de Títulos Habilitantes',
      filename: 'Títulos Habilitantes',
      columns: [
        { header: 'N°', key: 'nro' },
        { header: 'Título', key: 'titulo' },
        { header: 'Tipo', key: 'tipo' },
        { header: 'Número', key: 'numero' },
        { header: 'Vigencia Del', key: 'vigencia_del' },
        { header: 'Vigencia Al', key: 'vigencia_al' },
        { header: 'Días Vencer', key: 'dias_vencer' },
        { header: 'Ubicación', key: 'ubicacion' },
        { header: 'Estado', key: 'estado' }
      ],
      data
    });
  };
  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto">

        <ActionToolbar
          totalItems={filtered.length}
          label="Títulos"
          searchComponent={
            <>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-12 pr-4 py-3 text-[12px] font-semibold text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 tracking-[0.1em]"
              />
            </>
          }
        >
          <FilterBar
            filters={[
              { key: 'business_type', placeholder: 'TODOS LOS RUBROS', icon: MapPin, iconClassName: 'text-blue-500', wrapperClassName: 'md:min-w-[220px]', options: Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
              { key: 'location', placeholder: 'TODAS LAS SEDES', icon: MapPin, iconClassName: 'text-rose-500', wrapperClassName: 'md:min-w-[240px]', options: filteredLocations.map(loc => ({ value: loc.id, label: loc.companies?.name ? `${loc.name} (${loc.companies.name})` : loc.name })) },
            ]}
            values={{ location: selectedLocations, business_type: selectedRubros }}
            onChange={(key, value) => {
              if (key === 'location') setSelectedLocations(value as string[]);
              if (key === 'business_type') {
                const newRubros = value as string[];
                setSelectedRubros(newRubros);
                if (newRubros.length > 0) {
                  const validIds = new Set(locations.filter(l => l.business_type && newRubros.includes(l.business_type)).map(l => l.id));
                  setSelectedLocations(selectedLocations.filter(id => validIds.has(id)));
                }
              }
              setCurrentPage(1);
            }}
            onClearAll={() => {
              setSelectedRubros([]);
              setSelectedLocations([]);
              setCurrentPage(1);
            }}
          />

          <ViewToggle viewMode={viewMode} onChange={setViewMode} />

          {canEdit() && (
            <PrimaryButton icon={Plus} onClick={() => { setEditingTitulo(undefined); setIsFormOpen(true); }}>
              Nuevo Título
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
            onExportExcel={downloadReport}
            onExportPDF={downloadReportPdf}
          />

          {canEdit() && selectionMode && selectedIds.length > 0 && viewMode === 'table' && (
            <button
              onClick={handleBulkDelete}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 hover:text-rose-700 transition-all text-[10px] font-semibold uppercase tracking-wider"
            >
              <Trash2 size={14} />
              Eliminar ({selectedIds.length})
            </button>
          )}
        </ActionToolbar>

        {loading ? (
          <LoadingSpinner label="Cargando títulos habilitantes..." />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedData.map(titulo => (
              <div key={titulo.id} className={`bg-white rounded-2xl shadow-sm border transition-all p-6 flex flex-col group overflow-hidden hover:-translate-y-0.5 duration-200 relative ${selectedIds.includes(titulo.id) ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-slate-200/80 hover:shadow-xl'}`}>
                {canEdit() && selectionMode && (
                  <div className="absolute top-4 right-4 z-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(titulo.id)}
                      onChange={() => toggleSelect(titulo.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 cursor-pointer shadow-sm"
                    />
                  </div>
                )}
                <div className="flex justify-between items-center mb-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-100 text-slate-400 group-hover:bg-[#002855] group-hover:text-white transition-all shadow-sm">
                    <FileText size={20} />
                  </div>
                  {renderStatus(titulo)}
                </div>

                <div className="mb-4">
                  <h4 className="text-[14px] font-semibold text-slate-800 uppercase leading-none">{titulo.titulo}</h4>
                  <p className="text-[11px] font-semibold text-slate-400 tracking-wider mt-1">{titulo.tipo}</p>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 uppercase">
                    <MapPin size={14} className="text-rose-500 shrink-0" />
                    <span className="truncate">{titulo.locations?.name || 'Ubicación N/A'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 flex flex-col gap-0.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Número</label>
                      <span className="text-[11px] font-semibold text-slate-600 uppercase truncate">{titulo.numero || '—'}</span>
                    </div>
                    <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 flex flex-col gap-0.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Vigencia Doc.</label>
                      <span className="text-[11px] font-semibold text-slate-600 uppercase truncate">{titulo.vigencia_documento || '—'}</span>
                    </div>
                    <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 flex flex-col gap-0.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Vigencia Del</label>
                      <span className="text-[11px] font-semibold text-slate-600 uppercase truncate">
                        {(titulo.vigencia_del || titulo.fecha_emision) ? new Date((titulo.vigencia_del || titulo.fecha_emision) as string).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 flex flex-col gap-0.5">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Vigencia Al</label>
                      <span className="text-[11px] font-semibold text-slate-600 uppercase truncate">
                        {(titulo.vigencia_al || titulo.fecha_vencimiento) ? new Date((titulo.vigencia_al || titulo.fecha_vencimiento) as string).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150 mt-auto">
                  <RowActions
                    canEdit={canEdit()}
                    onEdit={(e) => { e.stopPropagation(); setEditingTitulo(titulo); setIsFormOpen(true); }}
                    onDelete={(e) => { e.stopPropagation(); handleDelete(titulo.id); }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-300">
            <div className="bg-slate-50 border-b border-slate-200 shrink-0">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </div>
            {/* Mobile card view */}
            <div className="block md:hidden divide-y divide-slate-100">
              {paginatedData.map((titulo) => (
                <div key={titulo.id} className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedIds.includes(titulo.id) ? 'bg-blue-50/40' : ''}`} onClick={() => { setSelectedTitulo(titulo); setShowDetails(true); }}>
                  <div className="flex items-center gap-2">
                    {canEdit() && selectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(titulo.id)}
                        onChange={() => toggleSelect(titulo.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 cursor-pointer shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-[#002855] truncate leading-tight">{titulo.titulo}</p>
                      <p className="text-[14px] font-semibold text-slate-800 uppercase">{titulo.tipo}</p>
                    </div>
                    {renderStatus(titulo)}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 flex-wrap">
                    <span>Del: {(titulo.vigencia_del || titulo.fecha_emision) ? new Date((titulo.vigencia_del || titulo.fecha_emision) as string).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '—'}</span>
                    <span>Al: {(titulo.vigencia_al || titulo.fecha_vencimiento) ? new Date((titulo.vigencia_al || titulo.fecha_vencimiento) as string).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '—'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                    <MapPin size={10} className="text-rose-400 shrink-0" />
                    <span className="truncate">{titulo.locations?.name || 'Ubicación N/A'}</span>
                    <span className="ml-auto">{titulo.vigencia_documento || '—'}</span>
                  </div>
                  {canEdit() && (
                    <div className="flex gap-1.5 mt-1.5" onClick={e => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); setEditingTitulo(titulo); setIsFormOpen(true); }} className="text-[10px] font-semibold text-slate-600 hover:underline">Editar</button>
                      <span className="text-slate-300">|</span>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(titulo.id); }} className="text-[10px] font-semibold text-rose-500 hover:underline">Eliminar</button>
                    </div>
                  )}
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
                          checked={paginatedData.length > 0 && selectedIds.length === paginatedData.length}
                          onChange={() => toggleSelectAll(paginatedData)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 transition-all cursor-pointer"
                        />
                      </TableHead>
                    )}

                    <TableHead>
                      <button
                        onClick={() => handleSort('titulo')}
                        className="flex items-center justify-start gap-2 hover:text-blue-600 transition-colors"
                      >
                        <span className="text-[12px] font-semibold text-[#002855] tracking-[0.2em]">Título</span>
                        {sortField === 'titulo' && (
                          sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('tipo')}
                        className="flex items-center justify-start gap-2 hover:text-blue-600 transition-colors"
                      >
                        <span className="text-[12px] font-semibold text-[#002855] tracking-[0.2em]">Tipo</span>
                        {sortField === 'tipo' && (
                          sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <span className="text-[12px] font-semibold text-[#002855] tracking-[0.2em]">Vigencia Del</span>
                    </TableHead>
                    <TableHead>
                      <span className="text-[12px] font-semibold text-[#002855] tracking-[0.2em]">Vigencia Al</span>
                    </TableHead>
                    <TableHead>
                      <span className="text-[12px] font-semibold text-[#002855] tracking-[0.2em]">Vigencia Doc.</span>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('fecha_vencimiento')}
                        className="flex items-center justify-start gap-2 hover:text-blue-600 transition-colors"
                      >
                        <span className="text-[12px] font-semibold text-[#002855] tracking-[0.2em]">Días para Vencer</span>
                        {sortField === 'fecha_vencimiento' && (
                          sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort('ubicacion')}
                        className="flex items-center justify-start gap-2 hover:text-blue-600 transition-colors"
                      >
                        <span className="text-[12px] font-semibold text-[#002855] tracking-[0.2em]">Ubicación</span>
                        {sortField === 'ubicacion' && (
                          sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <span className="text-[12px] font-semibold text-[#002855] tracking-[0.2em]">Acciones</span>
                    </TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((titulo) => (
                    <TableRow
                      key={titulo.id}
                      className={`cursor-pointer ${selectedIds.includes(titulo.id) ? 'bg-blue-50/40' : ''}`}
                      onClick={() => { setSelectedTitulo(titulo); setShowDetails(true); }}
                    >
                      {canEdit() && selectionMode && (
                        <TableCell className="text-center w-12">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(titulo.id)}
                            onChange={() => toggleSelect(titulo.id)}
                            onClick={e => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 transition-all cursor-pointer"
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <span className="text-[13px] font-semibold text-[#002855] leading-tight">{titulo.titulo}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[12px] font-semibold text-slate-700 uppercase">{titulo.tipo}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[12px] font-semibold text-slate-700">
                          {(titulo.vigencia_del || titulo.fecha_emision) ? new Date((titulo.vigencia_del || titulo.fecha_emision) as string).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[12px] font-semibold text-slate-700">
                          {(titulo.vigencia_al || titulo.fecha_vencimiento) ? new Date((titulo.vigencia_al || titulo.fecha_vencimiento) as string).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[12px] font-semibold text-slate-700 uppercase">{titulo.vigencia_documento || '—'}</span>
                      </TableCell>
                      <TableCell>
                        {renderStatus(titulo)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <MapPin size={14} className="text-rose-500 shrink-0" />
                          <span className="text-[12px] font-semibold uppercase truncate max-w-xs block">{titulo.locations?.name || 'Ubicación N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2 lg:opacity-0 lg:group-hover/row:opacity-100 transition-opacity duration-150">
                          <RowActions
                            canEdit={canEdit()}
                            onEdit={(e) => { e.stopPropagation(); setEditingTitulo(titulo); setIsFormOpen(true); }}
                            onDelete={(e) => { e.stopPropagation(); handleDelete(titulo.id); }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {isFormOpen && (
        <TituloHabilitanteForm
          tituloHabilitante={editingTitulo}
          locations={locations}
          onClose={() => setIsFormOpen(false)}
          onSave={() => {
            setIsFormOpen(false);
            fetchTitulos();
          }}
        />
      )}

      {showDetails && selectedTitulo && (
        <TituloHabilitanteDetails
          titulo={selectedTitulo}
          onClose={() => setShowDetails(false)}
          onEdit={
            canEdit()
              ? () => {
                setShowDetails(false);
                setEditingTitulo(selectedTitulo);
                setIsFormOpen(true);
              }
              : undefined
          }
        />
      )}
    </div>
  );
}