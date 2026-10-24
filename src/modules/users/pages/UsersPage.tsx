import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Mail, MapPin, X, Users as UsersIcon, Shield, Crown, Lock, Settings, TrendingUp, User as UserIcon, Search, Scale, Filter } from 'lucide-react';
import ActionToolbar from '../../../shared/components/ui/ActionToolbar';
import ActionsDropdown from '../../../shared/components/ui/ActionsDropdown';
import { useSelectionMode } from '../../../shared/hooks/useSelectionMode';
import FilterBar from '../../../shared/components/ui/FilterBar';
import ViewToggle from '../../../shared/components/ui/ViewToggle';
import PrimaryButton from '../../../shared/components/ui/PrimaryButton';
import { generateExcel, generatePDF } from '../../../shared/utils/exportUtils';
import { supabase, Location } from '../../../shared/services/supabase';
import { BUSINESS_TYPE_LABELS } from '../../../shared/types/inventory.types';
import UserForm from '../forms/UserForm';
import { useAuth } from '../../../app/providers/AuthContext';
import Pagination from '../../../shared/components/ui/Pagination';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import DetailModal, {
  DetailModalHeader,
  DetailModalBody,
  StandardModalFooter,

} from '../../../shared/components/ui/DetailModal';
import { useNotify } from '../../../shared/hooks/useNotify';
import UserLocationAccess from '../components/UserLocationAccess';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCellPrimary, TableCellSecondary, TableCellBadge, TableActionButton } from '../../../shared/components/ui/Table';

type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  location_id?: string;
  phone?: string;
  status: 'active' | 'inactive';
  notes?: string;
  permissions?: string[];
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  locations?: {
    id: string;
    name: string;
    type: string;
    business_type?: string;
  };
};

export default function Users() {
  const { canEdit } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>();
  const [showDetails, setShowDetails] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | undefined>();
  const [showLocationAccess, setShowLocationAccess] = useState(false);
  const [userForLocationAccess, setUserForLocationAccess] = useState<User | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [selectedRubros, setSelectedRubros] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const filteredLocations = useMemo(() => {
    if (selectedRubros.length === 0) return locations;
    return locations.filter(loc => loc.business_type && selectedRubros.includes(loc.business_type));
  }, [locations, selectedRubros]);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { selectionMode, setSelectionMode } = useSelectionMode();

  const handleToggleSelectionMode = () => {
    if (selectionMode) setSelectedIds([]);
    setSelectionMode(!selectionMode);
  };

  const canEditValue = canEdit();
  const { success: notifySuccess, error: notifyError, warning: notifyWarning, confirm } = useNotify();

  const handleNewUserClick = () => {
    setEditingUser(undefined);
    setShowForm(true);
  };



  useEffect(() => {
    fetchData();
  }, []);


  useEffect(() => {
    const handleNew = () => handleNewUserClick();
    const handleExport = () => exportToExcel();
    const handleExportPdf = () => exportToPdf();
    window.addEventListener('users:new', handleNew);
    window.addEventListener('users:export', handleExport);
    window.addEventListener('users:export-pdf', handleExportPdf);
    return () => {
      window.removeEventListener('users:new', handleNew);
      window.removeEventListener('users:export', handleExport);
      window.removeEventListener('users:export-pdf', handleExportPdf);
    };
  }, [users, searchTerm, roleFilter, statusFilter, selectedLocations, sortConfig]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchLocations()]);
    setLoading(false);
  };

  const fetchLocations = async () => {
    const { data } = await supabase.from('locations').select('*, companies(id, name)').eq('is_active', true).order('name');
    if (data) setLocations(data);
  };

  const handleEditUser = (user: User) => {
    if (user.role === 'super_admin') {
      notifyWarning('No se puede editar al Super Administrador.', 'Acceso restringido');
      return;
    }
    setEditingUser(user);
    setShowForm(true);
  };

  const handleViewUser = (user: User) => { setSelectedUser(user); setShowDetails(true); };

  const handleLocationAccess = (user: User) => {
    if (user.role === 'super_admin') {
      notifyWarning('El Super Administrador tiene acceso a todas las ubicaciones.', 'Acceso restringido');
      return;
    }
    setUserForLocationAccess(user);
    setShowLocationAccess(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (user.role === 'super_admin') {
      notifyWarning('No se puede eliminar al Super Administrador.', 'Acceso restringido');
      return;
    }
    const confirmed = await confirm(
      `Se eliminará al usuario ${user.full_name}. Esta acción no se puede deshacer.`,
      '¿Eliminar usuario?'
    );
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('users').delete().eq('id', user.id);
      if (error) throw error;
      await fetchUsers();
      notifySuccess('Usuario eliminado correctamente', 'Eliminado');
    } catch (err: any) {
      notifyError('Error: ' + err.message, 'Error al eliminar');
    }
  };

  const handleSaveUser = async () => {
    setShowForm(false);
    setEditingUser(undefined);
    setTimeout(() => fetchUsers(), 100);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingUser(undefined);
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, locations(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        setUsers(data as User[]);
      }
    } catch (err: any) {
      console.error('Error al cargar usuarios:', err);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin': return <Crown className="h-4 w-4" />;
      case 'gerencia': return <TrendingUp className="h-4 w-4" />;
      case 'sistemas': return <Lock className="h-4 w-4" />;
      case 'supervisores': return <Shield className="h-4 w-4" />;
      case 'administradores': return <UsersIcon className="h-4 w-4" />;
      case 'personalizado': return <Settings className="h-4 w-4" />;
      case 'area_legal': return <Scale className="h-4 w-4" />;
      case 'area_contable': return <UsersIcon className="h-4 w-4" />;
      default: return <UserIcon className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-violet-100 text-violet-700';
      case 'gerencia': return 'bg-indigo-100 text-indigo-700';
      case 'sistemas': return 'bg-teal-100 text-teal-700';
      case 'supervisores': return 'bg-blue-100 text-blue-700';
      case 'administradores': return 'bg-emerald-100 text-emerald-700';
      case 'personalizado': return 'bg-slate-100 text-slate-600';
      case 'area_legal': return 'bg-purple-100 text-purple-700';
      case 'area_contable': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'gerencia': return 'Gerencia';
      case 'sistemas': return 'Sistemas';
      case 'supervisores': return 'Supervisores';
      case 'administradores': return 'Administradores';
      case 'personalizado': return 'Personalizado';
      case 'area_legal': return 'Área Legal';
      case 'area_contable': return 'Área Contable';
      default: return role;
    }
  };

  const MODULE_LABELS: Record<string, string> = {
    dashboard: 'Dashboard',
    tickets: 'Mesa de Ayuda',
    checklist: 'Checklist',
    inventory: 'Inventario',
    cameras: 'Cámaras',
    maintenance: 'Mantenimiento',
    flota: 'Flota Vehicular',
    requests: 'Solicitudes',
    quotations: 'Cotizaciones',
    'spare-parts': 'Repuestos',
    users: 'Usuarios',
    locations: 'Sedes',
    sutran: 'Sutran',
    mtc: 'MTC Accesos',
    servers: 'Servidores',
    painpoint: 'Painpoints',
    sent: 'Enviados',
    audit: 'Auditoría',
    reports: 'Reportes',
    cvs: "CV's",
    'titulos-habilitantes': 'Títulos Habilitantes',
    'planos-defensa-civil': 'Planos Defensa Civil',
    vacations: 'Vacaciones',
  };

  const getPermissionModuleLabel = (permissionId: string): string => {
    const base = permissionId.replace(/-(view|edit|create|delete|export)$/, '');
    const moduleKey = base.split('-')[0];
    return MODULE_LABELS[moduleKey] || base;
  };

  const statusLabels = { active: 'Activo', inactive: 'Inactivo' };

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
        <span className="text-[12px] font-black text-[#002855] tracking-[0.2em]">{label}</span>
        {isSorted ? (
          <span className="text-[#002855] text-[10px]">
            {sortConfig.direction === 'asc' ? '▲' : '▼'}
          </span>
        ) : (
          <span className="text-slate-300 text-[10px] opacity-50">▲▼</span>
        )}
      </button>
    );
  };

  const filteredUsers = useMemo(() => {
    const filtered = users.filter(user => {
      const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter.length === 0 || roleFilter.includes(user.role);
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(user.status);
      const matchesRubro = selectedRubros.length === 0 ||
        selectedRubros.length === Object.keys(BUSINESS_TYPE_LABELS).length ||
        selectedRubros.includes(user.locations?.business_type || '');
      const matchesLocation = selectedLocations.length === 0 || selectedLocations.includes(user.location_id || '');
      return matchesSearch && matchesRole && matchesStatus && matchesRubro && matchesLocation;
    });

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'user':
          aValue = a.full_name.toLowerCase();
          bValue = b.full_name.toLowerCase();
          break;
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'role':
          aValue = getRoleLabel(a.role).toLowerCase();
          bValue = getRoleLabel(b.role).toLowerCase();
          break;
        case 'status':
          aValue = statusLabels[a.status as keyof typeof statusLabels].toLowerCase();
          bValue = statusLabels[b.status as keyof typeof statusLabels].toLowerCase();
          break;
        case 'location':
          aValue = (a.locations?.name || '').toLowerCase();
          bValue = (b.locations?.name || '').toLowerCase();
          break;
        default:
          aValue = (a as any)[sortConfig.key];
          bValue = (b as any)[sortConfig.key];
      }

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const result = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [users, searchTerm, roleFilter, statusFilter, selectedRubros, selectedLocations, sortConfig]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedUsers.length && paginatedUsers.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedUsers.map(u => u.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm(`¿Eliminar ${selectedIds.length} usuarios seleccionados?`, 'Eliminación por Lote');
    if (confirmed) {
      try {
        const { error } = await supabase.from('users').delete().in('id', selectedIds);
        if (error) throw error;
        setSelectedIds([]);
        await fetchUsers();
        notifySuccess(`${selectedIds.length} usuarios eliminados correctamente`, 'Eliminados');
      } catch (err: any) {
        notifyError('Error: ' + err.message, 'Error al eliminar');
      }
    }
  };

  const exportToExcel = async () => {
    try {
      const itemsToExport = selectedIds.length > 0
        ? filteredUsers.filter(u => selectedIds.includes(u.id))
        : filteredUsers;

      const data = itemsToExport.map(u => ({
        full_name: u.full_name,
        email: u.email,
        role: getRoleLabel(u.role),
        location: u.locations?.name || 'Sistema',
        status: statusLabels[u.status]
      }));

      await generateExcel({
        title: 'Reporte de Usuarios',
        filename: 'Usuarios',
        columns: [
          { header: 'NOMBRES', key: 'full_name', width: 25 },
          { header: 'EMAIL', key: 'email', width: 30 },
          { header: 'ROL', key: 'role', width: 20 },
          { header: 'UBICACIÓN', key: 'location', width: 20 },
          { header: 'ESTADO', key: 'status', width: 15 }
        ],
        data
      });
    } catch (e) {
      console.error('Error exportando Excel:', e);
      notifyError('Error al exportar a Excel', 'Error de exportación');
    }
  };

  const exportToPdf = () => {
    try {
      const itemsToExport = selectedIds.length > 0
        ? filteredUsers.filter(u => selectedIds.includes(u.id))
        : filteredUsers;

      const data = itemsToExport.map(u => ({
        full_name: u.full_name,
        email: u.email,
        role: getRoleLabel(u.role),
        location: u.locations?.name || 'Sistema',
        status: statusLabels[u.status]
      }));

      generatePDF({
        title: 'Reporte de Usuarios',
        filename: 'Usuarios',
        columns: [
          { header: 'Nombres', key: 'full_name' },
          { header: 'Email', key: 'email' },
          { header: 'Rol', key: 'role' },
          { header: 'Ubicación', key: 'location' },
          { header: 'Estado', key: 'status' }
        ],
        data
      });
    } catch (e) {
      console.error('Error exportando PDF:', e);
      notifyError('Error al exportar a PDF', 'Error de exportación');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        {/* Action Bar — Sedes-style */}
        <ActionToolbar
          totalItems={filteredUsers.length}
          label="Usuarios"
          searchComponent={
            <>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
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
                options: filteredLocations.map(loc => ({
                  value: loc.id,
                  label: loc.companies?.name ? `${loc.name} (${loc.companies.name})` : loc.name
                }))
              },
              {
                key: 'role', placeholder: 'TODOS LOS ROLES', wrapperClassName: 'md:min-w-[180px]', options: [
                  { value: 'super_admin', label: 'Super Admin' },
                  { value: 'gerencia', label: 'Gerencia' },
                  { value: 'sistemas', label: 'Sistemas' },
                  { value: 'supervisores', label: 'Supervisores' },
                  { value: 'area_legal', label: 'Área Legal' },
                  { value: 'area_contable', label: 'Área Contable' },
                  { value: 'administradores', label: 'Administradores' },
                  { value: 'personalizado', label: 'Personalizado' },
                ]
              },
              {
                key: 'status', placeholder: 'TODOS LOS ESTADOS', wrapperClassName: 'md:min-w-[160px]', options: [
                  { value: 'active', label: 'Activo' },
                  { value: 'inactive', label: 'Inactivo' },
                ]
              },
            ]}
            values={{ business_type: selectedRubros, location: selectedLocations, role: roleFilter, status: statusFilter }}
            onChange={(key, value) => {
              if (key === 'business_type') {
                const newRubros = value as string[];
                setSelectedRubros(newRubros);
                if (newRubros.length > 0) {
                  const validIds = new Set(locations.filter(l => l.business_type && newRubros.includes(l.business_type)).map(l => l.id));
                  setSelectedLocations(selectedLocations.filter(id => validIds.has(id)));
                }
              } else if (key === 'location') setSelectedLocations(value as string[]);
              else if (key === 'role') setRoleFilter(value as string[]);
              else if (key === 'status') setStatusFilter(value as string[]);
              setCurrentPage(1);
            }}
            onClearAll={() => {
              setSelectedRubros([]);
              setSelectedLocations([]);
              setRoleFilter([]);
              setStatusFilter([]);
              setCurrentPage(1);
            }}
          />

          <ViewToggle viewMode={viewMode} onChange={v => setViewMode(v as 'grid' | 'table')} />

          {canEditValue && (
            <div className="flex gap-2">
              {selectionMode && selectedIds.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-none hover:bg-rose-100 transition-colors border border-rose-200"
                >
                  <Trash2 size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">
                    Eliminar ({selectedIds.length})
                  </span>
                </button>
              )}
              <PrimaryButton icon={Plus} onClick={handleNewUserClick}>
                Nuevo Usuario
              </PrimaryButton>
            </div>
          )}

          <ActionsDropdown
            selectionMode={
              canEditValue
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

        {/* Content */}
        {loading ? (
          <LoadingSpinner label="Cargando usuarios..." />
        ) : viewMode === 'grid' ? (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden mb-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredUsers.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedUsers.map((u) => (
                <div key={u.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-400 transition-all duration-300 flex flex-col group overflow-hidden">
                  <div className="p-6 flex-1">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-xl bg-[#002855] text-white flex items-center justify-center text-sm font-black overflow-hidden flex-shrink-0">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.parentElement!.innerHTML = `<div class="w-full h-full bg-[#002855] text-white flex items-center justify-center text-sm font-black">${u.full_name?.charAt(0) || '?'}</div>`;
                            }} />
                        ) : (u.full_name?.charAt(0) || '?')}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[13px] font-black text-[#002855] uppercase tracking-tight mb-2 truncate">{u.full_name}</h3>
                        <span className={`text-[14px] font-semibold ${getRoleColor(u.role)}`}>
                          {getRoleIcon(u.role)}{getRoleLabel(u.role)}
                        </span>
                      </div>
                      <span className={`text-[14px] font-semibold ${u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{statusLabels[u.status]}</span>
                    </div>
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 p-2 rounded-xl border border-gray-100">
                        <Mail size={14} className="text-blue-500 shrink-0" />
                        <span className="font-bold truncate">{u.email}</span>
                      </div>
                      {u.locations && (
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                          <MapPin size={14} className="text-rose-500" />
                          <span>{u.locations.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex gap-2">
                    {canEditValue && u.role !== 'super_admin' && (
                      <>
                        <button onClick={() => handleLocationAccess(u)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider bg-slate-600 text-white rounded-lg hover:bg-slate-700 shadow-sm">
                          <MapPin size={14} /> Ubicaciones
                        </button>
                        <button onClick={() => handleEditUser(u)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-black tracking-wider bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm">
                          <Edit size={14} /> Editar
                        </button>
                        <button onClick={() => handleDeleteUser(u)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-black tracking-wider bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow-sm">
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col rounded-none">
            {/* Pagination Header */}
            <div className="bg-slate-50/50 border-b border-slate-100 relative z-20">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredUsers.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </div>
            {/* Mobile card view */}
            <div className="block md:hidden divide-y divide-slate-100">
              {paginatedUsers.map((u) => (
                <div key={u.id} className="p-3 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleViewUser(u)}>
                  <div className="flex items-center gap-2">
                    {canEditValue && selectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-black text-slate-800 truncate leading-tight">{u.full_name}</p>
                      <p className="text-[10px] font-semibold text-slate-400 truncate">{u.email}</p>
                    </div>
                    <span className={`shrink-0 text-[14px] font-semibold ${u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {statusLabels[u.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-[14px] font-semibold ${getRoleColor(u.role)}`}>
                      {getRoleLabel(u.role)}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                      <MapPin size={10} className="text-rose-400 shrink-0" />
                      {u.locations?.name || 'Sin asignar'}
                    </span>
                  </div>
                  {canEdit() && u.role !== 'super_admin' && (
                    <div className="flex gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); handleLocationAccess(u); }} className="text-[10px] font-semibold text-blue-600 hover:underline">Accesos</button>
                      <span className="text-slate-300">|</span>
                      <button onClick={(e) => { e.stopPropagation(); handleEditUser(u); }} className="text-[10px] font-semibold text-slate-600 hover:underline">Editar</button>
                      <span className="text-slate-300">|</span>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteUser(u); }} className="text-[10px] font-semibold text-rose-500 hover:underline">Eliminar</button>
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
                    {canEditValue && selectionMode && (
                      <th className="px-4 py-5 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={paginatedUsers.length > 0 && selectedIds.length === paginatedUsers.length}
                          onChange={toggleSelectAll}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                        />
                      </th>
                    )}
                    <TableHead sortable isSorted={sortConfig?.key === 'user'} sortDirection={sortConfig?.direction} onClick={() => handleSort('user')}>USUARIO</TableHead>
                    <TableHead className="hidden lg:table-cell" sortable isSorted={sortConfig?.key === 'email'} sortDirection={sortConfig?.direction} onClick={() => handleSort('email')}>CORREO</TableHead>
                    <TableHead sortable isSorted={sortConfig?.key === 'role'} sortDirection={sortConfig?.direction} onClick={() => handleSort('role')}>ROL</TableHead>
                    <TableHead sortable isSorted={sortConfig?.key === 'status'} sortDirection={sortConfig?.direction} onClick={() => handleSort('status')}>ESTADO</TableHead>
                    <TableHead sortable isSorted={sortConfig?.key === 'location'} sortDirection={sortConfig?.direction} onClick={() => handleSort('location')}>UBICACIÓN</TableHead>
                    <TableHead className="text-center">ACCIONES</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((u) => (
                    <TableRow
                      key={u.id}
                      onDoubleClick={() => handleViewUser(u)}
                      onClick={() => handleViewUser(u)}
                    >
                      {canEditValue && selectionMode && (
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                          />
                        </td>
                      )}
                      <TableCell>
                        <div className="flex flex-col">
                          <TableCellPrimary>{u.full_name}</TableCellPrimary>
                          <TableCellSecondary className="lg:hidden">{u.email}</TableCellSecondary>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <TableCellSecondary>{u.email}</TableCellSecondary>
                      </TableCell>
                      <TableCell>
                        <TableCellBadge className={getRoleColor(u.role)}>
                          {getRoleIcon(u.role)}{getRoleLabel(u.role)}
                        </TableCellBadge>
                      </TableCell>
                      <TableCell>
                        <TableCellBadge className={u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                          {statusLabels[u.status]}
                        </TableCellBadge>
                      </TableCell>
                      <TableCell>
                        {u.locations ? (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <MapPin size={13} className="text-rose-500 shrink-0" />
                            <TableCellSecondary>{u.locations.name}</TableCellSecondary>
                          </div>
                        ) : <TableCellSecondary className="italic">Sin asignar</TableCellSecondary>}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          {canEdit() && u.role !== 'super_admin' && (
                            <>
                              <TableActionButton
                                icon={<MapPin size={14} />}
                                onClick={(e) => { e.stopPropagation(); handleLocationAccess(u); }}
                                title="Administrar Accesos a Ubicaciones"
                              />
                              <TableActionButton
                                icon={<Edit size={14} />}
                                onClick={(e) => { e.stopPropagation(); handleEditUser(u); }}
                                title="Editar Usuario"
                              />
                              <TableActionButton
                                icon={<Trash2 size={14} />}
                                onClick={(e) => { e.stopPropagation(); handleDeleteUser(u); }}
                                title="Eliminar Usuario"
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
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <UserForm editUser={editingUser} onClose={handleCloseForm} onSave={handleSaveUser} />
      )}

      {showLocationAccess && userForLocationAccess && (
        <UserLocationAccess
          userId={userForLocationAccess.id}
          userName={userForLocationAccess.full_name}
          isOpen={showLocationAccess}
          onClose={() => {
            setShowLocationAccess(false);
            setUserForLocationAccess(undefined);
          }}
        />
      )}

      {showDetails && selectedUser && (
        <DetailModal maxWidth="3xl" onClose={() => setShowDetails(false)} closeOnBackdrop>
          <DetailModalHeader>
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 pr-1">
              <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
                {getRoleIcon(selectedUser.role)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xs sm:text-base md:text-[18px] font-normal text-white uppercase tracking-tight leading-snug truncate">
                  {selectedUser.full_name}
                </h2>
                <p className="text-[9px] sm:text-[10px] font-normal text-slate-300 uppercase tracking-wide mt-0.5 flex items-center gap-1.5 truncate">
                  <span>{getRoleLabel(selectedUser.role)}</span>
                  <span>•</span>
                  <span>{selectedUser.email}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDetails(false)}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 text-white/50 hover:text-white hover:bg-white/10 transition-all -mr-1"
              aria-label="Cerrar detalle"
            >
              <X size={20} />
            </button>
          </DetailModalHeader>

          <DetailModalBody>
            <div className="space-y-4">
              {/* Rol y Estado */}
              <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-slate-100">
                <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5">
                  {getRoleIcon(selectedUser.role)} {getRoleLabel(selectedUser.role)}
                </span>
                <span className="text-slate-300">•</span>
                <span className={`text-[11px] font-medium ${selectedUser.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {statusLabels[selectedUser.status]}
                </span>
              </div>

              {/* Grilla principal de 2 columnas bien distribuida */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-3 space-y-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/60 pb-1">
                    Información Personal
                  </p>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">Nombre Completo</span>
                      <p className="text-[11px] font-semibold text-[#002855] uppercase">{selectedUser.full_name}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">Correo Electrónico</span>
                      <p className="text-[11px] font-mono text-slate-700 break-all">{selectedUser.email}</p>
                    </div>
                    {selectedUser.phone && (
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">Teléfono</span>
                        <p className="text-[11px] font-mono text-slate-700">{selectedUser.phone}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 space-y-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/60 pb-1">
                    Asignación y Sistema
                  </p>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">Sede Principal</span>
                      <p className="text-[11px] font-medium text-[#002855] uppercase flex items-center gap-1.5">
                        <MapPin size={12} className="text-rose-500 shrink-0" />
                        {selectedUser.locations?.name || 'Todas / No asignado'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">Permisos de Acceso</span>
                      {selectedUser.role === 'super_admin' ? (
                        <p className="text-[11px] text-slate-700">Acceso Total (Administrador del Sistema)</p>
                      ) : Array.isArray(selectedUser.permissions) && selectedUser.permissions.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Array.from(new Set(selectedUser.permissions.map(getPermissionModuleLabel))).map((label) => (
                            <span key={label} className="text-[14px] font-semibold text-slate-800">
                              {label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-700">
                          Acceso según rol: {getRoleLabel(selectedUser.role)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notas si existen */}
              {selectedUser.notes && (
                <div className="bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notas Adicionales</p>
                  <p className="text-[10px] text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedUser.notes}</p>
                </div>
              )}
            </div>
          </DetailModalBody>

          <StandardModalFooter
            onClose={() => setShowDetails(false)}
            onEdit={canEdit() && selectedUser.role !== 'super_admin' ? () => { setShowDetails(false); handleEditUser(selectedUser); } : undefined}
            editLabel="Editar"
          />
        </DetailModal>
      )}
    </div>
  );
}