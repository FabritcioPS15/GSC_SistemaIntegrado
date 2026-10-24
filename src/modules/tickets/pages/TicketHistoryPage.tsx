// =============================================================================
// TicketHistoryPage.tsx — Historial de tickets archivados
// Funcionalidades:
//   - Lista todos los tickets con estado "archived"
//   - Filtros por búsqueda, prioridad, nivel de complejidad y rango de fechas
//   - Exportación a PDF y Excel
//   - Cálculo de tiempo de resolución (desde creación hasta cierre)
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Search, Calendar, RefreshCw, Ticket as TicketIcon, Clock, User } from 'lucide-react';
import { FaFilePdf } from "react-icons/fa6";
import { RiFileExcel2Fill } from "react-icons/ri";
import FilterBar from '../../../shared/components/ui/FilterBar';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import { supabase } from '../../../shared/services/supabase';
import ComplexityBadge from '../components/ComplexityBadge';
import { COMPLEXITY_CATEGORY, COMPLEXITY_LABELS, COMPLEXITY_LEVELS, normalizeComplexity } from '../tickets.types';
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from '../../../shared/components/ui/Table';
import { generateExcel, generatePDF } from '../../../shared/utils/exportUtils';


interface Ticket {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    category?: string;
    complexity_level?: string;
    created_at: string;
    updated_at: string;
    closed_at?: string;
    requester: {
        full_name: string;
        avatar_url?: string;
    };
    attendant?: {
        full_name: string;
        avatar_url?: string;
    };
    locations?: {
        name: string;
    };
}

// Mapa de estilos visuales para cada nivel de prioridad
// Se usa para colorear badges y etiquetas en la tabla
const PRIORITY_STYLES: Record<string, { label: string, color: string, dot: string }> = {
    critical: { label: 'P1 - Crítica', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
    high: { label: 'P2 - Alta', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
    medium: { label: 'P3 - Media', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    low: { label: 'P4 - Baja', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-500' }
};

// Texto de complejidad para los reportes: los tickets de otras áreas no se clasifican
const complexityReportLabel = (ticket: Ticket) =>
    normalizeComplexity(ticket.complexity_level)
        ? COMPLEXITY_LABELS[normalizeComplexity(ticket.complexity_level) as keyof typeof COMPLEXITY_LABELS]
        : (ticket.category === COMPLEXITY_CATEGORY ? 'Sin clasificar' : 'N/A');

export default function TicketHistory() {
    const navigate = useNavigate();
    // Estado local para filtros y carga de datos
    const [tickets, setTickets] = useState<Ticket[]>([]); // Lista de tickets archivados
    const [loading, setLoading] = useState(true); // Indicador de carga
    const [refreshing, setRefreshing] = useState(false); // Indicador de refresco manual
    const [searchTerm, setSearchTerm] = useState(''); // Término de búsqueda en título/solicitante/ubicación
    const [filterPriority, setFilterPriority] = useState<string[]>([]); // Filtro por prioridad (array de valores)
    const [filterComplexity, setFilterComplexity] = useState<string[]>([]); // Filtro por nivel de complejidad (N1/N2/N3)
    const [filterDateRange, setFilterDateRange] = useState<string[]>([]); // Rango de fechas predefinido (all, 7days, 30days, 90days, custom)
    const [startDate, setStartDate] = useState(''); // Fecha inicio del rango custom (YYYY-MM-DD)
    const [endDate, setEndDate] = useState(''); // Fecha fin del rango custom (YYYY-MM-DD)

    // Carga inicial de tickets archivados al montar el componente
    useEffect(() => {
        fetchArchivedTickets();
    }, []);

    // Obtiene todos los tickets con estado "archived" desde Supabase
    // Incluye relaciones: solicitante, técnico asignado y ubicación
    const fetchArchivedTickets = async () => {
        try {
            const { data, error } = await supabase
                .from('tickets')
                .select(`
                    *,
                    requester:requester_id(full_name, avatar_url),
                    attendant:assigned_to(full_name, avatar_url),
                    locations(name)
                `)
                .eq('status', 'archived')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Error fetching archived tickets:', error);
                throw error;
            }

            setTickets(data || []);
        } catch (error) {
            console.error('❌ Error in fetchArchivedTickets:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filtra los tickets archivados según múltiples criterios:
    // - Búsqueda: título, solicitante o ubicación (case-insensitive)
    // - Prioridad: filtra por array de prioridades seleccionadas
    // - Complejidad: filtra por array de niveles N1/N2/N3 seleccionados
    // - Rango de fechas: predefinido (7/30/90 días) o custom (start/end)
    // Usa closed_at para filtrar por fecha, o created_at si no hay closed_at
    const filteredTickets = useMemo(() => {
        return tickets.filter(ticket => {
            // Search filter
            const searchMatch = searchTerm === '' ||
                ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ticket.requester?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ticket.locations?.name?.toLowerCase().includes(searchTerm.toLowerCase());
            // Priority filter
            const priorityMatch = filterPriority.length === 0 || filterPriority.includes(ticket.priority);
            // Complexity filter (solo aplica al área de Sistemas)
            const complexityMatch = filterComplexity.length === 0 || filterComplexity.includes(ticket.complexity_level || '');

            // Date range filter
            let dateMatch = true;
            // For history, we usually care about when it was closed
            const ticketDate = new Date(ticket.closed_at || ticket.created_at);
            const now = new Date();

            const currentRange = filterDateRange.length > 0 ? filterDateRange[0] : 'all';

            if (currentRange !== 'all') {
                if (currentRange === 'custom') {
                    if (startDate) {
                        const [y, m, d] = startDate.split('-').map(Number);
                        const start = new Date(y, m - 1, d, 0, 0, 0);
                        if (ticketDate < start) dateMatch = false;
                    }
                    if (endDate && dateMatch) {
                        const [y, m, d] = endDate.split('-').map(Number);
                        const end = new Date(y, m - 1, d, 23, 59, 59);
                        if (ticketDate > end) dateMatch = false;
                    }
                } else {
                    switch (currentRange) {
                        case '7days':
                            dateMatch = (now.getTime() - ticketDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
                            break;
                        case '30days':
                            dateMatch = (now.getTime() - ticketDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
                            break;
                        case '90days':
                            dateMatch = (now.getTime() - ticketDate.getTime()) <= 90 * 24 * 60 * 60 * 1000;
                            break;
                    }
                }
            }

            return searchMatch && priorityMatch && complexityMatch && dateMatch;
        });
    }, [tickets, searchTerm, filterPriority, filterComplexity, filterDateRange, startDate, endDate]);

    // Calcula el tiempo transcurrido desde la creación hasta el cierre del ticket
    // Devuelve formato legible: segundos, minutos u horas según la duración
    const getTimeToClose = (ticket: Ticket) => {
        const created = new Date(ticket.created_at);
        const closed = new Date(ticket.closed_at || ticket.updated_at);
        const diffMs = closed.getTime() - created.getTime();

        if (diffMs < 60000) { // Menos de 1 minuto
            const seconds = Math.floor(diffMs / 1000);
            return `${seconds}s`;
        } else if (diffMs < 3600000) { // Menos de 1 hora
            const minutes = Math.floor(diffMs / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
            return `${minutes}m ${seconds}s`;
        } else {
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            return `${hours}h ${minutes}m`;
        }
    };

    // Refresca manualmente la lista de tickets archivados
    // Útil cuando se sabe que hubo cambios en la base de datos
    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchArchivedTickets();
        setRefreshing(false);
    };



    // Genera un reporte PDF con el historial de tickets filtrados
    // Incluye: N°, ID, título, solicitante, técnico, ubicación, prioridad, fechas y tiempo de cierre
    // Usa la utilidad compartida generatePDF para crear el documento
    const generateHistoryPDF = () => {
        const data = filteredTickets.map((t, i) => ({
            nro: i + 1,
            id: `TK-${t.id.slice(0, 6).toUpperCase()}`,
            title: t.title,
            requester: t.requester?.full_name || 'N/A',
            attendant: t.attendant?.full_name || 'Sin asignar',
            ubicacion: t.locations?.name || 'N/A',
            priority: PRIORITY_STYLES[t.priority]?.label || t.priority,
            complexity: complexityReportLabel(t),
            created_at: new Date(String(t.created_at).includes('T') ? String(t.created_at) : `${t.created_at}T12:00:00`).toLocaleDateString(),
            closed_at: t.closed_at ? new Date(String(t.closed_at).includes('T') ? String(t.closed_at) : `${t.closed_at}T12:00:00`).toLocaleDateString() : 'N/A',
            time_to_close: getTimeToClose(t)
        }));

        generatePDF({
            title: 'Historial de Tickets Archivados',
            filename: 'Historial Tickets',
            columns: [
                { header: 'N°', key: 'nro' },
                { header: 'ID', key: 'id' },
                { header: 'Título / Incidente', key: 'title' },
                { header: 'Solicitante', key: 'requester' },
                { header: 'Atendido Por', key: 'attendant' },
                { header: 'Ubicación', key: 'ubicacion' },
                { header: 'Prioridad', key: 'priority' },
                { header: 'Complejidad', key: 'complexity' },
                { header: 'Fecha Creación', key: 'created_at' },
                { header: 'Fecha Cierre', key: 'closed_at' },
                { header: 'Tiempo de Cierre', key: 'time_to_close' },
            ],
            data
        });
    };

    // Genera un reporte Excel con el historial de tickets filtrados
    // Incluye más detalles que el PDF: descripción completa, todas las fechas en formato local
    // Usa la utilidad compartida generateExcel para crear el archivo
    const generateHistoryExcel = async () => {
        const data = filteredTickets.map((t, i) => ({
            nro: i + 1,
            id: `TK-${t.id.slice(0, 6).toUpperCase()}`,
            title: t.title,
            description: t.description || '',
            requester: t.requester?.full_name || 'N/A',
            attendant: t.attendant?.full_name || 'Sin asignar',
            ubicacion: t.locations?.name || 'N/A',
            priority: PRIORITY_STYLES[t.priority]?.label || t.priority,
            complexity: complexityReportLabel(t),
            status: 'Archivado',
            created_at: new Date(t.created_at).toLocaleString(),
            closed_at: t.closed_at ? new Date(t.closed_at).toLocaleString() : 'N/A',
            time_to_close: getTimeToClose(t)
        }));

        await generateExcel({
            title: 'Historial de Tickets Archivados',
            filename: 'Historial Tickets',
            columns: [
                { header: 'N°', key: 'nro', width: 6 },
                { header: 'ID', key: 'id', width: 16 },
                { header: 'Título / Incidente', key: 'title', width: 40 },
                { header: 'Descripción', key: 'description', width: 50 },
                { header: 'Solicitante', key: 'requester', width: 25 },
                { header: 'Atendido Por', key: 'attendant', width: 25 },
                { header: 'Ubicación', key: 'ubicacion', width: 20 },
                { header: 'Prioridad', key: 'priority', width: 15 },
                { header: 'Complejidad', key: 'complexity', width: 24 },
                { header: 'Estado', key: 'status', width: 15 },
                { header: 'Fecha Creación', key: 'created_at', width: 22 },
                { header: 'Fecha Cierre', key: 'closed_at', width: 22 },
                { header: 'Tiempo de Cierre', key: 'time_to_close', width: 22 },
            ],
            data
        });
    };




    if (loading) {
        return (
            <LoadingSpinner className="bg-[#f8f9fc]" label="Cargando historial..." />
        );
    }

    return (
        <div className="flex flex-col h-full bg-white font-sans min-h-screen relative overflow-hidden">
            <div className="flex-1 overflow-y-auto bg-[#f8fafc]">
                <div className="w-full px-4 md:px-8 xl:px-12 py-8 space-y-4">

                    {/* Action Bar */}
                    <div className="bg-white border border-slate-200 rounded-none p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4 shadow-sm hover:shadow-md transition-all relative">
                        <div className="absolute -top-3 -left-3">
                            <div className="bg-[#002855] text-white px-3 py-1 text-[10px] font-semibold uppercase tracking-tight shadow-xl">
                                {filteredTickets.length} Tickets
                            </div>
                        </div>

                        {/* Search */}
                        <div className="flex-1 relative group/search">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 text-[12px] font-semibold text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 uppercase tracking-[0.1em]"
                            />
                        </div>

                        {/* Filters & Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                            <FilterBar
                                filters={[
                                    {
                                        key: 'priority', placeholder: 'Todas las prioridades', options: [
                                            { value: 'critical', label: 'P1 - Crítica' },
                                            { value: 'high', label: 'P2 - Alta' },
                                            { value: 'medium', label: 'P3 - Media' },
                                            { value: 'low', label: 'P4 - Baja' },
                                        ]
                                    },
                                    {
                                        key: 'complexity', placeholder: 'Toda complejidad', options: COMPLEXITY_LEVELS.map(level => ({
                                            value: level,
                                            label: COMPLEXITY_LABELS[level],
                                        }))
                                    },
                                    {
                                        key: 'dateRange', placeholder: 'Todo el tiempo', options: [
                                            { value: '7days', label: 'Últimos 7 días' },
                                            { value: '30days', label: 'Últimos 30 días' },
                                            { value: '90days', label: 'Últimos 90 días' },
                                            { value: 'custom', label: 'Rango Personalizado' },
                                        ]
                                    },
                                ]}
                                values={{ priority: filterPriority, complexity: filterComplexity, dateRange: filterDateRange }}
                                onChange={(key, value) => {
                                    if (key === 'priority') setFilterPriority(value as string[]);
                                    else if (key === 'complexity') setFilterComplexity(value as string[]);
                                    else if (key === 'dateRange') setFilterDateRange(value as string[]);
                                }}
                                hideClearButton
                            />

                            {/* Refrescar */}
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-4 py-3 bg-[#002855] text-white text-[10px] font-semibold uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm disabled:opacity-50"
                            >
                                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                                Refrescar
                            </button>

                            <button
                                onClick={generateHistoryExcel}
                                disabled={filteredTickets.length === 0}
                                className="group flex items-center justify-center w-10 h-10 bg-white text-slate-400 border border-slate-200 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm disabled:opacity-50"
                                title="Exportar a Excel"
                            >
                                <RiFileExcel2Fill size={20} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                            </button>

                            <button
                                onClick={generateHistoryPDF}
                                disabled={filteredTickets.length === 0}
                                className="group flex items-center justify-center w-10 h-10 bg-white text-slate-400 border border-slate-200 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 transition-all shadow-sm disabled:opacity-50"
                                title="Exportar a PDF"
                            >
                                <FaFilePdf size={20} className="text-slate-400 group-hover:text-rose-600 transition-colors" />
                            </button>
                        </div>
                    </div>

                    {filterDateRange.includes('custom') && (
                        <div className="flex items-center gap-3 animate-in slide-in-from-left-2 duration-300">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Desde</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-none text-[#002855] focus:outline-none focus:border-[#002855]/30 text-sm font-medium"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Hasta</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-none text-[#002855] focus:outline-none focus:border-[#002855]/30 text-sm font-medium"
                                />
                            </div>
                        </div>
                    )}

                    {filteredTickets.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-none p-16 text-center shadow-sm">
                            <div className="w-24 h-24 rounded-full bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center mx-auto mb-6">
                                <ShieldCheck size={48} className="text-slate-300" />
                            </div>
                            <h3 className="text-xl font-semibold text-[#002855] uppercase tracking-widest mb-2">No se encontraron tickets</h3>
                            <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest">
                                {searchTerm || filterPriority.length > 0 || filterComplexity.length > 0 || filterDateRange.length > 0
                                    ? 'Intenta ajustar los filtros de búsqueda'
                                    : 'Los tickets cerrados aparecerán aquí después de 10 minutos'
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden flex flex-col">
                            {/* Mobile view */}
                            <div className="md:hidden space-y-3 p-4 bg-slate-50 border-b border-slate-200">
                                {filteredTickets.map((ticket) => {
                                    const prio = PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.medium;
                                    return (
                                        <div key={ticket.id} onClick={() => navigate(`/ticket/${ticket.id}`)} className="bg-white border border-slate-200 p-4 active:bg-slate-50 transition-all cursor-pointer">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-semibold text-[#002855] uppercase">#TK-{ticket.id.slice(0, 6)}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-semibold tracking-wider ${prio.color}`}>
                                                        {prio.label}
                                                    </span>
                                                    {ticket.category === COMPLEXITY_CATEGORY && (
                                                        <ComplexityBadge level={ticket.complexity_level} />
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-[12px] font-semibold text-slate-700 uppercase leading-tight mb-2 line-clamp-2">{ticket.title}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-2">
                                                <span className="truncate">{ticket.locations?.name || 'Central'}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                                                <div className="flex items-center justify-between">
                                                    <span>Solicitante:</span>
                                                    <span className="font-semibold text-slate-600">{ticket.requester?.full_name || 'N/A'}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span>Atendido por:</span>
                                                    <span className="font-semibold text-slate-600">{ticket.attendant?.full_name || 'Sin asignar'}</span>
                                                </div>
                                                <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-50">
                                                    <span>Cierre:</span>
                                                    <span className="font-semibold text-slate-600">{ticket.closed_at ? new Date(String(ticket.closed_at).includes('T') ? String(ticket.closed_at) : `${ticket.closed_at}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : 'N/A'}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span>Tiempo:</span>
                                                    <span className="font-semibold text-slate-600">{getTimeToClose(ticket)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="hidden md:block overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">ID</TableHead>
                                            <TableHead>Incidente</TableHead>
                                            <TableHead>Solicitante</TableHead>
                                            <TableHead>Atendido por</TableHead>
                                            <TableHead>Prioridad</TableHead>
                                            <TableHead>Complejidad</TableHead>
                                            <TableHead>Tiempos</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredTickets.map((ticket) => {
                                            const prio = PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.medium;
                                            return (
                                                <TableRow key={ticket.id} onClick={() => navigate(`/ticket/${ticket.id}`)}>
                                                    <TableCell className="font-semibold w-12">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-none flex items-center justify-center shadow-sm transition-all duration-300 bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-md">
                                                                <TicketIcon size={14} />
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-[14px] font-semibold text-[#002855] uppercase leading-tight group-hover:text-blue-600 transition-colors">
                                                                #{ticket.id.slice(0, 6).toUpperCase()} - {ticket.title}
                                                            </span>
                                                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-1">
                                                                {ticket.locations?.name || 'Central'}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <User size={12} className="text-slate-400" />
                                                            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest">{ticket.requester?.full_name || 'N/A'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {ticket.attendant ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest">{ticket.attendant.full_name}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Sin asignar</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[9px] font-semibold uppercase tracking-widest ${prio.color}`}>
                                                                {prio.label}
                                                            </span>
                                                            {ticket.category === COMPLEXITY_CATEGORY && (
                                                                <ComplexityBadge level={ticket.complexity_level} />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1 text-[10px] font-semibold text-slate-600">
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar size={12} className="text-slate-400" />
                                                                <span className="uppercase tracking-widest">
                                                                    {ticket.closed_at ? new Date(String(ticket.closed_at).includes('T') ? String(ticket.closed_at) : `${ticket.closed_at}T12:00:00`).toLocaleDateString('es-PE', {
                                                                        day: '2-digit', month: 'short', year: 'numeric'
                                                                    }) : 'N/A'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <Clock size={12} className="text-slate-400" />
                                                                <span className="uppercase tracking-widest">Resuelto en {getTimeToClose(ticket)}</span>
                                                            </div>
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
            </div>
        </div>
    );
}
