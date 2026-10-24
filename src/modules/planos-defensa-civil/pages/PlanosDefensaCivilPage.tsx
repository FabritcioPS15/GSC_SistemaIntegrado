import { useEffect, useState, useMemo } from 'react';
import { Plus, MapPin, Search, Map, Calendar, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Pagination from '../../../shared/components/ui/Pagination';
import { supabase, Location } from '../../../shared/services/supabase';
import { BUSINESS_TYPE_LABELS } from '../../../shared/types/inventory.types';
import { useAuth } from '../../../app/providers/AuthContext';
import ActionToolbar from '../../../shared/components/ui/ActionToolbar';
import FilterBar from '../../../shared/components/ui/FilterBar';
import ViewToggle from '../../../shared/components/ui/ViewToggle';
import ActionsDropdown from '../../../shared/components/ui/ActionsDropdown';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import PrimaryButton from '../../../shared/components/ui/PrimaryButton';
import RowActions from '../../../shared/components/ui/RowActions';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../shared/components/ui/Table';

type PlanoDefensaCivil = {
  id: string;
  nombre: string;
  tipo: string;
  ubicacion_id: string;
  fecha_actualizacion: string;
  estado: 'vigente' | 'actualizado' | 'pendiente';
  descripcion?: string;
  archivo_url?: string;
  created_at: string;
  updated_at: string;
  locations?: Location;
};

export default function PlanosDefensaCivil() {
  const { canEdit } = useAuth();
  const [planos, setPlanos] = useState<PlanoDefensaCivil[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedRubros, setSelectedRubros] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'nombre' | 'tipo' | 'fecha_actualizacion' | 'ubicacion'>('nombre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchPlanos(), fetchLocations()]);
      setLoading(false);
    })();
  }, []);

  const fetchPlanos = async () => {
    const { data, error } = await supabase.from('planos_defensa_civil').select('*, locations(*)').order('created_at', { ascending: false });
    if (!error && data) {
      setPlanos(data as PlanoDefensaCivil[]);
    }
  };

  const fetchLocations = async () => {
    const { data } = await supabase.from('locations').select('*, companies(id, name)').eq('is_active', true).order('name');
    if (data) setLocations(data);
  };

  const filteredLocations = useMemo(() => {
    if (selectedRubros.length === 0) return locations;
    return locations.filter(loc => loc.business_type && selectedRubros.includes(loc.business_type));
  }, [locations, selectedRubros]);

  const sortedPlanos = [...planos].sort((a, b) => {
    let aValue: string | number = '';
    let bValue: string | number = '';

    switch (sortField) {
      case 'nombre':
        aValue = a.nombre || '';
        bValue = b.nombre || '';
        break;
      case 'tipo':
        aValue = a.tipo || '';
        bValue = b.tipo || '';
        break;
      case 'fecha_actualizacion':
        aValue = a.fecha_actualizacion ? new Date(a.fecha_actualizacion).getTime() : 0;
        bValue = b.fecha_actualizacion ? new Date(b.fecha_actualizacion).getTime() : 0;
        break;
      case 'ubicacion':
        aValue = a.locations?.name || '';
        bValue = b.locations?.name || '';
        break;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const filtered = sortedPlanos.filter(p => {
    const q = search.toLowerCase();
    const matchesSearch = p.nombre?.toLowerCase().includes(q) ||
      p.tipo?.toLowerCase().includes(q) ||
      p.descripcion?.toLowerCase().includes(q) ||
      p.locations?.name?.toLowerCase().includes(q);

    const matchesRubro = selectedRubros.length === 0 ||
      selectedRubros.length === Object.keys(BUSINESS_TYPE_LABELS).length ||
      selectedRubros.includes(p.locations?.business_type || '');

    const matchesLocation = selectedLocations.length === 0 ||
      selectedLocations.length === locations.length ||
      selectedLocations.includes(p.ubicacion_id || '');

    return matchesSearch && matchesRubro && matchesLocation;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: 'nombre' | 'tipo' | 'fecha_actualizacion' | 'ubicacion') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const renderStatus = (plano: PlanoDefensaCivil) => {
    const dateStr = new Date(String(plano.fecha_actualizacion).includes('T') ? String(plano.fecha_actualizacion) : `${plano.fecha_actualizacion}T12:00:00`).toLocaleDateString('es-PE');

    if (plano.estado === 'pendiente') {
      return (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[14px] font-semibold bg-amber-100 text-amber-700">
            Pendiente
          </span>
          <span className="text-[10px] font-black text-amber-600/80 ml-1">{dateStr}</span>
        </div>
      );
    }

    if (plano.estado === 'actualizado') {
      return (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[14px] font-semibold bg-emerald-100 text-emerald-700">
            Actualizado
          </span>
          <span className="text-[10px] font-bold text-slate-500 ml-1">{dateStr}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-[14px] font-semibold bg-emerald-100 text-emerald-700">
          Vigente
        </span>
        <span className="text-[10px] font-bold text-slate-500 ml-1">{dateStr}</span>
      </div>
    );
  };

  const downloadReport = () => {
    const headers = ['Nombre', 'Tipo', 'Ubicación', 'Fecha Actualización', 'Estado', 'Descripción'];
    const csvContent = [
      headers.join(','),
      ...filtered.map(p => [
        `"${p.nombre || ''}"`,
        `"${p.tipo || ''}"`,
        `"${p.locations?.name || ''}"`,
        `"${p.fecha_actualizacion ? new Date(String(p.fecha_actualizacion).includes('T') ? String(p.fecha_actualizacion) : `${p.fecha_actualizacion}T12:00:00`).toLocaleDateString('es-PE') : ''}"`,
        `"${p.estado || ''}"`,
        `"${p.descripcion || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `planos_defensa_civil_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadReportPdf = () => {
    const doc = new jsPDF();
    const tableData = filtered.map(p => [
      p.nombre || '',
      p.tipo || '',
      p.locations?.name || '',
      p.fecha_actualizacion ? new Date(String(p.fecha_actualizacion).includes('T') ? String(p.fecha_actualizacion) : `${p.fecha_actualizacion}T12:00:00`).toLocaleDateString('es-PE') : '',
      p.estado || '',
      p.descripcion || ''
    ]);

    autoTable(doc, {
      head: [['Nombre', 'Tipo', 'Ubicación', 'Actualización', 'Estado', 'Descripción']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 40, 85] }
    });

    doc.save(`planos_defensa_civil_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto">

        <ActionToolbar
          totalItems={filtered.length}
          label="Planos"
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
              { key: 'business_type', placeholder: 'TODOS LOS RUBROS', icon: Filter, iconClassName: 'text-blue-500', wrapperClassName: 'md:min-w-[220px]', options: Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
              { key: 'location', placeholder: 'TODAS LAS SEDES', icon: MapPin, iconClassName: 'text-rose-500', wrapperClassName: 'md:min-w-[240px]', options: filteredLocations.map(loc => ({ value: loc.id, label: loc.companies?.name ? `${loc.name} (${loc.companies.name})` : loc.name })) },
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

          <ViewToggle viewMode={viewMode} onChange={setViewMode} />

          {canEdit() && (
            <PrimaryButton icon={Plus} onClick={() => alert('Función para crear nuevo plano')}>
              Nuevo Plano
            </PrimaryButton>
          )}

          <ActionsDropdown onExportExcel={downloadReport} onExportPDF={downloadReportPdf} />
        </ActionToolbar>

        {loading ? (
          <LoadingSpinner label="Cargando planos..." />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedData.map(plano => (
              <div key={plano.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 hover:shadow-xl transition-all p-6 flex flex-col group overflow-hidden hover:-translate-y-0.5 duration-200">
                <div className="flex justify-between items-center mb-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-100 text-slate-400 group-hover:bg-[#002855] group-hover:text-white transition-all shadow-sm">
                    <Map size={20} />
                  </div>
                  {renderStatus(plano)}
                </div>

                <div className="mb-4">
                  <h4 className="text-[14px] font-black text-slate-800 uppercase leading-none">{plano.nombre}</h4>
                  <p className="text-[11px] font-semibold text-slate-400 tracking-wider mt-1">{plano.tipo}</p>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase">
                    <MapPin size={14} className="text-rose-500 shrink-0" />
                    <span className="truncate">{plano.locations?.name || 'Sede N/A'}</span>
                  </div>
                  {plano.descripcion && (
                    <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-semibold text-slate-600 line-clamp-2">{plano.descripcion}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150 mt-auto">
                  <RowActions
                    canEdit={canEdit()}
                    onEdit={undefined}
                    onDelete={undefined}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-300">
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
              {paginatedData.map((plano) => (
                <div key={plano.id} className="p-3 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-black text-[#002855] truncate leading-tight">{plano.nombre}</p>
                      <p className="text-[10px] font-semibold text-slate-500">{plano.tipo}</p>
                    </div>
                    {renderStatus(plano)}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 flex-wrap">
                    <span className="flex items-center gap-0.5">
                      <MapPin size={10} className="text-rose-400 shrink-0" />
                      {plano.locations?.name || 'Sede N/A'}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Calendar size={10} className="text-blue-400 shrink-0" />
                      {plano.fecha_actualizacion ? new Date(String(plano.fecha_actualizacion).includes('T') ? String(plano.fecha_actualizacion) : `${plano.fecha_actualizacion}T12:00:00`).toLocaleDateString('es-PE') : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>
                      <button onClick={() => handleSort('nombre')} className="flex items-center gap-2">
                        <span className="text-[12px] font-black text-[#002855] tracking-[0.2em]">Nombre</span>
                        {sortField === 'nombre' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => handleSort('tipo')} className="flex items-center gap-2">
                        <span className="text-[12px] font-black text-[#002855] tracking-[0.2em]">Tipo</span>
                        {sortField === 'tipo' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => handleSort('ubicacion')} className="flex items-center gap-2">
                        <span className="text-[12px] font-black text-[#002855] tracking-[0.2em]">Ubicación</span>
                        {sortField === 'ubicacion' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => handleSort('fecha_actualizacion')} className="flex items-center gap-2">
                        <span className="text-[12px] font-black text-[#002855] tracking-[0.2em]">Actualización</span>
                        {sortField === 'fecha_actualizacion' && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </button>
                    </TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((plano) => (
                    <TableRow key={plano.id} className="cursor-pointer">
                      <TableCell>
                        <div className="flex items-center gap-4">
                          <div className="w-9 h-9 rounded-none flex items-center justify-center bg-slate-100 text-slate-400 group-hover/row:bg-[#002855] group-hover/row:text-white transition-all shadow-sm">
                            <Map size={16} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-black text-[#002855] leading-tight">{plano.nombre}</span>
                            <span className="text-[11px] font-semibold text-slate-400 tracking-wider mt-1">{plano.tipo}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-[12px] font-bold text-slate-700 uppercase">{plano.tipo}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <MapPin size={14} className="text-rose-500 shrink-0" />
                          <span className="text-[12px] font-bold uppercase truncate max-w-xs block">{plano.locations?.name || 'Sede N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Calendar size={14} className="text-blue-500 shrink-0" />
                          <span className="text-[12px] font-black text-slate-800">
                            {plano.fecha_actualizacion ? new Date(String(plano.fecha_actualizacion).includes('T') ? String(plano.fecha_actualizacion) : `${plano.fecha_actualizacion}T12:00:00`).toLocaleDateString('es-PE') : '—'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{renderStatus(plano)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2 lg:opacity-0 lg:group-hover/row:opacity-100 transition-opacity duration-150">
                          <RowActions canEdit={canEdit()} onEdit={undefined} onDelete={undefined} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>)}
      </div>
    </div>
  );
}
