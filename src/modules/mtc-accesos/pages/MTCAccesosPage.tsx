import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, ExternalLink, Eye, EyeOff, X, Copy, Check, Globe, Database, Terminal, Server, Shield, List } from 'lucide-react';
import { supabase } from '../../../shared/services/supabase';
import { generatePDF, generateExcel } from '../../../shared/utils/exportUtils';
import MTCAccesoForm from '../forms/MTCAccesoForm';
import { useAuth } from '../../../app/providers/AuthContext';
import { useNotify } from '../../../shared/hooks/useNotify';
import Pagination from '../../../shared/components/ui/Pagination';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import DetailModal, {
  DetailModalHeader,
  DetailModalBody,
  StandardModalFooter,
} from '../../../shared/components/ui/DetailModal';
import ActionToolbar from '../../../shared/components/ui/ActionToolbar';
import ActionsDropdown from '../../../shared/components/ui/ActionsDropdown';
import { useSelectionMode } from '../../../shared/hooks/useSelectionMode';
import FilterSelect from '../../../shared/components/ui/FilterSelect';
import ViewToggle from '../../../shared/components/ui/ViewToggle';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCellIcon,
  TableCellPrimary,
  TableCellSecondary,
  TableCellBadge,
  TableActionButton
} from '../../../shared/components/ui/Table';

type MTCAcceso = {
  id: string;
  name: string;
  url: string;
  username?: string;
  password?: string;
  access_type: string;
  location_id?: string;
  locations?: {
    name: string;
  };
  notes?: string;
  created_at: string;
  updated_at: string;
};

type ViewType = 'list' | 'form';

export default function MTCAccesos() {
  const { canEdit } = useAuth();
  const { confirm, error: notifyError, success: notifySuccess } = useNotify();
  const [view, setView] = useState<ViewType>('list');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [accesos, setAccesos] = useState<MTCAcceso[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAcceso, setEditingAcceso] = useState<MTCAcceso | undefined>();
  const [viewingAcceso, setViewingAcceso] = useState<MTCAcceso | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [copiedItems, setCopiedItems] = useState<Record<string, boolean>>({});
  const [accessTypeFilter, setAccessTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { selectionMode, setSelectionMode } = useSelectionMode();

  const handleToggleSelectionMode = () => {
    if (selectionMode) setSelectedIds([]);
    setSelectionMode(!selectionMode);
  };


  useEffect(() => {
    fetchAccesos();
  }, []);

  const fetchAccesos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('mtc_accesos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al cargar accesos MTC:', error);
    }

    if (data) {
      const accesosData = data as MTCAcceso[];
      const locationIds = [...new Set(accesosData.map(r => r.location_id).filter(Boolean))];

      if (locationIds.length > 0) {
        const { data: locationsData } = await supabase
          .from('locations')
          .select('id, name')
          .in('id', locationIds);

        if (locationsData) {
          const locationMap = Object.fromEntries(locationsData.map((l: any) => [l.id, l.name]));
          accesosData.forEach(r => {
            if (r.location_id && locationMap[r.location_id]) {
              r.locations = { name: locationMap[r.location_id] };
            }
          });
        }
      }

      setAccesos(accesosData);
    }
    setLoading(false);
  };

  const handleEditAcceso = (acceso: MTCAcceso) => {
    setEditingAcceso(acceso);
    setView('form');
  };

  const handleViewAcceso = (acceso: MTCAcceso) => {
    setViewingAcceso(acceso);
  };

  const handleDeleteAcceso = async (acceso: MTCAcceso) => {
    const confirmed = await confirm(`¿Estás seguro de que quieres eliminar el acceso "${acceso.name}"?`, 'Eliminar Acceso');
    if (confirmed) {
      try {
        const { error } = await supabase
          .from('mtc_accesos')
          .delete()
          .eq('id', acceso.id);

        if (error) {
          console.error('? Error al eliminar acceso MTC:', error);
          notifyError(`Error al eliminar el acceso MTC: ${error.message}`);
        } else {
          await fetchAccesos();
          notifySuccess('Acceso MTC eliminado correctamente');
        }
      } catch (err) {
        console.error('? Error inesperado al eliminar acceso MTC:', err);
        notifyError(`Error inesperado: ${err instanceof Error ? err.message : 'Desconocido'}`);
      }
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    const confirmed = await confirm(`¿Estás seguro de que quieres eliminar los ${ids.length} accesos seleccionados?`, 'Eliminar Accesos MTC');
    if (confirmed) {
      try {
        const { error } = await supabase
          .from('mtc_accesos')
          .delete()
          .in('id', ids);

        if (error) {
          console.error('? Error al eliminar accesos MTC en lote:', error);
          notifyError(`Error al eliminar los accesos: ${error.message}`);
        } else {
          await fetchAccesos();
          setSelectedIds([]);
          notifySuccess(`${ids.length} accesos eliminados correctamente`);
        }
      } catch (err) {
        console.error('? Error inesperado al eliminar accesos en lote:', err);
        notifyError(`Error inesperado: ${err instanceof Error ? err.message : 'Desconocido'}`);
      }
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (accesosList: MTCAcceso[]) => {
    if (selectedIds.length === accesosList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(accesosList.map(a => a.id));
    }
  };

  const handleSaveAcceso = async () => {
    setView('list');
    setEditingAcceso(undefined);
    await fetchAccesos();
  };

  const handleCloseForm = () => {
    setView('list');
    setEditingAcceso(undefined);
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => ({ ...prev, [itemId]: true }));
      setTimeout(() => {
        setCopiedItems(prev => ({ ...prev, [itemId]: false }));
      }, 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedItems(prev => ({ ...prev, [itemId]: true }));
      setTimeout(() => {
        setCopiedItems(prev => ({ ...prev, [itemId]: false }));
      }, 2000);
    }
  };

  const getAccessTypeIcon = (type: string) => {
    switch (type) {
      case 'web': return <Globe className="h-4 w-4" />;
      case 'api': return <Server className="h-4 w-4" />;
      case 'database': return <Database className="h-4 w-4" />;
      case 'ssh': return <Terminal className="h-4 w-4" />;
      case 'ftp': return <Server className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const handleExportPDF = () => {
    const data = filteredAccesos.map((acceso, i) => ({
      nro: i + 1,
      name: acceso.name || '',
      url: acceso.url || '',
      username: acceso.username || '—',
      access_type: acceso.access_type || '',
      notes: acceso.notes || '—'
    }));

    generatePDF({
      title: 'Reporte de Accesos MTC',
      filename: 'Accesos MTC',
      columns: [
        { header: 'N°', key: 'nro' },
        { header: 'Nombre', key: 'name' },
        { header: 'URL de Acceso', key: 'url' },
        { header: 'Usuario', key: 'username' },
        { header: 'Tipo Acceso', key: 'access_type' },
        { header: 'Notas', key: 'notes' }
      ],
      data
    });
  };

  const handleExportExcel = async () => {
    const data = filteredAccesos.map((acceso, i) => ({
      nro: i + 1,
      name: acceso.name || '',
      url: acceso.url || '',
      username: acceso.username || '',
      password: acceso.password || '',
      access_type: acceso.access_type || '',
      location: acceso.locations?.name || 'N/A',
      notes: acceso.notes || ''
    }));

    await generateExcel({
      title: 'Reporte de Accesos MTC',
      filename: 'Accesos MTC',
      columns: [
        { header: 'N°', key: 'nro', width: 6 },
        { header: 'Nombre', key: 'name', width: 30 },
        { header: 'URL de Acceso', key: 'url', width: 40 },
        { header: 'Usuario', key: 'username', width: 22 },
        { header: 'Contraseña', key: 'password', width: 22 },
        { header: 'Tipo Acceso', key: 'access_type', width: 15 },
        { header: 'Ubicación', key: 'location', width: 25 },
        { header: 'Notas', key: 'notes', width: 30 }
      ],
      data
    });
  };

  const filteredAccesos = accesos.filter(acceso => {
    const matchesSearch = acceso.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acceso.access_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acceso.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !accessTypeFilter || acceso.access_type === accessTypeFilter;
    return matchesSearch && matchesType;
  });

  const totalPages = Math.ceil(filteredAccesos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAccesos = filteredAccesos.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        <ActionToolbar
          totalItems={filteredAccesos.length}
          label="Accesos"
          searchComponent={
            <>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-12 pr-4 py-3 text-[12px] font-semibold text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 tracking-[0.1em]"
              />
            </>
          }
        >
          <FilterSelect
            value={accessTypeFilter}
            onChange={e => { setAccessTypeFilter(e.target.value as string); setCurrentPage(1); }}
          >
            <option value="">TODOS LOS TIPOS</option>
            <option value="web">WEB SERVICES</option>
            <option value="api">APIS & ENDPOINTS</option>
            <option value="database">BASES DE DATOS</option>
            <option value="ssh">TERMINAL SSH</option>
            <option value="ftp">SERVIDORES FTP</option>
          </FilterSelect>

          <ViewToggle viewMode={viewMode} onChange={setViewMode} />

          {canEdit() && (
            <button
              onClick={() => setView(view === 'form' ? 'list' : 'form')}
              className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 text-[10px] font-normal uppercase tracking-wider transition-all shadow-sm ${view === 'form' ? 'bg-slate-800 text-white' : 'bg-[#002855] text-white hover:bg-blue-800'}`}
            >
              {view === 'form' ? <List size={14} /> : <Plus size={14} />}
              {view === 'form' ? 'Ver Lista' : 'Nuevo Acceso'}
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
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
          />

          {canEdit() && selectionMode && selectedIds.length > 0 && viewMode === 'table' && (
            <button
              onClick={() => handleBulkDelete(selectedIds)}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 hover:text-rose-700 transition-all text-[10px] font-semibold uppercase tracking-wider"
            >
              <Trash2 size={14} />
              Eliminar ({selectedIds.length})
            </button>
          )}
        </ActionToolbar>

        {view === 'form' ? (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-8">
              <div className="mb-8 border-b border-gray-100 pb-6">
                <h3 className="text-xl font-semibold text-slate-900 tracking-tight">
                  {editingAcceso ? 'Actualización de Credenciales' : 'Registro de Nuevo Acceso'}
                </h3>
                <p className="text-sm text-slate-500 mt-1 font-medium italic">Gestione de forma segura los accesos a plataformas del MTC.</p>
              </div>
              <MTCAccesoForm
                editAcceso={editingAcceso}
                onClose={handleCloseForm}
                onSave={handleSaveAcceso}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            {loading ? (
              <LoadingSpinner label="Cargando accesos MTC..." />
            ) : viewMode === 'table' ? (
              <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden flex flex-col">
                <div className="bg-slate-50 border-b border-slate-200 relative z-20">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredAccesos.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                  />
                </div>
                {/* Mobile card view */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {paginatedAccesos.map(acceso => (
                    <div
                      key={acceso.id}
                      className="p-3.5 cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors"
                      onClick={() => handleViewAcceso(acceso)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-slate-800 truncate leading-tight">{acceso.name}</p>
                          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{new Date(String(acceso.created_at).includes('T') ? String(acceso.created_at) : `${acceso.created_at}T12:00:00`).toLocaleDateString()}</p>
                        </div>
                        <span className="shrink-0 text-[14px] font-semibold text-slate-800">{acceso.access_type}</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <a href={acceso.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[11px] font-semibold text-blue-600 truncate block hover:underline">{acceso.url}</a>
                        {acceso.username ? (
                          <p className="text-[10px] font-mono font-semibold text-slate-600">{acceso.username} · {acceso.password ? '••••••••' : 'Sin contraseña'}</p>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">Sin credenciales</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewAcceso(acceso); }}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Eye size={13} /> Ver Detalle
                        </button>
                        {canEdit() && (
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); handleEditAcceso(acceso); }} className="text-[11px] font-semibold text-slate-600 hover:text-slate-900">Editar</button>
                            <span className="text-slate-300">|</span>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteAcceso(acceso); }} className="text-[11px] font-semibold text-rose-500 hover:text-rose-700">Eliminar</button>
                          </div>
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
                        <TableHead>Nombre</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>URL / Endpoint</TableHead>
                        <TableHead>Usuario</TableHead>
                        <TableHead className="text-center">Acciones</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {paginatedAccesos.map(acceso => (
                        <TableRow key={acceso.id} className="cursor-pointer" onClick={() => handleViewAcceso(acceso)} onDoubleClick={() => handleViewAcceso(acceso)}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <TableCellIcon icon={getAccessTypeIcon(acceso.access_type)} />
                              <div className="flex flex-col">
                                <TableCellPrimary>{acceso.name}</TableCellPrimary>
                                <TableCellSecondary>{new Date(String(acceso.created_at).includes('T') ? String(acceso.created_at) : `${acceso.created_at}T12:00:00`).toLocaleDateString()}</TableCellSecondary>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <TableCellBadge>{acceso.access_type}</TableCellBadge>
                          </TableCell>
                          <TableCell>
                            <a href={acceso.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[13px] font-semibold text-blue-600 truncate max-w-[220px] block hover:text-blue-800 transition-colors">{acceso.url}</a>
                          </TableCell>
                          <TableCell>
                            {acceso.username ? (
                              <div className="flex flex-col">
                                <TableCellPrimary className="font-mono">{acceso.username}</TableCellPrimary>
                                <TableCellSecondary>{acceso.password ? '••••••••' : 'Sin contraseña'}</TableCellSecondary>
                              </div>
                            ) : <span className="text-slate-300 italic text-xs">Sin credenciales</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                              <TableActionButton
                                icon={<Eye size={14} />}
                                onClick={(e) => { e.stopPropagation(); handleViewAcceso(acceso); }}
                                title="Ver Detalle"
                              />
                              {canEdit() && (
                                <>
                                  <TableActionButton
                                    icon={<Edit size={14} />}
                                    onClick={(e) => { e.stopPropagation(); handleEditAcceso(acceso); }}
                                    title="Editar"
                                  />
                                  <TableActionButton
                                    icon={<Trash2 size={14} />}
                                    onClick={(e) => { e.stopPropagation(); handleDeleteAcceso(acceso); }}
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
                  <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={filteredAccesos.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={setItemsPerPage}
                    />
                    {canEdit() && selectionMode && paginatedAccesos.length > 0 && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === paginatedAccesos.length && paginatedAccesos.length > 0}
                          onChange={() => toggleSelectAll(paginatedAccesos)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer shadow-sm"
                        />
                        <span className="text-xs font-medium text-slate-600">Seleccionar todos</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {paginatedAccesos.map(acceso => (
                    <div key={acceso.id} className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 flex flex-col group overflow-hidden ${selectedIds.includes(acceso.id) ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-gray-100 hover:shadow-xl hover:border-slate-300'}`}>
                      <div className="p-6 flex-1 relative">
                        {canEdit() && selectionMode && (
                          <div className="absolute top-4 right-4 z-10">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(acceso.id)}
                              onChange={() => toggleSelect(acceso.id)}
                              onClick={e => e.stopPropagation()}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer shadow-sm"
                            />
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700 transition-colors tracking-tight mb-2">{acceso.name}</h3>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                {getAccessTypeIcon(acceso.access_type)} {acceso.access_type}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4 mb-6">
                          <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100/50">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[10px] font-semibold text-gray-400 tracking-wider">Enlace Directo</label>
                              <button onClick={() => copyToClipboard(acceso.url, `url-${acceso.id}`)} className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-400 hover:text-blue-600 active:scale-90">
                                {copiedItems[`url-${acceso.id}`] ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                              </button>
                            </div>
                            <a href={acceso.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 font-semibold hover:text-blue-800 flex items-center gap-2 break-all group/link">
                              <span className="truncate">{acceso.url}</span>
                              <ExternalLink size={14} className="flex-shrink-0 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                            </a>
                          </div>
                          {acceso.username && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100/30">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-[10px] font-semibold text-blue-700/50 tracking-widest">Identidad</label>
                                  <button onClick={() => copyToClipboard(acceso.username!, `username-${acceso.id}`)} className="p-1.5 hover:bg-white rounded-lg transition-colors text-blue-400 hover:text-blue-600 active:scale-90">
                                    {copiedItems[`username-${acceso.id}`] ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                  </button>
                                </div>
                                <p className="text-sm text-blue-900 font-semibold tracking-tight font-mono">{acceso.username}</p>
                              </div>
                              {acceso.password && (
                                <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100/30">
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-semibold text-blue-700/50 tracking-widest">Token / Pass</label>
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => copyToClipboard(acceso.password!, `password-${acceso.id}`)} className="p-1.5 hover:bg-white rounded-lg transition-colors text-blue-400 hover:text-blue-600 active:scale-90">
                                        {copiedItems[`password-${acceso.id}`] ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                      </button>
                                      <button onClick={() => togglePasswordVisibility(acceso.id)} className="p-1.5 hover:bg-white rounded-lg transition-colors text-blue-600 hover:text-blue-800 active:scale-90">
                                        {showPasswords[acceso.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-sm text-blue-900 font-semibold tracking-widest font-mono">{showPasswords[acceso.id] ? acceso.password : '••••••••'}</p>
                                </div>
                              )}
                            </div>
                          )}
                          {acceso.notes && (
                            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100/50">
                              <label className="text-[10px] font-semibold text-gray-400 tracking-widest block mb-2">Observaciones</label>
                              <p className="text-xs text-gray-600 italic leading-relaxed whitespace-pre-wrap">{acceso.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-50 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleViewAcceso(acceso)}
                          className="px-3 py-2 bg-white text-blue-600 border border-slate-200 rounded-lg hover:bg-blue-50 transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                        >
                          <Eye size={16} /> Ver Detalle
                        </button>
                        {canEdit() && (
                          <div className="flex gap-2">
                            <button onClick={() => handleEditAcceso(acceso)} className="p-2 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-800 hover:text-white transition-all active:scale-95 shadow-sm" title="Editar"><Edit size={16} /></button>
                            <button onClick={() => handleDeleteAcceso(acceso)} className="p-2 bg-white text-rose-500 border border-rose-100 rounded-lg hover:bg-rose-500 hover:text-white transition-all active:scale-95 shadow-sm" title="Eliminar"><Trash2 size={16} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && filteredAccesos.length === 0 && (
              <div className="text-left py-12">
                <p className="text-gray-500 font-medium">No se encontraron accesos registrados.</p>
              </div>
            )}

            {viewingAcceso && (
              <DetailModal maxWidth="3xl" onClose={() => setViewingAcceso(undefined)} closeOnBackdrop>
                <DetailModalHeader>
                  <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 pr-1">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
                      {getAccessTypeIcon(viewingAcceso.access_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xs sm:text-base md:text-[18px] font-normal text-white uppercase tracking-tight leading-snug truncate">
                        {viewingAcceso.name}
                      </h2>
                      <p className="text-[9px] sm:text-[10px] font-normal text-slate-300 uppercase tracking-wide mt-0.5 flex items-center gap-1.5 truncate">
                        <span>ACCESO MTC</span>
                        <span>•</span>
                        <span>{viewingAcceso.access_type.toUpperCase()}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setViewingAcceso(undefined)}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 text-white/50 hover:text-white hover:bg-white/10 transition-all -mr-1"
                    aria-label="Cerrar detalle"
                  >
                    <X size={20} />
                  </button>
                </DetailModalHeader>

                <DetailModalBody>
                  <div className="space-y-4">
                    {/* Badge tipo de acceso */}
                    <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-slate-100">
                      <span className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                        {getAccessTypeIcon(viewingAcceso.access_type)}
                        {viewingAcceso.access_type}
                      </span>
                      <span className="text-[14px] font-semibold text-slate-800">
                        {viewingAcceso.locations?.name || 'Sede no especificada'}
                      </span>
                    </div>

                    {/* Grilla 2 columnas para endpoint y credenciales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* URL y Endpoint */}
                      <div className="bg-slate-50 border border-slate-200 p-3 space-y-2">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/60 pb-1">
                          Recurso / Dirección
                        </p>
                        <div className="space-y-1.5">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-semibold">Nombre del Sistema</span>
                            <p className="text-[11px] font-semibold text-[#002855] uppercase">{viewingAcceso.name}</p>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-semibold">URL / Endpoint</span>
                            {viewingAcceso.url ? (
                              <a
                                href={viewingAcceso.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1 break-all mt-0.5"
                              >
                                {viewingAcceso.url} <ExternalLink size={12} className="shrink-0" />
                              </a>
                            ) : (
                              <p className="text-[11px] text-slate-500 italic">No registrada</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Credenciales de Acceso */}
                      <div className="bg-slate-50 border border-slate-200 p-3 space-y-2">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/60 pb-1">
                          Seguridad y Credenciales
                        </p>
                        <div className="space-y-1.5">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-semibold">Usuario</span>
                            <p className="text-[11px] font-mono text-slate-700">{viewingAcceso.username || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-semibold">Contraseña</span>
                            {viewingAcceso.password ? (
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] font-mono text-slate-700 tracking-wider">
                                  {showPasswords[viewingAcceso.id] ? viewingAcceso.password : '••••••••'}
                                </span>
                                <button
                                  onClick={() => togglePasswordVisibility(viewingAcceso.id)}
                                  className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                                  title="Mostrar / Ocultar"
                                >
                                  {showPasswords[viewingAcceso.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-500 italic">Sin clave</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notas u observaciones */}
                    {viewingAcceso.notes && (
                      <div className="bg-slate-50 border border-slate-200 p-3">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observaciones Técnicas</p>
                        <p className="text-[10px] text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingAcceso.notes}</p>
                      </div>
                    )}
                  </div>
                </DetailModalBody>

                <StandardModalFooter
                  onClose={() => setViewingAcceso(undefined)}
                  onEdit={canEdit() ? () => { setViewingAcceso(undefined); handleEditAcceso(viewingAcceso); } : undefined}
                  editLabel="Editar"
                />
              </DetailModal>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
