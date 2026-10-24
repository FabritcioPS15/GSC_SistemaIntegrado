import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Edit, Trash2, Package,  X,  FileText, LayoutGrid, List as ListIcon, AlertTriangle, Search, MapPin, ChevronDown } from 'lucide-react';
import { RiFileExcel2Fill } from "react-icons/ri";
import { FaFilePdf } from "react-icons/fa6";
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useHeaderVisible } from '../../../shared/hooks/useHeaderVisible';
import { supabase } from '../../../shared/services/supabase';
import SparePartForm from '../forms/SparePartForm';
import { useAuth } from '../../../app/providers/AuthContext';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import DetailModal, {
  DetailModalHeader,
  DetailModalBody,
  DetailModalFooter,
  DetailModalGrid,
  DetailModalSection,
  DetailModalCard,
  DetailModalRow,
} from '../../../shared/components/ui/DetailModal';
import { useNotify } from '../../../shared/hooks/useNotify';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../shared/components/ui/Table';

type SparePart = {
  id: string;
  name: string;
  description: string;
  part_number: string;
  manufacturer: string;
  category: string;
  quantity: number;
  unit: string;
  unit_price: number;
  min_quantity: number;
  location: string;
  supplier: string;
  created_at: string;
  updated_at: string;
};

export default function SpareParts() {
  const { canEdit } = useAuth();
  const { confirm, success: notifySuccess, error: notifyError } = useNotify();
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | undefined>(undefined);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SparePart | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const isHeaderVisible = useHeaderVisible(localStorage.getItem('header_pinned') === 'true');

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('spare_parts')
        .select('*')
        .order('name');

      if (error) throw error;
      if (data) setSpareParts(data);
    } catch (error) {
      console.error('Error fetching spare parts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');

      if (error) throw error;
      if (data) setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchLocations();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLocationDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredParts = useMemo(() => {
    let result = [...spareParts];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(part =>
        part.name.toLowerCase().includes(q) ||
        part.part_number.toLowerCase().includes(q) ||
        part.description?.toLowerCase().includes(q) ||
        part.manufacturer?.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter(part => part.category === categoryFilter);
    }

    if (lowStockOnly) {
      result = result.filter(part => part.quantity <= part.min_quantity);
    }

    if (selectedLocations.length > 0) {
      result = result.filter(part => part.location && selectedLocations.includes(part.location));
    }

    if (sortConfig) {
      result.sort((a: any, b: any) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === bVal) return 0;
        const res = aVal < bVal ? -1 : 1;
        return sortConfig.direction === 'asc' ? res : -res;
      });
    }

    return result;
  }, [spareParts, searchTerm, categoryFilter, lowStockOnly, sortConfig]);

  const stats = useMemo(() => {
    const total = spareParts.length;
    const lowStock = spareParts.filter(p => p.quantity <= p.min_quantity).length;
    const totalValue = spareParts.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);
    const categories = new Set(spareParts.map(p => p.category)).size;
    return { total, lowStock, totalValue, categories };
  }, [spareParts]);

  const categories = ['all', ...new Set(spareParts.map(part => part.category).filter(Boolean))];

  const handleDelete = async (id: string) => {
    const confirmed = await confirm('¿Está seguro de que desea eliminar este repuesto?', 'Eliminar Repuesto');
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('spare_parts').delete().eq('id', id);
      if (error) throw error;
      fetchData();
      notifySuccess('Repuesto eliminado correctamente', 'Eliminado');
    } catch (error: any) {
      console.error('Error deleting:', error);
      notifyError('Error al eliminar: ' + error.message);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setLowStockOnly(false);
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Repuestos');

      worksheet.columns = [
        { header: 'Nombre', key: 'name', width: 30 },
        { header: 'Código', key: 'part_number', width: 20 },
        { header: 'Categoría', key: 'category', width: 15 },
        { header: 'Marca', key: 'manufacturer', width: 20 },
        { header: 'Cantidad', key: 'quantity', width: 12 },
        { header: 'Unidad', key: 'unit', width: 10 },
        { header: 'Precio Unit.', key: 'unit_price', width: 15 },
        { header: 'Stock Mínimo', key: 'min_quantity', width: 12 },
        { header: 'Ubicación', key: 'location', width: 20 },
        { header: 'Proveedor', key: 'supplier', width: 20 }
      ];

      worksheet.getRow(1).font = { bold: true, size: 12 };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      filteredParts.forEach(part => {
        worksheet.addRow({
          name: part.name || '',
          part_number: part.part_number || '',
          category: part.category || '',
          manufacturer: part.manufacturer || '',
          quantity: part.quantity || 0,
          unit: part.unit || '',
          unit_price: part.unit_price || 0,
          min_quantity: part.min_quantity || 0,
          location: part.location || '',
          supplier: part.supplier || ''
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `repuestos_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exportando Excel:', error);
      alert('Error al exportar a Excel');
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const tableData = filteredParts.map(part => [
        part.name || '',
        part.part_number || '',
        part.category || '',
        part.manufacturer || '',
        part.quantity || 0,
        part.unit || '',
        `$${(part.unit_price || 0).toFixed(2)}`,
        part.location || ''
      ]);

      autoTable(doc, {
        head: [['Nombre', 'Código', 'Categoría', 'Marca', 'Cantidad', 'Unidad', 'Precio', 'Ubicación']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 40, 85] }
      });

      doc.save(`repuestos_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exportando PDF:', error);
      alert('Error al exportar a PDF');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc]">

      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        <div className="bg-white border border-slate-200 rounded-none p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4 shadow-sm hover:shadow-md transition-all relative">
          <div className="absolute -top-3 -left-3">
            <div className="bg-[#002855] text-white px-3 py-1 text-[10px] font-black uppercase tracking-tight shadow-xl">
              {filteredParts.length} Repuestos
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 relative group/search">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); }}
              className="w-full pl-12 pr-4 py-3 text-[12px] text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 tracking-[0.1em]"
            />
          </div>

          {/* Filters + Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 hover:border-[#002855]/30 text-[10px] font-black text-[#002855] uppercase tracking-widest min-w-[220px]">
              <FileText size={14} className="text-rose-500" />
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); }}
                className="bg-transparent outline-none cursor-pointer flex-1"
              >
                <option value="all">TODAS LAS CATEGORÍAS</option>
                {categories.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                className="px-4 py-3 bg-slate-50 border border-slate-200 hover:border-[#002855]/30 text-[10px] font-black text-[#002855] uppercase tracking-widest flex items-center gap-3 transition-all min-w-[220px]"
              >
                <MapPin size={14} className="text-rose-500" />
                <span className="truncate">{selectedLocations.length === 0 || selectedLocations.length === locations.length ? 'Todas las sedes' : `${selectedLocations.length} Sedes`}</span>
                <ChevronDown size={14} className={`text-slate-300 ml-auto transition-transform ${showLocationDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showLocationDropdown && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  <div className="p-2 border-b border-slate-100">
                    <button
                      onClick={() => {
                        setSelectedLocations(locations.map(loc => loc.id));
                        setShowLocationDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      Seleccionar todas las sedes
                    </button>
                    <button
                      onClick={() => {
                        setSelectedLocations([]);
                        setShowLocationDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    >
                      Limpiar selección
                    </button>
                  </div>
                  {locations.map(location => (
                    <label key={location.id} className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedLocations.includes(location.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLocations([...selectedLocations, location.id]);
                          } else {
                            setSelectedLocations(selectedLocations.filter(id => id !== location.id));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mr-3"
                      />
                      <span className="text-xs font-medium text-slate-700">{location.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 hover:border-[#002855]/30">
              <span className="text-[10px] font-black text-[#002855] uppercase tracking-widest flex items-center gap-1">
                <AlertTriangle size={12} />
                Stock Bajo:
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={lowStockOnly}
                  onChange={(e) => { setLowStockOnly(e.target.checked); }}
                />
                <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex bg-slate-100 p-1 border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 transition-all ${viewMode === 'grid' ? 'bg-white text-[#002855] shadow-sm' : 'text-slate-400 hover:text-[#002855]'}`}
                title="Vista Cuadrícula"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 transition-all ${viewMode === 'list' ? 'bg-white text-[#002855] shadow-sm' : 'text-slate-400 hover:text-[#002855]'}`}
                title="Vista Tabla"
              >
                <ListIcon size={16} />
              </button>
            </div>

            {canEdit() && (
              <button
                onClick={() => {
                  setEditingPart(undefined);
                  setShowForm(true);
                }}
                className="flex items-center gap-2 px-4 py-3 bg-[#002855] text-white text-[10px] font-normal uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
              >
                <Plus size={14} />
                Agregar Repuesto
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="group flex items-center justify-center w-10 h-10 bg-white text-slate-400 border border-slate-200 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm"
              title="Exportar a Excel"
            >
              <RiFileExcel2Fill size={20} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </button>

            <button
              onClick={handleExportPDF}
              className="group flex items-center justify-center w-10 h-10 bg-white text-slate-400 border border-slate-200 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 transition-all shadow-sm"
              title="Exportar a PDF"
            >
              <FaFilePdf size={20} className="text-slate-400 group-hover:text-rose-600 transition-colors" />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <LoadingSpinner label="Cargando catálogo..." />
        ) : filteredParts.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-100 rounded-3xl p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package size={40} className="text-slate-200" />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">No se encontraron repuestos</h3>
            <p className="text-slate-400 max-w-xs mx-auto mt-2 text-sm">Prueba ajustando los filtros o realiza un nuevo registro.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredParts.map((part) => (
              <div key={part.id} className={`bg-white rounded-3xl border ${part.quantity <= part.min_quantity ? 'border-amber-200 bg-amber-50/10' : 'border-slate-100'} hover:shadow-xl transition-all group p-6 cursor-pointer`} onClick={() => { setSelectedPart(part); setShowDetails(true); }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-slate-50 p-3 rounded-2xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                    <Package size={24} />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingPart(part); setShowForm(true); }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(part.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 mb-4">
                  <h3 className="font-black text-slate-900 uppercase tracking-tight line-clamp-1">{part.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black text-[#002855] tracking-[0.2em]">{part.category}</span>
                    <div className="w-1 h-1 bg-slate-200 rounded-full" />
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">{part.part_number}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-50 mb-4">
                  <div className="bg-slate-50/50 p-2.5 rounded-xl">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Actual</p>
                    <p className={`text-sm font-black ${part.quantity <= part.min_quantity ? 'text-amber-600' : 'text-slate-700'}`}>
                      {part.quantity} <span className="text-[9px] uppercase">{part.unit}</span>
                    </p>
                  </div>
                  <div className="bg-slate-50/50 p-2.5 rounded-xl">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio Unit.</p>
                    <p className="text-sm font-black text-slate-700">${part.unit_price.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-wider">{part.manufacturer || "Genérico"}</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase">{part.location || "N/A"}</span>
                </div>

                {part.quantity <= part.min_quantity && (
                  <div className="mt-4 flex items-center gap-2 p-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">
                    <AlertTriangle size={14} />
                    <span className="text-[10px] font-black uppercase tracking-tight">Abastecimiento Requerido</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead><button onClick={() => handleSort('name')} className="flex items-center gap-1"><span className="text-[11px] font-black text-[#002855] uppercase tracking-[0.2em]">Producto</span></button></TableHead>
                    <TableHead><button onClick={() => handleSort('category')} className="flex items-center gap-1"><span className="text-[11px] font-black text-[#002855] uppercase tracking-[0.2em]">Categoría</span></button></TableHead>
                    <TableHead className="text-right"><button onClick={() => handleSort('quantity')} className="flex items-center gap-1 ml-auto"><span className="text-[11px] font-black text-[#002855] uppercase tracking-[0.2em]">Stock</span></button></TableHead>
                    <TableHead className="text-right"><button onClick={() => handleSort('unit_price')} className="flex items-center gap-1 ml-auto"><span className="text-[11px] font-black text-[#002855] uppercase tracking-[0.2em]">Precio</span></button></TableHead>
                    <TableHead className="text-center">Ubicación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {filteredParts.map((part) => (
                    <TableRow key={part.id} className={`cursor-pointer ${part.quantity <= part.min_quantity ? 'bg-amber-50/20' : ''}`} onClick={() => { setSelectedPart(part); setShowDetails(true); }}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-none flex items-center justify-center bg-slate-100 text-slate-400 group-hover/row:bg-[#002855] group-hover/row:text-white transition-all shadow-sm">
                            <Package size={16} />
                          </div>
                          <div>
                            <p className="font-black text-[#002855] uppercase tracking-tight text-sm">{part.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{part.part_number}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{part.category}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex flex-col items-end">
                          <span className={`text-sm font-black ${part.quantity <= part.min_quantity ? 'text-amber-600' : 'text-slate-700'}`}>
                            {part.quantity} {part.unit}
                          </span>
                          {part.quantity <= part.min_quantity && (
                            <span className="text-[8px] font-black text-amber-500 uppercase">Mín: {part.min_quantity}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-black text-sm text-slate-700">${part.unit_price.toFixed(2)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-[14px] font-semibold text-slate-800">{part.location || "—"}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); setEditingPart(part); setShowForm(true); }} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-[#002855] hover:bg-slate-100 bg-white rounded-none border border-slate-200 transition-all shadow-sm"><Edit size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(part.id); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-white rounded-none border border-slate-200 transition-all shadow-sm"><Trash2 size={14} /></button>
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

      {showForm && (
        <SparePartForm
          onClose={() => {
            setShowForm(false);
            setEditingPart(undefined);
          }}
          onSave={() => {
            setShowForm(false);
            setEditingPart(undefined);
            fetchData();
          }}
          editRecord={editingPart}
        />
      )}

      {showDetails && selectedPart && (
        <DetailModal maxWidth="5xl" onClose={() => setShowDetails(false)} closeOnBackdrop>
          <DetailModalHeader>
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 pr-1">
              <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <Package size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xs sm:text-base md:text-[18px] font-normal text-white uppercase tracking-tight leading-snug line-clamp-2 sm:line-clamp-1">
                  {selectedPart.name}
                </h2>
                <p className="text-[9px] sm:text-[10px] font-normal text-blue-200 uppercase tracking-wide mt-1 flex items-start sm:items-center gap-1.5">
                  <span className="line-clamp-2 sm:truncate">{selectedPart.part_number}</span>
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
              <DetailModalSection title="Información del Producto">
                <DetailModalCard className="space-y-2.5 sm:space-y-3">
                  <DetailModalRow label="Categoría">
                    <span className="text-[10px] sm:text-[11px] font-normal text-[#002855] uppercase">
                      {selectedPart.category}
                    </span>
                  </DetailModalRow>
                  <DetailModalRow label="Fabricante">
                    <span className="text-[10px] sm:text-[11px] font-normal text-slate-700 uppercase">
                      {selectedPart.manufacturer || '—'}
                    </span>
                  </DetailModalRow>
                  <DetailModalRow label="Proveedor">
                    <span className="text-[10px] sm:text-[11px] font-normal text-slate-700 uppercase">
                      {selectedPart.supplier || '—'}
                    </span>
                  </DetailModalRow>
                </DetailModalCard>

                <DetailModalCard className="space-y-2.5 sm:space-y-3">
                  <DetailModalRow label="Stock Actual">
                    <span className={`text-[10px] sm:text-[11px] font-normal ${selectedPart.quantity <= selectedPart.min_quantity ? 'text-amber-600' : 'text-slate-700'}`}>
                      {selectedPart.quantity} {selectedPart.unit}
                    </span>
                  </DetailModalRow>
                  <DetailModalRow label="Stock Mínimo">
                    <span className="text-[10px] sm:text-[11px] font-normal text-slate-700">
                      {selectedPart.min_quantity} {selectedPart.unit}
                    </span>
                  </DetailModalRow>
                  <DetailModalRow label="Precio Unitario">
                    <span className="text-[10px] sm:text-[11px] font-mono font-normal text-slate-700">
                      ${selectedPart.unit_price.toFixed(2)}
                    </span>
                  </DetailModalRow>
                </DetailModalCard>
              </DetailModalSection>

              <DetailModalSection title="Ubicación">
                <DetailModalCard>
                  <DetailModalRow label="Ubicación">
                    <span className="text-[10px] sm:text-[11px] font-normal text-[#002855] uppercase">
                      {selectedPart.location || '—'}
                    </span>
                  </DetailModalRow>
                </DetailModalCard>
              </DetailModalSection>

              {selectedPart.description && (
                <DetailModalSection title="Descripción">
                  <DetailModalCard>
                    <p className="text-[10px] sm:text-[11px] font-medium text-slate-700 leading-relaxed">
                      {selectedPart.description}
                    </p>
                  </DetailModalCard>
                </DetailModalSection>
              )}

              {selectedPart.quantity <= selectedPart.min_quantity && (
                <DetailModalSection title="Alerta de Stock">
                  <DetailModalCard className="bg-amber-50 border-amber-100">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                      <p className="text-[10px] sm:text-[11px] font-normal text-amber-900 uppercase tracking-tight">
                        Abastecimiento Requerido
                      </p>
                    </div>
                  </DetailModalCard>
                </DetailModalSection>
              )}
            </DetailModalGrid>
          </DetailModalBody>

          <DetailModalFooter>
            {canEdit() && (
              <button
                onClick={() => { setShowDetails(false); setEditingPart(selectedPart); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2.5 text-[10px] font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-500 hover:text-white transition-all uppercase tracking-widest"
              >
                <Edit size={14} /> Editar
              </button>
            )}
            <button
              onClick={() => setShowDetails(false)}
              className="px-6 py-2.5 text-[10px] font-normal text-white bg-[#002855] rounded-lg hover:bg-blue-800 transition-all uppercase tracking-widest"
            >
              Cerrar
            </button>
          </DetailModalFooter>
        </DetailModal>
      )}
    </div>
  );
}
