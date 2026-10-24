import { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, Search, CheckCircle, XCircle, Trash2, Eye, MapPin, X } from 'lucide-react';
import { FaFilePdf } from 'react-icons/fa6';
import { RiFileExcel2Fill } from 'react-icons/ri';
import { supabase } from '../../../shared/services/supabase';
import RequestForm from '../forms/RequestForm';
import { useAuth } from '../../../app/providers/AuthContext';
import { useNotify } from '../../../shared/hooks/useNotify';
import { useAllowedLocations } from '../../../shared/hooks/useAllowedLocations';
import { emailService } from '../../../shared/services/emailService';
import { Request, RequestStatus, RequestPriority, RequestCategory } from '../../../shared/types/requests.types';
import Pagination from '../../../shared/components/ui/Pagination';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import ActionToolbar from '../../../shared/components/ui/ActionToolbar';
import FilterBar from '../../../shared/components/ui/FilterBar';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  TableCellIcon,
  TableCellPrimary,
  TableCellSecondary,
  TableCellBadge,
  TableActionButton
} from '../../../shared/components/ui/Table';
import DetailModal, {
  DetailModalHeader,
  DetailModalBody,
  StandardModalFooter,
  DetailModalGrid,
  DetailModalSection,
  DetailModalCard,
  DetailModalRow,
} from '../../../shared/components/ui/DetailModal';
import { generatePDF, generateExcel } from '../../../shared/utils/exportUtils';


const statusLabels: Record<RequestStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
};

const statusColors: Record<RequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-800 border-slate-200',
};

const priorityLabels: Record<RequestPriority, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

const priorityColors: Record<RequestPriority, string> = {
  baja: 'bg-slate-100 text-slate-700 border-slate-200',
  media: 'bg-blue-100 text-blue-700 border-blue-200',
  alta: 'bg-orange-100 text-orange-700 border-orange-200',
  urgente: 'bg-red-100 text-red-700 border-red-200',
};

const categoryLabels: Record<RequestCategory, string> = {
  equipamiento: 'Equipamiento',
  mantenimiento: 'Mantenimiento',
  software: 'Software',
  infraestructura: 'Infraestructura',
  otro: 'Otro',
};

export default function RequestsPage() {
  const { canEdit } = useAuth();
  const allowedLocations = useAllowedLocations();
  const { success: notifySuccess, error: notifyError, confirm } = useNotify();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | undefined>();
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  useEffect(() => {
    fetchRequests();
  }, [JSON.stringify(allowedLocations)]);

  const fetchRequests = async () => {
    try {
      setLoading(true);

      // Si el usuario tiene restricción de sedes pero ninguna asignada, no hay nada que mostrar
      if (allowedLocations !== null && allowedLocations.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false });

      // Filtrar por sedes permitidas directamente en la query
      if (allowedLocations !== null && allowedLocations.length > 0) {
        query = query.in('location_id', allowedLocations);
      }

      const { data } = await query;

      const requestsData = data || [];

      // Manual client-side join for user names
      const userIds = [...new Set(requestsData.map((r: any) => r.requester_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', userIds);
          
        if (usersData) {
          const userMap = Object.fromEntries(usersData.map((u: any) => [u.id, u.full_name]));
          requestsData.forEach((r: any) => {
            if (r.requester_id && userMap[r.requester_id]) {
              r.requester = { full_name: userMap[r.requester_id] };
            }
          });
        }
      }

      // Manual client-side join for locations
      const locationIds = [...new Set(requestsData.map((r: any) => r.location_id).filter(Boolean))];
      if (locationIds.length > 0) {
        const { data: locationsData } = await supabase
          .from('locations')
          .select('id, name')
          .in('id', locationIds);
          
        if (locationsData) {
          const locationMap = Object.fromEntries(locationsData.map((l: any) => [l.id, l.name]));
          requestsData.forEach((r: any) => {
            if (r.location_id && locationMap[r.location_id]) {
              r.location = { name: locationMap[r.location_id] };
            }
          });
        }
      }

      setRequests(requestsData);
    } catch (err: any) {
      console.error('Error loading requests:', err);
      notifyError('Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  };


  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getDisplayName = (name?: string) => {
    if (!name) return '';
    if (name.includes('@')) {
      const parts = name.split('@')[0].split('.');
      return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return name;
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      const requesterName = getDisplayName(request.requester?.full_name || request.requester_name);
      
      const matchesSearch =
        request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        requesterName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(request.status);
      const matchesPriority = priorityFilter.length === 0 || priorityFilter.includes(request.priority);
      const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(request.category);

      return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
    });
  }, [requests, searchTerm, statusFilter, priorityFilter, categoryFilter]);

  const sortedRequests = useMemo(() => {
    if (!sortConfig) return filteredRequests;

    return [...filteredRequests].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof Request];
      const bValue = b[sortConfig.key as keyof Request];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const result = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [filteredRequests, sortConfig]);

  const totalPages = Math.ceil(sortedRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = sortedRequests.slice(startIndex, startIndex + itemsPerPage);

  const handleApprove = async (request: Request) => {
    const comments = prompt('Comentarios de aprobación (opcional):');
    
    try {
      const { error } = await supabase
        .from('requests')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (error) throw error;

      // Enviar correo de aprobación
      if (request.requester_email) {
        await emailService.sendRequestDecisionNotification({
          to: [request.requester_email],
          requestTitle: request.title,
          decision: 'approved',
          decisionMaker: (canEdit() ? 'Administrador' : 'Usuario'),
          comments: comments || undefined,
        });
      }

      await fetchRequests();
      notifySuccess('Solicitud aprobada correctamente');
    } catch (err: any) {
      notifyError('Error al aprobar solicitud: ' + err.message);
    }
  };

  const handleReject = async (request: Request) => {
    const comments = prompt('Comentarios de rechazo (opcional):');
    
    try {
      const { error } = await supabase
        .from('requests')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (error) throw error;

      // Enviar correo de rechazo
      if (request.requester_email) {
        await emailService.sendRequestDecisionNotification({
          to: [request.requester_email],
          requestTitle: request.title,
          decision: 'rejected',
          decisionMaker: (canEdit() ? 'Administrador' : 'Usuario'),
          comments: comments || undefined,
        });
      }

      await fetchRequests();
      notifySuccess('Solicitud rechazada correctamente');
    } catch (err: any) {
      notifyError('Error al rechazar solicitud: ' + err.message);
    }
  };

  const handleDelete = async (request: Request) => {
    const confirmed = await confirm(`¿Estás seguro de eliminar la solicitud "${request.title}"?`, 'Confirmar Eliminación');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('requests').delete().eq('id', request.id);
      if (error) throw error;

      await fetchRequests();
      notifySuccess('Solicitud eliminada correctamente');
    } catch (err: any) {
      notifyError('Error al eliminar solicitud: ' + err.message);
    }
  };

  const handleView = (request: Request) => {
    setSelectedRequest(request);
    setShowDetails(true);
  };

  const handleExportPDF = () => {
    const data = sortedRequests.map((r, i) => ({
      nro: i + 1,
      titulo: r.title,
      categoria: categoryLabels[r.category] || r.category,
      prioridad: priorityLabels[r.priority] || r.priority,
      estado: statusLabels[r.status] || r.status,
      solicitante: getDisplayName(r.requester?.full_name || r.requester_name) || 'N/A',
      departamento: r.department || 'N/A',
      sede: r.location?.name || 'N/A',
      costo: r.estimated_cost ? `S/ ${r.estimated_cost.toFixed(2)}` : 'N/A',
      fecha: new Date(r.created_at).toLocaleDateString('es-PE'),
    }));

    generatePDF({
      title: 'Reporte de Solicitudes',
      filename: 'Solicitudes',
      columns: [
        { header: 'N°', key: 'nro' },
        { header: 'Título', key: 'titulo' },
        { header: 'Categoría', key: 'categoria' },
        { header: 'Prioridad', key: 'prioridad' },
        { header: 'Estado', key: 'estado' },
        { header: 'Solicitante', key: 'solicitante' },
        { header: 'Dpto.', key: 'departamento' },
        { header: 'Sede', key: 'sede' },
        { header: 'Costo Est.', key: 'costo' },
        { header: 'Fecha', key: 'fecha' },
      ],
      data,
    });
  };

  const handleExportExcel = async () => {
    const data = sortedRequests.map((r, i) => ({
      nro: i + 1,
      titulo: r.title,
      descripcion: r.description || '',
      categoria: categoryLabels[r.category] || r.category,
      prioridad: priorityLabels[r.priority] || r.priority,
      estado: statusLabels[r.status] || r.status,
      solicitante: getDisplayName(r.requester?.full_name || r.requester_name) || 'N/A',
      correo: r.requester_email || 'N/A',
      departamento: r.department || 'N/A',
      sede: r.location?.name || 'N/A',
      costo: r.estimated_cost || 0,
      limite: r.due_date ? new Date(r.due_date).toLocaleDateString('es-PE') : 'N/A',
      fecha: new Date(r.created_at).toLocaleString('es-PE'),
    }));

    await generateExcel({
      title: 'Reporte de Solicitudes',
      filename: 'Solicitudes',
      columns: [
        { header: 'N°', key: 'nro', width: 6 },
        { header: 'Título', key: 'titulo', width: 35 },
        { header: 'Descripción', key: 'descripcion', width: 50 },
        { header: 'Categoría', key: 'categoria', width: 18 },
        { header: 'Prioridad', key: 'prioridad', width: 15 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Solicitante', key: 'solicitante', width: 25 },
        { header: 'Correo', key: 'correo', width: 25 },
        { header: 'Departamento', key: 'departamento', width: 20 },
        { header: 'Sede', key: 'sede', width: 20 },
        { header: 'Costo Estimado (S/)', key: 'costo', width: 18 },
        { header: 'Fecha Límite', key: 'limite', width: 18 },
        { header: 'Fecha Registro', key: 'fecha', width: 22 },
      ],
      data,
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc]">
      <div className="p-6 space-y-6">
        {/* Action Bar */}
        <ActionToolbar
          totalItems={sortedRequests.length}
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
                key: 'status', 
                placeholder: 'TODOS LOS ESTADOS', 
                options: Object.entries(statusLabels).map(([key, label]) => ({ value: key, label })) 
              },
              { 
                key: 'priority', 
                placeholder: 'TODAS LAS PRIORIDADES', 
                options: Object.entries(priorityLabels).map(([key, label]) => ({ value: key, label })) 
              },
              { 
                key: 'category', 
                placeholder: 'TODAS LAS CATEGORÍAS', 
                options: Object.entries(categoryLabels).map(([key, label]) => ({ value: key, label })) 
              },
            ]}
            values={{ status: statusFilter, priority: priorityFilter, category: categoryFilter }}
            onChange={(key, value) => {
              if (key === 'status') setStatusFilter(value as string[]);
              else if (key === 'priority') setPriorityFilter(value as string[]);
              else if (key === 'category') setCategoryFilter(value as string[]);
              setCurrentPage(1);
            }}
            onClearAll={() => {
              setStatusFilter([]);
              setPriorityFilter([]);
              setCategoryFilter([]);
              setCurrentPage(1);
            }}
          />

          <button
            onClick={handleExportExcel}
            disabled={sortedRequests.length === 0}
            className="group flex items-center justify-center w-10 h-10 bg-white text-slate-400 border border-slate-200 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm disabled:opacity-50"
            title="Exportar a Excel"
          >
            <RiFileExcel2Fill size={20} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </button>

          <button
            onClick={handleExportPDF}
            disabled={sortedRequests.length === 0}
            className="group flex items-center justify-center w-10 h-10 bg-white text-slate-400 border border-slate-200 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 transition-all shadow-sm disabled:opacity-50"
            title="Exportar a PDF"
          >
            <FaFilePdf size={20} className="text-slate-400 group-hover:text-rose-600 transition-colors" />
          </button>

          {canEdit() && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-[#002855] text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
            >
              <Plus size={14} />
              Nueva Solicitud
            </button>
          )}
        </ActionToolbar>

        {/* Table */}
        {loading ? (
          <LoadingSpinner label="Cargando solicitudes..." />
        ) : paginatedRequests.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto mb-4 text-[#002855] opacity-20" />
            <p className="text-[#002855] font-black text-xs tracking-widest mb-2">Sin solicitudes</p>
            <p className="text-slate-400 text-[10px] font-bold tracking-tight">
              {searchTerm || statusFilter.length > 0 || priorityFilter.length > 0 || categoryFilter.length > 0 
                ? 'Intenta ajustando los filtros' 
                : 'Aún no se han creado solicitudes'}
            </p>
          </div>
        ) : (
          <>
          <div className="hidden md:flex bg-white border border-slate-200 shadow-sm overflow-hidden flex-col rounded-none">
            <div className="bg-slate-50/50 border-b border-slate-100 relative z-20">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={sortedRequests.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead sortable isSorted={sortConfig?.key === 'title'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('title')}>
                      Título
                    </TableHead>
                    <TableHead sortable isSorted={sortConfig?.key === 'category'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('category')}>
                      Categoría
                    </TableHead>
                    <TableHead sortable isSorted={sortConfig?.key === 'priority'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('priority')}>
                      Prioridad
                    </TableHead>
                    <TableHead sortable isSorted={sortConfig?.key === 'status'} sortDirection={sortConfig?.direction || 'asc'} onClick={() => handleSort('status')}>
                      Estado
                    </TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <TableCellIcon icon={<FileText size={16} />} />
                          <div className="flex flex-col">
                            <TableCellPrimary>{request.title}</TableCellPrimary>
                            <TableCellSecondary>
                              {request.department || 'Sin departamento'}
                            </TableCellSecondary>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TableCellPrimary>
                          {categoryLabels[request.category]}
                        </TableCellPrimary>
                      </TableCell>
                      <TableCell>
                        <TableCellBadge className={priorityColors[request.priority]}>
                          {priorityLabels[request.priority]}
                        </TableCellBadge>
                      </TableCell>
                      <TableCell>
                        <TableCellBadge className={statusColors[request.status]}>
                          {statusLabels[request.status]}
                        </TableCellBadge>
                      </TableCell>
                      <TableCell>
                        <TableCellPrimary>
                          {(() => {
                            const name = request.requester?.full_name || request.requester_name;
                            if (!name) return 'Desconocido';
                            if (name.includes('@')) {
                              const parts = name.split('@')[0].split('.');
                              return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
                            }
                            return name;
                          })()}
                        </TableCellPrimary>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <MapPin size={14} className="text-rose-500 shrink-0" />
                          <TableCellSecondary>
                            {request.location?.name || 'No especificada'}
                          </TableCellSecondary>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TableCellSecondary>
                          {new Date(request.created_at).toLocaleDateString('es-PE')}
                        </TableCellSecondary>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <TableActionButton
                            icon={<Eye size={14} />}
                            onClick={() => handleView(request)}
                            title="Ver detalles"
                          />
                          {canEdit() && request.status === 'pending' && (
                            <>
                              <TableActionButton
                                icon={<CheckCircle size={14} className="text-emerald-600" />}
                                onClick={() => handleApprove(request)}
                                title="Aprobar"
                              />
                              <TableActionButton
                                icon={<XCircle size={14} className="text-rose-600" />}
                                onClick={() => handleReject(request)}
                                title="Rechazar"
                              />
                            </>
                          )}
                          {canEdit() && (
                            <TableActionButton
                              icon={<Trash2 size={14} />}
                              onClick={() => handleDelete(request)}
                              title="Eliminar"
                              variant="danger"
                            />
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
          <div className="md:hidden space-y-3">
            {paginatedRequests.map((request) => (
              <div key={request.id} className="bg-white border border-slate-200 p-4 active:bg-slate-50 transition-all cursor-pointer" onClick={() => handleView(request)}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black text-slate-800 truncate leading-tight">{request.title}</p>
                    <p className="text-[10px] font-semibold text-slate-400 truncate">{request.department || 'Sin departamento'}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 text-[9px] font-semibold border ${request.status === 'pending' ? 'text-amber-700 bg-amber-50 border-amber-200' : request.status === 'approved' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
                    {statusLabels[request.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`px-2 py-0.5 text-[9px] font-semibold border ${priorityColors[request.priority]}`}>
                    {priorityLabels[request.priority]}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-500">{categoryLabels[request.category]}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-2">
                  <MapPin size={10} className="text-rose-400 shrink-0" />
                  <span className="truncate">{request.location?.name || 'No especificada'}</span>
                  <span className="ml-auto font-mono text-slate-400">{new Date(request.created_at).toLocaleDateString('es-PE')}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-semibold text-slate-500 truncate">
                    {(() => {
                      const name = request.requester?.full_name || request.requester_name;
                      if (!name) return 'Desconocido';
                      if (name.includes('@')) return name.split('@')[0].split('.').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
                      return name;
                    })()}
                  </span>
                </div>
                <div className="flex gap-1.5 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleView(request)} className="text-[10px] font-bold text-slate-600 hover:underline bg-slate-50 px-2 py-1 rounded-sm w-full text-center">Ver</button>
                  {canEdit() && request.status === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(request)} className="text-[10px] font-bold text-emerald-600 hover:underline bg-emerald-50 px-2 py-1 rounded-sm w-full text-center">Aprobar</button>
                      <button onClick={() => handleReject(request)} className="text-[10px] font-bold text-rose-600 hover:underline bg-rose-50 px-2 py-1 rounded-sm w-full text-center">Rechazar</button>
                    </>
                  )}
                  {canEdit() && (
                    <button onClick={() => handleDelete(request)} className="text-[10px] font-bold text-slate-500 hover:text-rose-600 hover:underline bg-slate-50 hover:bg-rose-50 px-2 py-1 rounded-sm w-full text-center">Eliminar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-none shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <RequestForm onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); fetchRequests(); }} />
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selectedRequest && (
        <DetailModal maxWidth="5xl" onClose={() => { setShowDetails(false); setSelectedRequest(undefined); }} closeOnBackdrop>
          <DetailModalHeader>
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 pr-1">
              <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <FileText size={20} className="sm:size-24" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-normal text-white tracking-tight leading-tight truncate">
                  {selectedRequest.title}
                </h2>
                <p className="text-[10px] sm:text-xs text-blue-200 font-normal mt-0.5 truncate">
                  {categoryLabels[selectedRequest.category]} • {priorityLabels[selectedRequest.priority]}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setShowDetails(false); setSelectedRequest(undefined); }}
              className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all"
            >
              <X size={22} />
            </button>
          </DetailModalHeader>

          <DetailModalBody>
            <DetailModalGrid layout="stack-until-xl">

              <DetailModalSection title="Información General">
                <div className="space-y-2.5 sm:space-y-3">
                  <DetailModalCard className="space-y-2.5 sm:space-y-3">
                    <DetailModalRow label="Estado">
                      <span className={`inline-block px-2.5 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[9px] font-normal tracking-widest border ${statusColors[selectedRequest.status]}`}>
                        {statusLabels[selectedRequest.status]}
                      </span>
                    </DetailModalRow>
                    <DetailModalRow label="Categoría">
                      <span className="text-[10px] sm:text-[11px] font-normal text-[#002855] uppercase">
                        {categoryLabels[selectedRequest.category]}
                      </span>
                    </DetailModalRow>
                    <DetailModalRow label="Prioridad">
                      <span className="text-[10px] sm:text-[11px] font-normal text-slate-600 uppercase">
                        {priorityLabels[selectedRequest.priority]}
                      </span>
                    </DetailModalRow>
                  </DetailModalCard>

                  <DetailModalCard className="space-y-2.5 sm:space-y-3">
                    <DetailModalRow label="Fecha de Creación">
                      <span className="text-[10px] sm:text-[11px] font-normal text-slate-600">
                        {new Date(selectedRequest.created_at).toLocaleDateString('es-PE')}
                      </span>
                    </DetailModalRow>
                    <DetailModalRow label="Última Actualización">
                      <span className="text-[10px] sm:text-[11px] font-normal text-slate-600">
                        {new Date(selectedRequest.updated_at).toLocaleDateString('es-PE')}
                      </span>
                    </DetailModalRow>
                  </DetailModalCard>
                </div>
              </DetailModalSection>

              <DetailModalSection title="Solicitante y Ubicación">
                <DetailModalCard>
                  <DetailModalRow label="Solicitante">
                    <span className="text-[10px] sm:text-[11px] font-normal text-[#002855]">
                      {(() => {
                        const name = selectedRequest.requester?.full_name || selectedRequest.requester_name;
                        if (!name) return 'Desconocido';
                        if (name.includes('@')) {
                          const parts = name.split('@')[0].split('.');
                          return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
                        }
                        return name;
                      })()}
                    </span>
                  </DetailModalRow>
                  {selectedRequest.requester_email && (
                    <DetailModalRow label="Correo del Solicitante">
                      <span className="text-[10px] sm:text-[11px] font-normal text-slate-600">
                        {selectedRequest.requester_email}
                      </span>
                    </DetailModalRow>
                  )}
                  <DetailModalRow label="Departamento">
                    <span className="text-[10px] sm:text-[11px] font-normal text-slate-600">
                      {selectedRequest.department || 'No especificado'}
                    </span>
                  </DetailModalRow>
                  <DetailModalRow label="Sede">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-rose-500" />
                      <span className="text-[10px] sm:text-[11px] font-normal text-slate-600">
                        {selectedRequest.location?.name || 'No especificada'}
                      </span>
                    </div>
                  </DetailModalRow>
                </DetailModalCard>
              </DetailModalSection>

              <DetailModalSection title="Detalles Adicionales">
                <DetailModalCard>
                  <DetailModalRow label="Fecha Límite">
                    <span className="text-[10px] sm:text-[11px] font-normal text-slate-600">
                      {selectedRequest.due_date ? new Date(selectedRequest.due_date).toLocaleDateString('es-PE') : 'No especificada'}
                    </span>
                  </DetailModalRow>
                  {selectedRequest.estimated_cost && (
                    <DetailModalRow label="Costo Estimado">
                      <span className="text-[10px] sm:text-[11px] font-normal text-[#002855]">
                        S/ {selectedRequest.estimated_cost.toFixed(2)}
                      </span>
                    </DetailModalRow>
                  )}
                </DetailModalCard>
              </DetailModalSection>

              <DetailModalSection title="Descripción">
                <DetailModalCard>
                  <p className="text-[10px] sm:text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedRequest.description}
                  </p>
                </DetailModalCard>
              </DetailModalSection>

            </DetailModalGrid>
          </DetailModalBody>

          <StandardModalFooter
            onClose={() => { setShowDetails(false); setSelectedRequest(undefined); }}
            onEdit={canEdit() && selectedRequest.status === 'pending' ? () => { setShowDetails(false); /* TODO: Implement edit */ } : undefined}
            editLabel="Editar"
          />
        </DetailModal>
      )}
    </div>
  );
}
