// =============================================================================
// MyChatsPage.tsx — Página "Mis Chats" del usuario actual
// Funcionalidades:
//   - Muestra tickets creados por el usuario y tickets que atiende
//   - Filtros por estado (Todos, Pendientes, En Proceso, Resueltos)
//   - Búsqueda por título o solicitante
//   - Modal de detalle del ticket (TicketDetailModal)
//   - Suscripción en tiempo real a cambios en tickets propios
// =============================================================================

import { useState, useEffect } from 'react';
import { useAuth } from '../../../app/providers/AuthContext';
import { supabase } from '../../../shared/services/supabase';
import { MessageSquare } from 'lucide-react';
import TicketDetailModal from '../components/TicketDetailModal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../shared/components/ui/Table';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';

// Mapa de estilos visuales para las prioridades en badges
const PRIORITY_STYLES: Record<string, { label: string, color: string, dot: string }> = {
    critical: { label: 'P1 - Crítica', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
    high: { label: 'P2 - Alta', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
    medium: { label: 'P3 - Media', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    low: { label: 'P4 - Baja', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-500' }
};

export default function MyChats() {
    const { user } = useAuth();
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<any>(null); // Ticket seleccionado para modal
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');

    // Carga inicial + suscripción en tiempo real a cambios en tickets
    // Escucha INSERT, UPDATE, DELETE para mantener la lista sincronizada
    useEffect(() => {
        const initializeData = async () => {
            await fetchMyTickets();
        };

        initializeData();

        // Canal de tiempo real para cambios en tickets que nos pertenecen
        const subscription = supabase
            .channel(`my-tickets-updates-${user?.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tickets'
            }, async (payload) => {
                if (payload.eventType === 'UPDATE') {
                    // Actualización: reemplazar el ticket modificado en el estado local
                    setTickets(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
                } else if (payload.eventType === 'INSERT') {
                    // Solo recargar si el ticket nos pertenece (creado o asignado)
                    if (payload.new.requester_id === user?.id || payload.new.assigned_to === user?.id) {
                        fetchMyTickets();
                    }
                } else if (payload.eventType === 'DELETE') {
                    setTickets(prev => prev.filter(t => t.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => { void supabase.removeChannel(subscription); };
    }, [user?.id]);

    // Obtiene tickets donde el usuario es solicitante o está asignado como técnico
    const fetchMyTickets = async () => {
        try {
            const { data, error } = await supabase
                .from('tickets')
                .select(`
                    id, title, status, priority, created_at, updated_at, requester_id, assigned_to,
                    requester:requester_id(full_name, avatar_url),
                    attendant:assigned_to(full_name, avatar_url),
                    locations(name)
                `)
                .or(`requester_id.eq.${user?.id},assigned_to.eq.${user?.id}`)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setTickets(data || []);
        } catch (error) {
            console.error('Error fetching tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    // Convierte el código de estado interno a una etiqueta legible en español
    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'open': return 'Pendiente';
            case 'in_progress': return 'En Proceso';
            case 'resolved': return 'Resuelto';
            case 'closed': return 'Cerrado';
            default: return status;
        }
    };

    // Convierte el código de estado interno a las clases de color resaltadas
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-amber-100 text-amber-700';
            case 'in_progress': return 'bg-blue-100 text-blue-700';
            case 'resolved': return 'bg-emerald-100 text-emerald-700';
            case 'closed': return 'bg-slate-100 text-slate-600';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    // Filtra tickets por término de búsqueda y filtro de estado activo
    const filteredTickets = tickets.filter(ticket => {
        const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.requester?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter = activeFilter === 'all' || ticket.status === activeFilter;

        return matchesSearch && matchesFilter;
    });

    // Separa los tickets en dos categorías:
    // - Creados por mí (soy el solicitante)
    // - Atendidos por mí (soy el técnico asignado, pero no el creador)
    const myCreatedTickets = filteredTickets.filter(t => t.requester_id === user?.id);
    const myAttendedTickets = filteredTickets.filter(t => t.assigned_to === user?.id && t.requester_id !== user?.id);

    if (loading) {
        return (
            <LoadingSpinner label="Cargando chats..." />
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-[#002855] mb-2">Mis Chats</h1>
                <p className="text-gray-600">Todos tus tickets y conversaciones en un solo lugar</p>
            </div>

            {/* Filtros y búsqueda */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        {[
                            { key: 'all', label: 'Todos' },
                            { key: 'open', label: 'Pendientes' },
                            { key: 'in_progress', label: 'En Proceso' },
                            { key: 'resolved', label: 'Resueltos' }
                        ].map(filter => (
                            <button
                                key={filter.key}
                                onClick={() => setActiveFilter(filter.key as any)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === filter.key
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tickets creados por mí */}
            {myCreatedTickets.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-2 h-6 bg-blue-500 rounded-full" />
                        <h2 className="text-sm font-semibold text-[#002855] tracking-[0.2em]">Mis Tickets Creados</h2>
                        <span className="text-[10px] font-semibold text-slate-600">{myCreatedTickets.length}</span>
                    </div>
                    <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <tr>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Incidente</TableHead>
                                    <TableHead className="text-center">Estado</TableHead>
                                    <TableHead>Asignado a</TableHead>
                                    <TableHead>Prioridad</TableHead>
                                    <TableHead>Fecha</TableHead>
                                </tr>
                            </TableHeader>
                            <TableBody>
                                {myCreatedTickets.map(t => {
                                    const prio = PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium;
                                    return (
                                        <TableRow key={t.id} onClick={() => setSelectedTicket(t)} className="cursor-pointer">
                                            <TableCell><span className="text-[11px] font-semibold text-[#002855]">#TK-{t.id.slice(0, 6).toUpperCase()}</span></TableCell>
                                            <TableCell>
                                                <p className="text-[13px] font-semibold text-[#002855] leading-tight line-clamp-1">{t.title}</p>
                                                <p className="text-[11px] font-semibold text-slate-400 tracking-wider mt-1">{t.locations?.name || 'Central'}</p>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`text-[14px] font-semibold ${getStatusColor(t.status)}`}>
                                                    {getStatusLabel(t.status)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {t.attendant ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-none bg-slate-100 flex items-center justify-center text-[10px] font-semibold text-slate-500 overflow-hidden">{t.attendant?.avatar_url ? <img src={t.attendant.avatar_url} className="w-full h-full object-cover" alt="" /> : t.attendant?.full_name?.charAt(0)}</div>
                                                        <span className="text-[11px] font-semibold text-slate-700">{t.attendant.full_name?.split(' ')[0]}</span>
                                                    </div>
                                                ) : <span className="text-[10px] text-slate-300 font-semibold">Sin asignar</span>}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`text-[14px] font-semibold ${prio.color}`}>
                                                    {prio.label}
                                                </span>
                                            </TableCell>
                                            <TableCell><span className="text-[10px] font-semibold text-slate-400">{new Date(String(t.created_at).includes('T') ? String(t.created_at) : `${t.created_at}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</span></TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {/* Tickets que atiendo */}
            {myAttendedTickets.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-2 h-6 bg-indigo-500 rounded-full" />
                        <h2 className="text-sm font-semibold text-[#002855] tracking-[0.2em]">Tickets que Atiendo</h2>
                        <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-semibold">{myAttendedTickets.length}</span>
                    </div>
                    <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <tr>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Incidente</TableHead>
                                    <TableHead className="text-center">Estado</TableHead>
                                    <TableHead>Solicitante</TableHead>
                                    <TableHead>Prioridad</TableHead>
                                    <TableHead>Fecha</TableHead>
                                </tr>
                            </TableHeader>
                            <TableBody>
                                {myAttendedTickets.map(t => {
                                    const prio = PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium;
                                    return (
                                        <TableRow key={t.id} onClick={() => setSelectedTicket(t)} className="cursor-pointer">
                                            <TableCell><span className="text-[11px] font-semibold text-[#002855]">#TK-{t.id.slice(0, 6).toUpperCase()}</span></TableCell>
                                            <TableCell>
                                                <p className="text-[13px] font-semibold text-[#002855] leading-tight line-clamp-1">{t.title}</p>
                                                <p className="text-[11px] font-semibold text-slate-400 tracking-wider mt-1">{t.locations?.name || 'Central'}</p>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`text-[14px] font-semibold ${getStatusColor(t.status)}`}>
                                                    {getStatusLabel(t.status)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-none bg-slate-100 flex items-center justify-center text-[10px] font-semibold text-slate-500 overflow-hidden">{t.requester?.avatar_url ? <img src={t.requester.avatar_url} className="w-full h-full object-cover" alt="" /> : t.requester?.full_name?.charAt(0)}</div>
                                                    <span className="text-[11px] font-semibold text-slate-700">{t.requester?.full_name?.split(' ')[0]}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`text-[14px] font-semibold ${prio.color}`}>
                                                    {prio.label}
                                                </span>
                                            </TableCell>
                                            <TableCell><span className="text-[10px] font-semibold text-slate-400">{new Date(String(t.created_at).includes('T') ? String(t.created_at) : `${t.created_at}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</span></TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {/* Estado vacío */}
            {filteredTickets.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">No tienes chats</h3>
                    <p className="text-gray-400">No se encontraron tickets que coincidan con tu búsqueda</p>
                </div>
            )}

            {/* Modal del ticket */}
            {selectedTicket && (
                <TicketDetailModal
                    ticket={selectedTicket}
                    onClose={() => setSelectedTicket(null)}
                    onUpdate={fetchMyTickets}
                />
            )}
        </div>
    );
}
