import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquareWarning, Search, Building2, Layers, Tag, AlertTriangle, Trash2, Link2 } from 'lucide-react';
import { supabase, ChecklistObservacion } from '../../../shared/services/supabase';
import { useAuth } from '../../../app/providers/AuthContext';
import ActionToolbar from '../../../shared/components/ui/ActionToolbar';
import FilterBar from '../../../shared/components/ui/FilterBar';
import ExportButtons from '../../../shared/components/ui/ExportButtons';
import Pagination from '../../../shared/components/ui/Pagination';
import DateRangeFilter, { DateRange } from '../../../shared/components/ui/DateRangeFilter';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../shared/components/ui/Table';
import { useNotify } from '../../../shared/hooks/useNotify';
import { generateExcel, generatePDF } from '../../../shared/utils/exportUtils';

/** Quita acentos y normaliza a mayúsculas para comparar nombres de sede. */
const normalizar = (valor?: string | null) =>
   (valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

/** '2026-09-25' -> '25/09/2026'. Tolera null/undefined: una fila con la fecha
 *  corrupta no debe voltear toda la página. */
const formatearFecha = (iso?: string | null) => {
   if (!iso) return '—';
   const [a, m, d] = iso.split('-');
   return d && m && a ? `${d}/${m}/${a}` : iso;
};

/** Orden de los bloques: primero el de personal, después el de equipos. */
const PRIORIDAD_BLOQUE: Record<string, number> = { PERSONAL: 0, EQUIPOS: 1 };

/** Columnas por las que se puede ordenar desde el cabezal de la tabla. */
type ColumnaOrden = 'fecha' | 'sede' | 'bloque' | 'seccion' | 'comentario';
type SortConfig = { key: ColumnaOrden; direction: 'asc' | 'desc' } | null;

/** Extrae un mensaje legible de lo que tiró un catch sin tipar. */
const mensajeDeError = (err: unknown, porDefecto: string) =>
   err instanceof Error && err.message ? err.message : porDefecto;

export default function ChecklistObservaciones() {
   const { user } = useAuth();
   const { error: notifyError, success: notifySuccess, confirm: notifyConfirm } = useNotify();

   const [observaciones, setObservaciones] = useState<ChecklistObservacion[]>([]);
   const [loading, setLoading] = useState(true);

   const [searchTerm, setSearchTerm] = useState('');
   const [selectedSedes, setSelectedSedes] = useState<string[]>([]);
   const [selectedBloques, setSelectedBloques] = useState<string[]>([]);
   const [selectedSecciones, setSelectedSecciones] = useState<string[]>([]);
   const [rangoFechas, setRangoFechas] = useState<DateRange>({ from: '', to: '' });

   const [currentPage, setCurrentPage] = useState(1);
   const [itemsPerPage, setItemsPerPage] = useState(10);

   const [sortConfig, setSortConfig] = useState<SortConfig>(null);

   const [seleccionados, setSeleccionados] = useState<string[]>([]);
   const [procesando, setProcesando] = useState(false);

   /** Sedes de la app, para vincular a mano las filas que quedaron sueltas. */
   const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
   const [sedeElegida, setSedeElegida] = useState('');

   /**
    * useNotify devuelve funciones nuevas en cada render. Si el fetch las
    * usara como dependencia, su useCallback se recrearía siempre, el
    * useEffect de abajo se re-dispararía en cada render, el setLoading
    * volvería a renderizar, y la página quedaría pidiendo datos en loop
    * infinito — que es exactamente lo que se ve como "Cargando..." eterno.
    *
    * Por eso el notificador va en un ref y el callback no depende de nada.
    */
   const notifyRef = useRef(notifyError);
   useEffect(() => {
      notifyRef.current = notifyError;
   }, [notifyError]);

   const fetchObservaciones = useCallback(async () => {
      setLoading(true);
      try {
         const { data, error } = await supabase
            .from('checklist_observaciones')
            .select('*')
            .order('fecha', { ascending: false })
            .order('sede', { ascending: true });

         if (error) throw error;

         setObservaciones((data || []) as ChecklistObservacion[]);
      } catch (err) {
         console.error('Error fetching checklist_observaciones:', err);
         notifyRef.current(mensajeDeError(err, 'No se pudieron cargar los comentarios.'));
      } finally {
         setLoading(false);
      }
   }, []);

   /**
    * Restringe por sede igual que el resto del módulo: los roles privilegiados
    * ven todo; el resto solo su sede.
    *
    * Se filtra por `location_id` (uuid), no comparando el nombre de la hoja
    * contra locations.name: la Edge Function ya resolvió esa correspondencia
    * al guardar, así que acá no hay forma de que un supervisor vea comentarios
    * de otra sede por un parecido de nombres.
    *
    * Las filas sin location_id (sede mal nombrada en el Excel) quedan
    * ocultas para los no privilegiados a propósito: mostrarlas sería peor
    * que no mostrarlas.
    */
   const esPrivilegado = useMemo(() => {
      const privilegedRoles = ['super_admin', 'sistemas', 'gerencia', 'supervisores'];
      return Boolean(user && privilegedRoles.includes(user.role));
   }, [user]);

   useEffect(() => {
      fetchObservaciones();
   }, [fetchObservaciones]);

   /**
    * Catálogo de sedes para el select de vinculación. No va en el mismo
    * fetch que las observaciones: si fallara, no debería dejar de listar los
    * comentarios, solo se deshabilitaría la vinculación manual.
    */
   useEffect(() => {
      let vivo = true;
      (async () => {
         try {
            const { data, error } = await supabase.from('locations').select('id, name').order('name');
            if (error) throw error;
            if (vivo) setLocations((data || []) as { id: string; name: string }[]);
         } catch (err) {
            console.error('Error cargando sedes para vincular:', err);
         }
      })();
      return () => {
         vivo = false;
      };
   }, []);

   const sedesDisponibles = useMemo(
      () => Array.from(new Set(observaciones.map((o) => o.sede))).sort(),
      [observaciones]
   );

   const bloquesDisponibles = useMemo(
      () => Array.from(new Set(observaciones.map((o) => o.bloque))).sort(),
      [observaciones]
   );

   const seccionesDisponibles = useMemo(
      () =>
         Array.from(new Set(observaciones.map((o) => o.seccion).filter(Boolean)))
            .sort((a, b) => normalizar(a).localeCompare(normalizar(b))),
      [observaciones]
   );

   /**
    * Rango de fechas realmente cargado. Acota los <input type="date"> para
    * que no se pueda elegir un rango fuera de los datos, que devolvería una
    * lista vacía sin explicación.
    */
   const rangoDisponible = useMemo(() => {
      const fechas = observaciones.map((o) => o.fecha).filter(Boolean).sort();
      if (fechas.length === 0) return { min: undefined, max: undefined };
      return { min: fechas[0], max: fechas[fechas.length - 1] };
   }, [observaciones]);

   const filtradas = useMemo(() => {
      // Listado único, como el de inventario: entra todo lo guardado y el
      // filtrado lo hace la barra de arriba (sede / bloque / búsqueda).
      let resultado = observaciones;

      if (!esPrivilegado) {
         resultado = user?.location_id
            ? resultado.filter((o) => o.location_id === user.location_id)
            : [];
      }

      if (selectedSedes.length > 0) {
         resultado = resultado.filter((o) => selectedSedes.includes(o.sede));
      }

      if (selectedBloques.length > 0) {
         resultado = resultado.filter((o) => selectedBloques.includes(o.bloque));
      }

      if (selectedSecciones.length > 0) {
         resultado = resultado.filter((o) => selectedSecciones.includes(o.seccion));
      }

      // `fecha` es 'YYYY-MM-DD', así que comparar strings es comparar fechas.
      // Cada extremo va suelto: se puede acotar solo porDesde o solo por Hasta.
      if (rangoFechas.from) {
         resultado = resultado.filter((o) => !o.fecha || o.fecha >= rangoFechas.from);
      }
      if (rangoFechas.to) {
         resultado = resultado.filter((o) => !o.fecha || o.fecha <= rangoFechas.to);
      }

      if (searchTerm) {
         const term = normalizar(searchTerm);
         resultado = resultado.filter((o) =>
            normalizar(`${o.sede} ${o.seccion} ${o.comentario} ${o.bloque}`).includes(term)
         );
      }

      // Orden por defecto mientras el usuario no toca un cabezal: lo más
      // reciente primero, agrupado por sede y con Personal antes que Equipos.
      // Es el mismo criterio con el que ven el histórico los supervisores.
      const porDefecto = (a: ChecklistObservacion, b: ChecklistObservacion) => {
         if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;

         // Misma fecha: desempata por momento de inserción, para que dos
         // exporting del mismo día no queden mezclados.
         if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;

         const porSede = normalizar(a.sede).localeCompare(normalizar(b.sede));
         if (porSede !== 0) return porSede;

         return (PRIORIDAD_BLOQUE[a.bloque] ?? 9) - (PRIORIDAD_BLOQUE[b.bloque] ?? 9);
      };

      if (!sortConfig) return [...resultado].sort(porDefecto);

      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      return [...resultado].sort((a, b) => {
         switch (sortConfig.key) {
            case 'fecha': {
               // 'YYYY-MM-DD' ordena bien como string, pero el momento de
               // inserción rompe el empate cuando la fecha es la misma.
               if (a.fecha !== b.fecha) return (a.fecha < b.fecha ? -1 : 1) * dir;
               if (a.created_at === b.created_at) return porDefecto(a, b);
               return (a.created_at < b.created_at ? -1 : 1) * dir;
            }
            case 'sede': {
               const cmp = normalizar(a.sede).localeCompare(normalizar(b.sede));
               return cmp !== 0 ? cmp * dir : porDefecto(a, b);
            }
            case 'bloque': {
               // El bloque se ordena por el orden de la hoja (Personal primero),
               // no alfabético, que es lo que espera quien lee el checklist.
               const cmp = (PRIORIDAD_BLOQUE[a.bloque] ?? 9) - (PRIORIDAD_BLOQUE[b.bloque] ?? 9);
               return cmp !== 0 ? cmp * dir : porDefecto(a, b);
            }
            case 'seccion': {
               const cmp = normalizar(a.seccion).localeCompare(normalizar(b.seccion));
               return cmp !== 0 ? cmp * dir : porDefecto(a, b);
            }
            case 'comentario': {
               const cmp = normalizar(a.comentario).localeCompare(normalizar(b.comentario));
               return cmp !== 0 ? cmp * dir : porDefecto(a, b);
            }
            default:
               return porDefecto(a, b);
         }
      });
   }, [observaciones, esPrivilegado, user, selectedSedes, selectedBloques, selectedSecciones, rangoFechas, searchTerm, sortConfig]);

   /** Alterna asc/desc sobre la columna clickeada. */
   const handleSort = (key: ColumnaOrden) => {
      setSortConfig((prev) =>
         prev?.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
      );
      setCurrentPage(1);
   };

   const totalPages = Math.ceil(filtradas.length / itemsPerPage);
   const startIndex = (currentPage - 1) * itemsPerPage;
   const paginadas = filtradas.slice(startIndex, startIndex + itemsPerPage);

   /**
    * Si el filtro deja menos filas que las que alcanza a mostrar la página en la
    * que se está, `startIndex` se pasa del final y la tabla sale vacía aunque
    * haya resultados, con el mensaje de "no hay comentarios". Se corrige
    * ajustando la página en vez de mostrar un vacío engañoso.
    */
   useEffect(() => {
      const maximo = Math.max(1, totalPages);
      setCurrentPage((p) => (p > maximo ? maximo : p));
   }, [totalPages]);

   const toExportRows = () =>
      filtradas.map((o, index) => ({
         nro: index + 1,
         fecha: formatearFecha(o.fecha),
         sede: o.sede,
         bloque: o.bloque,
         seccion: o.seccion,
         comentario: o.comentario,
      }));

   const exportColumns = [
      { header: 'N°', key: 'nro', width: 6 },
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Sede', key: 'sede', width: 22 },
      { header: 'Bloque', key: 'bloque', width: 14 },
      { header: 'Sección', key: 'seccion', width: 22 },
      { header: 'Comentario', key: 'comentario', width: 60 },
   ];

   const handleExportExcel = async () => {
      try {
         await generateExcel({
            title: 'Comentarios de Checklist',
            filename: 'Comentarios Checklist',
            columns: exportColumns,
            data: toExportRows(),
            groupBy: 'sede',
            groupLabels: { sede: 'SEDE' },
            sheetBy: 'fecha',
            registros: filtradas.length,
         });
      } catch (err) {
         notifyError(mensajeDeError(err, 'Error al generar el Excel.'));
      }
   };

   const handleExportPdf = async () => {
      try {
         await generatePDF({
            title: 'Comentarios de Checklist',
            filename: 'Comentarios Checklist',
            columns: exportColumns,
            data: toExportRows(),
            groupBy: 'sede',
            groupLabels: { sede: 'SEDE' },
            registros: filtradas.length,
         });
      } catch (err) {
         notifyError(mensajeDeError(err, 'Error al generar el PDF.'));
      }
   };

   /** Un supervisor solo puede tocar los comentarios de su propia sede. */
   const puedeEditar = esPrivilegado;

   const idsVisibles = paginadas.map((o) => o.id);
   const todosSeleccionados = idsVisibles.length > 0 && idsVisibles.every((id) => seleccionados.includes(id));

   const toggleSeleccion = (id: string) => {
      setSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
   };

   const toggleTodosVisibles = () => {
      setSeleccionados((prev) =>
         todosSeleccionados ? prev.filter((id) => !idsVisibles.includes(id)) : [...new Set([...prev, ...idsVisibles])],
      );
   };

   /**
    * Vincula a mano las filas seleccionadas a una sede de la app.
    *
    * Existe para el caso en que la Edge Function no pudo resolver la sede
    * (nombre de hoja que no está en el mapa) y dejó location_id en NULL.
    * Reenviar el checklist desde la hoja arreglaría las filas nuevas, pero
    * no las viejas: estas ya están en la base y no se regeneran solas.
    */
   const vincularSede = async () => {
      if (seleccionados.length === 0 || !sedeElegida) return;

      const destino = locations.find((l) => l.id === sedeElegida);
      if (!destino) return;

      const cantidad = seleccionados.length;
      const confirmado = await notifyConfirm(
         `Se van a vincular ${cantidad} comentario(s) a la sede "${destino.name}".`,
         'Vincular sede',
      );
      if (!confirmado) return;

      setProcesando(true);
      try {
         const { error } = await supabase
            .from('checklist_observaciones')
            .update({ location_id: destino.id })
            .in('id', seleccionados);

         if (error) throw error;

         const affected = seleccionados;
         setObservaciones((prev) => prev.map((o) => (affected.includes(o.id) ? { ...o, location_id: destino.id } : o)));
         notifySuccess(`${cantidad} comentario(s) vinculados a ${destino.name}.`);
         setSeleccionados([]);
         setSedeElegida('');
      } catch (err) {
         notifyError(mensajeDeError(err, 'No se pudo vincular la sede.'));
      } finally {
         setProcesando(false);
      }
   };

   /**
    * Borrado definitivo. La columna `archivado` sigue existiendo en la base
    * pero la interfaz no la usa: el listado muestra todo en una sola tabla,
    * sin vistas separadas ni toggle. Quien ya archivó algo antes de este
    * cambio vuelve a verlo acá.
    */
   const eliminarDefinitivo = async () => {
      if (seleccionados.length === 0) return;

      const confirmado = await notifyConfirm(
         `Se van a eliminar ${seleccionados.length} comentario(s) de forma permanente. ` +
            'Esta acción no se puede deshacer.',
         'Eliminar comentarios',
      );
      if (!confirmado) return;

      setProcesando(true);
      try {
         const { error } = await supabase
            .from('checklist_observaciones')
            .delete()
            .in('id', seleccionados);

         if (error) throw error;

         // Mismo motivo que en archivar: si no se saca la fila del estado
         // local, la tabla sigue mostrándola y parece que no se borró.
         const affected = seleccionados;
         setObservaciones((prev) => prev.filter((o) => !affected.includes(o.id)));

         notifySuccess(`${affected.length} comentario(s) eliminados.`);
         setSeleccionados([]);
      } catch (err) {
         notifyError(mensajeDeError(err, 'No se pudieron eliminar los comentarios.'));
      } finally {
         setProcesando(false);
      }
   };

   useEffect(() => {
      // Si el filtro deja de mostrar lo que estaba seleccionado, la
      // selección se vuelve invisible y el botón actuaría sobre filas
      // que el usuario ya no ve.
      setSeleccionados((prev) => {
         const visibles = new Set(observaciones.map((o) => o.id));
         const filtrada = prev.filter((id) => visibles.has(id));
         return filtrada.length === prev.length ? prev : filtrada;
      });
   }, [observaciones]);

   /** Sedes cuyo nombre de hoja no se pudo vincular a un registro de locations. */
   const sedesSinVincular = useMemo(
      () =>
         Array.from(
            new Set(observaciones.filter((o) => !o.location_id).map((o) => o.sede))
         ).sort(),
      [observaciones]
   );

   return (
      <div className="flex flex-col h-full bg-[#f8fafc]">
         <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <ActionToolbar
               totalItems={filtradas.length}
               label="Comentarios"
               searchComponent={
                  <>
                     <Search
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors"
                     />
                     <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                           setSearchTerm(e.target.value);
                           setCurrentPage(1);
                        }}
                        placeholder="Buscar por sede, sección o comentario..."
                        className="w-full pl-12 pr-4 py-3 text-[12px] font-normal text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 tracking-[0.1em]"
                     />
                  </>
               }
            >
               <FilterBar
                  filters={[
                     {
                        key: 'sede',
                        placeholder: 'TODAS LAS SEDES',
                        icon: Building2,
                        iconClassName: 'text-blue-500',
                        wrapperClassName: 'md:min-w-[220px]',
                        options: sedesDisponibles.map((s) => ({ value: s, label: s })),
                     },
                      {
                         key: 'bloque',
                         placeholder: 'TODOS LOS BLOQUES',
                         icon: Layers,
                         iconClassName: 'text-emerald-500',
                         wrapperClassName: 'md:min-w-[220px]',
                         options: bloquesDisponibles.map((b) => ({
                            value: b,
                            label: b,
                         })),
                      },
                      {
                         key: 'seccion',
                         placeholder: 'TODAS LAS SECCIONES',
                         icon: Tag,
                         iconClassName: 'text-amber-500',
                         wrapperClassName: 'md:min-w-[220px]',
                         options: seccionesDisponibles.map((s) => ({
                            value: s,
                            label: s,
                         })),
                      },
                   ]}
                   values={{ sede: selectedSedes, bloque: selectedBloques, seccion: selectedSecciones }}
                   onClearAll={() => {
                      // Limpia también la búsqueda y el rango de fechas: el
                      // botón dice "Limpiar filtros" y dejar medio filtrado se
                      // siente como que no tocó nada.
                      setSelectedSedes([]);
                      setSelectedBloques([]);
                      setSelectedSecciones([]);
                      setSearchTerm('');
                      setRangoFechas({ from: '', to: '' });
                      setCurrentPage(1);
                   }}
                   onChange={(key, value) => {
                      if (key === 'sede') setSelectedSedes(value as string[]);
                      if (key === 'bloque') setSelectedBloques(value as string[]);
                      if (key === 'seccion') setSelectedSecciones(value as string[]);
                      setCurrentPage(1);
                   }}
                />

                <DateRangeFilter
                   value={rangoFechas}
                   onChange={(rango) => {
                      setRangoFechas(rango);
                      setCurrentPage(1);
                   }}
                   min={rangoDisponible.min}
                   max={rangoDisponible.max}
                />

                <div className="flex flex-wrap items-center gap-2">
                   <ExportButtons onExportExcel={handleExportExcel} onExportPDF={handleExportPdf} />

                   {puedeEditar && seleccionados.length > 0 && locations.length > 0 && (
                      <>
                        <select
                           value={sedeElegida}
                           onChange={(e) => setSedeElegida(e.target.value)}
                           className="px-3 py-3 bg-white border border-slate-200 text-[10px] font-normal uppercase tracking-widest text-slate-600 focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none"
                        >
                           <option value="">Vincular a sede...</option>
                           {locations.map((l) => (
                              <option key={l.id} value={l.id}>
                                 {l.name}
                              </option>
                           ))}
                        </select>
                        <button
                           type="button"
                           disabled={procesando || !sedeElegida}
                           onClick={vincularSede}
                           className="flex items-center gap-2 px-4 py-3 bg-[#002855] border border-[#002855] text-white text-[10px] font-normal uppercase tracking-widest hover:bg-[#001c3d] transition-all disabled:opacity-40"
                        >
                           <Link2 size={14} />
                           Vincular
                        </button>
                     </>
                  )}

                   {puedeEditar && seleccionados.length > 0 && (
                      <button
                         type="button"
                         disabled={procesando}
                         onClick={eliminarDefinitivo}
                         className="flex items-center gap-2 px-4 py-3 bg-rose-500 border border-rose-500 text-white text-[10px] font-normal uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-50"
                      >
                         <Trash2 size={14} />
                         Eliminar ({seleccionados.length})
                      </button>
                   )}
                </div>
             </ActionToolbar>

            <div className="bg-white border border-slate-200 shadow-sm">
               <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filtradas.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
               />

                <Table>
                   <TableHeader>
                      <TableRow>
                          {puedeEditar && (
                             <TableHead className="w-10">
                                <input
                                   type="checkbox"
                                   checked={todosSeleccionados}
                                   onChange={toggleTodosVisibles}
                                   className="cursor-pointer accent-[#002855]"
                                   aria-label="Seleccionar todos los visibles"
                                />
                             </TableHead>
                          )}
                          <TableHead
                             sortable
                             isSorted={sortConfig?.key === 'fecha'}
                             sortDirection={sortConfig?.direction || 'desc'}
                             onClick={() => handleSort('fecha')}
                          >
                             Fecha
                          </TableHead>
                          <TableHead
                             sortable
                             isSorted={sortConfig?.key === 'sede'}
                             sortDirection={sortConfig?.direction || 'asc'}
                             onClick={() => handleSort('sede')}
                          >
                             Sede
                          </TableHead>
                          <TableHead
                             sortable
                             isSorted={sortConfig?.key === 'bloque'}
                             sortDirection={sortConfig?.direction || 'asc'}
                             onClick={() => handleSort('bloque')}
                          >
                             Bloque
                          </TableHead>
                          <TableHead
                             sortable
                             isSorted={sortConfig?.key === 'seccion'}
                             sortDirection={sortConfig?.direction || 'asc'}
                             onClick={() => handleSort('seccion')}
                          >
                             Sección
                          </TableHead>
                          <TableHead
                             sortable
                             isSorted={sortConfig?.key === 'comentario'}
                             sortDirection={sortConfig?.direction || 'asc'}
                             onClick={() => handleSort('comentario')}
                          >
                             Comentario
                          </TableHead>
                      </TableRow>
                   </TableHeader>

                    <TableBody>
                       {paginadas.map((o) => (
                          <TableRow key={o.id}>
                             {puedeEditar && (
                                <TableCell>
                                   <input
                                      type="checkbox"
                                      checked={seleccionados.includes(o.id)}
                                      onChange={() => toggleSeleccion(o.id)}
                                      className="cursor-pointer accent-[#002855]"
                                      aria-label={`Seleccionar comentario de ${o.sede}`}
                                   />
                                </TableCell>
                             )}
                            <TableCell>
                               <span className="text-[12px] font-normal text-slate-700 uppercase tracking-widest whitespace-nowrap">
                                  {formatearFecha(o.fecha)}
                               </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-[13px] font-semibold text-[#002855] uppercase leading-tight">
                                 {o.sede}
                              </span>
                           </TableCell>
                           <TableCell>
                              <span className="text-[12px] font-normal text-slate-700 uppercase tracking-widest">
                                 {o.bloque}
                              </span>
                           </TableCell>
                           <TableCell>
                              <span className="text-[12px] font-semibold text-slate-800 uppercase tracking-wide">
                                 {o.seccion}
                              </span>
                           </TableCell>
                           <TableCell>
                              <p className="text-[12px] font-normal text-slate-600 leading-relaxed whitespace-pre-line">
                                 {o.comentario}
                              </p>
                           </TableCell>
                        </TableRow>
                     ))}

                     {!loading && paginadas.length === 0 && (
                        <TableRow>
                           <TableCell colSpan={puedeEditar ? 7 : 6} className="h-32 text-center text-slate-400 text-sm font-medium">
                              No hay comentarios registrados. Se generan al exportar el checklist desde Google Sheets.
                           </TableCell>
                        </TableRow>
                     )}

                     {loading && (
                        <TableRow>
                           <TableCell colSpan={puedeEditar ? 7 : 6} className="h-32 text-center text-slate-400 text-sm font-medium">
                              Cargando comentarios...
                           </TableCell>
                        </TableRow>
                     )}
                  </TableBody>
               </Table>
            </div>

            {esPrivilegado && sedesSinVincular.length > 0 && (
               <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 text-[10px] font-normal text-amber-800 uppercase tracking-wide leading-relaxed">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                     No se encontró sede en el sistema para: {sedesSinVincular.join(', ')}. Sus supervisores
                     no van a ver estos comentarios hasta que el nombre de la hoja coincida con el de la sede.
                     {puedeEditar && (
                        <>
                           {' '}
                           <button
                              type="button"
                              onClick={() => {
                                 setSeleccionados(observaciones.filter((o) => !o.location_id).map((o) => o.id));
                                 setCurrentPage(1);
                              }}
                              className="underline font-semibold hover:text-amber-900"
                           >
                              Seleccionar todas para vincular
                           </button>
                        </>
                     )}
                  </span>
               </div>
            )}

            <div className="flex items-start gap-2 text-[10px] font-normal text-slate-400 uppercase tracking-wide leading-relaxed">
               <MessageSquareWarning size={14} className="shrink-0 mt-0.5" />
               Solo se registran las secciones que tienen comentario escrito en el checklist. Las secciones en
               blanco no generan registro.
            </div>
         </div>
      </div>
   );
}
