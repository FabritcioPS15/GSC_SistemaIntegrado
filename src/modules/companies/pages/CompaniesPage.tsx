import { useEffect, useState, useMemo } from 'react';
import { Search, Plus, Filter, Trash2, Edit, Building } from 'lucide-react';
import { supabase, Company } from '../../../shared/services/supabase';
import { useAuth } from '../../../app/providers/AuthContext';
import CompanyForm from '../forms/CompanyForm';
import { useNotify } from '../../../shared/hooks/useNotify';
import { useSelectionMode } from '../../../shared/hooks/useSelectionMode';
import { generateExcel, generatePDF } from '../../../shared/utils/exportUtils';
import FilterBar from '../../../shared/components/ui/FilterBar';
import {
  ActionToolbar,
  ActionsDropdown,
  LoadingSpinner,
  PrimaryButton,
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



export default function Companies() {
  const { canEdit } = useAuth();
  const { confirm, success: notifySuccess, error: notifyError } = useNotify();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Company | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { selectionMode, toggleSelectionMode } = useSelectionMode();

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase.from('companies').select('*').order('name');
      if (error) {
        console.error('Error al cargar unidades de negocio:', error);
      }
      if (data) setCompanies(data as Company[]);
    } catch (err) {
      console.error('Error inesperado al cargar unidades de negocio:', err);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchCompanies();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const handleNew = () => openCreate();
    const handleExport = () => exportToExcel();
    const handleExportPdf = () => exportToPdf();

    window.addEventListener('companies:new', handleNew);
    window.addEventListener('companies:export', handleExport);
    window.addEventListener('companies:export-pdf', handleExportPdf);
    return () => {
      window.removeEventListener('companies:new', handleNew);
      window.removeEventListener('companies:export', handleExport);
      window.removeEventListener('companies:export-pdf', handleExportPdf);
    };
  }, [companies]);

  const handleToggleSelectionMode = () => {
    setSelectedIds([]);
    toggleSelectionMode();
  };

  const openCreate = () => { setEditing(undefined); setShowForm(true); };
  const openEdit = (company: Company) => { setEditing(company); setShowForm(true); };

  const del = async (company: Company) => {
    const confirmed = await confirm(`¿Eliminar la unidad de negocio "${company.name}"?`, 'Eliminar Unidad de Negocio');
    if (!confirmed) return;
    const { error } = await supabase.from('companies').delete().eq('id', company.id);
    if (error) return notifyError('Error al eliminar: ' + error.message);
    setSelectedIds(prev => prev.filter(id => id !== company.id));
    await fetchCompanies();
    notifySuccess(`Unidad de negocio "${company.name}" eliminada correctamente`, 'Eliminada');
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedData.length) setSelectedIds([]);
    else setSelectedIds(paginatedData.map(c => c.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    const confirmed = await confirm(`¿Eliminar ${selectedIds.length} unidades de negocio seleccionadas?`, 'Eliminación por Lote');
    if (!confirmed) return;
    const { error } = await supabase.from('companies').delete().in('id', selectedIds);
    if (!error) { setSelectedIds([]); await fetchCompanies(); notifySuccess(`${selectedIds.length} unidades de negocio eliminadas correctamente`, 'Eliminadas'); }
    else notifyError('Error al eliminar: ' + error.message);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...companies].filter(c => {
      const matchesSearch = (c.name || '').toLowerCase().includes(q) ||
        (c.ruc || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q);
      return matchesSearch;
    });
  }, [companies, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  const exportToExcel = async () => {
    try {
      const companiesToExport = selectedIds.length > 0
        ? filtered.filter(c => selectedIds.includes(c.id))
        : filtered;

      const data = companiesToExport.map(c => ({
        name: c.name,
        ruc: c.ruc || '—',
        address: c.address || '—',
        phone: c.phone || '—',
        email: c.email || '—',
        is_active: c.is_active ? 'Sí' : 'No'
      }));

      await generateExcel({
        title: 'Reporte de Unidades de Negocio',
        filename: 'UnidadesDeNegocio',
        columns: [
          { header: 'Nombre', key: 'name', width: 30 },
          { header: 'RUC', key: 'ruc', width: 15 },
          { header: 'Dirección', key: 'address', width: 40 },
          { header: 'Teléfono', key: 'phone', width: 15 },
          { header: 'Email', key: 'email', width: 25 },
          { header: 'Activa', key: 'is_active', width: 10 }
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
      const companiesToExport = selectedIds.length > 0
        ? filtered.filter(c => selectedIds.includes(c.id))
        : filtered;

      const data = companiesToExport.map(c => ({
        name: c.name,
        ruc: c.ruc || '—',
        address: c.address || '—',
        is_active: c.is_active ? 'Sí' : 'No'
      }));

      await generatePDF({
        title: 'Reporte de Unidades de Negocio',
        filename: 'UnidadesDeNegocio',
        columns: [
          { header: 'Nombre', key: 'name' },
          { header: 'RUC', key: 'ruc' },
          { header: 'Dirección', key: 'address' },
          { header: 'Activa', key: 'is_active' }
        ],
        data
      });
    } catch (e) {
      console.error('Error exportando PDF:', e);
      notifyError('Error al exportar PDF');
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-[#f8fafc]">
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">

          <ActionToolbar
            totalItems={filtered.length}
            label="Unidades de Negocio"
            searchComponent={
              <>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-12 pr-4 py-3 text-[12px] text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 tracking-[0.1em]"
                />
              </>
            }
          >

            {canEdit() && (
              <PrimaryButton icon={Plus} onClick={openCreate}>
                Nueva Unidad
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
            <LoadingSpinner label="Cargando empresas..." />
          ) : (
            <div className="bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col rounded-none">
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
                      <span className="hidden xl:block text-[10px] font-black text-rose-600 tracking-wider">{selectedIds.length} marcadas</span>
                      <button onClick={handleBulkDelete} className="flex items-center gap-2 px-3 py-2 bg-rose-500 text-white text-[10px] font-black tracking-wider rounded-md hover:bg-rose-600 transition-all shadow-sm active:scale-95" title="Eliminar seleccionadas">
                        <Trash2 size={14} /><span className="hidden sm:inline">Eliminar</span>
                      </button>
                    </div>
                  )}
                </Pagination>
              </div>

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
                        <span className="text-[12px] font-medium text-[#002855] tracking-[0.15em]">Unidad de Negocio</span>
                      </TableHead>
                      <TableHead>
                        <span className="text-[12px] font-medium text-[#002855] tracking-[0.15em]">RUC</span>
                      </TableHead>
                      <TableHead>
                        <span className="text-[12px] font-medium text-[#002855] tracking-[0.15em]">Contacto</span>
                      </TableHead>
                      <TableHead>
                        <span className="text-[12px] font-medium text-[#002855] tracking-[0.15em]">Estado</span>
                      </TableHead>
                      <TableHead className="text-center">
                        <span className="text-[12px] font-medium text-[#002855] tracking-[0.15em]">Acciones</span>
                      </TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map(company => (
                      <TableRow key={company.id} className={`${selectedIds.includes(company.id) ? 'bg-blue-50/40' : ''}`}>
                        {canEdit() && selectionMode && (
                          <TableCell className="w-12 animate-in fade-in slide-in-from-right-2 duration-200">
                            <input type="checkbox" checked={selectedIds.includes(company.id)} onChange={() => toggleSelect(company.id)} onClick={e => e.stopPropagation()} className="w-4 h-4 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 cursor-pointer" />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 shrink-0 rounded-none flex items-center justify-center bg-slate-50 border border-slate-100 text-slate-400">
                              <Building size={14} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <TableCellPrimary>{company.name}</TableCellPrimary>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TableCellPrimary className="truncate max-w-xs">{company.ruc || '—'}</TableCellPrimary>
                        </TableCell>
                        <TableCell>
                          <TableCellPrimary className="truncate max-w-xs">{company.email || company.phone || '—'}</TableCellPrimary>
                        </TableCell>
                        <TableCell>
                          <TableCellBadge className={company.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                            {company.is_active ? 'Activa' : 'Inactiva'}
                          </TableCellBadge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            {canEdit() && (
                              <>
                                <TableActionButton
                                  icon={<Edit size={14} />}
                                  onClick={(e) => { e.stopPropagation(); openEdit(company); }}
                                  title="Editar"
                                />
                                <TableActionButton
                                  icon={<Trash2 size={14} />}
                                  onClick={(e) => { e.stopPropagation(); del(company); }}
                                  title="Eliminar"
                                  variant="danger"
                                />
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={canEdit() && selectionMode ? 7 : 6}>
                          <div className="py-12 text-center">
                            <Building size={32} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-[12px] font-black text-slate-400 tracking-widest">No hay unidades de negocio</p>
                            <p className="text-[10px] font-normal text-slate-400 mt-1">Agrega la primera con el botón "Nueva Unidad"</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>

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

      {showForm && (
        <CompanyForm
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          onSave={async () => {
            await fetchCompanies();
            setShowForm(false);
            setEditing(undefined);
          }}
          editCompany={editing}
        />
      )}
    </>
  );
}
