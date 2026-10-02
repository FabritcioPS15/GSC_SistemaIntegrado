// =============================================================================
// TicketDetailPage.tsx — Página de detalle de un ticket individual
// Funcionalidades:
//   - Visualización completa del ticket (título, descripción, AnyDesk, estado)
//   - Clasificación de complejidad técnica (N1/N2/N3) con escalamiento durante la atención
//   - Chat en tiempo real con editor de texto enriquecido (negrita, cursiva, etc.)
//   - Gestión de estados: Atender, Resolver, Cerrar, Finalizar (archivar)
//   - Panel de participantes con presencia en tiempo real
//   - Reapertura de tickets por el creador (ventana de 10 min)
//   - Contacto WhatsApp para tickets de alta prioridad
//   - Auto-asignación al creador vía ticket_assignments
// =============================================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, User, AlertCircle, MessageSquare, Copy, ArrowLeft, Lock, Smile, Bold, Italic, List, Image as ImageIcon, Loader2, Clock, Activity, CheckCircle2, XCircle, Underline, Strikethrough, Monitor, Eye, Briefcase, Terminal, Layers, ChevronDown } from 'lucide-react';
import { supabase } from '../../../shared/services/supabase';
import { useAuth } from '../../../app/providers/AuthContext';
import { FaWhatsapp, FaTrashAlt } from "react-icons/fa";
import { IoChatbubbles } from "react-icons/io5";
import { notifyTicketAttended, notifyTicketResolved, notifyTicketClosed } from '../../../shared/services/notifications';
import { useTicketComments } from '../hooks/useTicketComments';
import { useTicketRealtime } from '../hooks/useTicketRealtime';
import { useNotify } from '../../../shared/hooks/useNotify';
import QuickResponses from '../components/QuickResponses';
import ComplexityBadge from '../components/ComplexityBadge';
import {
    COMPLEXITY_CASES,
    COMPLEXITY_CATEGORY,
    COMPLEXITY_DESCRIPTIONS,
    COMPLEXITY_LABELS,
    COMPLEXITY_LEVELS,
    describeComplexityEstimate,
    isComplexityEscalation,
    normalizeComplexity,
    resolveComplexityFromTitle,
    TicketComplexity,
} from '../tickets.types';

export default function TicketDetail() {
    const { ticketId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { success: notifySuccess, error: notifyError, info: notifyInfo, warning: notifyWarning, confirm } = useNotify();
    
    // Estado local de UI (no persistido en DB)
    const [newComment, setNewComment] = useState(''); // Texto del comentario en edición
    const [sending, setSending] = useState(false); // Indicador de envío en progreso
    const [copiedItem, setCopiedItem] = useState<string | null>(null); // Item copiado al portapapeles (para feedback visual)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false); // Visibilidad del selector de emojis
    const [showListMenu, setShowListMenu] = useState(false); // Visibilidad del menú de listas
    const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false); // Visibilidad del modal de confirmación de finalización
    const [showComplexityInfo, setShowComplexityInfo] = useState(false); // Visibilidad del detalle de complejidad (oculto por defecto)
    const [activeFormats, setActiveFormats] = useState<string[]>([]); // Formatos activos del editor (bold, italic, etc.)
    const [mobileTab, setMobileTab] = useState<'details' | 'chat' | 'people'>('chat'); // Pestaña activa en móvil
    const fileInputRef = useRef<HTMLInputElement>(null); // Referencia al input de archivos
    const [statusUpdating, setStatusUpdating] = useState(false); // Indicador de actualización de estado
    const [uploadingImage, setUploadingImage] = useState(false); // Indicador de subida de imagen
    const editorRef = useRef<HTMLDivElement>(null); // Referencia al editor contentEditable

    // Use hooks para datos y tiempo real
    // useTicketComments: carga ticket, comentarios y maneja adición de mensajes
    const {
        ticket,
        comments,
        loading,
        commentsEndRef,
        fetchTicket,
        fetchComments,
        addComment,
    } = useTicketComments({ ticketId, user });

    // useTicketRealtime: suscribe a cambios del ticket y presencia de usuarios
    const { onlineUsers } = useTicketRealtime({
        ticketId,
        user,
        onTicketUpdate: fetchTicket, // Recargar ticket cuando cambie en DB
        onCommentsUpdate: fetchComments, // Recargar comentarios cuando se agregue uno
    });

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (showListMenu && !(event.target as Element).closest('.list-menu-container')) {
                setShowListMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showListMenu]);

    // Sube una imagen al storage (bucket 'chat-attachments') y la inserta como comentario
    // Usa formato markdown ![imagen](url) para que sea renderizada en el chat
    // Acepta tanto selección manual como pegado directo desde el portapapeles
    // La imagen se guarda en la ruta: ticket_{id}/nombre_archivo
    const uploadFile = async (file: File) => {
        if (!ticketId) return;
        try {
            setUploadingImage(true);
            const fileExt = file.name.split('.').pop() || 'png';
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `ticket_${ticketId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Obtiene la URL pública del archivo subido
            const { data: { publicUrl } } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(filePath);

            const { error: commentError } = await supabase
                .from('ticket_comments')
                .insert([{
                    ticket_id: ticketId,
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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await uploadFile(file);
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        let hasImage = false;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (file) await uploadFile(file);
                hasImage = true;
                break;
            }
        }

        if (!hasImage) {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        }
    };

    // Envía un comentario al ticket:
    // 1. Convierte el HTML del editor contentEditable a Markdown
    // 2. Llama a addComment() del hook useTicketComments
    // 3. Detecta @menciones y notifica a los usuarios mencionados
    // 4. Limpia el editor después del envío exitoso
    // Las menciones usan formato @Nombre y generan notificaciones push
    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || sending) return;

        setSending(true);
        try {
            const content = editorRef.current ? htmlToMarkdown(editorRef.current.innerHTML) : '';
            if (!content.trim()) return;

            await addComment(content);

            // Detectar @menciones y notificar
            const mentionRegex = /@(\w+(?:\s\w+)?)/g;
            let mentionMatch;
            const mentionedNames: string[] = [];
            while ((mentionMatch = mentionRegex.exec(content)) !== null) {
                mentionedNames.push(mentionMatch[1].trim());
            }

            if (mentionedNames.length > 0 && ticket?.id) {
                // Buscar usuarios por nombre y notificarles
                for (const name of mentionedNames) {
                    const { data: mentionedUsers } = await supabase
                        .from('users')
                        .select('id')
                        .ilike('full_name', `%${name}%`)
                        .neq('id', user?.id);

                    if (mentionedUsers && mentionedUsers.length > 0) {
                        for (const mentioned of mentionedUsers) {
                            await supabase.from('notifications').insert([{
                                user_id: mentioned.id,
                                type: 'ticket_mention',
                                title: 'Te mencionaron en un ticket',
                                message: `${user?.full_name || 'Alguien'} te mencionó en "${ticket?.title}"`,
                                ticket_id: ticket?.id,
                                created_at: new Date().toISOString(),
                            }]);
                        }
                    }
                }
            }

            if (editorRef.current) editorRef.current.innerHTML = '';
            setNewComment('');
        } catch (error) {
            console.error('Error al enviar comentario:', error);
        } finally {
            setSending(false);
        }
    };

    // Lista de emojis comunes para el selector
    // Incluye emojis de reacción, estado, objetos y símbolos útiles
    const commonEmojis = [
        '😀', '😊', '😂', '❤️', '👍', '👎', '🎉', '🔥', '💯', '✅',
        '❌', '🚀', '💪', '🙏', '👏', '🤝', '💡', '⚡', '🌟', '✨',
        '😎', '🤔', '😅', '🤗', '🎯', '💎', '🏆', '🌈', '🎨', '📌',
        '🔔', '📢', '📝', '📋', '🔧', '⚙️', '🎯', '📊', '📈', '📉',
        '⭐', '🌟', '💫', '🌙', '☀️', '🌺', '🦁', '🐧', '🦊', '🐼'
    ];

    // Inserta un emoji en el editor en la posición del cursor
    // Usa execCommand para compatibilidad con contentEditable
    const addEmoji = (emoji: string) => {
        if (!editorRef.current) return;

        // Enfocar el editor antes de insertar
        editorRef.current.focus();

        // Insertar el emoji en la posición del cursor
        document.execCommand('insertText', false, emoji);

        // Actualizar el estado manualmente ya que execCommand no dispara onInput siempre
        setNewComment(editorRef.current.innerText);

        setShowEmojiPicker(false);
    };

    // Actualiza la lista de formatos activos en el editor
    // Verifica qué comandos de formato están activos en la selección actual
    const updateActiveFormats = () => {
        const formats = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'];
        setActiveFormats(formats.filter(f => document.queryCommandState(f)));
    };

    // Activa/desactiva un formato de texto en el editor
    // Comandos soportados: bold, italic, underline, strikeThrough, etc.
    const toggleFormat = (command: string) => {
        document.execCommand(command, false);
        updateActiveFormats();
        if (editorRef.current) editorRef.current.focus();
    };


    // Convierte HTML (desde contentEditable) a Markdown simple
    // Soporta: negrita (**), cursiva (_), subrayado (__), tachado (~~),
    // listas con viñetas (•), listas numeradas (1.), saltos de línea
    // Esta conversión es necesaria para almacenar el contenido de forma consistente
    const htmlToMarkdown = (html: string) => {
        let text = html
            // Listas
            .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, (_match: string, content: string) => {
                return content.replace(/<li[^>]*>(.*?)<\/li>/g, (_liMatch: string, liContent: string) => `• ${liContent}\n`);
            })
            .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/g, (_match: string, content: string) => {
                let index = 1;
                return content.replace(/<li[^>]*>(.*?)<\/li>/g, (_liMatch: string, liContent: string) => `${index++}. ${liContent}\n`);
            })
            // Formatos de texto
            .replace(/<b>(.*?)<\/b>/g, '**$1**')
            .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
            .replace(/<i>(.*?)<\/i>/g, '_$1_')
            .replace(/<em>(.*?)<\/em>/g, '_$1_')
            .replace(/<u>(.*?)<\/u>/g, '__$1__')
            .replace(/<strike>(.*?)<\/strike>/g, '~~$1~~')
            .replace(/<del>(.*?)<\/del>/g, '~~$1~~')
            // Saltos y bloques
            .replace(/<br\s*\/?>/g, '\n')
            .replace(/<div>(.*?)<\/div>/g, '\n$1')
            .replace(/&nbsp;/g, ' ')
            // Limpiar tags restantes
            .replace(/<[^>]*>/g, '');

        return text.trim();
    };

    // Convierte Markdown a HTML seguro para renderizar en el chat
    // Soporta: negrita, cursiva, subrayado, tachado, destacado (==),
    // código inline/bloque, citas (>), encabezados (#), listas,
    // checklists, imágenes, menciones (@usuario), y saltos de línea
    // Las menciones se resaltan en azul para facilitar la identificación
    const renderMarkdown = (text: string) => {
        return text
            // Menciones @usuario — resaltar en azul
            .replace(/@(\w+(?:\s\w+)?)/g, '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 font-semibold rounded-none text-[12px]">@$1</span>')
            // Formatos de texto
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **negrita**
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // *cursiva*
            .replace(/__(.*?)__/g, '<u>$1</u>') // __subrayado__
            .replace(/~~(.*?)~~/g, '<del>$1</del>') // ~~tachado~~
            .replace(/==(.*?)==/g, '<mark>$1</mark>') // ==destacado==

            // Código
            .replace(/`(.*?)`/g, '<code class="inline-code">$1</code>') // `código`
            .replace(/```(.*?)```/gs, '<pre class="code-block"><code>$1</code></pre>') // ```código```

            // Citas
            .replace(/^> (.*?)$/gm, '<blockquote class="quote">$1</blockquote>') // > cita

            // Encabezados
            .replace(/^# (.*?)$/gm, '<h1 class="title">$1</h1>') // # Título
            .replace(/^## (.*?)$/gm, '<h2 class="subtitle">$1</h2>') // ## Subtítulo

            // Listas
            .replace(/^• (.*?)$/gm, '<li class="bullet-item">$1</li>') // • lista
            .replace(/^\d+\. (.*?)$/gm, '<li class="numbered-item">$1</li>') // 1. lista numerada
            .replace(/^-\s*\[\s*\] (.*?)$/gm, '<li class="checklist-item">☐ $1</li>') // - [ ] checklist
            .replace(/^-\s*\[x\] (.*?)$/gm, '<li class="checklist-item">☑ $1</li>') // - [x] checklist completado

            // Imágenes
            .replace(/!\[imagen\]\((.*?)\)/g, '<img src="$1" alt="Adjunto" class="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity mt-2" onclick="window.open(\'$1\', \'_blank\')" />')

            // Envolver listas
            .replace(/(<li class="bullet-item">.*<\/li>)/gs, '<ul class="bullet-list">$1</ul>')
            .replace(/(<li class="numbered-item">.*<\/li>)/gs, '<ol class="numbered-list">$1</ol>')
            .replace(/(<li class="checklist-item">.*<\/li>)/gs, '<ul class="checklist">$1</ul>')

            .replace(/\n/g, '<br>'); // saltos de línea
    };


    // Elimina el ticket con validaciones de seguridad:
    // - Staff (super_admin, sistemas, gerencia, supervisores) pueden eliminar siempre
    // - El creador puede eliminar solo dentro de los primeros 3 minutos
    // - Primero limpia archivos adjuntos del storage, luego elimina el registro
    const handleDeleteTicket = async () => {
        const now = new Date();
        const createdDate = new Date(ticket.created_at);
        const minutesDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60);
        const isOwner = user?.id === ticket.requester_id;
        const isStaff = user?.role === 'super_admin' || user?.role === 'sistemas' || user?.role === 'gerencia' || user?.role === 'supervisores';
        const canDelete = isStaff || (isOwner && minutesDiff <= 3);

        if (!canDelete) {
            notifyError(
                isOwner ? 'El tiempo para eliminar tu ticket ha expirado (3 min).' : 'No tienes permisos para eliminar este ticket.',
                isOwner ? 'Tiempo agotado' : 'Acceso denegado'
            );
            return;
        }

        const confirmed = await confirm(
            `Se eliminará el ticket #${ticket.id.slice(0,8).toUpperCase()} y todos sus mensajes. Esta acción no se puede deshacer.`,
            '¿Eliminar ticket?'
        );

        if (!confirmed) return;

        try {
            setStatusUpdating(true);
            // Limpiar archivos adjuntos antes de eliminar el ticket
            const { data: files } = await supabase.storage.from('chat-attachments').list(`ticket_${ticketId}`);
            if (files && files.length > 0) {
                await supabase.storage.from('chat-attachments').remove(
                    files.map(f => `ticket_${ticketId}/${f.name}`)
                );
            }

            const { error } = await supabase.from('tickets').delete().eq('id', ticketId);
            if (error) throw error;
            notifySuccess('Ticket eliminado correctamente.', 'Eliminado');
            navigate('/tickets');
        } catch (error) {
            console.error(error);
            notifyError('No se pudo eliminar el ticket.', 'Error');
        } finally {
            setStatusUpdating(false);
        }
    };

    // Cambia el estado del ticket y registra timestamps:
    // - in_progress: asigna al técnico que atiende + attended_at
    // - resolved: marca resolved_at
    // - closed: marca closed_at
    // Cada cambio envía notificaciones a los roles correspondientes
    // y registra un comentario automático en el feed del ticket
    const handleStatusUpdate = async (newStatus: string) => {

        if (!canManageStatus) {
            return;
        }

        if (statusUpdating) {
            return;
        }

        try {
            setStatusUpdating(true);

            const updatePayload: any = { status: newStatus };

            if (newStatus === 'in_progress') {
                updatePayload.assigned_to = user?.id;
                updatePayload.attended_at = new Date().toISOString();
            } else if (newStatus === 'resolved') {
                updatePayload.resolved_at = new Date().toISOString();
            } else if (newStatus === 'closed') {
                updatePayload.closed_at = new Date().toISOString();
            }


            const { error } = await supabase.from('tickets').update(updatePayload).eq('id', ticketId);

            if (error) {
                throw error;
            }

            // Enviar notificaciones según el nuevo estado
            if (newStatus === 'resolved') {
                await notifyTicketResolved(
                    ticketId || '',
                    ticket.title || '',
                    user?.id || '',
                    user?.full_name || '',
                    ticket.locations?.name || 'Sin Ubicación'
                );
                notifySuccess(`Ticket marcado como resuelto.`, 'Estado actualizado');
            } else if (newStatus === 'closed') {
                await notifyTicketClosed(
                    ticketId || '',
                    ticket.title || '',
                    user?.id || '',
                    user?.full_name || '',
                    ticket.locations?.name || 'Sin Ubicación'
                );
                notifySuccess(`Ticket cerrado correctamente.`, 'Estado actualizado');
            } else if (newStatus === 'in_progress') {
                notifySuccess(`Ticket marcado como en proceso.`, 'Estado actualizado');
            } else {
                notifyInfo(`Estado cambiado a: ${getStatusLabel(newStatus)}`, 'Estado actualizado');
            }

            // Registro automático del cambio de estado en el feed
            await supabase.from('ticket_comments').insert([{
                ticket_id: ticketId,
                user_id: user?.id,
                content: `Cambió el estado a: **${getStatusLabel(newStatus).toUpperCase()}**`,
            }]);

            fetchComments();
        } catch (error) {
            notifyError('Error al actualizar el estado: ' + (error as any)?.message || 'Error desconocido', 'Error');
        } finally {
            setStatusUpdating(false);
        }
    };

    // Cambia el nivel de complejidad técnica del ticket (solo área de Sistemas)
    // El nivel inicial es una estimación del solicitante; durante la atención el
    // técnico puede escalarlo (N1 → N2 → N3) si el diagnóstico revela una
    // intervención de mayor nivel, o refinarlo a la baja.
    // Cada cambio queda registrado como comentario de sistema en el feed del ticket,
    // siguiendo el mismo patrón que los cambios de estado.
    const handleComplexityChange = async (newLevel: TicketComplexity) => {
        if (!canManageStatus || statusUpdating || !ticketId) {
            return;
        }

        if (ticket.category !== COMPLEXITY_CATEGORY) {
            notifyInfo('La complejidad técnica solo se clasifica en el área de Sistemas.', 'Clasificación');
            return;
        }

        const currentLevel = normalizeComplexity(ticket.complexity_level);
        if (currentLevel === newLevel) {
            return;
        }

        try {
            setStatusUpdating(true);

            const { error } = await supabase
                .from('tickets')
                .update({ complexity_level: newLevel })
                .eq('id', ticketId);

            if (error) {
                throw error;
            }

            const fromLabel = currentLevel ? COMPLEXITY_LABELS[currentLevel].toUpperCase() : 'SIN CLASIFICAR';
            const escalated = isComplexityEscalation(ticket.complexity_level, newLevel);

            await supabase.from('ticket_comments').insert([{
                ticket_id: ticketId,
                user_id: user?.id,
                content: escalated
                    ? `**ESCALADO**: La complejidad técnica subió de ${fromLabel} a ${COMPLEXITY_LABELS[newLevel].toUpperCase()} por ${user?.full_name}`
                    : `**CLASIFICADO**: La complejidad técnica cambió de ${fromLabel} a ${COMPLEXITY_LABELS[newLevel].toUpperCase()} por ${user?.full_name}`,
            }]);

            notifySuccess(
                escalated
                    ? `Caso escalado a ${COMPLEXITY_LABELS[newLevel]}.`
                    : `Nivel de complejidad actualizado a ${COMPLEXITY_LABELS[newLevel]}.`,
                escalated ? 'Escalamiento registrado' : 'Clasificación actualizada'
            );

            await fetchTicket();
            await fetchComments();
        } catch (error) {
            notifyError('Error al actualizar la complejidad: ' + (error as any)?.message || 'Error desconocido', 'Error');
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleWhatsAppContact = () => {
        if (!ticket.requester?.email) return;

        const phoneNumber = ticket.requester.email.includes('@') ?
            ticket.requester.email.split('@')[0].replace(/\D/g, '') : '';

        if (phoneNumber) {
            const message = encodeURIComponent(`Hola ${ticket.requester.full_name}, te escribo del soporte técnico sobre tu ticket #${ticket.id.slice(0, 8).toUpperCase()}. ¿Cómo podemos ayudarte?`);
            window.open(`https://wa.me/51${phoneNumber}?text=${message}`, '_blank');
        }
    };

    const shouldShowWhatsApp = () => {
        if (!ticket) return false;
        const isHighPriority = ticket.priority === 'high' || ticket.priority === 'critical';
        const now = new Date();
        const created = new Date(ticket.created_at);
        const diffMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
        return isHighPriority && diffMinutes > 10 && ticket.requester?.email;
    };

    const handleCopy = async (text: string, itemType: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedItem(itemType);
            setTimeout(() => setCopiedItem(null), 2000);
        } catch (error) {
        }
    };

    const canManageStatus = user?.role === 'super_admin' || user?.role === 'sistemas' || user?.role === 'gerencia' || user?.role === 'supervisores' || user?.role === 'administradores' || user?.role === 'personalizado';

    // Asigna el ticket al usuario actual como técnico responsable:
    // 1. Cambia estado a 'in_progress'
    // 2. Asigna el ticket al usuario (assigned_to = user.id)
    // 3. Registra attended_at (marca de tiempo de primera atención)
    // 4. Envía notificación a los interesados
    // 5. Agrega comentario automático al feed
    const handleAttendTicket = async () => {
        if (!canAttendTicket || statusUpdating) {
            return;
        }

        const confirmed = await confirm(
            `Se te asignará como técnico responsable del ticket #${ticket.id.slice(0,8).toUpperCase()}.`,
            '¿Atender este ticket?'
        );

        if (!confirmed) return;

        try {
            setStatusUpdating(true);

            // Actualizar a en_progreso y asignar como técnico responsable
            const { error } = await supabase.from('tickets').update({
                status: 'in_progress',
                assigned_to: user?.id,
                attended_at: new Date().toISOString()
            }).eq('id', ticketId);

            if (error) {
                throw error;
            }

            // Enviar notificación de ticket atendido
            await notifyTicketAttended(
                ticketId || '',
                ticket.title || '',
                user?.id || '',
                user?.full_name || '',
                ticket.locations?.name || ''
            );

            // Agregar comentario de atención
            await supabase.from('ticket_comments').insert([{
                ticket_id: ticketId,
                user_id: user?.id,
                content: `**ATENDIENDO**: Ticket atendido y asignado a ${user?.full_name}`,
            }]);

            notifySuccess(`Ticket asignado a ${user?.full_name}. ¡Éxito!`, 'Ticket atendido');
            fetchComments();
        } catch (error) {
            notifyError('Error al atender ticket: ' + (error as any)?.message || 'Error desconocido', 'Error');
        } finally {
            setStatusUpdating(false);
        }
    };

    // Permite que personal técnico se una al ticket como colaborador
    // Diferencias con handleAttendTicket:
    //   - No cambia el estado del ticket (solo se "une" al chat)
    //   - No se convierte en técnico responsable (assigned_to no cambia)
    //   - Se registra en ticket_assignments (soporte multi-colaborador)
    // Límite máximo: 4 personas por ticket
    const handleJoinTicket = async () => {

        if (!canManageStatus || !ticket) {
            return;
        }

        // Verificar si ya está asignado (evitar duplicados)
        const isAlreadyAssigned = ticket.ticket_assignments?.some((assignment: any) => assignment.user_id === user?.id);

        if (isAlreadyAssigned) {
            notifyInfo('Ya estás asignado a este ticket', 'Información');
            return;
        }

        // Verificar límite de 4 personas
        const currentAssignments = ticket.ticket_assignments?.length || 0;

        if (currentAssignments >= 4) {
            notifyWarning('Máximo de 4 personas asignadas a este ticket', 'Límite alcanzado');
            return;
        }

        try {

            const { error } = await supabase
                .from('ticket_assignments')
                .insert([{
                    ticket_id: ticketId,
                    user_id: user?.id,
                    assigned_at: new Date().toISOString()
                }]);

            if (error) {
                throw error;
            }


            // No cambiar estado automáticamente - solo participar sin atender

            // Agregar notificación de unión al chat
            await supabase.from('ticket_comments').insert([{
                ticket_id: ticketId,
                user_id: user?.id,
                content: `**${user?.full_name || 'Un usuario'}** se ha unido al ticket.`
            }]);

            // Actualizar el ticket para reflejar los cambios
            await fetchTicket();

        } catch (error) {
        }
    };

    const getAssignedUsers = () => {

        if (!ticket?.ticket_assignments) {
            return [];
        }

        const result = ticket.ticket_assignments.map((assignment: any) => {
            return {
                ...assignment,
                user: assignment.user || {
                    id: assignment.user_id,
                    full_name: 'Usuario',
                    email: '',
                    avatar_url: null
                },
                isCurrentUser: assignment.user_id === user?.id
            };
        });

        return result;
    };

    // Finaliza y archiva manualmente un ticket (acción irreversible desde UI)
    // - Cambia estado a 'archived' (diferente a 'closed' que es automático)
    // - Cierra el ticket y redirige al dashboard
    // - Los tickets archivados solo se ven en el historial
    // También se activa automáticamente: Resuelto→Cerrado (3min) y Cerrado→Archivado (10min)
    const handleFinalizeTicket = async () => {
        if (!canManageStatus || statusUpdating) {
            return;
        }

        const confirmed = await confirm(
            `El ticket #${ticket.id.slice(0,8).toUpperCase()} será archivado manualmente. Podrás verlo en el historial.`,
            '¿Finalizar y archivar ticket?'
        );

        if (!confirmed) return;

        try {
            setStatusUpdating(true);

            // Actualizar directamente a archivado con timestamp
            const { error } = await supabase.from('tickets').update({
                status: 'archived',
                closed_at: new Date().toISOString()
            }).eq('id', ticketId);

            if (error) {
                throw error;
            }

            // Agregar comentario de finalización
            await supabase.from('ticket_comments').insert([{
                ticket_id: ticketId,
                user_id: user?.id,
                content: `**FINALIZADO**: Ticket finalizado y archivado manualmente por ${user?.full_name}`,
            }]);

            setShowFinalizeConfirm(false);
            notifySuccess('¡Ticket cerrado correctamente! Puedes verlo en el historial de tickets.', 'Ticket finalizado');
            navigate('/tickets');
        } catch (error) {
            notifyError('Error al finalizar ticket: ' + (error as any)?.message || 'Error desconocido', 'Error');
        } finally {
            setStatusUpdating(false);
        }
    };

    // Verificar si el usuario está asignado al ticket
    const isUserAssigned = getAssignedUsers().some((u: any) => u.isCurrentUser);
    const canFinalizeTicket = canManageStatus && ticket?.status !== 'archived';

    // Permitir unirse si el ticket está abierto o en progreso
    const hasPermission = canManageStatus;
    const isOpen = ticket?.status === 'open' || ticket?.status === 'in_progress';
    const hasSpace = getAssignedUsers().length < 4;
    const canJoinTicket = hasPermission && isOpen && hasSpace;


    // Auto-unir al ticket si es el creador y no está asignado
    useEffect(() => {

        if (ticket && user && !isUserAssigned && user.id === ticket.requester_id && canJoinTicket) {
            handleJoinTicket();
        } else {
        }
    }, [ticket, user, isUserAssigned, canJoinTicket]);

    const getRoleIcon = (role: string, size: number = 14) => {
        switch (role) {
            case 'super_admin': return <Terminal size={size} />;
            case 'sistemas': return <Monitor size={size} />;
            case 'gerencia': return <Briefcase size={size} />;
            case 'supervisores': return <Eye size={size} />;
            default: return <User size={size} />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'open': return 'Pendiente';
            case 'in_progress': return 'Atendiendo';
            case 'resolved': return 'Resuelto';
            case 'closed': return 'Cerrado';
            default: return status;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'open': return <Clock size={14} />;
            case 'in_progress': return <Activity size={14} className="animate-pulse" />;
            case 'resolved': return <CheckCircle2 size={14} />;
            case 'closed': return <XCircle size={14} />;
            default: return <Clock size={14} />;
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

    const canAttendTicket = canManageStatus && ticket?.status === 'open';
    const isTicketCreator = user?.id === ticket?.requester_id;

    // Nivel de complejidad vigente, ya normalizado y validado contra el catálogo
    // (null si el ticket aún no fue clasificado)
    const currentComplexity = normalizeComplexity(ticket?.complexity_level);

    // Solo quien puede atender el ticket puede reclasificarlo por diagnóstico
    // El solicitante que lo creó solo consulta el nivel estimado por el sistema
    const canClassifyComplexity = canManageStatus && !isTicketCreator && ticket?.status !== 'archived';

    // Razón de la estimación automática, recalculada desde el asunto persistido
    // para poder explicarla en el detalle sin guardar datos adicionales
    const complexityEstimateReason = useMemo(
        () => describeComplexityEstimate(resolveComplexityFromTitle(ticket?.title, COMPLEXITY_CATEGORY)),
        [ticket?.title]
    );

    // Verificar si el ticket puede ser reabierto por el creador
    const canReopenTicket = isTicketCreator && ticket?.status === 'closed' && ticket?.closed_at;
    const timeSinceClosed = ticket?.closed_at ? Math.floor((new Date().getTime() - new Date(ticket.closed_at).getTime()) / (1000 * 60)) : 0;
    const isWithinReopenWindow = timeSinceClosed < 10; // 10 minutos para reabrir

    const handleReopenTicket = async () => {
        if (!canReopenTicket || !isWithinReopenWindow) return;

        try {
            setStatusUpdating(true);

            const { error } = await supabase.from('tickets').update({
                status: 'open',
                // Limpiar campos de cierre
                closed_at: null
            }).eq('id', ticketId);

            if (error) throw error;

            // Agregar comentario de reapertura
            await supabase.from('ticket_comments').insert([{
                ticket_id: ticketId,
                user_id: user?.id,
                content: `**REAPERTURA**: Ticket reabierto por el solicitante`,
            }]);

            fetchComments();
        } catch (error) {
            console.error('Error al reabrir ticket:', error);
        } finally {
            setStatusUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-600 mb-2">Ticket no encontrado</h2>
                    <button
                        onClick={() => navigate('/tickets')}
                        className="text-blue-600 hover:text-blue-700"
                    >
                        Volver a tickets
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[100dvh] bg-white flex flex-col overflow-hidden font-sans">
            <style>{`
                .inline-code { background-color: rgba(0, 0, 0, 0.1); padding: 2px 6px; font-family: 'Courier New', monospace; font-size: 0.9em; }
                .code-block { background-color: rgba(0, 0, 0, 0.05); padding: 12px; border-left: 4px solid #002855; font-family: 'Courier New', monospace; font-size: 0.9em; overflow-x: auto; margin: 8px 0; }
                .quote { border-left: 3px solid #e5e7eb; padding-left: 12px; margin: 8px 0; font-style: italic; color: #6b7280; }
                .title { font-size: 1.2em; font-weight: 900; margin: 16px 0 8px 0; color: #002855; text-transform: uppercase; }
                .subtitle { font-size: 1.1em; font-weight: 900; margin: 12px 0 6px 0; color: #002855; text-transform: uppercase; }
                .bullet-list, .numbered-list, .checklist { margin: 8px 0; padding-left: 20px; }
                .bullet-item, .numbered-item, .checklist-item { margin: 4px 0; line-height: 1.5; }
                .checklist-item { list-style: none; }
                mark { background-color: #fef3c7; padding: 1px 2px; }
                b, strong { font-weight: 900 !important; color: inherit; }
            `}</style>

            {/* Header Fijo */}
            <div className="flex-none bg-[#002855] px-6 py-4 flex items-center justify-between shadow-sm z-50">
                <div className="flex items-center gap-3 text-[14px] font-semibold uppercase tracking-widest text-slate-300">
                    <button onClick={() => navigate('/tickets')} className="hover:text-white transition-colors flex items-center gap-1">
                        <ArrowLeft size={18} /> Mesa de Ayuda
                    </button>
                    <span className="text-slate-500">/</span>
                    <span className="text-white">Ticket #{ticket.id.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`px-2 py-1 text-[10px] rounded-none font-semibold uppercase border ${getPriorityStyle(ticket.priority)}`}>
                        {getPriorityLabel(ticket.priority)}
                    </div>
                    {ticket.category === COMPLEXITY_CATEGORY && (
                        <ComplexityBadge level={ticket.complexity_level} variant="full" />
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                {/* Mobile Tab Bar */}
                <div className="lg:hidden flex border-b border-slate-200 bg-white flex-none shrink-0 z-10">
                    <button onClick={() => setMobileTab('details')} className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-widest border-b-2 transition-colors ${mobileTab === 'details' ? 'border-[#002855] text-[#002855]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Detalles</button>
                    <button onClick={() => setMobileTab('chat')} className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-widest border-b-2 transition-colors ${mobileTab === 'chat' ? 'border-[#002855] text-[#002855]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Chat</button>
                    <button onClick={() => setMobileTab('people')} className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-widest border-b-2 transition-colors ${mobileTab === 'people' ? 'border-[#002855] text-[#002855]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Personas</button>
                </div>

                {/* Left side: Ticket Details */}
                <div className={`w-full lg:w-[320px] xl:w-[350px] lg:flex-none border-r border-slate-200 bg-slate-50 overflow-y-auto ${mobileTab === 'details' ? 'block flex-1 min-h-0' : 'hidden lg:block'}`}>
                    <div className="p-6">
                        <h2 className="text-sm font-semibold text-[#002855] leading-tight mb-6 uppercase">{ticket.title}</h2>

                        <div className="space-y-6">
                            {/* Detalle Inicial */}
                            <div>
                                <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2 mb-3">Detalle Inicial</span>
                                <p className="text-[14px] text-slate-700 leading-relaxed font-medium">
                                    {ticket.description}
                                </p>
                            </div>

                            {/* Anydesk */}
                            <div>
                                <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2 mb-3">Acceso Remoto</span>
                                <div className="space-y-3">
                                    {/* AnyDesk ID */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="text-xs font-semibold text-slate-900">AnyDesk: <span className="text-slate-600 font-normal">{ticket.anydesk || 'No proporcionado'}</span></p>
                                        </div>
                                        {ticket.anydesk && (
                                            <button
                                                onClick={() => handleCopy(ticket.anydesk, 'anydesk')}
                                                className="w-6 h-6 rounded-none bg-white border border-slate-200 text-slate-600 hover:text-[#002855] hover:border-[#002855] transition-all flex items-center justify-center"
                                            >
                                                {copiedItem === 'anydesk' ? <div className="w-2 h-2 bg-green-500 rounded-none shrink-0" /> : <Copy size={12} />}
                                            </button>
                                        )}
                                    </div>

                                    {/* Contraseña */}
                                    {ticket.anydesk_password && (
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold text-slate-900">Pass: <span className="text-slate-600 font-normal">{ticket.anydesk_password}</span></p>
                                            </div>
                                            <button
                                                onClick={() => handleCopy(ticket.anydesk_password, 'password')}
                                                className="w-6 h-6 rounded-none bg-white border border-slate-200 text-slate-600 hover:text-[#002855] hover:border-[#002855] transition-all flex items-center justify-center"
                                            >
                                                {copiedItem === 'password' ? <div className="w-2 h-2 bg-green-500 rounded-none shrink-0" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Clasificación de complejidad técnica */}
                            {ticket.category === COMPLEXITY_CATEGORY && (
                                <div>
                                    <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2 mb-3 flex items-center gap-2">
                                        <Layers size={13} />
                                        Complejidad Técnica
                                    </span>

                                    <div className="bg-white border border-slate-200 p-4">
                                        {/* Nivel vigente + estado de edición */}
                                        <div className="flex items-center justify-between gap-2">
                                            <ComplexityBadge level={ticket.complexity_level} variant="full" />
                                            {!canClassifyComplexity && (
                                                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest text-right">
                                                    {isTicketCreator ? 'Solo lectura (solicitante)' : 'Solo lectura'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Combo para cambiar el nivel: la acción principal de la sección */}
                                        {canClassifyComplexity && (
                                            <div className="mt-3">
                                                <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
                                                    Cambiar nivel
                                                </label>
                                                <select
                                                    value={currentComplexity ?? ''}
                                                    onChange={(e) => {
                                                        const next = e.target.value as TicketComplexity;
                                                        if (next && next !== currentComplexity) {
                                                            handleComplexityChange(next);
                                                        }
                                                    }}
                                                    disabled={statusUpdating}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 text-[11px] font-normal text-slate-700 focus:outline-none focus:border-[#002855]/30 disabled:opacity-50"
                                                >
                                                    {!currentComplexity && (
                                                        <option value="" disabled>Sin clasificar</option>
                                                    )}
                                                    {COMPLEXITY_LEVELS.map((level) => (
                                                        <option key={level} value={level}>
                                                            {COMPLEXITY_LABELS[level]}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Detalle oculto por defecto: descripción, casos y origen del nivel */}
                                        <button
                                            type="button"
                                            onClick={() => setShowComplexityInfo(prev => !prev)}
                                            className="mt-3 flex items-center gap-1.5 text-[9px] font-semibold text-slate-400 uppercase tracking-widest hover:text-[#002855] transition-colors"
                                        >
                                            <ChevronDown
                                                size={12}
                                                className={`transition-transform ${showComplexityInfo ? 'rotate-180' : ''}`}
                                            />
                                            {showComplexityInfo ? 'Ocultar información' : 'Mostrar más información'}
                                        </button>

                                        {showComplexityInfo && (
                                            <div className="mt-3 pt-3 border-t border-slate-100">
                                                <p className="text-[11px] text-slate-600 leading-snug">
                                                    {currentComplexity
                                                        ? COMPLEXITY_DESCRIPTIONS[currentComplexity]
                                                        : 'Sin clasificar. El nivel se define de acuerdo a la complejidad técnica del caso y puede escalarse durante la atención.'}
                                                </p>

                                                {currentComplexity && (
                                                    <ul className="mt-3 space-y-1">
                                                        {COMPLEXITY_CASES[currentComplexity].map((caso) => (
                                                            <li key={caso} className="text-[10px] font-normal text-slate-400 uppercase tracking-wide leading-snug">
                                                                · {caso}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}

                                                <p className="mt-3 pt-3 border-t border-slate-100 text-[10px] font-normal text-slate-400 leading-snug">
                                                    {complexityEstimateReason}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Gestión de Estado */}
                            <div>
                                <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2 mb-3">Gestión de Estado</span>
                                {ticket?.status === 'archived' ? (
                                    <div className="text-center py-4 bg-white border border-slate-200 p-4">
                                        <Lock size={18} className="text-slate-400 mx-auto mb-2" />
                                        <h3 className="text-[15px] font-semibold text-slate-700 uppercase mb-1">Bloqueado</h3>
                                        <p className="text-[12px] text-slate-500 uppercase tracking-wider">Ticket archivado.</p>
                                    </div>
                                ) : isTicketCreator ? (
                                    // Vista informativa
                                    <div className="space-y-2">
                                        {['open', 'in_progress', 'resolved', 'closed'].map(st => (
                                            <div
                                                key={st}
                                                className={`w-full px-4 py-2.5 rounded-none text-[12px] font-semibold uppercase tracking-widest flex items-center justify-between border ${ticket.status === st
                                                    ? 'bg-[#002855] text-white border-[#002855]'
                                                    : 'bg-white text-slate-400 border-slate-200'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(st)}
                                                    <span>{getStatusLabel(st)}</span>
                                                </div>
                                                {ticket.status === st && <div className="w-1.5 h-1.5 bg-white rounded-none" />}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    // Vista funcional
                                    <div className="space-y-2 mb-4">
                                        {['open', 'in_progress', 'resolved', 'closed'].map(st => (
                                            <button
                                                key={st}
                                                onClick={() => handleStatusUpdate(st)}
                                                disabled={!canManageStatus || statusUpdating}
                                                className={`w-full px-4 py-2.5 rounded-none text-[12px] font-semibold uppercase tracking-widest flex items-center justify-between border transition-colors ${ticket.status === st
                                                    ? 'bg-[#002855] text-white border-[#002855]'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-[#002855] disabled:opacity-50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(st)}
                                                    <span>{statusUpdating && ticket.status === st ? '...' : getStatusLabel(st)}</span>
                                                </div>
                                                {ticket.status === st && <div className="w-1.5 h-1.5 bg-white rounded-none animate-pulse" />}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {canReopenTicket && isWithinReopenWindow && (
                                    <div className="mt-4 p-3 bg-white border border-slate-200 rounded-none">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[9px] font-semibold text-slate-700 uppercase tracking-widest">Reapertura</span>
                                            <span className="text-[9px] font-semibold text-[#002855]">{10 - timeSinceClosed}m</span>
                                        </div>
                                        <button onClick={handleReopenTicket} disabled={statusUpdating} className="w-full py-2 bg-[#002855] text-white rounded-none text-[10px] font-semibold uppercase tracking-widest flex justify-center border border-[#002855] hover:bg-white hover:text-[#002855] transition-colors">
                                            Reabrir
                                        </button>
                                    </div>
                                )}

                                {canFinalizeTicket && (
                                    <div className="mt-6">
                                        <button onClick={() => setShowFinalizeConfirm(true)} disabled={statusUpdating} className="w-full py-3 bg-rose-600 text-white rounded-none text-[10px] font-semibold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-700 transition-colors border border-rose-600">
                                            <AlertCircle size={14} /> Finalizar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Center: Chat */}
                <div className={`flex-1 flex-col bg-white lg:border-r border-slate-200 min-w-0 min-h-0 ${mobileTab === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
                    <div className="flex-none px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-none bg-[#002855] text-white flex items-center justify-center">
                                <IoChatbubbles size={16} />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="text-[15px] font-semibold text-[#002855] uppercase tracking-[0.2em]">Canal de Seguimiento</h3>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-none animate-pulse" />
                                    <span className="text-[11px] text-green-600 font-semibold uppercase tracking-widest">Sincronización Activa</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {shouldShowWhatsApp() && (
                                <button onClick={handleWhatsAppContact} className="w-8 h-8 rounded-none bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center">
                                    <FaWhatsapp size={14} />
                                </button>
                            )}
                            <button onClick={handleDeleteTicket} className="w-8 h-8 rounded-none bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-600 transition-colors flex items-center justify-center">
                                <FaTrashAlt size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30">
                        {isUserAssigned ? (
                            <>
                                {comments.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                        <MessageSquare size={40} className="mb-4 opacity-10" />
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.3em]">No hay registros en el log</p>
                                    </div>
                                ) : comments.map((c) => {
                                    const isMe = c.user_id === user?.id;
                                    const isSystem = c.content.includes('Cambió el estado') ||
                                        c.content.includes('ATENDIENDO') ||
                                        c.content.includes('FINALIZADO') ||
                                        c.content.includes('REAPERTURA') ||
                                        c.content.includes('ESCALADO') ||
                                        c.content.includes('CLASIFICADO') ||
                                        c.content.includes('se ha unido al ticket') ||
                                        c.content.includes('asignado a');

                                    if (isSystem) {
                                        return (
                                            <div key={c.id} className="flex flex-col items-center my-2">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <div className="h-px w-8 bg-slate-200" />
                                                    <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Registro de Sistema</span>
                                                    <div className="h-px w-8 bg-slate-200" />
                                                </div>
                                                <div className="bg-white px-4 py-2 border border-slate-200 shadow-sm flex items-center gap-3 relative overflow-hidden group">
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#002855]" />
                                                    <div className="w-1.5 h-1.5 bg-[#002855] rounded-none shrink-0" />
                                                    <span className="text-[10px] font-semibold text-[#002855] uppercase tracking-widest leading-none">
                                                        {c.content.replace(/\*\*/g, '')}
                                                    </span>
                                                </div>
                                                <span className="text-[8px] font-semibold text-slate-400 uppercase mt-2 tracking-widest">
                                                    {new Date(c.created_at).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={c.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                            <div className={`w-8 h-8 flex-none rounded-none overflow-hidden border ${isMe ? 'bg-[#002855] border-[#002855]' : 'bg-slate-200 border-slate-300'}`}>
                                                {c.author?.avatar_url ? (
                                                    <img src={c.author.avatar_url} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className={`w-full h-full flex items-center justify-center ${isMe ? 'text-white' : 'text-slate-500'}`}>
                                                        {getRoleIcon(c.author?.role, 14)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[90%] lg:max-w-[85%]`}>
                                                <div className={`px-4 py-3 border shadow-sm ${isMe ? 'bg-[#002855] border-[#002855] text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                                                    <p className="text-[14px] leading-relaxed font-medium break-words overflow-hidden" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.content) }} />
                                                    <div className={`text-[8px] mt-2 font-semibold uppercase tracking-widest ${isMe ? 'text-slate-300' : 'text-slate-400'}`}>
                                                        {new Date(c.created_at).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                <Lock size={40} className="mb-4 opacity-10" />
                                <p className="text-[10px] font-semibold uppercase tracking-[0.3em]">Acceso Restringido</p>
                                <p className="text-[9px] font-semibold uppercase tracking-widest mt-2">{canJoinTicket ? 'Inicie sesión en el ticket para visualizar' : 'No tiene permisos para este canal'}</p>
                            </div>
                        )}
                        <div ref={commentsEndRef} />
                    </div>

                    <div className="flex-none p-4 lg:p-6 bg-white border-t border-slate-200 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] z-20">
                        {ticket?.status === 'archived' ? (
                            <div className="text-center py-2">
                                <p className="text-[14px] font-semibold text-rose-600 uppercase tracking-widest flex items-center justify-center gap-2">
                                    <Lock size={16} /> Archivo Histórico (Solo Lectura)
                                </p>
                            </div>
                        ) : !isUserAssigned ? (
                            <div className="text-center py-2">
                                <button onClick={handleJoinTicket} className="px-8 py-3 bg-[#002855] text-white text-[14px] font-semibold uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-lg border border-[#002855] flex items-center gap-2 mx-auto">
                                    <MessageSquare size={18} /> Ingresar al Ticket
                                </button>
                            </div>
                        ) : (
                            <div className="max-w-4xl mx-auto w-full">
                                {/* Barra de Herramientas Superior */}
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <div className="flex flex-wrap items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => toggleFormat('bold')}
                                            className={`w-9 h-9 flex items-center justify-center transition-all ${activeFormats.includes('bold') ? 'bg-[#002855] text-white shadow-inner' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-transparent hover:border-slate-200'}`}
                                            title="Negrita (Ctrl+B)"
                                        >
                                            <Bold size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleFormat('italic')}
                                            className={`w-9 h-9 flex items-center justify-center transition-all ${activeFormats.includes('italic') ? 'bg-[#002855] text-white shadow-inner' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-transparent hover:border-slate-200'}`}
                                            title="Cursiva (Ctrl+I)"
                                        >
                                            <Italic size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleFormat('underline')}
                                            className={`w-9 h-9 flex items-center justify-center transition-all ${activeFormats.includes('underline') ? 'bg-[#002855] text-white shadow-inner' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-transparent hover:border-slate-200'}`}
                                            title="Subrayado (Ctrl+U)"
                                        >
                                            <Underline size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleFormat('strikeThrough')}
                                            className={`w-9 h-9 flex items-center justify-center transition-all ${activeFormats.includes('strikeThrough') ? 'bg-[#002855] text-white shadow-inner' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-transparent hover:border-slate-200'}`}
                                            title="Tachado"
                                        >
                                            <Strikethrough size={16} />
                                        </button>

                                        <div className="w-px h-5 bg-slate-200 mx-1" />

                                        <div className="relative list-menu-container">
                                            <button
                                                type="button"
                                                onClick={() => setShowListMenu(!showListMenu)}
                                                className={`w-9 h-9 flex items-center justify-center transition-all ${(activeFormats.includes('insertUnorderedList') || activeFormats.includes('insertOrderedList') || showListMenu) ? 'bg-[#002855] text-white shadow-inner' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-transparent hover:border-slate-200'}`}
                                                title="Opciones de Lista"
                                            >
                                                <List size={16} />
                                            </button>

                                            {showListMenu && (
                                                <div className="absolute bottom-full left-0 mb-2 bg-white border-2 border-[#002855] shadow-2xl p-1 z-[110] w-40 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                    <button
                                                        type="button"
                                                        onClick={() => { toggleFormat('insertUnorderedList'); setShowListMenu(false); }}
                                                        className="w-full px-3 py-2 text-[10px] font-semibold uppercase flex items-center gap-3 hover:bg-slate-50 text-slate-600"
                                                    >
                                                        <List size={14} className="text-slate-400" />
                                                        <span>Viñetas</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { toggleFormat('insertOrderedList'); setShowListMenu(false); }}
                                                        className="w-full px-3 py-2 text-[10px] font-semibold uppercase flex items-center gap-3 hover:bg-slate-50 text-slate-600 border-t border-slate-100"
                                                    >
                                                        <div className="font-semibold text-[10px] text-slate-400">1.</div>
                                                        <span>Numerada</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="w-px h-5 bg-slate-200 mx-1" />

                                        <button
                                            type="button"
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className={`w-9 h-9 flex items-center justify-center transition-all ${showEmojiPicker ? 'bg-[#002855] text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-transparent hover:border-slate-200'}`}
                                            title="Insertar Emoji"
                                        >
                                            <Smile size={16} />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadingImage}
                                            className="h-9 px-3 flex items-center gap-2 text-slate-400 hover:bg-slate-100 hover:text-[#002855] border border-transparent hover:border-slate-200 transition-all"
                                            title="Adjuntar Imagen"
                                        >
                                            {uploadingImage ? <Loader2 size={16} className="animate-spin text-[#002855]" /> : <ImageIcon size={16} />}
                                            <span className="text-[10px] font-semibold uppercase tracking-widest hidden sm:inline">Imagen</span>
                                        </button>

                                        <div className="w-px h-5 bg-slate-200 mx-1" />

                                        <QuickResponses onSelect={(text) => {
                                            if (editorRef.current) {
                                                editorRef.current.innerHTML = text;
                                                setNewComment(text);
                                                editorRef.current.focus();
                                            }
                                        }} />
                                    </div>

                                    <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest">Registrar Avance</span>
                                </div>

                                {/* Contenedor de Escritura */}
                                <form onSubmit={handleCommentSubmit} className="relative flex items-end gap-3">
                                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />

                                    <div className="flex-1 relative bg-white">
                                        {/* Placeholder Real */}
                                        {!newComment.trim() && (
                                            <div className="absolute inset-0 px-5 py-4 text-slate-300 pointer-events-none text-[14px] font-medium select-none uppercase tracking-wider">
                                                Escribe aquí tu mensaje...
                                            </div>
                                        )}

                                        <div
                                            ref={editorRef}
                                            contentEditable={!sending}
                                            onPaste={handlePaste}
                                            onInput={() => {
                                                if (editorRef.current) {
                                                    setNewComment(editorRef.current.innerText);
                                                }
                                            }}
                                            onKeyUp={updateActiveFormats}
                                            onClick={updateActiveFormats}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleCommentSubmit(e);
                                                }
                                                // Atajos de teclado para formato
                                                if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                                                    e.preventDefault();
                                                    toggleFormat('bold');
                                                }
                                                if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                                                    e.preventDefault();
                                                    toggleFormat('italic');
                                                }
                                                if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                                                    e.preventDefault();
                                                    toggleFormat('underline');
                                                }
                                            }}
                                            className="w-full px-5 py-4 bg-transparent border-2 border-slate-200 rounded-none focus:outline-none focus:border-[#002855] text-[14px] font-medium transition-all min-h-[56px] max-h-[300px] overflow-y-auto block custom-scrollbar relative z-10"
                                        />

                                        {/* Pickers Absolutos */}
                                        {showEmojiPicker && (
                                            <div className="absolute bottom-full left-0 mb-4 bg-white border-2 border-[#002855] shadow-2xl p-4 z-[100] w-[300px]">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Emojis Frecuentes</span>
                                                    <button onClick={() => setShowEmojiPicker(false)} className="text-slate-400 hover:text-rose-600 font-semibold">×</button>
                                                </div>
                                                <div className="grid grid-cols-7 gap-2">
                                                    {commonEmojis.slice(0, 35).map((emoji, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onMouseDown={(e) => e.preventDefault()} // Evita pérdida de foco
                                                            onClick={() => addEmoji(emoji)}
                                                            className="text-xl hover:scale-125 transition-transform p-1"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={sending || !newComment.trim()}
                                        className="w-14 h-14 bg-[#002855] text-white border-2 border-[#002855] flex items-center justify-center hover:bg-white hover:text-[#002855] transition-all active:scale-90 shadow-xl disabled:opacity-50 disabled:grayscale shrink-0"
                                        title="Enviar Mensaje"
                                    >
                                        {sending ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right side: People Info */}
                <div className={`w-full lg:w-[280px] xl:w-[300px] lg:flex-none bg-slate-50 overflow-y-auto lg:border-t-0 border-slate-200 ${mobileTab === 'people' ? 'block flex-1 min-h-0' : 'hidden lg:block'}`}>
                    <div className="p-6 space-y-8">
                        {/* Participantes */}
                        <div>
                            <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2 mb-4">Participantes</span>
                            <div className="space-y-4">
                                {/* Solicitante */}
                                <div className="flex items-center gap-3 p-4 bg-white border border-slate-200 shadow-sm">
                                    <div className="w-12 h-12 bg-slate-200 border border-slate-300 rounded-none overflow-hidden flex-none">
                                        {ticket.requester?.avatar_url ? <img src={ticket.requester.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-500">{getRoleIcon(ticket.requester?.role, 18)}</div>}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-semibold text-[#002855] uppercase truncate">
                                            {ticket.requester?.full_name} {ticket.requester_id === user?.id && <span className="opacity-50 text-[9px] ml-1">(YO)</span>}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={onlineUsers.has(ticket.requester_id) ? 'text-emerald-500' : 'text-slate-400'}>
                                                {getRoleIcon(ticket.requester?.role, 14)}
                                            </div>
                                            {onlineUsers.has(ticket.requester_id) ? (
                                                <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase text-emerald-500 tracking-widest">
                                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                    En Línea
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-semibold uppercase text-slate-400 tracking-widest">Solicitante</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Técnico Asignado Principal */}
                                {ticket.attendant && (
                                    <div className="flex items-center gap-3 p-4 bg-[#002855] shadow-lg">
                                        <div className="w-12 h-12 bg-[#002855] border border-white/20 rounded-none overflow-hidden flex-none">
                                            {ticket.attendant?.avatar_url ? <img src={ticket.attendant.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white">{getRoleIcon(ticket.attendant?.role, 18)}</div>}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-semibold text-white uppercase truncate">
                                                {ticket.attendant?.full_name} {ticket.assigned_to === user?.id && <span className="opacity-50 text-[9px] ml-1">(YO)</span>}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className={onlineUsers.has(ticket.assigned_to) ? 'text-emerald-400' : 'text-slate-300'}>
                                                    {getRoleIcon(ticket.attendant?.role, 14)}
                                                </div>
                                                {onlineUsers.has(ticket.assigned_to) ? (
                                                    <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase text-emerald-400 tracking-widest">
                                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                                        En Línea
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-semibold uppercase text-slate-300 tracking-widest">Responsable</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Atender Ticket Button */}
                                {canAttendTicket && (
                                    <button onClick={handleAttendTicket} disabled={statusUpdating} className="w-full py-2 bg-[#002855] text-white text-[10px] font-semibold uppercase tracking-widest hover:bg-slate-800 transition-colors border border-[#002855]">
                                        Asignar a mí
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Equipo de Soporte */}
                        {getAssignedUsers().length > 0 && (
                            <div>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2 mb-4">Personal en Sitio</span>
                                <div className="space-y-2">
                                    {getAssignedUsers().map((assignment: any) => (
                                        <div key={assignment.user_id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 shadow-sm">
                                            <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-none overflow-hidden flex-none">
                                                {assignment.user?.avatar_url ? <img src={assignment.user.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400">{getRoleIcon(assignment.user?.role, 16)}</div>}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-semibold text-slate-800 uppercase truncate leading-tight">
                                                    {assignment.user?.full_name} {assignment.user_id === user?.id && <span className="text-[#002855] opacity-50 text-[8px] ml-1">(YO)</span>}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className={onlineUsers.has(assignment.user_id) ? 'text-emerald-500' : 'text-slate-400'}>
                                                        {getRoleIcon(assignment.user?.role, 14)}
                                                    </div>
                                                    {onlineUsers.has(assignment.user_id) && (
                                                        <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase text-emerald-500 tracking-widest">
                                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                            En Línea
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Cronología */}
                        <div className="pt-4 border-t border-slate-200">
                            <div className="bg-white border border-slate-200 p-4">
                                <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-widest mb-1 text-center font-mono">Referencia Temporal</p>
                                <p className="text-[17px] font-semibold text-[#002855] text-center mb-1">
                                    {(() => {
                                        const now = new Date();
                                        const created = new Date(ticket.created_at);
                                        const diffMs = now.getTime() - created.getTime();
                                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                        const diffDays = Math.floor(diffHours / 24);
                                        if (diffDays > 0) return `${diffDays}D ${diffHours % 24}H`;
                                        else if (diffHours > 0) return `${diffHours}H ${Math.floor((diffMs / (1000 * 60)) % 60)}M`;
                                        else return `${Math.floor(diffMs / (1000 * 60))} MIN`;
                                    })()}
                                </p>
                                <p className="text-[12px] text-slate-500 font-semibold uppercase text-center">{new Date(String(ticket.created_at).includes('T') ? String(ticket.created_at) : `${ticket.created_at}T12:00:00`).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Modals (Standardized) */}
            {showFinalizeConfirm && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
                    <div className="bg-white rounded-none border-2 border-[#002855] shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-none bg-rose-100 flex items-center justify-center text-rose-600">
                                <AlertCircle size={20} />
                            </div>
                            <div>
                                <h3 className="text-xs font-semibold text-[#002855] uppercase tracking-widest">Finalizar Ciclo</h3>
                                <p className="text-[10px] text-slate-500 font-semibold uppercase">Acción irreversible en DB</p>
                            </div>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 p-4 mb-6">
                            <p className="text-[10px] text-rose-800 font-semibold uppercase leading-relaxed">
                                El ticket será marcado como ARCHIVADO. No se admitirán nuevos registros ni cambios de estado.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowFinalizeConfirm(false)} className="flex-1 py-2 bg-slate-100 text-slate-700 text-[10px] font-semibold uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-colors">Cancelar</button>
                            <button onClick={handleFinalizeTicket} disabled={statusUpdating} className="flex-1 py-2 bg-rose-600 text-white text-[10px] font-semibold uppercase tracking-widest border border-rose-600 hover:bg-rose-700 transition-colors shadow-lg">Finalizar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
