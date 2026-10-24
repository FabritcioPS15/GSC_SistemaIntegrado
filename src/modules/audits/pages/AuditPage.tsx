import { useState, useEffect } from 'react';
import { Trash2, Edit, List, ClipboardCheck, LayoutGrid, X, User, Calendar, Plus, MapPin } from 'lucide-react';
import { useHeaderVisible } from '../../../shared/hooks/useHeaderVisible';
import { supabase, BranchAudit } from '../../../shared/services/supabase';
import { useAuth } from '../../../app/providers/AuthContext';
import AuditForm from '../forms/AuditForm';
import HeaderSearch from '../../../app/layouts/HeaderSearch';
import FilterBar from '../../../shared/components/ui/FilterBar';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import ActionsDropdown from '../../../shared/components/ui/ActionsDropdown';
import { useSelectionMode } from '../../../shared/hooks/useSelectionMode';
import { useNotify } from '../../../shared/hooks/useNotify';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../shared/components/ui/Table';

type ViewType = 'history' | 'form';

export default function Audit() {
  const { canEdit } = useAuth();
  const { confirm, error: notifyError } = useNotify();
  const [view, setView] = useState<ViewType>('history');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [audits, setAudits] = useState<BranchAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [editingAudit, setEditingAudit] = useState<BranchAudit | undefined>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { selectionMode, setSelectionMode } = useSelectionMode();
  const isHeaderVisible = useHeaderVisible(localStorage.getItem('header_pinned') === 'true');

  const handleToggleSelectionMode = () => {
    if (selectionMode) setSelectedIds([]);
    setSelectionMode(!selectionMode);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = (auditsToSelect: BranchAudit[]) => {
    if (selectedIds.length === auditsToSelect.length && auditsToSelect.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(auditsToSelect.map(a => a.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm(`¿Eliminar ${selectedIds.length} auditorías seleccionadas?`, 'Eliminación por Lote');
    if (!confirmed) return;
    const { error } = await supabase.from('branch_audits').delete().in('id', selectedIds);
    if (error) return notifyError('Error al eliminar: ' + error.message);
    await fetchAudits();
    setSelectedIds([]);
  };

  useEffect(() => {
    fetchAudits();
  }, []);

  const fetchAudits = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('branch_audits').select('*, locations(*)').order('audit_date', { ascending: false });
    if (!error && data) setAudits(data as BranchAudit[]);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm('¿Estás seguro de eliminar este registro?', 'Eliminar Registro');
    if (!confirmed) return;
    const { error } = await supabase.from('branch_audits').delete().eq('id', id);
    if (error) return notifyError('Error al eliminar: ' + error.message);
    await fetchAudits();
  };

  const handleEdit = (audit: BranchAudit) => { setEditingAudit(audit); setView('form'); };

  const filteredAudits = audits.filter(audit => {
    const locName = audit.locations?.name || '';
    const mSearch = locName.toLowerCase().includes(searchTerm.toLowerCase()) || audit.auditor_name.toLowerCase().includes(searchTerm.toLowerCase());
    const mStatus = filterStatus.length === 0 || filterStatus.includes(audit.status);
    return mSearch && mStatus;
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'excellent': return { label: 'EXCELENTE', color: 'bg-emerald-100 text-emerald-700' };
      case 'good': return { label: 'BUENO', color: 'bg-teal-100 text-teal-700' };
      case 'regular': return { label: 'REGULAR', color: 'bg-amber-100 text-amber-700' };
      case 'critical': return { label: 'CRÍTICO', color: 'bg-red-100 text-red-700' };
      default: return { label: status, color: 'bg-slate-100 text-slate-600' };
    }
  };

  const formatDate = (ds: string) => new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(ds));

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc] font-sans">
      <div className={`bg-white border-b border-[#e2e8f0] px-6 h-14 flex items-center justify-between shadow-sm sticky top-0 z-30 font-sans transition-transform duration-500 ease-in-out ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex items-center gap-4">
          <div className="bg-[#002855] p-2 text-white shadow-lg">
            <ClipboardCheck size={18} />
          </div>
          <div className="hidden lg:block">
            <h2 className="text-[13px] font-black text-[#002855] uppercase tracking-[0.15em] leading-none">Auditoría Operativa</h2>
            <div className="flex items-center gap-2 text-[9px] font-bold text-[#64748b] uppercase tracking-widest mt-1">
              <span>Evaluación de Sedes</span>
              <div className="w-1 h-1 bg-gray-300 rounded-none" />
              <span className="text-blue-600 font-black">{filteredAudits.length} EVALUACIONES</span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-xl mx-8 gap-4">
          <HeaderSearch
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            variant="light"
          />

          <FilterBar
            filters={[
              {
                key: 'status', placeholder: 'TODOS LOS ESTADOS', wrapperClassName: 'md:min-w-[200px]', options: [
                  { value: 'excellent', label: 'EXCELENTE' },
                  { value: 'good', label: 'BUENO' },
                  { value: 'regular', label: 'REGULAR' },
                  { value: 'critical', label: 'CRÍTICO' },
                ]
              },
            ]}
            values={{ status: filterStatus }}
            onChange={(key, value) => setFilterStatus(value as string[])}
            hideClearButton
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-slate-50 p-1 border border-slate-200">
            <button
              onClick={() => { setView('history'); setViewMode('grid'); }}
              className={`p-1.5 transition-all ${view === 'history' && viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => { setView('history'); setViewMode('list'); }}
              className={`p-1.5 transition-all ${view === 'history' && viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}
            >
              <List size={16} />
            </button>
          </div>

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
          />

          {canEdit() && selectionMode && selectedIds.length > 0 && view === 'history' && (
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-all shadow-sm flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              <Trash2 size={14} />
              Eliminar ({selectedIds.length})
            </button>
          )}

          {canEdit() && (
            <button
              onClick={() => setView('form')}
              className={`px-5 py-2 bg-[#002855] text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-800 transition-all border border-blue-900 shadow-md flex items-center gap-2 group ${view === 'form' ? 'ring-2 ring-blue-500' : ''}`}
            >
              <Plus size={14} className="group-hover:rotate-90 transition-transform" />
              NUEVO REPORTE
            </button>
          )}
        </div>
      </div>

      <div className="p-8 space-y-8 flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full">
        {view === 'form' ? (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
            <div className="bg-white border border-slate-200 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[#002855]" />
              <div className="p-8">
                <div className="mb-8 border-b border-slate-100 pb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[18px] font-black text-[#002855] uppercase tracking-tight">{editingAudit ? 'MODIFICAR EVALUACIÓN' : 'REGISTRAR EVALUACIÓN'}</h3>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">DOCUMENTACIÓN TÉCNICA Y HALLAZGOS POR SEDE</p>
                    </div>
                    <button onClick={() => setView('history')} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <AuditForm editAudit={editingAudit} onClose={() => { setView('history'); setEditingAudit(undefined); }} onSave={async () => { setView('history'); setEditingAudit(undefined); await fetchAudits(); }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            {loading ? (
              <LoadingSpinner label="Cargando auditorías..." />
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredAudits.map(audit => {
                  const statusCfg = getStatusConfig(audit.status);
                  return (
                    <div key={audit.id} className={`bg-white border hover:shadow-xl transition-all duration-300 relative group overflow-hidden flex flex-col ${selectedIds.includes(audit.id) ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-slate-200 hover:border-blue-200 shadow-sm'}`}>
                      {canEdit() && selectionMode && (
                        <div className="absolute top-4 right-4 z-20">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(audit.id)}
                            onChange={() => toggleSelect(audit.id)}
                            onClick={e => e.stopPropagation()}
                            className="w-4 h-4 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 cursor-pointer shadow-sm"
                          />
                        </div>
                      )}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rotate-45 -mr-16 -mt-16 group-hover:bg-blue-50 transition-colors" />
                      <div className="p-7 flex-1 flex flex-col">
                        <div className="flex items-start justify-between mb-8 relative z-10">
                          <span className={`text-[10px] font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
                        </div>

                        <div className="mb-8">
                          <h3 className="text-[16px] font-black text-[#002855] uppercase tracking-tight mb-2 leading-tight group-hover:text-blue-600 transition-colors">{audit.locations?.name || 'SEDE N/A'}</h3>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <User size={12} className="text-slate-300" /> Auditor: <span className="text-[#002855]">{audit.auditor_name}</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-5 border border-slate-100 flex items-center justify-between mb-8">
                          <div className="flex flex-col">
                            <span className="text-[12px] font-black text-[#002855] tracking-[0.2em] mb-1">SCORE DE CALIDAD</span>
                            <div className="flex items-center gap-1">
                              <Calendar size={10} className="text-slate-400" />
                              <span className="text-[9px] font-bold text-slate-400 uppercase">{formatDate(audit.audit_date)}</span>
                            </div>
                          </div>
                          <span className={`text-4xl font-black ${audit.score >= 90 ? 'text-emerald-600' : audit.score >= 70 ? 'text-[#002855]' : 'text-rose-600'}`}>{audit.score}<span className="text-sm ml-0.5">%</span></span>
                        </div>

                        <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-end gap-2">
                          <button onClick={(e) => { e.stopPropagation(); handleEdit(audit); }} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-[#002855] hover:bg-slate-100 bg-white rounded-lg border border-slate-200 transition-all shadow-sm"><Edit size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(audit.id); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-white rounded-lg border border-slate-200 transition-all shadow-sm"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {/* Mobile card view */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {filteredAudits.map(audit => {
                    const statusCfg = getStatusConfig(audit.status);
                    return (
                      <div key={audit.id} className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedIds.includes(audit.id) ? 'bg-blue-50/40' : ''}`} onClick={() => handleEdit(audit)}>
                        <div className="flex items-center gap-2">
                          {canEdit() && selectionMode && (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(audit.id)}
                              onChange={() => toggleSelect(audit.id)}
                              onClick={e => e.stopPropagation()}
                              className="w-4 h-4 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 cursor-pointer shrink-0"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-black text-[#002855] uppercase tracking-tight truncate leading-tight">{audit.id.slice(0, 8)}</p>
                            <p className="text-[10px] font-semibold text-slate-400 italic">{audit.auditor_name}</p>
                          </div>
                          <span className={`text-[10px] font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 flex-wrap">
                          <span className="flex items-center gap-0.5">
                            <MapPin size={10} className="text-rose-400 shrink-0" />
                            {audit.locations?.name || 'N/A'}
                          </span>
                          <span>{formatDate(audit.audit_date)}</span>
                          <span className={`ml-auto font-black ${audit.score >= 90 ? 'text-emerald-600' : audit.score >= 70 ? 'text-[#002855]' : 'text-rose-600'}`}>{audit.score}%</span>
                        </div>
                        {canEdit() && (
                          <div className="flex gap-1.5 mt-1.5" onClick={e => e.stopPropagation()}>
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(audit); }} className="text-[10px] font-semibold text-slate-600 hover:underline">Editar</button>
                            <span className="text-slate-300">|</span>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(audit.id); }} className="text-[10px] font-semibold text-rose-500 hover:underline">Eliminar</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <tr>
                        {canEdit() && selectionMode && (
                          <TableHead className="text-center w-12">
                            <input
                              type="checkbox"
                              checked={filteredAudits.length > 0 && selectedIds.length === filteredAudits.length}
                              onChange={() => toggleSelectAll(filteredAudits)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 transition-all cursor-pointer"
                            />
                          </TableHead>
                        )}
                        <TableHead>Auditoría / Auditor</TableHead>
                        <TableHead>Ubicación</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-center">Score</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {filteredAudits.map(audit => {
                        const statusCfg = getStatusConfig(audit.status);
                        return (
                          <TableRow key={audit.id} className={`cursor-pointer ${selectedIds.includes(audit.id) ? 'bg-blue-50/40' : ''}`} onClick={() => handleEdit(audit)}>
                            {canEdit() && selectionMode && (
                              <TableCell className="text-center w-12">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(audit.id)}
                                  onChange={() => toggleSelect(audit.id)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 transition-all cursor-pointer"
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-[12px] font-black text-[#002855] uppercase tracking-tight group-hover/row:text-blue-600 transition-colors">{audit.id.slice(0, 8)}</span>
                                <span className="text-[12px] font-semibold text-slate-400 tracking-wider mt-1 italic">{audit.auditor_name}</span>
                              </div>
                            </TableCell>
                            <TableCell><span className="font-black text-[12px] text-[#002855] uppercase tracking-widest">{audit.locations?.name || 'N/A'}</span></TableCell>
                            <TableCell><span className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(audit.audit_date)}</span></TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span className={`text-[16px] font-black ${audit.score >= 90 ? 'text-emerald-600' : audit.score >= 70 ? 'text-[#002855]' : 'text-rose-600'}`}>{audit.score}%</span>
                                <div className="w-16 h-1 bg-slate-100 mt-1">
                                  <div className="h-full bg-blue-500" style={{ width: `${audit.score}%` }} />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`text-[10px] font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={(e) => { e.stopPropagation(); handleEdit(audit); }} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-[#002855] hover:bg-slate-100 bg-white rounded-none border border-slate-200 transition-all shadow-sm"><Edit size={14} /></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(audit.id); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-white rounded-none border border-slate-200 transition-all shadow-sm"><Trash2 size={14} /></button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

