import { useEffect, useState, useMemo } from 'react';
import { Plus, Edit, Trash2, MapPin, Eye, X, Copy, ChevronDown, ChevronUp, EyeOff, Star, Video, ArrowRight, Search, Filter } from 'lucide-react';
import { BUSINESS_TYPE_LABELS } from '../../../shared/types/inventory.types';
import { GiCctvCamera } from 'react-icons/gi';
import { generateExcel, generatePDF } from '../../../shared/utils/exportUtils';
import { supabase, Camera as CameraType, Location, StoredDisk } from '../../../shared/services/supabase';
import CameraForm from '../forms/CameraForm';
import { useAuth } from '../../../app/providers/AuthContext';
import { useNotify } from '../../../shared/hooks/useNotify';
import Pagination from '../../../shared/components/ui/Pagination';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import StoredDiskForm from '../forms/StoredDiskForm';
import DetailModal, {
  DetailModalHeader,
  DetailModalBody,
  StandardModalFooter,
  DetailModalGrid,
  DetailModalSection,
  DetailModalCard,
  DetailModalRow,
} from '../../../shared/components/ui/DetailModal';
import ModalOverlay from '../../../shared/components/ui/ModalOverlay';
import ActionToolbar from '../../../shared/components/ui/ActionToolbar';
import ActionsDropdown from '../../../shared/components/ui/ActionsDropdown';
import { useSelectionMode } from '../../../shared/hooks/useSelectionMode';
import FilterBar from '../../../shared/components/ui/FilterBar';
import ViewToggle from '../../../shared/components/ui/ViewToggle';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableCellPrimary,
  TableCellSecondary,
  TableCellBadge,
  TableActionButton
} from '../../../shared/components/ui/Table';

type Camera = CameraType;

type CamerasProps = {
  subview?: string;
};
export default function Cameras({ subview }: CamerasProps) {
  const { canEdit, user } = useAuth();
  const { error: notifyError, confirm } = useNotify();
  const [loading, setLoading] = useState(true);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [editing, setEditing] = useState<Camera | undefined>();
  const [selectedCamera, setSelectedCamera] = useState<Camera | undefined>();
  const [expandedStorage, setExpandedStorage] = useState<Set<string>>(new Set());
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [selectedRubros, setSelectedRubros] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterStorage, setFilterStorage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [showStoredDiskForm, setShowStoredDiskForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [storedDisks, setStoredDisks] = useState<StoredDisk[]>([]);
  const [editingDisk, setEditingDisk] = useState<StoredDisk | undefined>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { selectionMode, setSelectionMode } = useSelectionMode();
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const handleToggleSelectionMode = () => {
    if (selectionMode) setSelectedIds([]);
    setSelectionMode(!selectionMode);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };




  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchCameras(), fetchLocations(), fetchStoredDisks()]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const handleNewCamera = () => openCreate();
    const handleExport = () => handleExportExcel();
    const handleExportPdf = () => handleExportPDF();
    const handleToggleView = () => setViewMode(prev => prev === 'grid' ? 'table' : 'grid');

    window.addEventListener('cameras:new', handleNewCamera);
    window.addEventListener('cameras:export', handleExport);
    window.addEventListener('cameras:export-pdf', handleExportPdf);
    window.addEventListener('cameras:toggle-view', handleToggleView);

    return () => {
      window.removeEventListener('cameras:new', handleNewCamera);
      window.removeEventListener('cameras:export', handleExport);
      window.removeEventListener('cameras:export-pdf', handleExportPdf);
      window.removeEventListener('cameras:toggle-view', handleToggleView);
    };
  }, [cameras, selectedLocations, filterStatus, filterStorage, viewMode, searchTerm, subview]);

  const fetchLocations = async () => {
    const { data } = await supabase.from('locations').select('*, companies(id, name)').eq('is_active', true).order('name');
    if (data) setLocations(data);
  };

  const filteredLocations = useMemo(() => {
    if (selectedRubros.length === 0) return locations;
    return locations.filter(loc => loc.business_type && selectedRubros.includes(loc.business_type));
  }, [locations, selectedRubros]);

  const fetchCameras = async () => {
    let query = supabase
      .from('cameras')
      .select('*, locations(*), camera_disks(*)');

    if (user?.role === 'administradores' && user?.location_id) {
      query = query.eq('location_id', user.location_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) setCameras(data as Camera[]);
  };

  const fetchStoredDisks = async () => {
    const { data, error } = await supabase
      .from('stored_disks')
      .select('*, cameras(name, location_id, locations(name))')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setStoredDisks(data as any);
    }
  };

  const handleDeleteDisk = async (id: string) => {
    const confirmed = await confirm('¿Eliminar registro de disco almacenado?', 'Eliminar Disco');
    if (!confirmed) return;
    const { error } = await supabase.from('stored_disks').delete().eq('id', id);
    if (error) return notifyError('Error al eliminar: ' + error.message);
    await fetchStoredDisks();
  };

  const openCreate = () => {
    setEditing(undefined);
    setShowForm(true);
  };

  const openEdit = (cam: Camera) => {
    setEditing(cam);
    setShowForm(true);
  };

  const del = async (cam: Camera) => {
    const confirmed = await confirm(`¿Eliminar cámara "${cam.name}"?`, 'Eliminar Cámara');
    if (!confirmed) return;
    const { error } = await supabase.from('cameras').delete().eq('id', cam.id);
    if (error) return notifyError('Error al eliminar: ' + error.message);
    await fetchCameras();
    setSelectedIds(prev => prev.filter(selectedId => selectedId !== cam.id));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm(`¿Eliminar ${selectedIds.length} cámaras seleccionadas?`, 'Eliminación por Lote');
    if (!confirmed) return;
    const { error } = await supabase.from('cameras').delete().in('id', selectedIds);
    if (error) return notifyError('Error al eliminar por lote: ' + error.message);
    await fetchCameras();
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = (items: Camera[]) => {
    if (selectedIds.length === items.length && items.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(i => i.id));
    }
  };

  const onSave = async () => {
    setShowForm(false);
    setShowStoredDiskForm(false);
    setEditing(undefined);
    setEditingDisk(undefined);
    await Promise.all([fetchCameras(), fetchStoredDisks()]);
  };

  const handleView = (cam: Camera) => {
    setSelectedCamera(cam);
    setShowDetails(true);
  };

  const toggleStorage = (id: string) => {
    const next = new Set(expandedStorage);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedStorage(next);
  };

  const togglePasswordVisible = (id: string) => {
    const next = new Set(visiblePasswords);
    if (next.has(id)) next.delete(id); else next.add(id);
    setVisiblePasswords(next);
  };

  const copyToClipboard = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch { }
  };

  const humanAccess = (t?: string) => {
    if (!t) return '—';
    if (t === 'url') return 'URL';
    if (t === 'ivms') return 'IVMS';
    if (t === 'esviz') return 'ESVIZ';
    return t;
  };

  // Función para obtener el tipo de ubicación basado en el subview
  const getLocationTypeFromSubview = (subview?: string) => {
    if (!subview) return null;

    const typeMap: Record<string, string> = {
      'cameras-revision': 'revision',
      'cameras-escuela': 'escuela_conductores',
      'cameras-policlinico': 'policlinico',
      'cameras-circuito': 'circuito',
    };

    return typeMap[subview] || null;
  };

  // Helper: calcula el porcentaje máximo de uso de disco de una cámara
  const getMaxDiskUsagePercent = (cam: Camera): number => {
    if (!cam.camera_disks || cam.camera_disks.length === 0) return 0;
    return Math.max(
      ...cam.camera_disks.map(d => {
        if (!d.total_capacity_gb || d.total_capacity_gb === 0) return 0;
        return (Number(d.used_space_gb) / Number(d.total_capacity_gb)) * 100;
      })
    );
  };

  const filteredCameras = useMemo(() => {
    let filtered = cameras
      .filter((c) => {
        const locationType = getLocationTypeFromSubview(subview);
        if (locationType && (c as any).locations?.type !== locationType) return false;

        const matchesSearch = !searchTerm ||
          c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.ip_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.model?.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        if (selectedRubros.length > 0) {
          const locBusinessType = (c as any).locations?.business_type;
          if (!locBusinessType || !selectedRubros.includes(locBusinessType)) return false;
        }

        if (selectedLocations.length > 0) {
          const cameraLocationId = (c as any).locations?.id;
          if (!cameraLocationId || !selectedLocations.includes(cameraLocationId)) return false;
        }

        if (filterStatus.length > 0 && !filterStatus.includes(c.status ?? '')) return false;

        if (filterStorage) {
          const hasCriticalDisk = c.camera_disks?.some(d => {
            if (!d.total_capacity_gb || Number(d.total_capacity_gb) === 0) return false;
            const usedPercent = (Number(d.used_space_gb) / Number(d.total_capacity_gb)) * 100;
            return usedPercent >= 75;
          });
          if (!hasCriticalDisk) return false;
        }

        return true;
      });

    if (filterStorage) {
      filtered.sort((a, b) => getMaxDiskUsagePercent(b) - getMaxDiskUsagePercent(a));
    } else if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any = (a as any)[sortConfig.key];
        let bValue: any = (b as any)[sortConfig.key];

        if (sortConfig.key === 'location') {
          aValue = (a as any).locations?.name || '';
          bValue = (b as any).locations?.name || '';
        } else if (sortConfig.key === 'disks') {
          aValue = a.camera_disks?.length || 0;
          bValue = b.camera_disks?.length || 0;
        }

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const result = aValue < bValue ? -1 : 1;
        return sortConfig.direction === 'asc' ? result : -result;
      });
    }

    return filtered;
  }, [cameras, searchTerm, selectedRubros, selectedLocations, filterStatus, filterStorage, subview, sortConfig]);

  const totalPages = Math.ceil(filteredCameras.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredCameras.slice(startIndex, startIndex + itemsPerPage);

  const processedStoredDisks = storedDisks.map(disk => ({
    ...disk,
    camera_name: (disk as any).cameras?.name,
    location_name: (disk as any).cameras?.locations?.name,
    location_id: (disk as any).cameras?.location_id
  }));

  const filteredDisks = processedStoredDisks.filter(disk => {
    const matchesSearch = !searchTerm ||
      disk.camera_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      disk.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      disk.disk_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      disk.serial_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLocation = selectedLocations.length === 0 ||
      (disk.location_id && selectedLocations.includes(disk.location_id));

    return matchesSearch && matchesLocation;
  });

  const paginatedDisks = filteredDisks.slice(startIndex, startIndex + itemsPerPage);
  const totalDisksPages = Math.ceil(filteredDisks.length / itemsPerPage);



  const getSelectedSedeName = () => {
    if (selectedLocations.length === 1) {
      return locations.find(l => l.id === selectedLocations[0])?.name;
    }
    return undefined;
  };

  const handleExportPDF = () => {
    const isDisksView = subview === 'cameras-disks';
    const sedeName = getSelectedSedeName();

    if (isDisksView) {
      const data = filteredDisks.map((d, i) => ({
        nro: i + 1,
        disco: `Disco #${d.disk_number}`,
        serial: d.serial_number || '—',
        marca: d.brand || '—',
        camara: d.camera_name || '—',
        ubicacion: d.location_name || '—',
        capacidad: `${d.used_space_gb}/${d.total_capacity_gb} GB`,
        periodo: d.stored_from ? `${new Date(String(d.stored_from).includes('T') ? String(d.stored_from) : `${d.stored_from}T12:00:00`).toLocaleDateString('es-PE')} - ${new Date(String(d.stored_to || '').includes('T') ? String(d.stored_to || '') : `${d.stored_to || ''}T12:00:00`).toLocaleDateString('es-PE')}` : '—',
        notas: d.notes || '—'
      }));

      generatePDF({
        title: 'Inventario de Discos Extraídos',
        filename: 'Discos Extraídos',
        sede: sedeName,
        columns: [
          { header: 'N°', key: 'nro' },
          { header: 'Disco', key: 'disco' },
          { header: 'Serie', key: 'serial' },
          { header: 'Marca', key: 'marca' },
          { header: 'Cámara Origen', key: 'camara' },
          { header: 'Ubicación', key: 'ubicacion' },
          { header: 'Capacidad', key: 'capacidad' },
          { header: 'Periodo Grabación', key: 'periodo' },
          { header: 'Notas', key: 'notes' }
        ],
        data
      });
    } else {
      const data = filteredCameras.map((c, i) => ({
        nro: i + 1,
        camara: c.name || '—',
        ubicacion: (c as any).locations?.name || '—',
        grabacion: c.recording_start_date ? new Date(String(c.recording_start_date + 'T00:00:00').includes('T') ? String(c.recording_start_date + 'T00:00:00') : `${c.recording_start_date + 'T00:00:00'}T12:00:00`).toLocaleDateString('es-PE') : '—',
        marca: c.brand || '—',
        ip: `${c.ip_address || '—'}:${c.port || '—'}`,
        discos: c.camera_disks?.map(d => `D${d.disk_number}: ${d.total_capacity_gb}GB (${d.disk_type})`).join(', ') || 'Sin discos',
        espacio: c.camera_disks?.map(d => `D${d.disk_number}: ${d.remaining_capacity_gb || 0}GB`).join(', ') || '—'
      }));

      generatePDF({
        title: 'Reporte Detallado de Cámaras',
        filename: 'Cámaras',
        sede: sedeName,
        columns: [
          { header: 'N°', key: 'nro' },
          { header: 'Cámara', key: 'camara' },
          { header: 'Ubicación', key: 'ubicacion' },
          { header: 'Inicio Grabación', key: 'grabacion' },
          { header: 'Marca', key: 'marca' },
          { header: 'IP / Puerto', key: 'ip' },
          { header: 'Discos Duros', key: 'discos' },
          { header: 'Espacio Libre', key: 'espacio' }
        ],
        data
      });
    }
  };

  const handleExportExcel = async () => {
    const isDisksView = subview === 'cameras-disks';
    const sedeName = getSelectedSedeName();

    if (isDisksView) {
      const data = filteredDisks.map((d, i) => ({
        nro: i + 1,
        disco: `Disco #${d.disk_number}`,
        serial: d.serial_number || '',
        marca: d.brand || '',
        camara: d.camera_name || '',
        ubicacion: d.location_name || '',
        desde: d.stored_from || '',
        hasta: d.stored_to || '',
        total: d.total_capacity_gb || 0,
        usado: d.used_space_gb || 0,
        notas: d.notes || ''
      }));

      await generateExcel({
        title: 'Inventario de Discos Extraídos',
        filename: 'Discos Extraídos',
        sede: sedeName,
        columns: [
          { header: 'N°', key: 'nro', width: 6 },
          { header: 'Disco', key: 'disco', width: 15 },
          { header: 'Serie', key: 'serial', width: 22 },
          { header: 'Marca', key: 'marca', width: 18 },
          { header: 'Cámara Origen', key: 'camara', width: 25 },
          { header: 'Ubicación', key: 'ubicacion', width: 25 },
          { header: 'Grabación Desde', key: 'desde', width: 18 },
          { header: 'Grabación Hasta', key: 'hasta', width: 18 },
          { header: 'Capacidad Total (GB)', key: 'total', width: 22 },
          { header: 'Espacio Usado (GB)', key: 'usado', width: 22 },
          { header: 'Notas', key: 'notes', width: 40 }
        ],
        data
      });
    } else {
      const data = filteredCameras.map((c, i) => ({
        nro: i + 1,
        nombre: c.name || '',
        ubicacion: (c as any).locations?.name || '',
        grabacion: c.recording_start_date || '—',
        marca: c.brand || '',
        modelo: c.model || '',
        ip: c.ip_address || '',
        puerto: c.port || '',
        usuario: c.username || '',
        url: c.url || '',
        tipo: humanAccess(c.access_type),
        estado: c.status === 'active' ? 'Activo' : c.status === 'maintenance' ? 'Mantenimiento' : 'Inactivo',
        discos: c.camera_disks?.map(d => `D${d.disk_number}: ${d.total_capacity_gb}GB (${d.disk_type})`).join(', ') || 'Sin discos',
        espacio: c.camera_disks?.map(d => `D${d.disk_number}: ${d.remaining_capacity_gb || 0}GB`).join(', ') || '—',
        notas: c.notes || ''
      }));

      await generateExcel({
        title: 'Reporte Detallado de Cámaras',
        filename: 'Cámaras',
        sede: sedeName,
        columns: [
          { header: 'N°', key: 'nro', width: 6 },
          { header: 'Nombre', key: 'nombre', width: 25 },
          { header: 'Ubicación', key: 'ubicacion', width: 25 },
          { header: 'Inicio Grabación', key: 'grabacion', width: 20 },
          { header: 'Marca', key: 'marca', width: 15 },
          { header: 'Modelo', key: 'modelo', width: 20 },
          { header: 'IP', key: 'ip', width: 15 },
          { header: 'Puerto', key: 'puerto', width: 10 },
          { header: 'Usuario', key: 'usuario', width: 20 },
          { header: 'URL Acceso', key: 'url', width: 40 },
          { header: 'Tipo Acceso', key: 'tipo', width: 15 },
          { header: 'Estado', key: 'estado', width: 15 },
          { header: 'Discos Duros', key: 'discos', width: 35 },
          { header: 'Espacio Libre', key: 'espacio', width: 25 },
          { header: 'Notas', key: 'notas', width: 30 }
        ],
        data
      });
    }
  };


  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">

      <div className="p-6 space-y-6 flex-1 overflow-y-auto">

        <ActionToolbar
          totalItems={subview === 'cameras-disks' ? filteredDisks.length : filteredCameras.length}
          label={subview === 'cameras-disks' ? 'Discos' : 'Equipos'}
          searchComponent={
            <>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-12 pr-4 py-3 text-[12px] font-black text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 tracking-[0.1em]"
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
                multiple: true,
                options: filteredLocations.map(loc => ({
                  value: loc.id,
                  label: (loc as any).companies?.name ? `${loc.name} (${(loc as any).companies.name})` : loc.name
                }))
              },
              ...(subview !== 'cameras-disks' ? [{
                key: 'status', placeholder: 'TODOS LOS ESTADOS', options: [
                  { value: 'active', label: 'ACTIVO' },
                  { value: 'maintenance', label: 'MANTENIMIENTO' },
                  { value: 'inactive', label: 'INACTIVO' },
                ]
              }] : []),
            ]}
            values={{ business_type: selectedRubros, location: selectedLocations, status: filterStatus }}
            onChange={(key, value) => {
              if (key === 'business_type') {
                const newRubros = value as string[];
                setSelectedRubros(newRubros);
                if (newRubros.length > 0) {
                  const validIds = new Set(locations.filter(l => l.business_type && newRubros.includes(l.business_type)).map(l => l.id));
                  setSelectedLocations(selectedLocations.filter(id => validIds.has(id)));
                }
              } else if (key === 'location') setSelectedLocations(value as string[]);
              else if (key === 'status') setFilterStatus(value as string[]);
              setCurrentPage(1);
            }}
            onClearAll={() => {
              setSelectedRubros([]);
              setSelectedLocations([]);
              setFilterStatus([]);
              setCurrentPage(1);
            }}
          />

          {subview !== 'cameras-disks' && (
            <div className="w-full md:w-auto flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200 hover:border-[#002855]/30">
              <span className="text-[10px] font-black text-[#002855] tracking-widest flex items-center gap-1">
                <Star size={12} />
                Crítico:
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={filterStorage}
                  onChange={(e) => { setFilterStorage(e.target.checked); setCurrentPage(1); }}
                />
                <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {subview !== 'cameras-disks' && (
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          )}

          {subview === 'cameras-disks' ? (
            <button
              onClick={() => setShowStoredDiskForm(true)}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-[#002855] text-white text-[10px] font-normal uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
            >
              <Plus size={14} />
              Nuevo Disco Almacenado
            </button>
          ) : canEdit() && (
            <button
              onClick={openCreate}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-[#002855] text-white text-[10px] font-normal uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
            >
              <Plus size={14} />
              Agregar Equipo
            </button>
          )}

          <ActionsDropdown
            selectionMode={
              canEdit() && subview !== 'cameras-disks'
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

          {canEdit() && selectionMode && selectedIds.length > 0 && viewMode === 'table' && !subview && (
            <button
              onClick={handleBulkDelete}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 hover:text-rose-700 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
            >
              <Trash2 size={14} />
              Eliminar ({selectedIds.length})
            </button>
          )}
        </ActionToolbar>

        {
          loading ? (
            <LoadingSpinner label="Cargando cámaras..." />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedData.map((cam) => (
                <div key={cam.id} className={`group bg-white rounded-none shadow-sm border hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col relative ${selectedIds.includes(cam.id) ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-gray-200 hover:border-blue-300'}`}>
                  {canEdit() && selectionMode && !subview && (
                    <div className="absolute top-4 right-4 z-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(cam.id)}
                        onChange={() => toggleSelect(cam.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 cursor-pointer shadow-sm"
                      />
                    </div>
                  )}
                  {/* Header con diseño minimalista */}
                  <div className="relative bg-gray-50 px-5 pt-4 pb-4 border-b border-gray-100">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`${cam.status === 'active' ? 'bg-green-500 text-white' :
                          cam.status === 'maintenance' ? 'bg-yellow-500 text-white' :
                            'bg-gray-400 text-white'} rounded-none p-2.5 shadow-sm`}>
                          <GiCctvCamera size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900 text-base leading-tight group-hover:text-blue-700 transition-colors">{cam.name}</h3>
                            {typeof cam.display_count !== 'undefined' && cam.display_count !== null && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700 shadow-sm border border-gray-300">{cam.display_count}</span>
                            )}
                            {cam.access_type && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded-none bg-gray-100 text-gray-600 border-gray-200">
                                {humanAccess(cam.access_type)}
                              </span>
                            )}
                          </div>
                          {(cam as any).locations && (
                            <div className="flex items-center gap-1.5 text-[12px] font-bold text-slate-700 hidden sm:block">
                              <MapPin size={14} className="text-rose-500 inline" />
                              <span>{(cam as any).locations.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Status badge */}
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-[14px] font-semibold ${cam.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          cam.status === 'maintenance' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                          {cam.status === 'active' ? 'Activo' : cam.status === 'maintenance' ? 'Mantenimiento' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body con mejor espaciado y diseño */}
                  <div className="px-5 pb-4 space-y-4">
                    {/* Información técnica compacta */}
                    <div className="bg-gray-50 rounded-none p-3 border border-gray-100">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {(cam.brand || cam.model) && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs font-medium">MODELO:</span>
                            <span className="font-mono text-xs font-bold text-gray-800">{cam.brand || ''} {cam.model || ''}</span>
                          </div>
                        )}
                        {cam.ip_address && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs font-medium">IP:</span>
                            <span className="font-mono text-xs font-bold text-blue-600">{cam.ip_address}</span>
                          </div>
                        )}
                      </div>
                    </div>


                    {/* Credenciales y acceso */}
                    <div className="space-y-3">
                      {cam.url && (
                        <div className="bg-gray-50 rounded-none p-3 border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 text-xs font-bold">URL:</span>
                              <span className="font-mono text-xs text-gray-800 break-all flex-1">{cam.url}</span>
                            </div>
                            <button
                              onClick={() => window.open(cam.url, '_blank', 'noopener')}
                              className="px-3 py-1.5 text-xs bg-gray-800 text-white rounded-none hover:bg-black transition-colors font-medium shadow-sm"
                              title="Abrir URL"
                            >
                              Abrir
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center justify-between bg-gray-50 rounded-none p-3 border border-gray-200">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 text-xs font-medium">Usuario:</span>
                            <span className="font-mono text-xs text-gray-800 break-all flex-1">{cam.username || '—'}</span>
                          </div>
                          {cam.username && (
                            <button onClick={() => copyToClipboard(cam.username)} className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded-none transition-colors" title="Copiar">
                              <Copy size={12} />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between bg-gray-50 rounded-none p-3 border border-gray-200">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 text-xs font-medium">Contraseña:</span>
                            <span className="font-mono text-xs text-gray-800 break-all flex-1">{visiblePasswords.has(cam.id) ? (cam.password || '—') : (cam.password ? '••••••••' : '—')}</span>
                          </div>
                          {cam.password && (
                            <div className="flex gap-1">
                              <button onClick={() => togglePasswordVisible(cam.id)} className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded-none transition-colors" title={visiblePasswords.has(cam.id) ? 'Ocultar' : 'Mostrar'}>
                                {visiblePasswords.has(cam.id) ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                              <button onClick={() => copyToClipboard(cam.password)} className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded-none transition-colors" title="Copiar">
                                <Copy size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {cam.auth_code && (
                        <div className="flex items-center justify-between bg-yellow-50 rounded-none p-3 border border-yellow-200">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-700 text-xs font-medium">Código:</span>
                            <span className="font-mono text-xs text-yellow-800 break-all flex-1">{cam.auth_code}</span>
                          </div>
                          <button onClick={() => copyToClipboard(cam.auth_code)} className="p-1.5 bg-yellow-200 hover:bg-yellow-300 rounded-none transition-colors" title="Copiar">
                            <Copy size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Almacenamiento mejorado */}
                    <div className="bg-gray-50 rounded-none p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-700">💾 Almacenamiento</span>
                        {(cam.camera_disks && cam.camera_disks.length > 0) && (
                          <button
                            onClick={() => toggleStorage(cam.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                          >
                            {expandedStorage.has(cam.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {cam.camera_disks.length} disco{cam.camera_disks.length > 1 ? 's' : ''}
                          </button>
                        )}
                      </div>

                      {(cam.camera_disks && cam.camera_disks.length > 0) ? (
                        <div>
                          {(() => {
                            const totals = cam.camera_disks!.reduce(
                              (acc, d) => {
                                const total = Number(d.total_capacity_gb) || 0;
                                const used = Number(d.used_space_gb) || 0;
                                return { total: acc.total + total, used: acc.used + used };
                              },
                              { total: 0, used: 0 }
                            );
                            const percentUsed = totals.total > 0 ? Math.min(100, Math.max(0, Math.round((totals.used / totals.total) * 100))) : 0;
                            const remaining = Math.max(0, totals.total - totals.used);
                            return (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600 font-medium">Uso total:</span>
                                  <span className="font-bold text-gray-800">{totals.used}GB / {totals.total}GB</span>
                                </div>
                                <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${percentUsed > 75 ? 'bg-red-500' : percentUsed > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                    style={{ width: `${percentUsed}%` }}
                                  />
                                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference">
                                    {percentUsed}%
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                  <span>Libre: {remaining}GB</span>
                                  <span className={percentUsed > 75 ? 'text-red-600 font-bold' : percentUsed > 50 ? 'text-yellow-600 font-bold' : 'text-green-600 font-bold'}>
                                    {percentUsed > 75 ? '⚠️ Crítico (<25%)' : percentUsed > 50 ? '⚠️ Precaución (<50%)' : '✓ Normal (>50%)'}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <div className="text-gray-400 text-sm">Sin discos configurados</div>
                        </div>
                      )}
                    </div>

                    {/* Detalles expandidos de almacenamiento */}
                    {cam.camera_disks && cam.camera_disks.length > 0 && expandedStorage.has(cam.id) && (
                      <div className="space-y-2">
                        {cam.camera_disks.map((d) => {
                          const total = Number(d.total_capacity_gb) || 0;
                          const used = Number(d.used_space_gb) || 0;
                          const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((used / total) * 100))) : 0;
                          const remaining = Math.max(0, total - used);
                          return (
                            <div key={d.id} className="bg-white border border-gray-200 rounded-none p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-bold text-gray-700">Disco #{d.disk_number} • {d.disk_type || 'Sin tipo'}</div>
                                <span className={`text-[14px] font-semibold ${d.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                  d.status === 'maintenance' ? 'bg-amber-100 text-amber-700' :
                                    d.status === 'full' ? 'bg-rose-100 text-rose-700' :
                                      'bg-slate-100 text-slate-600'
                                  }`}>
                                  {d.status === 'active' ? 'Activo' : d.status === 'maintenance' ? 'Mantenimiento' : d.status === 'full' ? 'Lleno' : 'Desconocido'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                                <span>Usado: {used}GB</span>
                                <span>Libre: {remaining}GB</span>
                                <span>Total: {total}GB</span>
                              </div>
                              <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-300 ${percent > 75 ? 'bg-red-500' : percent > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${percent}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Acciones mejoradas */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      {canEdit() && (
                        <>
                          <button
                            onClick={() => openEdit(cam)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-none hover:bg-gray-200 transition-colors font-medium border border-gray-200"
                          >
                            <Edit size={16} /> Editar
                          </button>
                          <button
                            onClick={() => del(cam)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-gray-100 text-gray-400 rounded-none hover:bg-red-50 hover:text-red-600 transition-colors font-medium border border-gray-200"
                          >
                            <Trash2 size={16} /> Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : subview === 'cameras-disks' ? (
            <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-50/50 border-b border-slate-100 relative z-20">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalDisksPages}
                  totalItems={filteredDisks.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Disco / Serie</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Periodo Grabación</TableHead>
                      <TableHead>Capacidad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDisks.map((disk) => (
                      <TableRow key={disk.id} className="group/row">
                        <TableCell className="font-bold">
                          <div className="flex flex-col">
                            <TableCellPrimary>Disco #{disk.disk_number}</TableCellPrimary>
                            <span className="text-[10px] font-mono font-bold text-slate-400 tracking-widest mt-1">S/N: {disk.serial_number || 'S/N DESCONOCIDA'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TableCellPrimary className="text-slate-500">{disk.brand || '—'}</TableCellPrimary>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <TableCellPrimary className="text-slate-600">{disk.camera_name || '—'}</TableCellPrimary>
                            <TableCellSecondary>{disk.location_name || 'UBICACIÓN N/A'}</TableCellSecondary>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="px-2 py-1 bg-blue-50 border border-blue-100 rounded-none text-[10px] font-black text-blue-600 tracking-wider">
                              {disk.stored_from ? new Date(String(disk.stored_from).includes('T') ? String(disk.stored_from) : `${disk.stored_from}T12:00:00`).toLocaleDateString() : 'INICIO N/A'}
                            </div>
                            <span className="text-slate-300">—</span>
                            <div className="px-2 py-1 bg-blue-50 border border-blue-100 rounded-none text-[10px] font-black text-blue-600 tracking-wider">
                              {disk.stored_to ? new Date(String(disk.stored_to).includes('T') ? String(disk.stored_to) : `${disk.stored_to}T12:00:00`).toLocaleDateString() : 'FIN N/A'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <TableCellPrimary>{disk.used_space_gb}/{disk.total_capacity_gb} GB</TableCellPrimary>
                            <div className="w-24 bg-slate-100 h-1 rounded-none overflow-hidden">
                              <div className="bg-rose-500 h-full" style={{ width: `${Math.min(100, Math.round((Number(disk.used_space_gb) / Number(disk.total_capacity_gb)) * 100))}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TableCellBadge className="bg-rose-100 text-rose-700">ALMACENADO</TableCellBadge>
                        </TableCell>
                        <TableCell>
                          <span className="text-[12px] font-medium text-slate-500 italic max-w-xs block truncate">{disk.notes || 'Sin observaciones'}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            {canEdit() && (
                              <>
                                <TableActionButton
                                  icon={<Edit size={14} />}
                                  onClick={() => {
                                    setEditingDisk(disk);
                                    setShowStoredDiskForm(true);
                                  }}
                                  title="Editar Disco"
                                />
                                <TableActionButton
                                  icon={<Trash2 size={14} />}
                                  onClick={() => handleDeleteDisk(disk.id)}
                                  title="Eliminar Disco"
                                  variant="danger"
                                />
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedDisks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-400 font-bold text-[10px] tracking-widest py-10">
                          No se encontraron discos extraídos almacenados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden md:flex bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden flex-col">
                <div className="bg-slate-50/50 border-b border-slate-100 relative z-20">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredCameras.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                  />
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canEdit() && selectionMode && !subview && (
                          <TableHead className="w-12 text-center">
                            <input
                              type="checkbox"
                              checked={paginatedData.length > 0 && selectedIds.length === paginatedData.length}
                              onChange={() => toggleSelectAll(paginatedData)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-[#002855] focus:ring-[#002855]/30 transition-all cursor-pointer"
                            />
                          </TableHead>
                        )}
                        <TableHead sortable isSorted={sortConfig?.key === 'name'} sortDirection={sortConfig?.direction} onClick={() => handleSort('name')}>Cámara</TableHead>
                        <TableHead sortable isSorted={sortConfig?.key === 'location'} sortDirection={sortConfig?.direction} onClick={() => handleSort('location')}>Ubicación</TableHead>
                        <TableHead sortable isSorted={sortConfig?.key === 'recording_start_date'} sortDirection={sortConfig?.direction} onClick={() => handleSort('recording_start_date')}>Inicio Grabación</TableHead>
                        <TableHead sortable isSorted={sortConfig?.key === 'status'} sortDirection={sortConfig?.direction} onClick={() => handleSort('status')}>Estado</TableHead>
                        <TableHead sortable isSorted={sortConfig?.key === 'disks'} sortDirection={sortConfig?.direction} onClick={() => handleSort('disks')}>Almacenamiento</TableHead>
                        <TableHead className="text-center">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((cam) => (
                        <TableRow
                          key={cam.id}
                          className={`cursor-pointer transition-colors duration-150 group/row relative ${selectedIds.includes(cam.id) ? 'bg-blue-50/40' : ''}`}
                          onClick={() => handleView(cam)}
                        >
                          {canEdit() && selectionMode && !subview && (
                            <TableCell className="text-center w-12">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(cam.id)}
                                onChange={() => toggleSelect(cam.id)}
                                onClick={e => e.stopPropagation()}
                                className="w-3.5 h-3.5 rounded-none border-slate-300 text-[#002855] focus:ring-[#002855]/30 transition-all cursor-pointer"
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-bold noTruncate">
                            <div className="flex flex-col min-w-0">
                              <TableCellPrimary className="truncate max-w-[350px]">{cam.name}</TableCellPrimary>
                              <TableCellSecondary className="truncate max-w-[350px]">{cam.brand || ''} {cam.model || ''}</TableCellSecondary>
                            </div>
                          </TableCell>
                          <TableCell>
                            <TableCellPrimary className="text-slate-700 truncate max-w-xs block">{(cam as any).locations?.name || 'Ubicación N/A'}</TableCellPrimary>
                          </TableCell>
                          <TableCell>
                            <TableCellPrimary>
                              {cam.recording_start_date ? new Date(String(cam.recording_start_date + 'T00:00:00').includes('T') ? String(cam.recording_start_date + 'T00:00:00') : `${cam.recording_start_date + 'T00:00:00'}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </TableCellPrimary>
                          </TableCell>
                          <TableCell>
                            <TableCellBadge className={cam.status === 'active' ? 'bg-emerald-100 text-emerald-700' : cam.status === 'maintenance' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}>
                              {cam.status === 'active' ? 'ACTIVO' : cam.status === 'maintenance' ? 'MANTENIMIENTO' : 'INACTIVO'}
                            </TableCellBadge>
                          </TableCell>
                          <TableCell>
                            {cam.camera_disks && cam.camera_disks.length > 0 ? (
                              <div className="flex flex-col gap-1 min-w-[120px]">
                                {(() => {
                                  const activeDisks = cam.camera_disks!.filter(d => d.status !== 'extracted');
                                  if (activeDisks.length === 0) return <TableCellSecondary>SIN DISCOS ACTIVOS</TableCellSecondary>;

                                  const totals = activeDisks.reduce(
                                    (acc, d) => {
                                      const total = Number(d.total_capacity_gb) || 0;
                                      const remaining = Number(d.remaining_capacity_gb) || 0;
                                      const used = d.used_space_gb !== null && d.used_space_gb !== undefined
                                        ? Number(d.used_space_gb)
                                        : (total - remaining);
                                      return {
                                        total: acc.total + total,
                                        used: acc.used + used
                                      };
                                    },
                                    { total: 0, used: 0 }
                                  );
                                  const percent = totals.total > 0 ? Math.min(100, Math.round((totals.used / totals.total) * 100)) : 0;
                                  return (
                                    <>
                                      <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-0.5">
                                        <span>{totals.used}/{totals.total}GB</span>
                                        <span>{percent}%</span>
                                      </div>
                                      <div className="w-full bg-slate-100 h-1.5 rounded-none overflow-hidden border border-slate-200">
                                        <div
                                          className={`h-full ${percent > 75 ? 'bg-rose-500' : percent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                          style={{ width: `${percent}%` }}
                                        />
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            ) : (
                              <TableCellSecondary>SIN DISCOS</TableCellSecondary>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                              {canEdit() && (
                                <>
                                  <TableActionButton
                                    icon={<Edit size={14} />}
                                    onClick={e => { e.stopPropagation(); openEdit(cam); }}
                                    title="Editar"
                                  />
                                  <TableActionButton
                                    icon={<Trash2 size={14} />}
                                    onClick={e => { e.stopPropagation(); del(cam); }}
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

              {/* Mobile card view */}
              <div className="md:hidden space-y-3 mt-4">
                {paginatedData.map((cam) => (
                  <div key={cam.id} className="bg-white border border-slate-200" onClick={() => handleView(cam)}>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-black text-[#002855] uppercase truncate">{cam.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 truncate">{cam.brand || ''} {cam.model || ''}</p>
                        </div>
                        <span className={`shrink-0 text-[14px] font-semibold ${cam.status === 'active' ? 'bg-emerald-100 text-emerald-700' : cam.status === 'maintenance' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {cam.status === 'active' ? 'ACTIVO' : cam.status === 'maintenance' ? 'MANTENIMIENTO' : 'INACTIVO'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1.5">
                        <MapPin size={11} className="text-rose-500 shrink-0" />
                        <span className="text-[9px] font-bold text-slate-500 truncate">{(cam as any).locations?.name || 'Ubicación N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                        <span className="text-[8px] font-bold text-slate-400">
                          {cam.recording_start_date ? new Date(String(cam.recording_start_date + 'T00:00:00').includes('T') ? String(cam.recording_start_date + 'T00:00:00') : `${cam.recording_start_date + 'T00:00:00'}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '—'}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400">
                          {cam.camera_disks?.length || 0} disco(s)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="md:hidden mt-3">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredCameras.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              </div>
            </>
          )
        }

        {
          showDetails && selectedCamera && (
            <DetailModal maxWidth="5xl" onClose={() => setShowDetails(false)} closeOnBackdrop>
              <DetailModalHeader>
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 pr-1">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <GiCctvCamera size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xs sm:text-base md:text-[18px] font-normal text-white tracking-tight leading-snug line-clamp-2 sm:line-clamp-1">
                      {selectedCamera.name}
                    </h2>
                    <p className="text-[9px] sm:text-[10px] font-normal text-blue-200 tracking-wide mt-1 flex items-start sm:items-center gap-1.5">
                      <MapPin size={10} className="shrink-0 mt-0.5 sm:mt-0" />
                      <span className="line-clamp-2 sm:truncate">{(selectedCamera as any).locations?.name || 'UBICACIÓN INTEGRAL'}</span>
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

                  <DetailModalSection title="Especificaciones">
                    <div className="space-y-2.5 sm:space-y-3">
                      <DetailModalCard className="space-y-2.5 sm:space-y-3">
                        <DetailModalRow label="Estado Operativo">
                          <span className={`text-[14px] font-semibold ${selectedCamera.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                            selectedCamera.status === 'maintenance' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                            {selectedCamera.status === 'active' ? 'Activo' : selectedCamera.status === 'maintenance' ? 'Mantenimiento' : 'Inactivo'}
                          </span>
                        </DetailModalRow>
                        <DetailModalRow label="Marca / Modelo">
                          <span className="text-[10px] sm:text-[12px] font-normal text-[#002855] uppercase break-words">
                            {selectedCamera.brand || 'GENÉRICA'} {selectedCamera.model || ''}
                          </span>
                        </DetailModalRow>
                        <DetailModalRow label="Flujos de Video">
                          <span className="text-[10px] sm:text-[12px] font-normal text-[#002855]">{selectedCamera.display_count || '0'} CÁMARAS</span>
                        </DetailModalRow>
                      </DetailModalCard>

                      <DetailModalCard className="space-y-2.5 sm:space-y-3">
                        <DetailModalRow label="Registro de Alta">
                          <span className="text-[10px] sm:text-[12px] font-normal text-slate-600">
                            {new Date(String(selectedCamera.created_at).includes('T') ? String(selectedCamera.created_at) : `${selectedCamera.created_at}T12:00:00`).toLocaleDateString()}
                          </span>
                        </DetailModalRow>
                        <DetailModalRow label="Último Cambio">
                          <span className="text-[10px] sm:text-[12px] font-normal text-slate-600">
                            {new Date(String(selectedCamera.updated_at).includes('T') ? String(selectedCamera.updated_at) : `${selectedCamera.updated_at}T12:00:00`).toLocaleDateString()}
                          </span>
                        </DetailModalRow>
                      </DetailModalCard>
                    </div>
                  </DetailModalSection>

                  <DetailModalSection title="Accesos y Red">
                    <DetailModalCard>
                      <DetailModalRow label="Tipo de Conexión">
                        <span className="text-[10px] sm:text-[12px] font-normal text-[#002855] uppercase">
                          {humanAccess(selectedCamera.access_type)}
                        </span>
                      </DetailModalRow>

                      <div className="space-y-2.5 sm:space-y-3 mt-3 sm:mt-4 pt-3 border-t border-slate-200/80">
                        <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-sm">
                          <span className="text-[8px] sm:text-[9px] font-normal text-slate-400 block mb-1.5">Dirección IPv4</span>
                          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                            <span className="font-mono text-[11px] sm:text-xs font-normal text-blue-600 break-all">{selectedCamera.ip_address || '0.0.0.0'}</span>
                            <span className="font-mono text-[9px] sm:text-[10px] font-normal text-slate-400 shrink-0">PORT: {selectedCamera.port || '—'}</span>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-sm">
                          <span className="text-[8px] sm:text-[9px] font-normal text-slate-400 block mb-1.5">Usuario GS</span>
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <span className="text-[10px] sm:text-[11px] font-normal text-[#002855] truncate">{selectedCamera.username || '—'}</span>
                            <button type="button" onClick={() => copyToClipboard(selectedCamera.username)} className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center hover:text-blue-600 transition-colors shrink-0" aria-label="Copiar usuario">
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-sm">
                          <span className="text-[8px] sm:text-[9px] font-normal text-slate-400 block mb-1.5">Credenciales</span>
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <span className="font-mono text-[10px] sm:text-xs font-normal text-slate-600 tracking-wide break-all">
                              {visiblePasswords.has(selectedCamera.id) ? (selectedCamera.password || '—') : (selectedCamera.password ? '••••••••' : '—')}
                            </span>
                            <div className="flex gap-0.5 shrink-0">
                              <button type="button" onClick={() => togglePasswordVisible(selectedCamera.id)} className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center hover:text-blue-600 transition-colors" aria-label="Mostrar u ocultar contraseña">
                                {visiblePasswords.has(selectedCamera.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                              <button type="button" onClick={() => copyToClipboard(selectedCamera.password)} className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center hover:text-blue-600 transition-colors" aria-label="Copiar contraseña">
                                <Copy size={14} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {selectedCamera.auth_code && (
                          <div className="bg-blue-50 border border-blue-100 p-2.5 sm:p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <span className="block text-[8px] font-normal text-blue-400 tracking-widest">Código de verificación</span>
                              <span className="font-mono text-xs sm:text-sm font-normal text-blue-700 break-all">{selectedCamera.auth_code}</span>
                            </div>
                            <button type="button" onClick={() => copyToClipboard(selectedCamera.auth_code)} className="w-full sm:w-auto p-2.5 min-h-[44px] flex items-center justify-center gap-2 bg-white border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all text-[10px] font-normal uppercase tracking-widest">
                              <Copy size={14} /> Copiar
                            </button>
                          </div>
                        )}

                        {selectedCamera.url && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => window.open(selectedCamera.url, '_blank', 'noopener')}
                              className="w-full py-2.5 sm:py-3 bg-[#002855] text-white text-[9px] sm:text-[10px] font-normal uppercase tracking-wide sm:tracking-[0.2em] shadow-lg hover:bg-blue-800 transition-all flex items-center justify-center gap-2 min-h-[44px]"
                            >
                              Visualizar Cámaras
                              <ArrowRight size={14} />
                            </button>
                            <span className="block text-[8px] sm:text-[9px] text-slate-400 font-normal mt-1.5 break-all">{selectedCamera.url}</span>
                          </div>
                        )}
                      </div>
                    </DetailModalCard>
                  </DetailModalSection>

                  <DetailModalSection title="Almacenamiento">
                    <div className="space-y-2.5 sm:space-y-4">
                      {selectedCamera.camera_disks && selectedCamera.camera_disks.length > 0 ? (
                        <div className="space-y-4">
                          {/* Resumen Total */}
                          {(() => {
                            const totals = selectedCamera.camera_disks!.reduce(
                              (acc, d) => {
                                const total = Number(d.total_capacity_gb) || 0;
                                const remaining = Number(d.remaining_capacity_gb) || 0;
                                const used = d.used_space_gb !== null && d.used_space_gb !== undefined ? Number(d.used_space_gb) : (total - remaining);
                                return {
                                  total: acc.total + total,
                                  used: acc.used + used
                                };
                              },
                              { total: 0, used: 0 }
                            );
                            const percent = totals.total > 0 ? Math.min(100, Math.round((totals.used / totals.total) * 100)) : 0;
                            return (
                              <div className="p-3 sm:p-4 bg-slate-900 text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-blue-600/10 rounded-full blur-3xl" />
                                <div className="relative z-10">
                                  <div className="flex justify-between items-end mb-3 sm:mb-4 gap-2">
                                    <span className="text-[8px] sm:text-[9px] font-normal tracking-wide sm:tracking-[0.2em] text-blue-400">Capacidad Global</span>
                                    <span className="text-lg sm:text-[20px] font-normal tracking-tighter">{percent}%</span>
                                  </div>
                                  <div className="w-full bg-white/10 h-1.5 sm:h-2 rounded-none mb-2 sm:mb-3">
                                    <div
                                      className={`h-full transition-all duration-1000 ${percent > 75 ? 'bg-rose-500' : percent > 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 text-[10px] sm:text-[11px] font-normal uppercase tracking-tighter">
                                    <span>Ocupado: {totals.used} GB</span>
                                    <span className="text-blue-400">Total: {totals.total} GB</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          <div className="space-y-2 max-h-[40vh] sm:max-h-[280px] overflow-y-auto overscroll-contain pr-0.5">
                            {selectedCamera.camera_disks.map((d) => {
                              const total = Number(d.total_capacity_gb) || 0;
                              const used = d.used_space_gb !== null && d.used_space_gb !== undefined ? Number(d.used_space_gb) : (total - Number(d.remaining_capacity_gb) || 0);
                              const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                              return (
                                <div key={d.id} className="p-2.5 sm:p-3 bg-white border border-slate-200">
                                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0">
                                      <span className="text-[9px] sm:text-[10px] font-normal text-[#002855] tracking-wide">Disco #{d.disk_number}</span>
                                      {d.serial_number && <span className="block text-[8px] font-normal text-slate-400 uppercase truncate">S/N: {d.serial_number}</span>}
                                    </div>
                                    <span className={`shrink-0 text-[14px] font-semibold ${d.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                      d.status === 'full' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                                      }`}>
                                      {d.status?.toUpperCase() || 'OFFLINE'}
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-100 h-1 mb-2">
                                    <div className={`h-full ${percent > 75 ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }} />
                                  </div>
                                  <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-[8px] sm:text-[9px] font-normal text-slate-400">
                                    <span className="break-words">TIPO: {d.disk_type || 'GS-SATA'} {d.brand ? `(${d.brand})` : ''}</span>
                                    <span className="shrink-0">{used}/{total} GB</span>
                                  </div>
                                  {(d.stored_from || d.stored_to) && (
                                    <div className="text-[7px] sm:text-[8px] font-normal text-blue-600 border-t border-slate-50 pt-1.5 mt-1.5 leading-relaxed">
                                      Grabación: {d.stored_from ? new Date(String(d.stored_from + 'T00:00:00').includes('T') ? String(d.stored_from + 'T00:00:00') : `${d.stored_from + 'T00:00:00'}T12:00:00`).toLocaleDateString() : '—'} — {d.stored_to ? new Date(String(d.stored_to + 'T00:00:00').includes('T') ? String(d.stored_to + 'T00:00:00') : `${d.stored_to + 'T00:00:00'}T12:00:00`).toLocaleDateString() : '—'}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 sm:p-8 border-2 border-dashed border-slate-200 text-center">
                          <span className="text-[9px] sm:text-[10px] font-normal text-slate-300 tracking-widest">Sin registro de almacenamiento</span>
                        </div>
                      )}

                      {selectedCamera.notes && (
                        <div className="p-3 sm:p-4 bg-amber-50 border border-amber-100">
                          <span className="text-[8px] sm:text-[9px] font-normal text-amber-600 tracking-widest mb-1.5 flex items-center gap-1">
                            <Star size={10} /> Notas Técnicas
                          </span>
                          <p className="text-[10px] sm:text-[11px] font-medium text-amber-900 leading-relaxed">
                            {selectedCamera.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </DetailModalSection>

                </DetailModalGrid>
              </DetailModalBody>

              <StandardModalFooter
                onClose={() => setShowDetails(false)}
                onEdit={canEdit() ? () => { setShowDetails(false); openEdit(selectedCamera); } : undefined}
                editLabel="Editar"
              />
            </DetailModal>
          )
        }

        {showForm && (
          <CameraForm
            onClose={() => setShowForm(false)}
            onSave={onSave}
            editCamera={editing}
          />
        )}
      </div >
      {showWelcomePopup && (
        <ModalOverlay className="bg-[#001529]/60 backdrop-blur-sm">
          <div
            className="bg-white border border-slate-200 shadow-2xl w-full max-w-lg relative overflow-hidden animate-in zoom-in-95 duration-300 mx-2 sm:mx-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-600" />
            <div className="p-8">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 flex items-center justify-center mb-6 shadow-inner">
                  <Video size={32} />
                </div>
                <h3 className="text-[20px] font-black text-[#002855] tracking-tight mb-2">Protocolo de Monitoreo</h3>
                <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] mb-4">SISTEMA INTEGRAL DE VIDEOVIGILANCIA GS</p>
                <div className="w-12 h-1 bg-blue-600 rounded-none mb-6" />
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex gap-4 p-4 bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 shrink-0 bg-white border border-slate-200 flex items-center justify-center text-[12px] font-black text-blue-600 italic">01</div>
                  <div>
                    <h4 className="text-[11px] font-black text-[#002855] tracking-widest mb-1">Verificación de IP</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Asegúrese de estar conectado a la red local de la ubicación para acceder a las cámaras por IP directa.</p>
                  </div>
                </div>
                <div className="flex gap-4 p-4 bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 shrink-0 bg-white border border-slate-200 flex items-center justify-center text-[12px] font-black text-blue-600 italic">02</div>
                  <div>
                    <h4 className="text-[11px] font-black text-[#002855] tracking-widest mb-1">Acceso IVMS/ESVIZ</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Utilice los códigos de verificación proporcionados para los equipos con tecnología cloud P2P.</p>
                  </div>
                </div>
                <div className="flex gap-4 p-4 bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 shrink-0 bg-white border border-slate-200 flex items-center justify-center text-[12px] font-black text-blue-600 italic">03</div>
                  <div>
                    <h4 className="text-[11px] font-black text-[#002855] tracking-widest mb-1">Reporte de Fallas</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Cualquier inconsistencia en el almacenamiento debe ser reportada inmediatamente en la sección de mantenimiento.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowWelcomePopup(false)}
                className="w-full py-4 bg-[#002855] text-white text-[12px] font-black uppercase tracking-[0.2em] hover:bg-blue-800 transition-all shadow-lg flex items-center justify-center gap-3 group"
              >
                ENTENDIDO, CONTINUAR
                <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
      {showStoredDiskForm && (
        <StoredDiskForm
          onClose={() => {
            setShowStoredDiskForm(false);
            setEditingDisk(undefined);
          }}
          onSuccess={onSave}
          editDisk={editingDisk}
        />
      )}
    </div>
  );
}



