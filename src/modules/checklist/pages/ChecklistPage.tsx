import { useEffect, useState, useMemo, useCallback } from 'react';
import { Car, ChevronRight, Stethoscope, GraduationCap, FileText, ExternalLink, Edit, MapPin, Search, X, ListChecks, FolderOpen, Plus, MessageSquareWarning } from 'lucide-react';
import { supabase, Location } from '../../../shared/services/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthContext';
import LocationForm from '../../sedes/forms/LocationForm';
import ActionToolbar from '../../../shared/components/ui/ActionToolbar';
import ActionsDropdown from '../../../shared/components/ui/ActionsDropdown';
import { useSelectionMode } from '../../../shared/hooks/useSelectionMode';
import FilterBar from '../../../shared/components/ui/FilterBar';
import ViewToggle from '../../../shared/components/ui/ViewToggle';
import DetailModal, {
   DetailModalHeader,
   DetailModalBody,
} from '../../../shared/components/ui/DetailModal';
import Pagination from '../../../shared/components/ui/Pagination';

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../shared/components/ui/Table';
import { useNotify } from '../../../shared/hooks/useNotify';
import { Building2 } from 'lucide-react';
import { generateExcel, generatePDF } from '../../../shared/utils/exportUtils';

export default function Checklist({ type }: { type?: string }) {
   const navigate = useNavigate();
   const { canEdit, user } = useAuth();
   const { error: notifyError } = useNotify();
   const [locations, setLocations] = useState<Location[]>([]);
   const [searchTerm, setSearchTerm] = useState('');
   const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
   const [showForm, setShowForm] = useState(false);
   const [editingLocation, setEditingLocation] = useState<Location | undefined>();
   const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
   const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
   const [currentPage, setCurrentPage] = useState(1);
   const [itemsPerPage, setItemsPerPage] = useState(10);
   const [selectedIds, setSelectedIds] = useState<string[]>([]);
   const { selectionMode, toggleSelectionMode } = useSelectionMode();

   const handleToggleSelectionMode = () => {
      setSelectedIds([]);
      toggleSelectionMode();
   };

   const driveLinks: Record<string, string> = {
      escon: 'https://drive.google.com/drive/folders/170_fX-XqA6K8F8-R7Nn-T5R_N4L5lX_h?usp=drive_link',
      ecsal: 'https://drive.google.com/drive/folders/1F-vTj-YV-R9Y8L8X8K7Nn-T5R_N4L5lX_h?usp=drive_link',
      citv: 'https://drive.google.com/drive/folders/11Q8PLtXgaL6T42LkcAb1y3MZjyIKOpUi?usp=drive_link'
   };

   const fetchLocations = useCallback(async () => {
      try {
         const { data: locationsData, error: locationsError } = await supabase
            .from('locations')
            .select('*')
            .order('name');

         if (locationsError) throw locationsError;

         let filteredResults = locationsData as Location[];

         const privilegedRoles = ['super_admin', 'sistemas', 'gerencia', 'supervisores'];
         const isPrivileged = user && privilegedRoles.includes(user.role);

         if (!isPrivileged && user?.location_id) {
            filteredResults = filteredResults.filter(loc => loc.id === user.location_id);
         }

         setLocations(filteredResults);
      } catch (err) {
         console.error('Error fetching locations:', err);
      }
   }, [user]);

   useEffect(() => {
      fetchLocations();
   }, [fetchLocations]);

   const handleEditLinks = (location: Location) => {
      setEditingLocation(location);
      setShowForm(true);
   };

   const handleSaveLinks = async () => {
      setShowForm(false);
      setEditingLocation(undefined);
      await fetchLocations();
   };

   const filteredLocations = useMemo(() => {
      let filtered = locations;

      // Filtro por ruta
      if (type && type !== 'all') {
         filtered = filtered.filter(loc => {
            if (type === 'escon') return loc.type === 'escuela_conductores';
            if (type === 'ecsal') return loc.type === 'policlinico';
            if (type === 'citv') return loc.type === 'revision';
            return false;
         });
      }

      // Filtro por checkboxes (solo si estamos en 'Ver Todo')
      if ((!type || type === 'all') && selectedTypes.length > 0) {
         filtered = filtered.filter(loc => selectedTypes.includes(loc.type));
      }

      // Búsqueda por texto
      if (searchTerm) {
         filtered = filtered.filter(loc =>
            loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (loc.address && loc.address.toLowerCase().includes(searchTerm.toLowerCase()))
         );
      }

      return filtered;
   }, [locations, type, selectedTypes, searchTerm]);

   const totalPages = Math.ceil(filteredLocations.length / itemsPerPage);
   const startIndex = (currentPage - 1) * itemsPerPage;
   const paginatedLocations = filteredLocations.slice(startIndex, startIndex + itemsPerPage);

   const getIconData = (locationType: string) => {
      switch (locationType) {
         case 'escuela_conductores': return { icon: <GraduationCap size={16} />, color: 'blue', route: 'escon', label: 'ESCON' };
         case 'policlinico': return { icon: <Stethoscope size={16} />, color: 'emerald', route: 'ecsal', label: 'ECSAL' };
         case 'revision': return { icon: <Car size={16} />, color: 'orange', route: 'citv', label: 'CITV' };
         default: return { icon: <MapPin size={16} />, color: 'slate', route: 'all', label: 'OTRO' };
      }
   };

   const toggleSelectAll = () => {
      if (selectedIds.length === paginatedLocations.length && paginatedLocations.length > 0) {
         setSelectedIds([]);
      } else {
         setSelectedIds(paginatedLocations.map(loc => loc.id));
      }
   };

   const toggleSelect = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
   };

   const handleExportExcel = async () => {
      try {
         const locationsToExport = selectedIds.length > 0
            ? filteredLocations.filter(loc => selectedIds.includes(loc.id))
            : filteredLocations;

         const data = locationsToExport.map((loc, index) => {
            const { label } = getIconData(loc.type);
            return {
               nro: index + 1,
               name: loc.name,
               type: label,
               address: loc.address || 'Sin dirección',
               checklist_link: loc.checklist_url ? 'Disponible' : 'No configurado',
               evidence_link: loc.history_url ? 'Disponible' : 'No configurado',
            };
         });

         await generateExcel({
            title: 'Reporte de Ubicaciones — Checklist',
            filename: 'Checklist Ubicaciones',
            columns: [
               { header: 'N°', key: 'nro', width: 6 },
               { header: 'UBICACIÓN / EMPRESA', key: 'name', width: 35 },
               { header: 'TIPO', key: 'type', width: 22 },
               { header: 'DIRECCIÓN', key: 'address', width: 40 },
               { header: 'CHECKLIST DRIVE', key: 'checklist_link', width: 22 },
               { header: 'EVIDENCIAS', key: 'evidence_link', width: 22 },
            ],
            data
         });
      } catch (error) {
         console.error('Error exportando Excel:', error);
         notifyError('Error al exportar a Excel', 'Error de exportación');
      }
   };

   const handleExportPdf = () => {
      const locationsToExport = selectedIds.length > 0
         ? filteredLocations.filter(loc => selectedIds.includes(loc.id))
         : filteredLocations;

      const data = locationsToExport.map((loc, index) => {
         const { label } = getIconData(loc.type);
         return {
            nro: index + 1,
            name: loc.name,
            type: label,
            address: loc.address || 'Sin dirección',
            checklist_link: loc.checklist_url ? '? Disponible' : '? No configurado',
            evidence_link: loc.history_url ? '? Disponible' : '? No configurado',
         };
      });

      generatePDF({
         title: 'Reporte de Ubicaciones — Checklist',
         filename: 'Checklist Ubicaciones',
         columns: [
            { header: 'N°', key: 'nro' },
            { header: 'Ubicación / Empresa', key: 'name' },
            { header: 'Tipo', key: 'type' },
            { header: 'Dirección', key: 'address' },
            { header: 'Checklist Drive', key: 'checklist_link' },
            { header: 'Evidencias', key: 'evidence_link' },
         ],
         data
      });
   };

   return (
      <div className="flex flex-col h-full bg-[#f8fafc]">
         <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <ActionToolbar
               totalItems={filteredLocations.length}
               label="Ubicaciones"
               searchComponent={
                  <>
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
                     <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                           setSearchTerm(e.target.value);
                           setCurrentPage(1);
                        }}
                        className="w-full pl-12 pr-4 py-3 text-[12px] font-normal text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 tracking-[0.1em]"
                     />
                  </>
               }
            >
               {(!type || type === 'all') && (
                  <FilterBar
                     filters={[
                        {
                           key: 'type',
                           placeholder: 'TODOS LOS TIPOS',
                           icon: Building2,
                           iconClassName: 'text-blue-500',
                           wrapperClassName: 'md:min-w-[220px]',
                           options: [
                              { value: 'escuela_conductores', label: 'ESCON' },
                              { value: 'policlinico', label: 'ECSAL' },
                              { value: 'revision', label: 'CITV' }
                           ]
                        }
                     ]}
                     values={{ type: selectedTypes }}
                     onChange={(key, value) => {
                        setSelectedTypes(value as string[]);
                        setCurrentPage(1);
                     }}
                  />
               )}

               {type && type !== 'all' && driveLinks[type] && (
                  <a
                     href={driveLinks[type]}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-[#002855] text-white text-[10px] font-normal uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
                  >
                     <ExternalLink size={14} />
                     Abrir Drive
                  </a>
               )}
               {canEdit() && (
                  <button
                     onClick={() => {
                        setEditingLocation(undefined);
                        setShowForm(true);
                     }}
                     className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-[#002855] text-white text-[10px] font-normal uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
                  >
                     <Plus size={14} />
                     NUEVA UBICACIÓN
                  </button>
               )}

                <button
                   onClick={() => navigate('/checklist/comentarios')}
                   className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-[#002855] text-[10px] font-normal uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                   <MessageSquareWarning size={14} />
                   Comentarios
                </button>

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
                   onExportPDF={handleExportPdf}
                />


               <ViewToggle viewMode={viewMode} onChange={(m) => setViewMode(m as 'grid' | 'table')} />
            </ActionToolbar>

            {viewMode === 'table' ? (
               <>
                  {/* Mobile cards */}
                  <div className="block md:hidden space-y-3">
                     <div className="bg-white border border-slate-200 shadow-sm">
                        <Pagination
                           currentPage={currentPage}
                           totalPages={totalPages}
                           totalItems={filteredLocations.length}
                           itemsPerPage={itemsPerPage}
                           onPageChange={setCurrentPage}
                           onItemsPerPageChange={setItemsPerPage}
                        />
                     </div>
                     <div className="space-y-3">
                        {paginatedLocations.map(location => {
                           const { icon, color, label } = getIconData(location.type);
                           const isSelected = selectedIds.includes(location.id);
                           return (
                              <div key={location.id} onClick={() => setSelectedLocation(location)} className={`bg-white border ${isSelected ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200'} p-4 active:bg-slate-50 transition-all cursor-pointer`}>
                                 <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                       {canEdit() && selectionMode && (
                                          <div onClick={e => e.stopPropagation()} className="shrink-0">
                                             <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => toggleSelect(location.id, e as any)}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                             />
                                          </div>
                                       )}
                                       <div className={`w-9 h-9 shrink-0 flex items-center justify-center bg-slate-100 text-slate-400`}>
                                          {icon}
                                       </div>
                                       <div className="min-w-0 flex-1">
                                          <p className="text-[13px] font-normal text-[#002855] leading-tight truncate">{location.name}</p>
                                          {location.address && (
                                             <p className="text-[10px] text-slate-500 truncate mt-0.5">{location.address}</p>
                                          )}
                                       </div>
                                    </div>
                                    <span className="shrink-0 text-[14px] font-semibold text-slate-800">
                                       {label}
                                    </span>
                                 </div>
                                 <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedLocation(location); }}
                                    className="w-full py-2.5 bg-[#002855] text-white text-[10px] font-normal uppercase tracking-widest hover:bg-blue-800 transition-all flex items-center justify-center gap-2"
                                 >
                                    Ver Opciones
                                 </button>
                              </div>
                           );
                        })}
                        {paginatedLocations.length === 0 && (
                           <div className="py-16 text-center text-slate-400 text-sm font-medium bg-white border border-slate-200">
                              No se encontraron ubicaciones.
                           </div>
                        )}
                     </div>
                  </div>
                  {/* Desktop table */}
                  <div className="hidden md:block bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden flex flex-col">
                     <div className="bg-slate-50 border-b border-slate-200 shrink-0">
                        <Pagination
                           currentPage={currentPage}
                           totalPages={totalPages}
                           totalItems={filteredLocations.length}
                           itemsPerPage={itemsPerPage}
                           onPageChange={setCurrentPage}
                           onItemsPerPageChange={setItemsPerPage}
                        />
                     </div>
                     <div className="overflow-x-auto">
                        <Table>
                           <TableHeader>
                              <tr>
                                 {canEdit() && selectionMode && (
                                    <TableHead className="text-center w-12">
                                       <input
                                          type="checkbox"
                                          checked={paginatedLocations.length > 0 && selectedIds.length === paginatedLocations.length}
                                          onChange={toggleSelectAll}
                                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                                       />
                                    </TableHead>
                                 )}
                                 <TableHead>Ubicación</TableHead>
                                 <TableHead>Dirección</TableHead>
                                 <TableHead className="text-center">Tipo</TableHead>
                                 <TableHead className="text-right">Acciones</TableHead>
                              </tr>
                           </TableHeader>
                           <TableBody>
                              {paginatedLocations.map(location => {
                                 const { icon, color, label } = getIconData(location.type);
                                 const isSelected = selectedIds.includes(location.id);
                                 return (
                                    <TableRow
                                       key={location.id}
                                       className={`cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}
                                       onClick={() => setSelectedLocation(location)}
                                    >
                                       {canEdit() && selectionMode && (
                                          <TableCell className="text-center w-12" onClick={e => e.stopPropagation()}>
                                             <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => toggleSelect(location.id, e as any)}
                                                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                                             />
                                          </TableCell>
                                       )}
                                       <TableCell>
                                          <div className="flex items-center gap-3">
                                             <div className={`w-9 h-9 rounded-none flex items-center justify-center shadow-sm transition-all duration-300 bg-slate-100 text-slate-400`}>
                                                {icon}
                                             </div>
                                             <span className="text-[13px] font-normal text-[#002855] leading-tight">
                                                {location.name}
                                             </span>
                                          </div>
                                       </TableCell>
                                       <TableCell>
                                          <div className="flex items-center gap-2">
                                             <MapPin size={12} className="text-slate-400" />
                                             <span className="text-[12px] font-normal text-slate-700 uppercase tracking-widest">
                                                {location.address || 'Sin dirección'}
                                             </span>
                                          </div>
                                       </TableCell>
                                       <TableCell className="text-center">
                                          <span className="text-[14px] font-semibold text-slate-800">
                                             {label}
                                          </span>
                                       </TableCell>
                                       <TableCell className="text-right">
                                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                             <span className="text-[10px] font-normal text-[#002855] uppercase tracking-widest pr-2">
                                                Opciones ?
                                             </span>
                                          </div>
                                       </TableCell>
                                    </TableRow>
                                 );
                              })}
                              {paginatedLocations.length === 0 && (
                                 <TableRow>
                                    <TableCell colSpan={canEdit() ? 5 : 4} className="h-32 text-center text-slate-400 text-sm font-medium">
                                       No se encontraron ubicaciones.
                                    </TableCell>
                                 </TableRow>
                              )}
                           </TableBody>
                        </Table>
                     </div>
                  </div>
               </>
            ) : (
               <div className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden">
                     <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredLocations.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                     />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                     {paginatedLocations.map((location) => {
                        const { icon, color, label } = getIconData(location.type);
                        return (
                           <div key={location.id} className={`group bg-white rounded-none shadow-sm border border-slate-200 hover:shadow-lg hover:border-${color}-300 transition-all duration-200 flex flex-col overflow-hidden`}>
                              <div className="relative bg-slate-50 px-5 pt-4 pb-4 border-b border-slate-100">
                                 <div className="flex items-start justify-between mb-4">
                                    <div className={`w-12 h-12 rounded-none flex items-center justify-center transition-all bg-white text-slate-400 shadow-sm border border-slate-200 group-hover:bg-${color}-600 group-hover:text-white group-hover:border-transparent`}>
                                       {icon}
                                    </div>
                                    <span className={`px-3 py-1.5 text-[10px] font-normal tracking-wider border border-${color}-200 text-${color}-600 bg-${color}-50 rounded-none`}>
                                       {label}
                                    </span>
                                 </div>
                                 <h3 className="text-[13px] font-normal text-[#002855] leading-tight mb-2">
                                    {location.name}
                                 </h3>
                                 <div className="flex items-center gap-1.5 text-[10px] font-normal text-slate-500 uppercase tracking-widest">
                                    <MapPin size={12} className="text-rose-500" />
                                    <span className="truncate">{location.address || 'Sin dirección'}</span>
                                 </div>
                              </div>

                              <div className="p-4 bg-slate-50 border-t border-slate-100 mt-auto">
                                 <button
                                    onClick={() => setSelectedLocation(location)}
                                    className="w-full py-2.5 bg-[#002855] text-white rounded-none hover:bg-blue-800 transition-all text-[10px] font-normal uppercase tracking-widest shadow-sm flex items-center justify-center gap-2"
                                 >
                                    Ver Opciones <ChevronRight size={14} />
                                 </button>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>
            )}

            {/* Modal de Opciones usando DetailModal */}
            {selectedLocation && (
               <DetailModal maxWidth="sm" onClose={() => setSelectedLocation(null)} closeOnBackdrop>
                  <DetailModalHeader>
                     <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                     <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 pr-1">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
                           <Building2 size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                           <h2 className="text-xs sm:text-base font-normal text-white uppercase tracking-tight leading-snug line-clamp-1">{selectedLocation.name}</h2>
                           <p className="text-[9px] sm:text-[10px] font-normal text-blue-200 uppercase tracking-wide mt-1 flex items-center gap-1">
                              <MapPin size={10} />
                              {selectedLocation.address || 'Sin dirección'}
                           </p>
                        </div>
                     </div>
                     <button onClick={() => setSelectedLocation(null)} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 text-white/50 hover:text-white hover:bg-white/10 transition-all -mr-1" aria-label="Cerrar">
                        <X size={22} />
                     </button>
                  </DetailModalHeader>

                  <DetailModalBody>
                     <div className="space-y-3">
                        <button
                           onClick={() => {
                              const { route } = getIconData(selectedLocation.type);
                              navigate(`/checklist/${route}/${selectedLocation.id}`);
                           }}
                           className="w-full flex items-center justify-between p-4 bg-blue-50/50 border border-blue-100 hover:bg-blue-50 hover:border-blue-200 transition-all group/link"
                        >
                           <div className="flex items-center gap-3">
                              <div className="p-2 bg-white shadow-sm border border-blue-200 text-blue-600">
                                 <ListChecks size={18} />
                              </div>
                              <div className="text-left">
                                 <span className="block text-[12px] font-normal text-[#002855] uppercase tracking-widest">Llenar Checklist</span>
                                 <span className="block text-[10px] text-slate-500 uppercase mt-0.5">Formulario interactivo</span>
                              </div>
                           </div>
                           <ChevronRight size={18} className="text-slate-400 group-hover/link:translate-x-1 group-hover/link:text-blue-600 transition-all" />
                        </button>

                        <a
                           href={selectedLocation.checklist_url || '#'}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="w-full flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all group/link"
                        >
                           <div className="flex items-center gap-3">
                              <div className="p-2 bg-white shadow-sm border border-slate-200 text-slate-600">
                                 <FileText size={18} />
                              </div>
                              <div className="text-left">
                                 <span className="block text-[12px] font-normal text-[#002855] uppercase tracking-widest">Checklist Drive</span>
                                 <span className="block text-[10px] text-slate-500 uppercase mt-0.5">Documento general</span>
                              </div>
                           </div>
                           <ExternalLink size={18} className="text-slate-400 group-hover/link:text-slate-600 transition-all" />
                        </a>

                        <a
                           href={selectedLocation.history_url || '#'}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="w-full flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all group/link"
                        >
                           <div className="flex items-center gap-3">
                              <div className="p-2 bg-white shadow-sm border border-slate-200 text-slate-600">
                                 <FolderOpen size={18} />
                              </div>
                              <div className="text-left">
                                 <span className="block text-[12px] font-normal text-[#002855] uppercase tracking-widest">Evidencias</span>
                                 <span className="block text-[10px] text-slate-500 uppercase mt-0.5">Historial de fotos y docs</span>
                              </div>
                           </div>
                           <ExternalLink size={18} className="text-slate-400 group-hover/link:text-slate-600 transition-all" />
                        </a>

                        {canEdit() && (
                           <button
                              onClick={(e) => {
                                 e.stopPropagation();
                                 setSelectedLocation(null);
                                 handleEditLinks(selectedLocation);
                              }}
                              className="w-full flex items-center justify-center gap-2 p-3 mt-4 bg-white border border-slate-200 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600 transition-all text-[10px] font-normal text-slate-500 uppercase tracking-widest"
                           >
                              <Edit size={14} />
                              Editar Enlaces Drive
                           </button>
                        )}
                     </div>
                  </DetailModalBody>
               </DetailModal>
            )}

            {showForm && (
               <LocationForm
                  editLocation={editingLocation}
                  onClose={() => {
                     setShowForm(false);
                     setEditingLocation(undefined);
                  }}
                  onSave={handleSaveLinks}
               />
            )}
         </div>
      </div>
   );
}
