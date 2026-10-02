// =============================================================================
// TicketDetailModal.tsx — Modal de detalle rápido de ticket
// Funcionalidades:
//   - Vista compacta del ticket (información + chat en pestañas)
//   - Muestra el nivel de complejidad técnica (N1/N2/N3) en tickets de Sistemas
//   - Chat en tiempo real con envío de mensajes e imágenes
//   - Gestión de estado del ticket (Pendiente → En Proceso → Resuelto → Cerrado)
//   - Eliminación de ticket con limpieza de adjuntos
//   - Diseñado para usarse desde listas (MyChatsPage, etc.) no desde la página completa
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { X, Send, User, Clock, MessageSquare, Trash2, ShieldCheck, Image as ImageIcon, Loader2, Ticket, MessageCircle } from 'lucide-react';
import { supabase } from '../../../shared/services/supabase';
import { useAuth } from '../../../app/providers/AuthContext';
import { useNotify } from '../../../shared/hooks/useNotify';
import ModalOverlay from '../../../shared/components/ui/ModalOverlay';
import ComplexityBadge from './ComplexityBadge';
import { COMPLEXITY_CATEGORY } from '../tickets.types';

// Props del componente modal
// ticket: Datos del ticket a mostrar
// onClose: Función para cerrar el modal
// onUpdate: Función para recargar la lista de tickets padre
type TicketDetailModalProps = {
    ticket: any;
    onClose: () => void;
    onUpdate: () => void;
};

export default function TicketDetailModal({ ticket: initialTicket, onClose, onUpdate }: TicketDetailModalProps) {
    const { user } = useAuth(); // Usuario actual autenticado
    const { error: notifyError, warning: notifyWarning, confirm } = useNotify(); // Sistema de notificaciones
    const [currentTicket, setCurrentTicket] = useState<any>(initialTicket); // Datos del ticket (se actualiza en tiempo real)
    const [comments, setComments] = useState<any[]>([]); // Lista de comentarios del ticket
    const [newComment, setNewComment] = useState(''); // Texto del nuevo comentario en edición
    const [sending, setSending] = useState(false); // Indicador de envío en progreso
    const commentsEndRef = useRef<HTMLDivElement>(null); // Referencia al final de la lista para auto-scroll
    const [statusUpdating, setStatusUpdating] = useState(false); // Indicador de actualización de estado
    const [activeTab, setActiveTab] = useState<'details' | 'feed'>('feed'); // Pestaña activa en móvil (detalles o chat)
    const [uploadingImage, setUploadingImage] = useState(false); // Indicador de subida de imagen
    const fileInputRef = useRef<HTMLInputElement>(null); // Referencia al input de archivos

    // Actualiza el ticket cuando cambia el prop inicialTicket
    useEffect(() => {
        setCurrentTicket(initialTicket);
    }, [initialTicket]);

    // Carga comentarios y suscribe a actualizaciones en tiempo real
    // Suscripción 1: Escucha cambios en el ticket (estado, asignaciones)
    // Suscripción 2: Escucha nuevos comentarios y los agrega al estado local
    useEffect(() => {
        fetchComments();

        const ticketSubscription = supabase
            .channel(`ticket-status-${currentTicket.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'tickets',
                filter: `id=eq.${currentTicket.id}`
            }, async () => {
                const { data } = await supabase
                    .from('tickets')
                    .select(`
                        *,
                        requester:requester_id(full_name, email, avatar_url),
                        attendant:assigned_to(full_name, email, avatar_url),
                        locations(name)
                    `)
                    .eq('id', currentTicket.id)
                    .single();

                if (data) setCurrentTicket(data);
                onUpdate();
            })
            .subscribe();

        const commentsSubscription = supabase
            .channel(`comments-feed-${currentTicket.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'ticket_comments',
                filter: `ticket_id=eq.${currentTicket.id}`
            }, async (payload) => {
                // Fetch only the new comment's author info to append to state
                const { data } = await supabase
                    .from('ticket_comments')
                    .select(`
                        id, content, created_at, user_id, ticket_id,
                        author:user_id(full_name, avatar_url)
                    `)
                    .eq('id', (payload.new as any).id)
                    .single();
                
                if (data) {
                    setComments(prev => {
                        if (prev.some(c => c.id === data.id)) return prev;
                        return [...prev, data];
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ticketSubscription);
            supabase.removeChannel(commentsSubscription);
        };
    }, [currentTicket.id]);

    // Auto-scroll al fondo cuando se agregan nuevos comentarios
    useEffect(() => {
        scrollToBottom();
    }, [comments]);

    // Hace scroll suave hasta el último comentario
    const scrollToBottom = () => {
        setTimeout(() => {
            commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    // Carga todos los comentarios del ticket ordenados cronológicamente
    const fetchComments = async () => {
        try {
            const { data, error } = await supabase
                .from('ticket_comments')
                .select(`
                    id, content, created_at, user_id, ticket_id,
                    author:user_id(full_name, avatar_url)
                `)
                .eq('ticket_id', currentTicket.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setComments(data || []);
        } catch (error) {
            console.error('Error fetching comments:', error);
        }
    };

    // Sube una imagen al storage de Supabase y la agrega como comentario
    // Usa formato markdown ![imagen](url) para mostrar la imagen en el chat
    // La imagen se guarda en la ruta: ticket_{id}/nombre_archivo
    const uploadFile = async (file: File) => {
        if (!currentTicket) return;
        try {
            setUploadingImage(true);
            const fileExt = file.name.split('.').pop() || 'png';
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `ticket_${currentTicket.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(filePath);

            const { error: commentError } = await supabase
                .from('ticket_comments')
                .insert([{
                    ticket_id: currentTicket.id,
                    user_id: user?.id,
                    content: `![imagen](${publicUrl})`
                }]);

            if (commentError) throw commentError;
            fetchComments();
        } catch (error: any) {
            console.error('Error al subir imagen:', error);
            notifyError('No se pudo subir la imagen: ' + (error.message || 'Error desconocido'), 'Error de carga');
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Maneja la selección de imagen desde el input file
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await uploadFile(file);
    };

    // Permite pegar imágenes directamente desde el portapapeles
    const handlePaste = async (e: React.ClipboardEvent) => {
        const item = e.clipboardData.items[0];
        if (item?.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) await uploadFile(file);
        }
    };

    // Envía un nuevo comentario al ticket
    // Inserta el comentario en la base de datos y recarga la lista
    const handleSendComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            setSending(true);
            const { error } = await supabase
                .from('ticket_comments')
                .insert([
                    {
                        ticket_id: currentTicket.id,
                        user_id: user?.id,
                        content: newComment.trim()
                    }
                ]);

            if (error) throw error;
            setNewComment('');
            fetchComments();
        } catch (error) {
            console.error('Error sending comment:', error);
        } finally {
            setSending(false);
        }
    };

    // Elimina el ticket si tiene permisos
    // Solo el creador (3 min desde creación) o staff (super_admin, sistemas, gerencia, supervisores) pueden eliminar
    // Primero limpia archivos adjuntos del storage, luego elimina el registro
    // Esto evita dejar archivos huérfanos en el storage
    const handleDeleteTicket = async () => {
        const now = new Date();
        const createdDate = new Date(currentTicket.created_at);
        const minutesDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60);
        const isOwner = user?.id === currentTicket.requester_id;
        const isStaff = user?.role === 'super_admin' || user?.role === 'sistemas' || user?.role === 'gerencia' || user?.role === 'supervisores';
        const canDelete = isStaff || (isOwner && minutesDiff <= 3);

        if (!canDelete) {
            notifyWarning(isOwner ? 'Tiempo agotado (3 min).' : 'Acceso Denegado.', 'Acción no permitida');
            return;
        }

        const confirmed = await confirm(
            'Esta acción no se puede deshacer.',
            '¿Eliminar ticket?'
        );
        if (!confirmed) return;

        try {
            setStatusUpdating(true);
            
            // Limpiar archivos adjuntos antes de eliminar el ticket
            const { data: files } = await supabase.storage.from('chat-attachments').list(`ticket_${currentTicket.id}`);
            if (files && files.length > 0) {
                await supabase.storage.from('chat-attachments').remove(
                    files.map(f => `ticket_${currentTicket.id}/${f.name}`)
                );
            }

            const { error } = await supabase.from('tickets').delete().eq('id', currentTicket.id);
            if (error) throw error;
            onUpdate();
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setStatusUpdating(false);
        }
    };

    // Actualiza el estado del ticket (solo el técnico asignado)
    // Al cambiar a "in_progress" asigna automáticamente al técnico y registra attended_at
    // Cada cambio de estado se registra como un comentario automático en el feed
    // Esto mantiene un historial de cambios visible para todos los participantes
    const handleStatusUpdate = async (newStatus: string) => {
        const isAssignedTechnician = user?.id === currentTicket.assigned_to;
        
        if (!isAssignedTechnician) return;

        try {
            setStatusUpdating(true);
            const updatePayload: any = { status: newStatus };
            if (newStatus === 'in_progress') {
                updatePayload.assigned_to = user?.id;
                updatePayload.attended_at = new Date().toISOString();
            }

            const { error } = await supabase.from('tickets').update(updatePayload).eq('id', currentTicket.id);
            if (error) throw error;

            await supabase.from('ticket_comments').insert([{
                ticket_id: currentTicket.id,
                user_id: user?.id,
                content: `Cambió el estado a: **${getStatusLabel(newStatus)}**`,
            }]);

            fetchComments();
            onUpdate();
        } catch (error) {
            console.error(error);
        } finally {
            setStatusUpdating(false);
        }
    };

    // Funciones auxiliares para mostrar etiquetas legibles y estilos visuales
    // Estas funciones traducen valores técnicos a formato amigable para el usuario
    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'open': return 'Pendiente';
            case 'in_progress': return 'Atendiendo';
            case 'resolved': return 'Resuelto';
            case 'closed': return 'Cerrado';
            default: return status;
        }
    };

    const getPriorityLabel = (priority: string) => {
        switch (priority) {
            case 'critical': return 'P1 - Crítica';
            case 'high': return 'P2 - Alta';
            case 'medium': return 'P3 - Media';
            case 'low': return 'P4 - Baja';
            default: return priority;
        }
    };

    const getPriorityStyle = (priority: string) => {
        switch (priority) {
            case 'critical': return 'text-rose-600 bg-rose-50 border-rose-100';
            case 'high': return 'text-orange-600 bg-orange-50 border-orange-100';
            case 'medium': return 'text-blue-600 bg-blue-50 border-blue-100';
            default: return 'text-slate-600 bg-slate-50 border-slate-100';
        }
    };

    // Verifica si el usuario actual puede gestionar el estado del ticket
    // Solo el técnico asignado (assigned_to) tiene permisos para cambiar estado
    const canManageStatus = user?.id === currentTicket.assigned_to;

    return (
        <ModalOverlay className="bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-none shadow-2xl w-full h-full max-h-[95vh] sm:max-h-[85vh] md:max-h-[700px] max-w-5xl flex flex-col overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-8 duration-500">

                {/* Header for mobile */}
                <div className="flex md:hidden bg-gradient-to-r from-blue-900 to-blue-900 px-4 py-3 items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-white/10 rounded-none flex items-center justify-center border border-white/20">
                            <MessageCircle size={16} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-[10px] font-normal text-white uppercase tracking-[0.2em] leading-tight">CANAL DE SEGUIMIENTO</h3>
                            <p className="text-[7px] font-normal text-blue-200 uppercase tracking-widest mt-0.5">Interacción en tiempo real</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDeleteTicket}
                            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-none transition-all"
                            title="Eliminar ticket"
                        >
                            <Trash2 size={14} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-none transition-all"
                            title="Cerrar ventana"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Mobile Tabs */}
                <div className="flex md:hidden border-b border-slate-100 bg-white">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`flex-1 py-3 text-xs font-normal uppercase tracking-widest transition-all ${
                            activeTab === 'details' 
                                ? 'text-[#002855] border-b-2 border-[#002855] bg-[#F8FAFC]' 
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        Detalles
                    </button>
                    <button
                        onClick={() => setActiveTab('feed')}
                        className={`flex-1 py-3 text-xs font-normal uppercase tracking-widest transition-all ${
                            activeTab === 'feed' 
                                ? 'text-[#002855] border-b-2 border-[#002855] bg-[#F8FAFC]' 
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        Chat
                    </button>
                </div>

                {/* Content Container */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    {/* Left side: Information - Hidden on mobile unless active tab is details */}
                    <div className={`${
                        activeTab === 'details' ? 'flex' : 'hidden'
                    } md:flex w-full md:w-[420px] bg-[#F8FAFC] border-r border-slate-100 p-4 sm:p-6 md:p-10 flex-col overflow-y-auto custom-scrollbar`}>
                        <div className="flex items-center justify-between mb-6 sm:mb-8 md:mb-10">
                            <span className="text-[8px] sm:text-[9px] md:text-[10px] font-normal text-slate-300 uppercase tracking-[0.2em] sm:tracking-[0.25em] md:tracking-[0.3em]">#TK-{currentTicket.id.slice(0, 8)}</span>
                            <div className="flex items-center gap-2">
                                <div className={`px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[7px] sm:text-[8px] md:text-[9px] font-normal uppercase tracking-[0.15em] sm:tracking-[0.2em] border ${getPriorityStyle(currentTicket.priority)}`}>
                                    {getPriorityLabel(currentTicket.priority)}
                                </div>
                                {currentTicket.category === COMPLEXITY_CATEGORY && (
                                    <ComplexityBadge level={currentTicket.complexity_level} variant="full" />
                                )}
                            </div>
                        </div>

                        <h2 className="text-lg sm:text-xl md:text-2xl font-normal text-[#002855] leading-tight mb-4 sm:mb-6 md:mb-8 uppercase italic">{currentTicket.title}</h2>

                        <div className="space-y-6 sm:space-y-8 md:space-y-10">
                            <div className="bg-white p-4 sm:p-5 md:p-6 rounded-[1rem] sm:rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm relative group">
                                <span className="absolute -top-2 sm:-top-2.5 md:-top-3 left-3 sm:left-4 md:left-6 bg-[#002855] text-white px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded-lg text-[7px] sm:text-[8px] md:text-[9px] font-normal uppercase tracking-widest">Detalle Inicial</span>
                                <p className="text-[11px] sm:text-[12px] md:text-[13px] text-slate-500 leading-relaxed pt-1 sm:pt-1.5 md:pt-2">
                                    {currentTicket.description}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:gap-4">
                                <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 md:p-5 bg-white rounded-[1.5rem] sm:rounded-2xl md:rounded-3xl border border-slate-100">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F8FAFC] flex items-center justify-center text-slate-400 border border-slate-100 shadow-inner overflow-hidden">
                                        {currentTicket.requester?.avatar_url ? (
                                            <img src={currentTicket.requester.avatar_url} className="w-full h-full object-cover" />
                                        ) : <User size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[7px] sm:text-[8px] md:text-[9px] font-normal text-slate-300 uppercase tracking-widest mb-0.5">Reportado Por</p>
                                        <p className="text-xs sm:text-xs md:text-xs font-normal text-[#002855] uppercase truncate">{currentTicket.requester?.full_name}</p>
                                        <p className="text-[8px] sm:text-[9px] md:text-[10px] font-normal text-blue-500 uppercase mt-0.5 truncate">{currentTicket.locations?.name || 'Sede Central'}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 md:p-5 bg-white rounded-[1.5rem] sm:rounded-2xl md:rounded-3xl border border-slate-100">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F8FAFC] flex items-center justify-center text-slate-400 border border-slate-100 shadow-inner">
                                        <Clock size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[7px] sm:text-[8px] md:text-[9px] font-normal text-slate-300 uppercase tracking-widest mb-0.5">Fecha de Apertura</p>
                                        <p className="text-xs sm:text-xs md:text-xs font-normal text-[#002855] truncate">{new Date(currentTicket.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    </div>
                                </div>

                                {currentTicket.attendant && (
                                    <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 md:p-5 bg-blue-600 rounded-[1.5rem] sm:rounded-2xl md:rounded-3xl border border-blue-500 shadow-lg shadow-blue-100">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20 overflow-hidden">
                                            {currentTicket.attendant?.avatar_url ? (
                                                <img src={currentTicket.attendant.avatar_url} className="w-full h-full object-cover" />
                                            ) : <ShieldCheck size={16} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[7px] sm:text-[8px] md:text-[9px] font-normal text-white/50 uppercase tracking-widest mb-0.5">Técnico Asignado</p>
                                            <p className="text-xs sm:text-xs md:text-xs font-normal text-white uppercase truncate">{currentTicket.attendant?.full_name}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 sm:pt-8 md:pt-10 border-t border-slate-200">
                                <p className="text-[8px] sm:text-[9px] md:text-[10px] font-normal text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.25em] md:tracking-[0.3em] mb-3 sm:mb-4">Gestión de Estado</p>
                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                    {['open', 'resolved', 'closed'].map(st => (
                                        <button
                                            key={st}
                                            onClick={() => handleStatusUpdate(st)}
                                            disabled={!canManageStatus || statusUpdating}
                                            className={`px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[7px] sm:text-[8px] md:text-[9px] font-normal uppercase tracking-widest transition-all ${
                                                currentTicket.status === st 
                                                    ? 'bg-[#002855] text-white shadow-lg sm:shadow-xl scale-105' 
                                                    : 'bg-white text-slate-300 border border-slate-100 hover:border-slate-300 hover:text-slate-500'
                                            }`}
                                        >
                                            {getStatusLabel(st)}
                                        </button>
                                    ))}
                                    {canManageStatus && (
                                        <button
                                            key="in_progress"
                                            onClick={() => handleStatusUpdate('in_progress')}
                                            disabled={statusUpdating}
                                            className={`px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[7px] sm:text-[8px] md:text-[9px] font-normal uppercase tracking-widest transition-all ${
                                                currentTicket.status === 'in_progress' 
                                                    ? 'bg-[#002855] text-white shadow-lg sm:shadow-xl scale-105' 
                                                    : 'bg-white text-slate-300 border border-slate-100 hover:border-slate-300 hover:text-slate-500'
                                            }`}
                                        >
                                            {getStatusLabel('in_progress')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right side: Interaction Feed - Hidden on mobile unless active tab is feed */}
                    <div className={`${
                        activeTab === 'feed' ? 'flex' : 'hidden'
                    } md:flex flex-1 flex-col bg-white relative`}>
                        {/* Desktop Header - Hidden on mobile */}
                        <div className="hidden md:flex bg-gradient-to-r from-blue-900 to-blue-900 px-5 py-4 items-center justify-between shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="w-9 h-9 bg-white/10 rounded-none flex items-center justify-center border border-white/20">
                                    <MessageCircle size={18} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-normal text-white uppercase tracking-[0.2em] leading-tight">CANAL DE SEGUIMIENTO</h3>
                                    <p className="text-[10px] font-normal text-blue-200 uppercase tracking-widest mt-0.5">Interacción directa en tiempo real</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleDeleteTicket}
                                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-none transition-all"
                                    title="Eliminar ticket"
                                >
                                    <Trash2 size={20} />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-none transition-all"
                                    title="Cerrar ventana"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 custom-scrollbar bg-[#F8FAFC]/30">
                            {comments.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 sm:space-y-6">
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center">
                                        <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
                                    </div>
                                    <p className="text-[9px] sm:text-[10px] md:text-[11px] font-normal uppercase tracking-[0.3em] sm:tracking-[0.4em] opacity-30 text-center px-4">Aún no hay mensajes</p>
                                </div>
                            ) : comments.map((c) => {
                                const isMe = c.user_id === user?.id;
                                const isSystem = c.content.includes('Cambió el estado');

                                if (isSystem) {
                                    return (
                                        <div key={c.id} className="flex justify-center">
                                            <div className="bg-white border border-slate-100 px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 rounded-full shadow-sm text-[7px] sm:text-[8px] md:text-[9px] font-normal text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] flex items-center gap-2 sm:gap-3 animate-in fade-in zoom-in duration-500">
                                                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-500" />
                                                <span className="text-center">{c.content.replace(/\*\*/g, '')}</span>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={c.id} className={`flex gap-3 sm:gap-4 md:gap-5 ${isMe ? 'flex-row-reverse' : ''} group`}>
                                        <div className="relative shrink-0">
                                            <div className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-white shadow-lg sm:shadow-xl ${
                                                isMe ? 'bg-blue-600' : 'bg-[#002855]'
                                            }`}>
                                                {c.author?.avatar_url ? (
                                                    <img src={c.author.avatar_url} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-white font-normal text-xs sm:text-sm">
                                                        {c.author?.full_name?.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            {c.user_id === currentTicket.requester_id && (
                                                <div 
                                                    className={`absolute -top-1 sm:-top-1.5 ${isMe ? '-left-1 sm:-left-1.5' : '-right-1 sm:-right-1.5'} bg-amber-500 text-white rounded-full p-0.5 sm:p-1 border-2 border-white shadow-sm z-10`}
                                                    title="Solicitante del Ticket"
                                                >
                                                    <Ticket className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                                </div>
                                            )}
                                        </div>
                                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%] sm:max-w-[75%] md:max-w-[80%]`}>
                                            <div className={`p-3 sm:p-4 md:p-6 rounded-[1rem] sm:rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm text-[11px] sm:text-[12px] md:text-[13px] leading-relaxed transition-all ${
                                                isMe 
                                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                                    : 'bg-white border border-slate-100 text-[#002855] rounded-tl-none group-hover:shadow-md'
                                            }`}>
                                                {c.content.startsWith('![imagen]') ? (
                                                    <div className="space-y-2">
                                                        <img 
                                                            src={c.content.match(/\((.*?)\)/)?.[1]} 
                                                            alt="Adjunto" 
                                                            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                            onClick={() => window.open(c.content.match(/\((.*?)\)/)?.[1], '_blank')}
                                                        />
                                                        <span className="text-[10px] opacity-70 block italic">Imagen adjunta</span>
                                                    </div>
                                                ) : c.content}
                                            </div>
                                            <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-3 px-1 sm:px-2">
                                                <span className="text-[7px] sm:text-[8px] md:text-[9px] font-normal text-slate-400 uppercase tracking-widest">{c.author?.full_name}</span>
                                                <span className="w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full bg-slate-200"></span>
                                                <span className="text-[7px] sm:text-[8px] md:text-[9px] font-normal text-slate-400 uppercase">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={commentsEndRef} />
                        </div>

                        <div className="p-3 sm:p-4 bg-white border-t border-slate-50">
                            <form onSubmit={handleSendComment} className="flex items-center gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    accept="image/*"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingImage}
                                    className="p-2 sm:p-3 text-[#002855] bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-xl transition-all shadow-sm"
                                    title="Subir imagen"
                                >
                                    {uploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                                </button>
                                <div className="flex-1 relative group">
                                    <input
                                        type="text"
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onPaste={handlePaste}
                                        placeholder={uploadingImage ? "Subiendo imagen..." : "Escribe un mensaje aquí (o pega una imagen)..."}
                                        className="w-full h-10 sm:h-12 pl-4 sm:pl-6 pr-12 sm:pr-16 bg-[#F8FAFC] rounded-[1rem] sm:rounded-[1.5rem] border border-slate-200 outline-none focus:ring-3 sm:focus:ring-4 focus:ring-blue-100 text-[11px] sm:text-[13px] font-normal text-[#002855] placeholder:text-slate-400 transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newComment.trim() || sending}
                                        className="absolute right-1 sm:right-1.5 top-1 sm:top-1.5 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200 hover:scale-110 active:scale-95 transition-all disabled:opacity-30"
                                    >
                                        <Send className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </ModalOverlay>
    );
}
