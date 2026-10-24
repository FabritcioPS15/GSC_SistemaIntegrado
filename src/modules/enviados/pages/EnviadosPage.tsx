import { useState, useEffect, useMemo } from 'react';
import { Edit, Trash2, MapPin, Package, Truck, X, Calendar, Plus, LayoutGrid, List, Search, Send } from 'lucide-react';
import { useHeaderVisible } from '../../../shared/hooks/useHeaderVisible';
import { supabase, AssetWithDetails, Location } from '../../../shared/services/supabase';
import ModalOverlay from '../../../shared/components/ui/ModalOverlay';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import ShipmentForm from '../forms/ShipmentForm';
import { useAuth } from '../../../app/providers/AuthContext';
import { useNotify } from '../../../shared/hooks/useNotify';
import Pagination from '../../../shared/components/ui/Pagination';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../shared/components/ui/Table';

type Shipment = {
  id: string;
  asset_id: string;
  from_location_id?: string;
  to_location_id: string;
  shipment_date: string;
  shipped_by?: string;
  received_by?: string;
  tracking_number?: string;
  carrier?: string;
  status: 'shipped' | 'in_transit' | 'delivered' | 'returned';
  notes?: string;
  created_at: string;
  updated_at: string;
  assets?: AssetWithDetails;
  from_location?: Location;
  to_location?: Location;
};

type EnviadosProps = {
  locationFilter?: string;
};

export default function Enviados({ locationFilter }: EnviadosProps) {
  const { canEdit } = useAuth();
  const { confirm, error: notifyError, success: notifySuccess } = useNotify();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingShipment, setEditingShipment] = useState<Shipment | undefined>();
  const [viewingShipment, setViewingShipment] = useState<Shipment | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toLocationIdFilter, setToLocationIdFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const isHeaderVisible = useHeaderVisible(localStorage.getItem('header_pinned') === 'true');

  void isHeaderVisible;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchShipments(), fetchLocations()]);
    setLoading(false);
  };

  const fetchShipments = async () => {
    const { data } = await supabase
      .from('shipments')
      .select('*, assets(*, asset_types(*), locations(*)), from_location:locations!from_location_id(*), to_location:locations!to_location_id(*)')
      .order('created_at', { ascending: false });
    if (data) setShipments(data as Shipment[]);
  };

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .order('name');
    if (data) setLocations(data);
  };

  const handleEditShipment = (shipment: Shipment) => {
    setEditingShipment(shipment);
    setView('form');
  };

  const handleViewShipment = (shipment: Shipment) => {
    setViewingShipment(shipment);
  };

  const handleDeleteShipment = async (shipment: Shipment) => {
    const confirmed = await confirm(`¿Estás seguro de que quieres eliminar el envío del activo "${shipment.assets?.brand} ${shipment.assets?.model}"?`, 'Eliminar Envío');
    if (confirmed) {
      try {
        const { error } = await supabase
          .from('shipments')
          .delete()
          .eq('id', shipment.id);

        if (error) {
          console.error('Error al eliminar envío:', error);
          notifyError('Error al eliminar el envío');
        } else {
          await fetchShipments();
          notifySuccess('Envío eliminado correctamente');
        }
      } catch (err) {
        console.error('Error al eliminar envío:', err);
        notifyError('Error al eliminar el envío');
      }
    }
  };

  const handleSaveShipment = () => {
    setView('list');
    setEditingShipment(undefined);
    fetchShipments();
  };

  const handleCloseForm = () => {
    setView('list');
    setEditingShipment(undefined);
  };

  const filteredShipments = useMemo(() => {
    return shipments.filter(shipment => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        shipment.assets?.brand?.toLowerCase().includes(q) ||
        shipment.assets?.model?.toLowerCase().includes(q) ||
        shipment.tracking_number?.toLowerCase().includes(q) ||
        shipment.carrier?.toLowerCase().includes(q) ||
        shipment.shipped_by?.toLowerCase().includes(q) ||
        shipment.received_by?.toLowerCase().includes(q);

      const matchesStatus = !statusFilter || shipment.status === statusFilter;

      let matchesLocation = true;
      if (locationFilter) {
        if (locationFilter === 'sent-lima') {
          if (shipment.to_location?.region) {
            matchesLocation = shipment.to_location.region === 'lima';
          } else {
            matchesLocation = shipment.to_location?.name?.toLowerCase().includes('lima') || false;
          }
        } else if (locationFilter === 'sent-provincias') {
          if (shipment.to_location?.region) {
            matchesLocation = shipment.to_location.region === 'provincia';
          } else {
            matchesLocation = !!(shipment.to_location?.name && !shipment.to_location.name.toLowerCase().includes('lima'));
          }
        }
      }

      const matchesToLocation = !toLocationIdFilter || shipment.to_location_id === toLocationIdFilter;

      return matchesSearch && matchesStatus && matchesLocation && matchesToLocation;
    });
  }, [shipments, searchTerm, statusFilter, locationFilter, toLocationIdFilter]);

  const totalPages = Math.ceil(filteredShipments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedShipments = filteredShipments.slice(startIndex, startIndex + itemsPerPage);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setToLocationIdFilter('');
    setCurrentPage(1);
  };

  const statusLabels: Record<Shipment['status'], string> = {
    shipped: 'Enviado',
    in_transit: 'En Tránsito',
    delivered: 'Entregado',
    returned: 'Devuelto',
  };

  const statusColorClasses: Record<Shipment['status'], string> = {
    shipped: 'bg-blue-100 text-blue-700',
    in_transit: 'bg-blue-100 text-blue-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    returned: 'bg-rose-100 text-rose-700',
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'shipped': return Truck;
      case 'in_transit': return Truck;
      case 'delivered': return Package;
      case 'returned': return Package;
      default: return Truck;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] font-sans">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-4 md:px-8 xl:px-12 py-8 space-y-4">
          {view === 'list' ? (
            <>
              {/* Action Bar — Sedes-style */}
              <div className="bg-white border border-slate-200 rounded-none p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4 shadow-sm hover:shadow-md transition-all relative">
                <div className="absolute -top-3 -left-3">
                  <div className="bg-[#002855] text-white px-3 py-1 text-[10px] font-black uppercase tracking-tight shadow-xl">
                    {filteredShipments.length} Envíos
                  </div>
                </div>

                {/* Search */}
                <div className="flex-1 relative group/search">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-12 pr-4 py-3 text-[12px] font-black text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 tracking-[0.1em]"
                  />
                </div>

                {/* Filters + Toggle */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 hover:border-[#002855]/30 text-[10px] font-black text-[#002855] uppercase tracking-widest min-w-[220px]">
                    <MapPin size={14} className="text-rose-500" />
                    <select
                      value={toLocationIdFilter}
                      onChange={e => { setToLocationIdFilter(e.target.value); setCurrentPage(1); }}
                      className="bg-transparent outline-none cursor-pointer flex-1"
                    >
                      <option value="">TODOS LOS DESTINOS</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>

                  <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    className="px-4 py-3 bg-slate-50 border border-slate-200 hover:border-[#002855]/30 text-[10px] font-black text-[#002855] tracking-widest outline-none transition-all min-w-[150px] appearance-none cursor-pointer"
                  >
                    <option value="">TODOS LOS ESTADOS</option>
                    <option value="shipped">ENVIADO</option>
                    <option value="in_transit">EN TRÁNSITO</option>
                    <option value="delivered">ENTREGADO</option>
                    <option value="returned">DEVUELTO</option>
                  </select>

                  {(searchTerm || statusFilter || toLocationIdFilter) && (
                    <button
                      onClick={clearFilters}
                      className="px-4 py-3 text-[#002855] hover:bg-slate-100 transition-colors"
                      title="Limpiar filtros"
                    >
                      <X size={16} />
                    </button>
                  )}

                  <div className="flex bg-slate-100 p-1 border border-slate-200">
                    <button onClick={() => setViewMode('grid')} className={`p-1.5 transition-all ${viewMode === 'grid' ? 'bg-white text-[#002855] shadow-sm' : 'text-slate-400'}`} title="Vista Cuadrícula"><LayoutGrid size={16} /></button>
                    <button onClick={() => setViewMode('list')} className={`p-1.5 transition-all ${viewMode === 'list' ? 'bg-white text-[#002855] shadow-sm' : 'text-slate-400'}`} title="Vista Tabla"><List size={16} /></button>
                  </div>

                  {canEdit() && (
                    <button
                      onClick={() => { setEditingShipment(undefined); setView('form'); }}
                      className="flex items-center gap-2 px-4 py-3 bg-[#002855] text-white text-[10px] font-normal uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
                    >
                      <Plus size={14} /> Nuevo
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <LoadingSpinner label="Cargando envíos..." />
              ) : filteredShipments.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-none p-20 text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Truck size={40} className="text-slate-300" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">No se encontraron envíos</h3>
                  <p className="text-gray-500 max-w-xs mx-auto mt-2">Prueba ajustando los filtros o realiza un nuevo registro.</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden mb-4">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={filteredShipments.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={setItemsPerPage}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedShipments.map((shipment) => (
                      <div key={shipment.id} className="bg-white rounded-none shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-400/50 transition-all duration-300 overflow-hidden group flex flex-col">
                        <div className="p-6 flex-1">
                          <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-none flex items-center justify-center bg-slate-50">
                                {(() => {
                                  const Icon = getStatusIcon(shipment.status);
                                  return <Icon className="text-slate-400" size={24} />;
                                })()}
                              </div>
                              <div>
                                <span className={`text-[14px] font-semibold mb-1 ${statusColorClasses[shipment.status]}`}>
                                  {statusLabels[shipment.status]}
                                </span>
                                <h3 className="text-sm font-black text-[#002855] uppercase leading-tight truncate max-w-[150px]">
                                  {shipment.assets?.brand} {shipment.assets?.model}
                                </h3>
                              </div>
                            </div>
                            {canEdit() && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditShipment(shipment)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"><Edit size={16} /></button>
                                <button onClick={() => handleDeleteShipment(shipment)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"><Trash2 size={16} /></button>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-slate-50 p-4 rounded-none border border-slate-100 font-sans">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Origen</p>
                              <div className="flex items-center gap-2">
                                <MapPin size={12} className="text-slate-400 shrink-0" />
                                <span className="text-[11px] font-black text-[#002855] uppercase truncate">{shipment.from_location?.name || 'STOCK CENTRAL'}</span>
                              </div>
                            </div>
                            <div className="bg-blue-50/30 p-4 rounded-none border border-blue-100/50 font-sans">
                              <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-2">Destino</p>
                              <div className="flex items-center gap-2">
                                <MapPin size={12} className="text-blue-500 shrink-0" />
                                <span className="text-[11px] font-black text-blue-900 uppercase truncate">{shipment.to_location?.name}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Fecha</p>
                              <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">{new Date(String(shipment.shipment_date).includes('T') ? String(shipment.shipment_date) : `${shipment.shipment_date}T12:00:00`).toLocaleDateString()}</span>
                            </div>
                            {shipment.tracking_number && (
                              <div className="flex flex-col">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Guía</p>
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">{shipment.tracking_number}</span>
                              </div>
                            )}
                          </div>
                          <button onClick={() => handleViewShipment(shipment)} className="flex items-center gap-2 px-3 py-2 bg-white text-[#002855] border border-slate-200 text-[10px] font-black tracking-wider hover:bg-slate-50 transition-all shadow-sm">DETALLES</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden flex flex-col">
                  {/* Pagination Header */}
                  <div className="bg-slate-50 border-b border-slate-200 relative z-20">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={filteredShipments.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={setItemsPerPage}
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <tr>
                          <TableHead>Activo</TableHead>
                          <TableHead>Ruta</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Logística</TableHead>
                          <TableHead className="text-center">Acciones</TableHead>
                        </tr>
                      </TableHeader>
                      <TableBody>
                        {paginatedShipments.map((shipment) => (
                          <TableRow key={shipment.id} className="cursor-pointer" onClick={() => handleViewShipment(shipment)}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 flex items-center justify-center shadow-sm transition-all duration-300 bg-slate-50 group-hover/row:bg-[#002855] group-hover/row:text-white">
                                  {(() => { const Icon = getStatusIcon(shipment.status); return <Icon size={18} />; })()}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[13px] font-black text-[#002855] leading-tight">{shipment.assets?.brand} {shipment.assets?.model}</span>
                                  <span className="text-[11px] font-semibold text-slate-400 tracking-wider mt-1">{shipment.assets?.asset_types?.name}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-tighter shrink-0 w-16">Origen:</span>
                                  <span className="text-[11px] font-black text-[#002855] uppercase truncate">{shipment.from_location?.name || 'STOCK CENTRAL'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                  <span className="text-[11px] font-black text-blue-400 uppercase tracking-tighter shrink-0 w-16">Destino:</span>
                                  <span className="text-[11px] font-black text-blue-900 uppercase truncate">{shipment.to_location?.name}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={`text-[14px] font-semibold ${statusColorClasses[shipment.status]}`}>
                                {statusLabels[shipment.status]}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-[13px] font-black text-slate-600 uppercase tabular-nums">{new Date(String(shipment.shipment_date).includes('T') ? String(shipment.shipment_date) : `${shipment.shipment_date}T12:00:00`).toLocaleDateString()}</span>
                                <span className="text-[11px] font-semibold text-slate-400 tracking-wider mt-1">{shipment.tracking_number || 'Sin Guía'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                {canEdit() && (
                                  <>
                                    <button onClick={(e) => { e.stopPropagation(); handleEditShipment(shipment); }} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-[#002855] hover:bg-slate-100 bg-white rounded-none border border-slate-200 transition-all shadow-sm" title="Editar"><Edit size={14} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteShipment(shipment); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-white rounded-none border border-slate-200 transition-all shadow-sm" title="Eliminar"><Trash2 size={14} /></button>
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
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-black text-[#002855] uppercase tracking-tight">Registro de Envío</h3>
                  <p className="text-[12px] font-black text-[#002855] tracking-[0.2em] mt-1">Ingresa los datos logísticos del transporte</p>
                </div>
                <button onClick={handleCloseForm} className="p-2 hover:bg-slate-100 rounded-none transition-colors"><X size={20} className="text-slate-400" /></button>
              </div>
              <div className="p-6 lg:p-10">
                <ShipmentForm editShipment={editingShipment} onSave={handleSaveShipment} onClose={handleCloseForm} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Detalle */}
      {viewingShipment && (
        <ModalOverlay className="bg-slate-900/40 backdrop-blur-sm">
          <div
            className="bg-white w-full h-full md:h-[90vh] max-w-full sm:max-w-2xl rounded-none shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-900 px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-6">
                <div className="w-9 h-9 bg-white/10 rounded-none flex items-center justify-center border border-white/20">
                  <Send size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-normal text-white uppercase tracking-[0.2em] leading-tight">Ficha de Envío</h2>
                  <p className={`text-[10px] font-normal uppercase tracking-widest mt-0.5 ${statusColorClasses[viewingShipment.status]}`}>{statusLabels[viewingShipment.status]}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingShipment(undefined)}
                className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-none transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {/* Activo e Información General */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 bg-[#002855] rounded-none" />
                    <h3 className="text-[10px] font-normal text-gray-400 uppercase tracking-[0.2em]">Activo Trasladado</h3>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-none border border-gray-100 font-sans">
                    <p className="text-[12px] font-normal text-[#002855] tracking-[0.2em] mb-2">Marca y Modelo</p>
                    <p className="text-lg font-normal text-[#002855] uppercase">{viewingShipment.assets?.brand} {viewingShipment.assets?.model}</p>
                    <div className="mt-4 flex items-center gap-2 font-normal text-[10px] uppercase text-slate-500">
                      <Package size={14} />
                      {viewingShipment.assets?.asset_types?.name}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 bg-emerald-500 rounded-none" />
                    <h3 className="text-[10px] font-normal text-gray-400 uppercase tracking-[0.2em]">Tiempos de Entrega</h3>
                  </div>
                  <div className="bg-emerald-50/30 p-6 rounded-none border border-emerald-100/50 font-sans">
                    <div>
                      <p className="text-[10px] font-normal text-emerald-600/60 uppercase tracking-widest mb-2">Fecha de Envío</p>
                      <div className="flex items-center gap-2 text-sm font-normal text-emerald-900 uppercase">
                        <Calendar size={16} />
                        {new Date(String(viewingShipment.shipment_date).includes('T') ? String(viewingShipment.shipment_date) : `${viewingShipment.shipment_date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ruta y Logística */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-rose-500 rounded-none" />
                  <h3 className="text-[10px] font-normal text-gray-400 uppercase tracking-[0.2em]">Ruta y Logística</h3>
                </div>
                <div className="relative">
                  <div className="absolute left-6 top-10 bottom-10 w-0.5 border-l-2 border-dashed border-slate-200" />
                  <div className="space-y-8 relative">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-none bg-white border-2 border-slate-100 flex items-center justify-center z-10 shadow-sm">
                        <MapPin size={20} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-[12px] font-normal text-[#002855] tracking-[0.2em]">Punto de Origen</p>
                        <p className="text-sm font-normal text-slate-700 uppercase">{viewingShipment.from_location?.name || 'STOCK CENTRAL'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-none bg-[#002855] flex items-center justify-center z-10 shadow-lg">
                        <MapPin size={20} className="text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-normal text-blue-400 uppercase tracking-widest">Punto de Destino</p>
                        <p className="text-sm font-normal text-[#002855] uppercase">{viewingShipment.to_location?.name}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Información del Transportista */}
              <div className="bg-slate-50 p-6 rounded-none border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-6 font-sans">
                <div>
                  <p className="text-[12px] font-normal text-[#002855] tracking-[0.2em] mb-1">Guía / Tracking</p>
                  <p className="text-xs font-normal text-slate-900 uppercase">{viewingShipment.tracking_number || "NO ASIGNADO"}</p>
                </div>
                <div>
                  <p className="text-[12px] font-normal text-[#002855] tracking-[0.2em] mb-1">Empresa Carrier</p>
                  <p className="text-xs font-normal text-slate-900 uppercase">{viewingShipment.carrier || "RECURSO PROPIO"}</p>
                </div>
                <div>
                  <p className="text-[12px] font-normal text-[#002855] tracking-[0.2em] mb-1">Enviado Por</p>
                  <p className="text-xs font-normal text-slate-900 uppercase">{viewingShipment.shipped_by || "—"}</p>
                </div>
                <div>
                  <p className="text-[12px] font-normal text-[#002855] tracking-[0.2em] mb-1">Recibido Por</p>
                  <p className="text-xs font-normal text-slate-900 uppercase">{viewingShipment.received_by || "PENDIENTE"}</p>
                </div>
              </div>

              {/* Notas */}
              {viewingShipment.notes && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 bg-amber-500 rounded-none" />
                    <h3 className="text-[10px] font-normal text-gray-400 uppercase tracking-[0.2em]">Observaciones de Logística</h3>
                  </div>
                  <div className="bg-amber-50/50 p-6 rounded-none border border-amber-100 font-sans">
                    <p className="text-sm text-amber-950 font-medium italic leading-relaxed">{viewingShipment.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex items-center justify-between gap-3 z-10">
              <div className="flex items-center gap-3 ml-auto">
                <button
                  onClick={() => setViewingShipment(undefined)}
                  className="px-6 py-2 text-[10px] font-normal uppercase tracking-[0.2em] text-slate-600 bg-white border border-slate-200 rounded-none hover:bg-slate-50 transition-all"
                >
                  Cerrar
                </button>
                {canEdit() && (
                  <button
                    onClick={() => {
                      setViewingShipment(undefined);
                      handleEditShipment(viewingShipment);
                    }}
                    className="px-8 py-2 text-[10px] font-normal uppercase tracking-[0.2em] text-white bg-blue-600 rounded-none hover:bg-blue-700 transition-all shadow-lg"
                  >
                    Editar Envío
                  </button>
                )}
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
