import { useEffect, useState, useCallback, useMemo } from 'react';
import { Trash2, MapPin, X, Copy, ChevronDown, Search, Filter } from 'lucide-react';
import { GrServerCluster as ServerIcon } from 'react-icons/gr';
import { SiAnydesk } from "react-icons/si";
import { supabase, Server, Location } from '../../../shared/services/supabase';
import { BUSINESS_TYPE_LABELS } from '../../../shared/types/inventory.types';
import { generatePDF, generateExcel } from '../../../shared/utils/exportUtils';
import { useAuth } from '../../../app/providers/AuthContext';
import ServerForm from '../forms/ServerForm';
import Pagination from '../../../shared/components/ui/Pagination';
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
import ActionToolbar from '../../../shared/components/ui/ActionToolbar';
import ActionsDropdown from '../../../shared/components/ui/ActionsDropdown';
import { useSelectionMode } from '../../../shared/hooks/useSelectionMode';
import FilterBar from '../../../shared/components/ui/FilterBar';
import ViewToggle from '../../../shared/components/ui/ViewToggle';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import PrimaryButton from '../../../shared/components/ui/PrimaryButton';
import RowActions from '../../../shared/components/ui/RowActions';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableCellPrimary,
} from '../../../shared/components/ui/Table';

// ─── Stats (tipado correcto) ─────────────────────────────────────────────────
interface ServerStats {
  withIp: number;
  withAnydesk: number;
  recentlyUpdated: number;
}

export default function Servers() {

  const { canEdit } = useAuth();
  const { success: notifySuccess, info: notifyInfo, confirm, error: notifyError } = useNotify();

  const [servers, setServers] = useState<Server[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Server | undefined>();
  const [showDetails, setShowDetails] = useState(false);
  const [selectedServer, setSelectedServer] = useState<Server | undefined>();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedRubros, setSelectedRubros] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  const filteredLocations = useMemo(() => {
    if (selectedRubros.length === 0) return locations;
    return locations.filter(loc => loc.business_type && selectedRubros.includes(loc.business_type));
  }, [locations, selectedRubros]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { selectionMode, toggleSelectionMode } = useSelectionMode();

  const handleToggleSelectionMode = () => {
    setSelectedIds([]);
    toggleSelectionMode();
  };
  const [sortField, setSortField] = useState<'name' | 'location' | 'ip' | 'anydesk' | 'updated_at'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  // FIX #3: stats ahora tienen estado real
  const [, setStats] = useState<ServerStats>({ withIp: 0, withAnydesk: 0, recentlyUpdated: 0 });

  // FIX #4: resetPagination definida ANTES de cualquier función que la llame
  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchServers(), fetchLocations()]);
      setLoading(false);
    })();
  }, []);

  const fetchServers = async () => {
    const { data, error } = await supabase
      .from('servers')
      .select('*, locations(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setServers(data as Server[]);
      calculateStats(data as Server[]);
    }
  };

  // FIX #3: calculateStats ahora guarda los valores en estado
  const calculateStats = (srvData: Server[]) => {
    let withIp = 0, withAnydesk = 0, recentlyUpdated = 0;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    srvData.forEach(s => {
      if (s.ip_address) withIp++;
      if (s.anydesk_id) withAnydesk++;
      if (new Date(s.updated_at) > oneWeekAgo) recentlyUpdated++;
    });

    setStats({ withIp, withAnydesk, recentlyUpdated });
  };

  const fetchLocations = async () => {
    const { data } = await supabase.from('locations').select('*, companies(id, name)').eq('is_active', true).order('name');
    if (data) setLocations(data);
  };

  const openCreate = useCallback(() => { setEditing(undefined); setShowForm(true); }, []);
  const openEdit = (s: Server) => { setEditing(s); setShowForm(true); };

  const downloadServersReport = useCallback(async () => {
    const data = servers.map((s, i) => ({
      nro: i + 1,
      name: s.name || '',
      location: s.locations?.name || 'VIRTUAL',
      ip: s.ip_address || '',
      anydesk: s.anydesk_id || '',
      username: s.username || '',
      password: s.password || '',

      notes: s.notes || '',
      updated: new Date(s.updated_at).toLocaleString('es-PE')
    }));

    await generateExcel({
      title: 'Reporte de Servidores',
      filename: 'Servidores',
      columns: [
        { header: 'N°', key: 'nro', width: 6 },
        { header: 'Nombre', key: 'name', width: 25 },
        { header: 'Ubicación', key: 'location', width: 20 },
        { header: 'Dirección IP', key: 'ip', width: 18 },
        { header: 'AnyDesk ID', key: 'anydesk', width: 18 },
        { header: 'Usuario Access', key: 'username', width: 20 },
        { header: 'Contraseña', key: 'password', width: 20 },
        { header: 'S.O.', key: 'os', width: 15 },
        { header: 'CPU', key: 'cpu', width: 15 },
        { header: 'RAM (GB)', key: 'ram', width: 12 },
        { header: 'Disco (GB)', key: 'disk', width: 12 },
        { header: 'Notas', key: 'notes', width: 30 },
        { header: 'Última Modificación', key: 'updated', width: 22 }
      ],
      data
    });
  }, [servers]);

  const downloadServersReportPdf = useCallback(() => {
    const data = servers.map((s, i) => ({
      nro: i + 1,
      name: s.name || '',
      location: s.locations?.name || 'VIRTUAL',
      ip: s.ip_address || '—',
      anydesk: s.anydesk_id || '—',
      updated: new Date(String(s.updated_at).includes('T') ? String(s.updated_at) : `${s.updated_at}T12:00:00`).toLocaleDateString('es-PE')
    }));

    generatePDF({
      title: 'Reporte de Servidores',
      filename: 'Servidores',
      columns: [
        { header: 'N°', key: 'nro' },
        { header: 'Nombre', key: 'name' },
        { header: 'Ubicación', key: 'location' },
        { header: 'Dirección IP', key: 'ip' },
        { header: 'AnyDesk ID', key: 'anydesk' },
        { header: 'S.O.', key: 'os' },
        { header: 'Modificado', key: 'updated' }
      ],
      data
    });
  }, [servers]);  // FIX #2: dependencias correctas en el useEffect de eventos
  useEffect(() => {
    const handleDownload = () => downloadServersReport();
    const handleDownloadPdf = () => downloadServersReportPdf();
    const handleNewServer = () => openCreate();
    const handleToggleView = () => setViewMode(prev => prev === 'grid' ? 'table' : 'grid');

    window.addEventListener('servers:download', handleDownload);
    window.addEventListener('servers:download-pdf', handleDownloadPdf);
    window.addEventListener('servers:new', handleNewServer);
    window.addEventListener('servers:toggle-view', handleToggleView);

    return () => {
      window.removeEventListener('servers:download', handleDownload);
      window.removeEventListener('servers:download-pdf', handleDownloadPdf);
      window.removeEventListener('servers:new', handleNewServer);
      window.removeEventListener('servers:toggle-view', handleToggleView);
    };
  }, [downloadServersReport, downloadServersReportPdf, openCreate]);

  const del = async (s: Server) => {
    const confirmed = await confirm(`¿Eliminar servidor "${s.name}"?`, 'Confirmar Eliminación');
    if (confirmed) {
      const { error } = await supabase.from('servers').delete().eq('id', s.id);
      if (error) {
        notifyError('Error al eliminar el servidor: ' + error.message);
      } else {
        setSelectedIds(prev => prev.filter(id => id !== s.id));
        await fetchServers();
        notifySuccess('Servidor eliminado correctamente');
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedData.map(s => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    const confirmed = await confirm(`¿Eliminar ${selectedIds.length} servidores seleccionados?`, 'Eliminación por Lote');
    if (confirmed) {
      const { error } = await supabase.from('servers').delete().in('id', selectedIds);
      if (!error) {
        setSelectedIds([]);
        await fetchServers();
        notifySuccess(`${selectedIds.length} servidores eliminados correctamente`);
      } else {
        // FIX #5: sin alert() bloqueante
        notifyError('Error al eliminar: ' + error.message);
      }
    }
  };

  const handleSort = (field: 'name' | 'location' | 'ip' | 'anydesk' | 'updated_at') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    resetPagination();
  };

  const sortedServers = [...servers].sort((a, b) => {
    let aValue: string | number = '';
    let bValue: string | number = '';

    switch (sortField) {
      case 'name':
        aValue = a.name || '';
        bValue = b.name || '';
        break;
      case 'location':
        aValue = a.locations?.name || '';
        bValue = b.locations?.name || '';
        break;
      case 'ip':
        aValue = a.ip_address || '';
        bValue = b.ip_address || '';
        break;
      case 'anydesk':
        aValue = a.anydesk_id || '';
        bValue = b.anydesk_id || '';
        break;
      case 'updated_at':
        aValue = new Date(a.updated_at).getTime();
        bValue = new Date(b.updated_at).getTime();
        break;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const filtered = sortedServers.filter(s => {
    const q = search.toLowerCase();
    const matchesSearch =
      s.name?.toLowerCase().includes(q) ||
      s.ip_address?.toLowerCase().includes(q) ||
      s.anydesk_id?.toLowerCase().includes(q) ||
      s.locations?.name?.toLowerCase().includes(q);

    const matchesRubro =
      selectedRubros.length === 0 ||
      selectedRubros.length === Object.keys(BUSINESS_TYPE_LABELS).length ||
      selectedRubros.includes(s.locations?.business_type || '');

    const matchesLocation =
      selectedLocations.length === 0 ||
      selectedLocations.length === locations.length ||
      selectedLocations.includes(s.location_id || '');

    return matchesSearch && matchesRubro && matchesLocation;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  // FIX #5: helper de copia sin alert()
  const copyToClipboard = (text: string, label = 'Copiado') => {
    navigator.clipboard.writeText(text);
    notifyInfo(`${label} al portapapeles`);
  };

  return (
    // FIX #1: estructura JSX completa y correctamente cerrada
    <div className="flex flex-col h-full bg-[#f8fafc]">

      <div className="p-6 space-y-6 flex-1 overflow-y-auto">

        {/* Barra de Acciones */}
        <ActionToolbar
          totalItems={filtered.length}
          label="Instancias"
          searchComponent={
            <>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPagination(); }}
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
            ]}
            values={{ business_type: selectedRubros, location: selectedLocations }}
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
              }
              setCurrentPage(1);
            }}
            onClearAll={() => {
              setSelectedRubros([]);
              setSelectedLocations([]);
              setCurrentPage(1);
            }}
          />

          <ViewToggle viewMode={viewMode} onChange={v => setViewMode(v)} />

          {canEdit() && (
            <PrimaryButton onClick={openCreate}>
              Nuevo Servidor
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
            onExportExcel={downloadServersReport}
            onExportPDF={downloadServersReportPdf}
          />
        </ActionToolbar>

        {/* Contenido principal */}
        {loading ? (
          <LoadingSpinner label="Cargando servidores..." />
        ) : viewMode === 'grid' ? (

          /* ── VISTA GRID ── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-1">
            {paginatedData.map(srv => {
              const hasIp = !!srv.ip_address;
              const hasAnydesk = !!srv.anydesk_id;
              const isSelected = selectedIds.includes(srv.id);

              return (
                <div
                  key={srv.id}
                  onClick={() => { setSelectedServer(srv); setShowDetails(true); }}
                  className={`bg-white rounded-none shadow-sm border transition-all duration-300 flex flex-col group overflow-hidden relative cursor-pointer hover:bg-slate-50/80 hover:border-blue-200/50 hover:shadow-md ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-slate-100'}`}
                >
                  {canEdit() && selectionMode && (
                    <div className="absolute top-4 left-4 z-20">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(srv.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded border-slate-200 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer shadow-sm animate-in fade-in slide-in-from-right-2 duration-200"
                      />
                    </div>
                  )}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-blue-500/10 transition-colors" />

                  <div className="p-4 flex-1 relative z-10">
                    <div className="flex items-center gap-3 mb-4 pt-1">
                      <div className={`w-10 h-10 rounded-none flex items-center justify-center transition-all duration-300 ${canEdit() ? 'md:ml-8' : ''} bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-600/20`}>
                        <ServerIcon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[13px] font-semibold text-[#002855] tracking-tight truncate leading-tight group-hover:text-blue-700 transition-colors">{srv.name}</h3>
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 mt-0.5">
                          <MapPin size={9} className="text-rose-500" /> {srv.locations?.name || 'VIRTUAL'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className={`p-2 rounded-none border transition-all ${hasIp ? 'bg-emerald-50/20 border-emerald-100/50' : 'bg-slate-50 border-slate-100'}`}>
                        <label className="text-[10px] font-semibold text-slate-400 tracking-wider block mb-0.5 ml-1">LAN</label>
                        <p className={`text-[11px] font-mono font-semibold ${hasIp ? 'text-emerald-700' : 'text-slate-400'}`}>{srv.ip_address || '—'}</p>
                      </div>
                      <div className={`p-2 rounded-none border transition-all ${hasAnydesk ? 'bg-blue-50/20 border-blue-100/50' : 'bg-slate-50 border-slate-100'}`}>
                        <label className="text-[10px] font-semibold text-slate-400 tracking-wider block mb-0.5 ml-1">AnyDesk</label>
                        <p className={`text-[11px] font-mono font-semibold ${hasAnydesk ? 'text-blue-700' : 'text-slate-400'}`}>{srv.anydesk_id || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex gap-2 z-10">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedServer(srv); setShowDetails(true); }}
                      className="flex-1 py-1.5 text-[10px] font-semibold tracking-wider text-slate-600 bg-white border border-slate-200 rounded-none hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                    >
                      Ficha
                    </button>
                    <RowActions
                      canEdit={canEdit()}
                      onEdit={(e) => { e.stopPropagation(); openEdit(srv); }}
                      onDelete={(e) => { e.stopPropagation(); del(srv); }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

        ) : (

          /* ── VISTA LIST ── */
          <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden flex flex-col">

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
                    <span className="hidden xl:block text-[10px] font-semibold text-rose-600 tracking-wider">
                      {selectedIds.length} marcados
                    </span>
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-2 px-3 py-2 bg-rose-500 text-white text-[10px] font-semibold uppercase tracking-wider rounded-md hover:bg-rose-600 transition-all shadow-sm active:scale-95"
                      title="Eliminar seleccionados"
                    >
                      <Trash2 size={14} />
                      <span className="hidden sm:inline">Eliminar</span>
                    </button>
                  </div>
                )}
              </Pagination>
            </div>

            <div className="flex-1">

              {/* Vista Mobile Accordion */}
              <div className="md:hidden space-y-3">
                {paginatedData.map(srv => {
                  const isExpanded = expandedId === srv.id;
                  const hasIp = !!srv.ip_address;
                  const hasAnydesk = !!srv.anydesk_id;
                  const isSelected = selectedIds.includes(srv.id);

                  return (
                    <div key={srv.id} className={`bg-white border border-slate-200 p-4 transition-all duration-300 ${isSelected ? 'border-[#002855] bg-[#002855]/5' : ''}`}>
                      <div className={`flex items-center justify-between`}>
                        <div className="flex items-center gap-4">
                          {canEdit() && selectionMode && (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(srv.id)}
                              onChange={() => toggleSelect(srv.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 transition-all cursor-pointer animate-in fade-in slide-in-from-right-2 duration-200"
                            />
                          )}
                          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : srv.id)}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm bg-slate-50 border border-slate-100 text-slate-400 transition-all">
                              <ServerIcon size={18} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[13px] font-black text-[#002855] leading-tight">{srv.name}</span>
                              <span className="text-[10px] font-semibold text-slate-400 tracking-wider mt-0.5">{srv.locations?.name || 'VIRTUAL'}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronDown
                          onClick={() => setExpandedId(isExpanded ? null : srv.id)}
                          className={`text-slate-300 transition-transform duration-500 cursor-pointer ${isExpanded ? 'rotate-180' : ''}`}
                          size={16}
                        />
                      </div>

                      {isExpanded && (
                        <div className="space-y-4 border-t border-slate-100 mt-4 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="grid grid-cols-2 gap-3">
                            <div className={`p-3 rounded-xl border ${hasIp ? 'bg-emerald-50/30 border-emerald-100/50' : 'bg-slate-50 border-slate-100'}`}>
                              <label className="text-[10px] font-black text-slate-400 tracking-wider block mb-1">Red Interna</label>
                              <div className="flex items-center justify-between">
                                <span className={`text-[11px] font-mono font-black ${hasIp ? 'text-[#002855]' : 'text-slate-300'}`}>{srv.ip_address || '—'}</span>
                                {hasIp && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(srv.ip_address!, 'IP'); }}
                                    className="p-1.5 bg-white rounded-lg shadow-sm text-slate-400 active:scale-95 transition-all"
                                  >
                                    <Copy size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className={`p-3 rounded-xl border ${hasAnydesk ? 'bg-blue-50/30 border-blue-100/50' : 'bg-slate-50 border-slate-100'}`}>
                              <label className="text-[10px] font-black text-slate-400 tracking-wider block mb-1">ID Remoto</label>
                              <div className="flex items-center justify-between">
                                <span className={`text-[11px] font-mono font-black ${hasAnydesk ? 'text-red-600' : 'text-slate-300'}`}>{srv.anydesk_id || '—'}</span>
                                {hasAnydesk && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(srv.anydesk_id!, 'AnyDesk ID'); }}
                                    className="p-1.5 bg-white rounded-lg shadow-sm text-slate-400 active:scale-95 transition-all"
                                  >
                                    <Copy size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {canEdit() && (
                            <div className="flex gap-1.5 border-t border-slate-100 pt-3">
                              <button onClick={() => openEdit(srv)} className="text-[10px] font-bold text-[#002855] hover:underline bg-[#002855]/5 px-2 py-1 rounded-sm w-full text-center">Editar</button>
                              <button onClick={() => del(srv)} className="text-[10px] font-bold text-rose-600 hover:underline bg-rose-50 px-2 py-1 rounded-sm w-full text-center">Eliminar</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Vista Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canEdit() && selectionMode && (
                        <TableHead className="w-12 animate-in fade-in slide-in-from-right-2 duration-200">
                          <input
                            type="checkbox"
                            checked={paginatedData.length > 0 && selectedIds.length === paginatedData.length}
                            onChange={toggleSelectAll}
                            className="w-3.5 h-3.5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                          />
                        </TableHead>
                      )}
                      <TableHead sortable isSorted={sortField === 'name'} sortDirection={sortDirection} onClick={() => handleSort('name')}>Servidor</TableHead>
                      <TableHead sortable isSorted={sortField === 'location'} sortDirection={sortDirection} onClick={() => handleSort('location')}>Ubicación</TableHead>
                      <TableHead sortable isSorted={sortField === 'ip'} sortDirection={sortDirection} onClick={() => handleSort('ip')}>IP</TableHead>
                      <TableHead sortable isSorted={sortField === 'anydesk'} sortDirection={sortDirection} onClick={() => handleSort('anydesk')}>
                        <div className="flex items-center gap-1.5"><SiAnydesk size={12} className="text-red-500" /> ANYDESK</div>
                      </TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((srv) => {
                      const hasIp = !!srv.ip_address;
                      const hasAnydesk = !!srv.anydesk_id;

                      return (
                        <TableRow
                          key={srv.id}
                          className={selectedIds.includes(srv.id) ? 'bg-blue-50/50' : ''}
                          onClick={() => { setSelectedServer(srv); setShowDetails(true); }}
                        >
                          {canEdit() && selectionMode && (
                            <TableCell className="w-12 animate-in fade-in slide-in-from-right-2 duration-200">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(srv.id)}
                                onChange={() => toggleSelect(srv.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-3.5 h-3.5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center justify-start gap-3">
                              <div className="w-9 h-9 rounded-none flex items-center justify-center shadow-sm transition-all duration-300 bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-md">
                                <ServerIcon size={14} />
                              </div>
                              <div className="flex flex-col items-start">
                                <span className="text-[13px] font-semibold text-[#002855] leading-tight">{srv.name}</span>
                                <span className="text-[11px] font-semibold text-slate-400 tracking-wider mt-1 md:hidden">{srv.locations?.name || 'VIRTUAL'}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col min-w-0">
                              <TableCellPrimary className="truncate max-w-[180px]">{srv.locations?.name || 'VIRTUAL'}</TableCellPrimary>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start group/cell">
                              <div className="flex items-center justify-start gap-2">
                                <span className={`text-[11px] font-mono font-semibold ${hasIp ? 'text-[#002855]' : 'text-slate-300'}`}>{srv.ip_address || '—'}</span>
                                {hasIp && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(srv.ip_address!, 'IP'); }}
                                    className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-300 hover:text-blue-500 transition-all opacity-0 group-hover/cell:opacity-100"
                                    title="Copiar IP"
                                  >
                                    <Copy size={13} />
                                  </button>
                                )}
                              </div>
                              <span className="text-[10px] font-semibold text-slate-400 mt-1">Red Interna</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start group/cell">
                              <div className="flex items-center justify-start gap-2">
                                <span className={`text-[11px] font-mono font-semibold ${hasAnydesk ? 'text-red-600' : 'text-slate-300'}`}>{srv.anydesk_id || '—'}</span>
                                {hasAnydesk && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(srv.anydesk_id!, 'AnyDesk ID'); }}
                                    className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover/cell:opacity-100"
                                    title="Copiar AnyDesk"
                                  >
                                    <Copy size={13} />
                                  </button>
                                )}
                              </div>
                              <span className="text-[10px] font-semibold text-slate-400 mt-1">ID Remoto</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0">
                              <RowActions
                                canEdit={canEdit()}
                                onEdit={(e) => { e.stopPropagation(); openEdit(srv); }}
                                onDelete={(e) => { e.stopPropagation(); del(srv); }}
                              />
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
        )}

        {/* FIX #1: Floating bulk-action bar correctamente dentro del return */}
        {selectionMode && selectedIds.length > 0 && canEdit() && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] pointer-events-none w-full flex justify-center px-6">
            <div className="bg-[#002855]/95 backdrop-blur-md text-white px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 border border-white/10 pointer-events-auto">
              <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[9px] font-semibold">
                  {selectedIds.length}
                </div>
                <span className="text-[8px] font-semibold tracking-widest opacity-80">Marcados</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 text-[8px] font-semibold tracking-widest text-rose-400 hover:text-rose-100 transition-colors"
                >
                  <Trash2 size={12} /> Eliminar lote
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-[8px] font-semibold tracking-widest text-slate-400 hover:text-white transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Formulario */}
        {showForm && (
          <ServerForm
            onClose={() => setShowForm(false)}
            onSave={() => {
              fetchServers();
              setShowForm(false);
              setEditing(undefined);
            }}
            editServer={editing}
          />
        )}

        {showDetails && selectedServer && (
          <DetailModal maxWidth="7xl" onClose={() => setShowDetails(false)} closeOnBackdrop>
            <DetailModalHeader>
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 pr-1">
                <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
                  <ServerIcon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs sm:text-base md:text-[18px] font-normal text-white tracking-tight leading-snug line-clamp-2 sm:line-clamp-1">
                    {selectedServer.name}
                  </h2>
                  <p className="text-[9px] sm:text-[10px] font-normal text-blue-200 tracking-wide mt-1 flex items-start sm:items-center gap-1.5">
                    <MapPin size={10} className="shrink-0 mt-0.5 sm:mt-0" />
                    <span className="line-clamp-2 sm:truncate">{selectedServer.locations?.name || 'N/A'}</span>
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
                <DetailModalSection title="Información de Conexión">
                  <DetailModalCard className="space-y-2.5 sm:space-y-3">
                    <DetailModalRow label="Dirección IP">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="font-mono text-[10px] sm:text-[11px] font-normal text-blue-600 break-all">{selectedServer.ip_address || '—'}</span>
                        {selectedServer.ip_address && (
                          <button onClick={() => copyToClipboard(selectedServer.ip_address || '')} className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center hover:text-blue-600 transition-colors shrink-0">
                            <Copy size={14} />
                          </button>
                        )}
                      </div>
                    </DetailModalRow>
                    <DetailModalRow label="AnyDesk ID">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="font-mono text-[10px] sm:text-[11px] font-normal text-blue-600">{selectedServer.anydesk_id || '—'}</span>
                        {selectedServer.anydesk_id && (
                          <button onClick={() => copyToClipboard(selectedServer.anydesk_id || '')} className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center hover:text-blue-600 transition-colors shrink-0">
                            <Copy size={14} />
                          </button>
                        )}
                      </div>
                    </DetailModalRow>
                  </DetailModalCard>
                </DetailModalSection>

                <DetailModalSection title="Credenciales Principales">
                  <DetailModalCard className="space-y-2.5 sm:space-y-3">
                    <DetailModalRow label="Usuario">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-[10px] sm:text-[11px] font-normal text-[#002855] truncate">{selectedServer.username || '—'}</span>
                        {selectedServer.username && (
                          <button onClick={() => copyToClipboard(selectedServer.username || '')} className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center hover:text-blue-600 transition-colors shrink-0">
                            <Copy size={14} />
                          </button>
                        )}
                      </div>
                    </DetailModalRow>
                    <DetailModalRow label="Contraseña">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="font-mono text-[10px] sm:text-xs font-normal text-slate-600 tracking-wide break-all">
                          {selectedServer.password ? '••••••••••••' : '—'}
                        </span>
                        {selectedServer.password && (
                          <button onClick={() => copyToClipboard(selectedServer.password || '')} className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center hover:text-blue-600 transition-colors shrink-0">
                            <Copy size={14} />
                          </button>
                        )}
                      </div>
                    </DetailModalRow>
                  </DetailModalCard>
                </DetailModalSection>

                {selectedServer.windows_credentials && selectedServer.windows_credentials.length > 0 && (
                  <DetailModalSection title="Credenciales Adicionales">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedServer.windows_credentials.map((cred: any, i: number) => (
                        <DetailModalCard key={i}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[8px] font-normal text-blue-600 tracking-widest">{cred.description || 'ACCESO'}</span>
                          </div>
                          <DetailModalRow label="Usuario">
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <span className="text-[10px] sm:text-[11px] font-normal text-[#002855] truncate">{cred.username}</span>
                              <button onClick={() => copyToClipboard(cred.username || '')} className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center hover:text-blue-600 transition-colors shrink-0">
                                <Copy size={14} />
                              </button>
                            </div>
                          </DetailModalRow>
                          <DetailModalRow label="Contraseña">
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <span className="font-mono text-[10px] sm:text-xs font-normal text-slate-600 tracking-wide">••••••••••••</span>
                              <button onClick={() => copyToClipboard(cred.password || '')} className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center hover:text-blue-600 transition-colors shrink-0">
                                <Copy size={14} />
                              </button>
                            </div>
                          </DetailModalRow>
                        </DetailModalCard>
                      ))}
                    </div>
                  </DetailModalSection>
                )}

                {selectedServer.notes && (
                  <DetailModalSection title="Notas">
                    <DetailModalCard className="bg-amber-50 border-amber-100">
                      <p className="text-[10px] sm:text-[11px] font-medium text-amber-900 leading-relaxed">
                        {selectedServer.notes}
                      </p>
                    </DetailModalCard>
                  </DetailModalSection>
                )}
              </DetailModalGrid>
            </DetailModalBody>

            <StandardModalFooter
              onClose={() => setShowDetails(false)}
              onEdit={canEdit() ? () => { setShowDetails(false); openEdit(selectedServer); } : undefined}
              editLabel="Editar"
            />
          </DetailModal>

        )}

      </div>
    </div>

  );
}
