import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// Forzar importación para evitar caché
import { Settings, HelpCircle, Menu, Image as ImageIcon, Check, User as UserIcon, LogOut, ChevronRight, ChevronDown, Search, Plus, X, RefreshCw, BarChart3, Package, Wrench, Calendar, Camera, Users as UsersIcon, Clipboard, Ticket, LayoutGrid, AlertTriangle, MapPin } from 'lucide-react';
import { FaTerminal } from "react-icons/fa";
import { supabase, SutranVisit } from '../../shared/services/supabase';
import { useAuth } from '../providers/AuthContext';
import NotificationsFinal from '../../shared/components/NotificationsFinal';
import { RiFileExcel2Fill } from 'react-icons/ri';
import { FaFilePdf } from 'react-icons/fa6';

const ROUTE_LABELS: Record<string, string> = {
    'inventory': 'Inventario',
    'camara': 'Cámaras',
    'cameras': 'Cámaras',
    'maintenance': 'Mantenimiento',
    'sent': 'Enviados',
    'sutran': 'Sutran',
    'locations': 'Sedes',
    'mtc': 'MTC Accesos',
    'users': 'Usuarios',
    'audit': 'Auditoría',
    'integrity': 'Integridad',
    'diagnostic': 'Diagnóstico',
    'connection-test': 'Prueba de Conexión',
    'quick-diagnostic': 'Diagnóstico Rápido',
    'tickets': 'Mesa de Ayuda',
    'dashboard': 'Dashboard General',
    'mine': 'Mis Tickets',
    'reports': 'Reportes',
    'painpoint': 'Puntos Críticos',
    'checklist': 'Checklist',
    'comentarios': 'Comentarios',
    'observaciones': 'Comentarios',
    'vacations': 'Vacaciones',
    'servers': 'Servidores',
    'flota-vehicular': 'Flota Vehicular',
    'spare-parts': 'Repuestos',
    'all': 'Ver Todo',
    'escon': 'ESCON',
    'ecsal': 'ECSAL',
    'citv': 'CITV',
    'lima': 'Lima',
    'provincias': 'Provincias',
    'pending': 'Pendientes',
    'in-progress': 'En Progreso',
    'completed': 'Completados',
};


type TopHeaderProps = {
    onMobileMenuClick?: () => void;
    sidebarCollapsed?: boolean;
};



export default function TopHeader({ onMobileMenuClick, sidebarCollapsed }: TopHeaderProps) {
    const { user, updateProfile, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const pathnames = location.pathname.split('/').filter(x => x);
    const showBreadcrumbs = location.pathname !== '/login'; // Mostrar breadcrumb siempre excepto en login
    const isTicketsRoute = location.pathname.startsWith('/tickets');
    const currentPath = location.pathname;
    // Detectar página actual para acciones específicas
    const getPageActions = () => {

        if (currentPath === '/' || currentPath === '/dashboard') {

            return {

                show: true,

                title: 'Acciones Dashboard',

                searchPlaceholder: 'Buscar...',

                actions: [

                    { icon: <FaFilePdf size={16} />, label: 'Reportes', action: () => navigate('/tickets/reports') },

                    { icon: <RefreshCw size={16} />, label: 'Actualizar', action: () => window.location.reload() },

                    { icon: <BarChart3 size={16} />, label: 'Estadísticas', action: () => alert('Estadísticas en desarrollo') }

                ]

            };

        }



        if (currentPath.startsWith('/tickets')) {

            return {

                show: true,

                title: 'Acciones Tickets',

                searchPlaceholder: 'Buscar tickets...',

                actions: [

                    { icon: <Plus size={16} />, label: 'Nuevo Ticket', action: () => window.dispatchEvent(new CustomEvent('tickets:new')) },

                    { icon: <FaFilePdf size={16} />, label: 'Reportes', action: () => navigate('/tickets/reports') },

                    { icon: <RiFileExcel2Fill size={16} />, label: 'Descargar Excel', action: () => window.dispatchEvent(new CustomEvent('tickets:export')) },

                    { icon: <Clipboard size={16} />, label: 'Historial', action: () => navigate('/tickets/history') }

                ]

            };

        }



        if (currentPath.startsWith('/inventory')) {

            return {

                show: true,

                title: 'Acciones Inventario',

                searchPlaceholder: 'Buscar equipos...',

                actions: [

                    { icon: <Plus size={16} />, label: 'Agregar Equipo', action: () => window.dispatchEvent(new CustomEvent('inventory:new')) },

                    { icon: <RiFileExcel2Fill size={16} />, label: 'Exportar Excel', action: () => window.dispatchEvent(new CustomEvent('inventory:export')) },

                    { icon: <FaFilePdf size={16} />, label: 'Exportar PDF', action: () => window.dispatchEvent(new CustomEvent('inventory:export-pdf')) },

                    { icon: <Package size={16} />, label: 'Repuestos', action: () => navigate('/spare-parts') },

                    { icon: <Wrench size={16} />, label: 'Mantenimiento', action: () => navigate('/maintenance') }

                ]

            };

        }



        if (currentPath.startsWith('/users')) {

            return {

                show: true,

                title: 'Acciones Usuarios',

                searchPlaceholder: 'Buscar usuarios...',

                actions: [

                    { icon: <Plus size={16} />, label: 'Nuevo Usuario', action: () => window.dispatchEvent(new CustomEvent('users:new')) },

                    { icon: <RiFileExcel2Fill size={16} />, label: 'Exportar Excel', action: () => window.dispatchEvent(new CustomEvent('users:export')) },

                    { icon: <FaFilePdf size={16} />, label: 'Exportar PDF', action: () => window.dispatchEvent(new CustomEvent('users:export-pdf')) },

                    { icon: <Settings size={16} />, label: 'Permisos', action: () => alert('Permisos en desarrollo') }

                ]

            };

        }



        if (currentPath.startsWith('/flota-vehicular')) {

            return {
                show: true,
                title: 'Acciones Flota',
                actions: [
                    { icon: <Plus size={16} />, label: 'Agregar Vehículo', action: () => window.dispatchEvent(new CustomEvent('flota:new')) },
                    { icon: <FaFilePdf size={16} />, label: 'Reporte PDF', action: () => window.dispatchEvent(new CustomEvent('flota:report')) },
                    { icon: <RiFileExcel2Fill size={16} />, label: 'Exportar Excel', action: () => window.dispatchEvent(new CustomEvent('flota:export')) },
                    { icon: <Wrench size={16} />, label: 'Mantenimiento', action: () => navigate('/maintenance') }
                ]

            };

        }



        if (currentPath.startsWith('/sutran')) {

            return {

                show: true,

                title: 'Acciones Sutran',

                searchPlaceholder: 'Buscar visitas...',

                actions: [

                    { icon: <Plus size={16} />, label: 'Nueva Visita', action: () => window.dispatchEvent(new CustomEvent('sutran:new')) },

                    { icon: <Calendar size={16} />, label: 'Calendario', action: () => alert('Calendario en desarrollo') },

                    { icon: <FaFilePdf size={16} />, label: 'Reporte PDF', action: () => window.dispatchEvent(new CustomEvent('sutran:report')) }

                ]

            };

        }



        if (currentPath.startsWith('/maintenance')) {

            return {

                show: true,

                title: 'Acciones Mantenimiento',

                searchPlaceholder: 'Buscar mantenimientos...',

                actions: [

                    { icon: <Plus size={16} />, label: 'Nueva Orden', action: () => window.dispatchEvent(new CustomEvent('maintenance:new')) },

                    { icon: <Clipboard size={16} />, label: 'Checklist', action: () => navigate('/checklist') },

                    { icon: <Package size={16} />, label: 'Inventario', action: () => navigate('/inventory') }

                ]

            };

        }



        if (currentPath.startsWith('/cameras')) {

            return {
                show: true,
                showSearch: false,
                title: 'Control de Cámaras',
                actions: [
                    { icon: <Plus size={16} />, label: 'Agregar Cámara', action: () => window.dispatchEvent(new CustomEvent('cameras:new')) },
                    { icon: <RiFileExcel2Fill size={16} />, label: 'Descargar en Excel', action: () => window.dispatchEvent(new CustomEvent('cameras:export')) },
                    { icon: <FaFilePdf size={16} />, label: 'Descargar en PDF', action: () => window.dispatchEvent(new CustomEvent('cameras:export-pdf')) },
                    { icon: <LayoutGrid size={16} />, label: 'Cambiar de vista', action: () => window.dispatchEvent(new CustomEvent('cameras:toggle-view')) },
                    { icon: <FaTerminal size={16} />, label: 'Descargar Automatización', action: () => { const a = document.createElement('a'); a.href = '/camera_automation.bat'; a.download = 'camera_automation.bat'; document.body.appendChild(a); a.click(); document.body.removeChild(a); } },
                ]

            };

        }



        if (currentPath.startsWith('/locations') || currentPath.startsWith('/sedes')) {

            return {

                show: true,

                title: 'Acciones Sedes',

                searchPlaceholder: 'Buscar sedes...',

                actions: [

                    { icon: <Plus size={16} />, label: 'Nueva Sede', action: () => window.dispatchEvent(new CustomEvent('locations:new')) },

                    { icon: <RiFileExcel2Fill size={16} />, label: 'Exportar Excel', action: () => window.dispatchEvent(new CustomEvent('locations:export')) },

                    { icon: <FaFilePdf size={16} />, label: 'Exportar PDF', action: () => window.dispatchEvent(new CustomEvent('locations:export-pdf')) },

                    { icon: <Camera size={16} />, label: 'Cámaras', action: () => navigate('/cameras') },

                    { icon: <UsersIcon size={16} />, label: 'Usuarios', action: () => navigate('/users') }

                ]

            };

        }



        if (currentPath.startsWith('/companies')) {

            return {

                show: true,

                title: 'Acciones Unidades de Negocio',

                actions: [

                    { icon: <Plus size={16} />, label: 'Nueva Unidad', action: () => window.dispatchEvent(new CustomEvent('companies:new')) },

                    { icon: <RiFileExcel2Fill size={16} />, label: 'Exportar Excel', action: () => window.dispatchEvent(new CustomEvent('companies:export')) },

                    { icon: <FaFilePdf size={16} />, label: 'Exportar PDF', action: () => window.dispatchEvent(new CustomEvent('companies:export-pdf')) },

                ]

            };

        }



        if (currentPath.startsWith('/servers')) {

            return {

                show: true,

                title: 'Acciones Servidores',

                searchPlaceholder: 'Buscar servidores...',

                actions: [

                    { icon: <Plus size={16} />, label: 'Añadir nuevo servidor', action: () => window.dispatchEvent(new CustomEvent('servers:new')) },

                    { icon: <LayoutGrid size={16} />, label: 'Cambiar vista', action: () => window.dispatchEvent(new CustomEvent('servers:toggle-view')) },

                    { icon: <RiFileExcel2Fill size={16} />, label: 'Descargar Excel', action: () => window.dispatchEvent(new CustomEvent('servers:download')) },

                    { icon: <FaFilePdf size={16} />, label: 'Descargar PDF', action: () => window.dispatchEvent(new CustomEvent('servers:download-pdf')) }

                ]

            };

        }



        // Para otras páginas, no mostrar acciones por ahora

        return { show: false, showSearch: true };

    };



    const pageActions = getPageActions();



    // Estado para forzar actualización del breadcrumb

    const [breadcrumbKey, setBreadcrumbKey] = useState(0);



    // Actions panel state (for ticket routes)

    const [showActions, setShowActions] = useState(false);

    const [searchValue, setSearchValue] = useState('');

    const actionsRef = useRef<HTMLDivElement>(null);


    const [showUserSettings, setShowUserSettings] = useState(false);

    const [showSutranPopup, setShowSutranPopup] = useState(false);

    const [showHelpModal, setShowHelpModal] = useState(false);

    const [sutranNotifications, setSutranNotifications] = useState<SutranVisit[]>([]);

    const [userLocation, setUserLocation] = useState<string>('');


    const settingsRef = useRef<HTMLDivElement>(null);

    const sutranPopupRef = useRef<HTMLDivElement>(null);

    const helpRef = useRef<HTMLDivElement>(null);



    // Forzar actualización del breadcrumb cuando cambia la ruta

    useEffect(() => {

        setBreadcrumbKey(prev => prev + 1);

    }, [location.pathname]);



    // Close actions panel on route change

    useEffect(() => { setShowActions(false); setSearchValue(''); }, [location.pathname]);



    // Broadcast search to Tickets page

    useEffect(() => {

        if (!isTicketsRoute) return;

        window.dispatchEvent(new CustomEvent('tickets:search', { detail: searchValue }));

    }, [searchValue, isTicketsRoute]);





    // Temp state for editing user profile

    const [editName, setEditName] = useState(user?.full_name || '');

    const [editAvatar, setEditAvatar] = useState(user?.avatar_url || '');

    const [isSaving, setIsSaving] = useState(false);



    useEffect(() => {

        if (user) {

            setEditName(user.full_name);

            setEditAvatar(user.avatar_url || '');

        }

    }, [user]);



    // Fetch user's location name with Realtime updates

    useEffect(() => {

        const fetchUserLocation = async () => {

            if (user?.location_id) {

                const { data } = await supabase

                    .from('locations')

                    .select('name')

                    .eq('id', user.location_id)

                    .single();



                if (data) {

                    setUserLocation(data.name);

                }

            } else {

                setUserLocation('');

            }

        };



        fetchUserLocation();



        // Subscribe to location changes

        const locationSubscription = supabase

            .channel('location-changes')

            .on('postgres_changes', {

                event: 'UPDATE',

                schema: 'public',

                table: 'locations',

                filter: `id=eq.${user?.location_id}`

            }, (payload) => {

                if (payload.new && 'name' in payload.new) {

                    setUserLocation(payload.new.name as string);

                }

            })

            .subscribe();



        return () => {

            supabase.removeChannel(locationSubscription);

        };

    }, [user?.location_id]);



    // Fetch Sutran notifications via Realtime
    useEffect(() => {
        const toLocalDateStr = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const fetchNotifications = async () => {
            try {
                const today = new Date();
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(today.getDate() - 30);
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(today.getDate() + 30);

                const { data } = await supabase
                    .from('sutran_visits')
                    .select('*')
                    .in('status', ['pending', 'in_progress'])
                    .gte('visit_date', toLocalDateStr(thirtyDaysAgo))
                    .lte('visit_date', toLocalDateStr(thirtyDaysFromNow))
                    .order('visit_date', { ascending: true });

                if (data) {
                    setSutranNotifications(data as SutranVisit[]);
                }
            } catch (error) {
                console.error('Error fetching notifications:', error);
            }
        };

        fetchNotifications();

        const channel = supabase
            .channel('sutran-visits-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'sutran_visits'
            }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);



    // Close dropdowns on click outside

    useEffect(() => {

        const handleClickOutside = (event: MouseEvent) => {


            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {

                setShowUserSettings(false);

            }

            if (sutranPopupRef.current && !sutranPopupRef.current.contains(event.target as Node)) {

                setShowSutranPopup(false);

            }

            if (helpRef.current && !helpRef.current.contains(event.target as Node)) {

                setShowHelpModal(false);

            }

        };



        document.addEventListener('mousedown', handleClickOutside);

        return () => document.removeEventListener('mousedown', handleClickOutside);

    }, []);



    // Close actions panel on outside click

    useEffect(() => {

        const handler = (e: MouseEvent) => {

            if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {

                setShowActions(false);

            }

        };

        document.addEventListener('mousedown', handler);

        return () => document.removeEventListener('mousedown', handler);

    }, []);



    const handleSaveProfile = async () => {

        try {

            setIsSaving(true);

            await updateProfile({

                full_name: editName,

                avatar_url: editAvatar || undefined

            });

            setShowUserSettings(false);

        } catch (error) {

            console.error('Error saving profile:', error);

            alert('Error al guardar el perfil');

        } finally {

            setIsSaving(false);

        }

    };



    const getDaysRemaining = (dateString: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const targetDate = new Date(dateString);
        targetDate.setHours(0, 0, 0, 0);

        const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Hoy';
        if (diffDays === 1) return 'Mañana';
        if (diffDays > 1) return `en ${diffDays} días`;
        return `Vencida (hace ${Math.abs(diffDays)} días)`;
    };



    return (

        <header className={`h-14 bg-white text-gray-800 flex items-center justify-between sticky top-0 z-[100] shadow-lg border-b border-gray-200 transition-all duration-300 ${sidebarCollapsed ? 'lg:px-6 px-6' : 'lg:px-6 px-6'}`}>

            <div className="flex items-center gap-4 lg:gap-8 overflow-hidden">

                <button

                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors lg:hidden shrink-0 text-gray-700"

                    onClick={onMobileMenuClick}

                >

                    <Menu size={20} />

                </button>



                {/* Improved Breadcrumbs with better UX - Desktop Only */}

                <nav key={breadcrumbKey} className={`hidden lg:flex items-center gap-2 overflow-hidden min-w-0 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-0' : 'lg:ml-0'}`} aria-label="Navegación de migajas de pan">

                    {showBreadcrumbs && (

                        <>

                            {/* Sistema GSC Root */}

                            <div className="flex items-center gap-1.5 shrink-0">

                                <button

                                    onClick={() => navigate('/')}

                                    className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-md shadow-sm hover:from-slate-700 hover:to-slate-600 transition-all"

                                    title="Navegar al Dashboard"

                                >

                                    <div className="w-2 h-2 bg-green-400 rounded-full" />

                                    <span className="text-[12px] font-semibold tracking-widest">Sistema GSC</span>

                                </button>

                            </div>



                            <ChevronRight size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
                            {/* Ticket Icon for Ticket Routes */}
                            {isTicketsRoute && (
                                <>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => navigate('/tickets')}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md shadow-sm hover:bg-blue-200 transition-all"
                                            title="Navegar a Tickets">
                                            <Ticket size={14} />
                                            <span className="text-[12px] font-semibold tracking-widest">Tickets</span>
                                        </button>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-400 shrink-0" aria-hidden="true" />

                                </>

                            )}



                            {/* Main Module */}

                            {pathnames.length > 0 ? (

                                <>

                                    <div className="flex items-center gap-1.5 shrink-0">

                                        {pathnames.length === 1 ? (

                                            <button

                                                onClick={() => navigate(`/${pathnames[0]}`)}

                                                className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold text-slate-700 tracking-widest hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"

                                                title={`Navegar a ${ROUTE_LABELS[pathnames[0].toLowerCase()] || pathnames[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`}

                                            >

                                                <span>{ROUTE_LABELS[pathnames[0].toLowerCase()] || pathnames[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>

                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden="true" />

                                            </button>

                                        ) : (

                                            <button

                                                onClick={() => navigate(`/${pathnames[0]}`)}

                                                className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-slate-500 tracking-widest hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"

                                                title={`Navegar a ${ROUTE_LABELS[pathnames[0].toLowerCase()] || pathnames[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`}

                                                aria-label={`Navegar a ${ROUTE_LABELS[pathnames[0].toLowerCase()] || pathnames[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`}

                                            >

                                                <span className="truncate">{ROUTE_LABELS[pathnames[0].toLowerCase()] || pathnames[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>

                                            </button>

                                        )}

                                    </div>



                                    {/* Sub-routes */}

                                    {pathnames.length > 1 && (

                                        <>

                                            <ChevronRight size={14} className="text-slate-400 shrink-0" aria-hidden="true" />

                                            {pathnames.slice(1).map((name, index) => {

                                                const isLast = index === pathnames.slice(1).length - 1;

                                                const fullPath = `/${pathnames.slice(0, index + 2).join('/')}`;

                                                const label = ROUTE_LABELS[name.toLowerCase()] || name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());



                                                return (

                                                    <div key={fullPath} className="flex items-center gap-1.5 shrink-0 min-w-0">

                                                        {isLast ? (

                                                            <button

                                                                onClick={() => navigate(fullPath)}

                                                                className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold text-slate-700 tracking-widest hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all truncate max-w-[180px] sm:max-w-[250px]"

                                                                title={`Navegar a ${label}`}

                                                            >

                                                                <span className="truncate">{label}</span>

                                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden="true" />

                                                            </button>

                                                        ) : (

                                                            <>

                                                                <ChevronRight size={14} className="text-slate-400 shrink-0" aria-hidden="true" />

                                                                <button

                                                                    onClick={() => navigate(fullPath)}

                                                                    className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-slate-500 tracking-widest hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all truncate max-w-[100px] sm:max-w-[150px] group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"

                                                                    title={`Navegar a ${label}`}

                                                                    aria-label={`Navegar a ${label}`}

                                                                >

                                                                    <span className="truncate">{label}</span>

                                                                </button>

                                                            </>

                                                        )}

                                                    </div>

                                                );

                                            })}

                                        </>

                                    )}

                                </>

                            ) : (

                                /* Dashboard como módulo actual cuando no hay pathnames */
                                <button
                                    onClick={() => navigate('/')}
                                    className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-slate-700 tracking-widest hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                                    title="Navegar al Dashboard"
                                >
                                    <span>Dashboard</span>
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden="true" />
                                </button>
                            )}
                        </>
                    )}
                </nav>
            </div>



            <div className="flex items-center gap-2">

                {/* Dynamic Page Actions Dropdown */}

                {pageActions.show && (

                    <div className="relative" ref={actionsRef}>

                        <button

                            onClick={() => setShowActions(v => !v)}

                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-semibold tracking-widest font-sans transition-all ${showActions ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'}`}

                        >

                            <Plus size={13} />

                            ACCIONES

                            <ChevronDown size={13} className={`transition-transform duration-200 ${showActions ? 'rotate-180' : ''}`} />

                        </button>



                        {showActions && (

                            <div className="absolute left-1/3 sm:right-0 top-full mt-2 w-80 sm:w-72 bg-[#001e3c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[200] animate-in fade-in slide-in-from-top-2 duration-200 sm:left-auto left-1/3 sm:translate-x-0 -translate-x-1/3 font-sans">

                                {pageActions.showSearch !== false && (

                                    <div className="p-4 border-b border-white/10">

                                        <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-3 font-sans">{pageActions.title}</p>

                                        <div className="relative">

                                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />

                                            <input

                                                autoFocus

                                                type="text"

                                                value={searchValue}

                                                onChange={e => setSearchValue(e.target.value)}

                                                placeholder={pageActions.searchPlaceholder}

                                                className="w-full bg-white/10 border border-white/10 rounded-xl pl-8 pr-8 py-2.5 text-[11px] text-white placeholder-white/30 font-medium outline-none focus:border-blue-500/50 focus:bg-white/15 transition-all"

                                            />

                                            {searchValue && (

                                                <button onClick={() => setSearchValue('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">

                                                    <X size={13} />

                                                </button>

                                            )}

                                        </div>

                                    </div>

                                )}

                                <div className="p-3 space-y-2">

                                    {pageActions.actions?.map((action, index) => (

                                        <button

                                            key={index}

                                            onClick={() => { action.action(); setShowActions(false); }}

                                            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[12px] font-semibold tracking-wide transition-all active:scale-95 shadow-lg shadow-blue-900/30 font-sans"

                                        >

                                            {action.icon}

                                            {action.label}

                                        </button>

                                    )) || []}

                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className="flex items-center gap-1">
                    {/* Sistema de Notificaciones - FUNCIONANDO */}
                    <NotificationsFinal />
                    {/* SUTRAN Indicator */}
                    <div className="relative" ref={sutranPopupRef}>
                        <button
                            onClick={() => setShowSutranPopup(!showSutranPopup)}
                            className={`
                              relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300
                              ${showSutranPopup
                                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-200'
                                    : 'bg-slate-100/80 text-slate-600 hover:bg-orange-50 hover:text-orange-600 border border-transparent hover:border-orange-200'}
                            `}
                            title="Visitas SUTRAN"
                        >
                            <AlertTriangle size={18} className={showSutranPopup ? 'animate-pulse' : ''} />
                            {sutranNotifications.length > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                                    {sutranNotifications.length}
                                </span>
                            )}
                        </button>
                        {showSutranPopup && (
                            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-[200] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                <div className="p-4 border-b border-gray-100 bg-[#001529] text-white">

                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/20 rounded-lg">
                                            <AlertTriangle size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm">Visitas SUTRAN</h4>
                                            <p className="text-[10px] opacity-80">Próximas visitas programadas</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 space-y-3 max-h-96 overflow-y-auto"> {sutranNotifications.length > 0 ? (sutranNotifications.map((visit) => (
                                    <div
                                        key={visit.id}
                                        onClick={() => { navigate('/sutran'); setShowSutranPopup(false); }}
                                        className="p-3 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-gray-900 mb-1">{visit.location_name}</p>
                                                <p className="text-[10px] text-gray-600">Inspector: {visit.inspector_name}</p>
                                            </div>

                                            <span className="text-[14px] font-semibold text-slate-800">
                                                {visit.status === 'pending' ? 'Pendiente' : visit.status === 'in_progress' ? 'En Progreso' : 'Completada'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">

                                            <Calendar size={12} className="text-orange-600" />

                                            <span className="text-xs font-bold text-orange-700">

                                                {new Date(String(visit.visit_date).includes('T') ? String(visit.visit_date) : `${visit.visit_date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}

                                            </span>

                                            <span className="text-[10px] text-gray-500">•</span>

                                            <span className="text-[10px] font-medium text-gray-600">{getDaysRemaining(visit.visit_date)}</span>

                                        </div>

                                    </div>

                                ))

                                ) : (

                                    <div className="text-center py-6">

                                        <AlertTriangle size={32} className="text-gray-300 mx-auto mb-2" />

                                        <p className="text-sm text-gray-500">No hay visitas próximas</p>

                                        <p className="text-xs text-gray-400 mt-1">en los próximos 30 días</p>

                                    </div>

                                )}

                                </div>



                                <div className="p-2 bg-gray-50 border-t border-gray-100">

                                    <button

                                        onClick={() => { navigate('/sutran'); setShowSutranPopup(false); }}

                                        className="w-full py-2 text-[10px] font-bold text-orange-600 hover:bg-orange-50 rounded-lg transition-colors flex items-center justify-center gap-2"

                                    >

                                        Ver Todas las Visitas

                                        <ChevronRight size={12} />

                                    </button>

                                </div>

                            </div>

                        )}

                    </div>



                    {/* Help Button - Solo visible en cámaras */}

                    {currentPath.startsWith('/cameras') && (

                        <div className="relative" ref={helpRef}>

                            <button

                                onClick={() => setShowHelpModal(!showHelpModal)}

                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"

                                title="Ayuda Cámaras"

                            >

                                <HelpCircle size={18} />

                            </button>

                            {showHelpModal && (

                                <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">

                                    <div className="p-4 border-b border-gray-100 bg-[#001529] text-white">

                                        <div className="flex items-center gap-3">

                                            <div className="p-2 bg-white/20 rounded-lg">

                                                <HelpCircle size={20} />

                                            </div>

                                            <div>

                                                <h4 className="font-bold text-sm">Tutorial Cámaras</h4>

                                                <p className="text-[10px] opacity-80">Guía de uso del sistema de cámaras</p>

                                            </div>

                                        </div>

                                    </div>

                                    <div className="p-4">

                                        <div className="aspect-video bg-gray-900 rounded-lg mb-4 overflow-hidden">

                                            <video

                                                controls

                                                className="w-full h-full object-cover"

                                            >

                                                <source src="/camaras-tutorial.mp4" type="video/mp4" />

                                                Tu navegador no soporta el elemento de video.

                                            </video>

                                        </div>

                                        <div className="space-y-2">

                                            <h5 className="font-bold text-xs text-gray-700 tracking-widest">Temas cubiertos:</h5>

                                            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">

                                                <li>Configuración de cámaras</li>

                                                <li>Acceso por URL</li>

                                                <li>Códigos de autenticación</li>

                                                <li>Visualización en tiempo real</li>

                                            </ul>

                                        </div>

                                    </div>

                                </div>

                            )}

                        </div>

                    )}



                    <div className="h-8 w-[1px] bg-gray-300 mx-1" />



                    {/* User Info - Estilo Moderno */}
                    <div className="hidden lg:flex flex-col items-end gap-0.5 mr-4 leading-tight">
                        <span className="text-[11px] font-black text-slate-800 tracking-tight">
                            {user?.full_name}
                        </span>
                        {userLocation && (
                            <span className="text-[9px] font-bold text-blue-600/70 tracking-widest flex items-center gap-1">
                                <MapPin size={8} /> {userLocation}
                            </span>
                        )}
                    </div>



                    {/* User Profile Settings - Premium Trigger */}
                    <div className="relative" ref={settingsRef}>
                        <button
                            onClick={() => setShowUserSettings(!showUserSettings)}
                            className={`
                              flex items-center gap-2 p-1 rounded-xl transition-all duration-300
                              ${showUserSettings ? 'bg-blue-50 border-blue-200 shadow-sm' : 'hover:bg-slate-50 border-transparent'}
                              border
                            `}
                        >
                            <div className="relative">
                                <div className="w-8 h-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center text-[11px] font-black text-white shadow-md border border-white/10 uppercase overflow-hidden">
                                    {user?.avatar_url ? (
                                        <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        user?.full_name?.charAt(0)
                                    )}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
                            </div>
                            <Settings size={18} className={`text-slate-400 transition-transform duration-500 ${showUserSettings ? 'rotate-180 text-blue-600' : ''}`} />
                        </button>



                        {showUserSettings && (

                            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden text-gray-800 animate-in fade-in zoom-in-95 duration-200 origin-top-right">

                                <div className="p-4 border-b border-gray-100 bg-[#001529] text-white">

                                    <div className="flex items-center gap-3">

                                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg font-bold uppercase overflow-hidden border border-white/20">

                                            {user?.avatar_url ? (

                                                <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />

                                            ) : (

                                                user?.full_name?.charAt(0)

                                            )}

                                        </div>

                                        <div className="overflow-hidden">

                                            <h4 className="font-bold text-sm truncate">{user?.full_name}</h4>

                                            <p className="text-[10px] opacity-80 truncate tracking-widest">{user?.role}</p>

                                        </div>

                                    </div>

                                </div>



                                <div className="p-4 space-y-4">

                                    <h3 className="text-[12px] font-black text-[#002855] tracking-widest">Mi Perfil</h3>



                                    <div className="space-y-3">

                                        <div>

                                            <label className="text-[12px] font-bold text-gray-400 tracking-wider mb-1 block">Nombre Completo</label>

                                            <div className="relative">

                                                <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />

                                                <input

                                                    type="text"

                                                    value={editName}

                                                    onChange={(e) => setEditName(e.target.value)}

                                                    className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs focus:ring-1 focus:ring-[#002855] focus:bg-white outline-none transition-all font-bold"

                                                    placeholder="Nombre"

                                                />

                                            </div>

                                        </div>



                                        <div>

                                            <label className="text-[10px] font-bold text-gray-400 tracking-wider mb-1 block">URL Foto de Perfil</label>

                                            <div className="relative">

                                                <ImageIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />

                                                <input

                                                    type="text"

                                                    value={editAvatar}

                                                    onChange={(e) => setEditAvatar(e.target.value)}

                                                    className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs focus:ring-1 focus:ring-[#002855] focus:bg-white outline-none transition-all font-medium"

                                                    placeholder="https://..."

                                                />

                                            </div>

                                        </div>



                                        <button

                                            onClick={handleSaveProfile}

                                            disabled={isSaving}

                                            className="w-full bg-[#002855] text-white py-2.5 rounded-lg text-xs font-black tracking-widest hover:bg-[#003d80] transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-900/10 disabled:opacity-50"

                                        >

                                            {isSaving ? (

                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />

                                            ) : (

                                                <>

                                                    <Check size={14} />

                                                    Actualizar Perfil

                                                </>

                                            )}

                                        </button>

                                    </div>

                                </div>



                                <div className="p-2 bg-gray-50 border-t border-gray-100">

                                    <button

                                        onClick={logout}

                                        className="w-full py-2 text-[10px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center gap-2"

                                    >

                                        <LogOut size={12} />

                                        Cerrar Sesión

                                    </button>

                                </div>

                                <div className="py-2 text-center bg-gray-50 border-t border-gray-100">

                                    <p className="text-[7px] font-bold text-gray-300 uppercase tracking-[2px]">

                                        SISTEMA GSC • DESARROLLADO POR FABRITCIO PEÑA

                                    </p>

                                </div>

                            </div>

                        )}

                    </div>

                </div>

            </div>

        </header>

    );

}







