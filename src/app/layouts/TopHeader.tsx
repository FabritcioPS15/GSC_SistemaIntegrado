import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// Forzar importación para evitar caché
import { Home, Settings, HelpCircle, Menu, Image as ImageIcon, Check, User as UserIcon, LogOut, ChevronRight, Calendar, AlertTriangle, MapPin } from 'lucide-react';
import { supabase, SutranVisit } from '../../shared/services/supabase';
import { useAuth } from '../providers/AuthContext';
import NotificationsFinal from '../../shared/components/NotificationsFinal';
import Loader from '../../shared/components/ui/Loader';

const ROUTE_LABELS: Record<string, string> = {
    // Módulos principales
    'dashboard': 'Dashboard',
    'inventory': 'Inventario',
    'cameras': 'Cámaras',
    'camara': 'Cámaras',
    'maintenance': 'Mantenimiento',
    'sent': 'Enviados',
    'checklist': 'Checklist',
    'vacations': 'Vacaciones',
    'cvs': 'Recursos Humanos',
    'sutran': 'Sutran',
    'locations': 'Sedes',
    'companies': 'Empresas',
    'mtc': 'MTC Accesos',
    'users': 'Usuarios',
    'servers': 'Servidores',
    'flota-vehicular': 'Flota Vehicular',
    'requests': 'Requerimientos',
    'spare-parts': 'Repuestos',
    'titulos-habilitantes': 'Títulos Habilitantes',
    'planos-defensa-civil': 'Planos Defensa Civil',
    'audit': 'Auditoría',
    'integrity': 'Integridad',
    'diagnostic': 'Diagnóstico',
    'connection-test': 'Prueba de Conexión',
    'quick-diagnostic': 'Diagnóstico Rápido',
    'tickets': 'Mesa de Ayuda',

    // Sub-rutas específicas
    'mine': 'Mis Tickets',
    'reports': 'Reportes',
    'painpoint': 'Puntos Críticos',
    'comentarios': 'Observaciones',
    'observaciones': 'Observaciones',
    'future-visits': 'Próximas Visitas',
    'all': 'Ver Todo',

    // Tipos de Negocio
    'escon': 'ESCON',
    'ecsal': 'ECSAL',
    'citv': 'CITV',
    'policlinico': 'ECSAL',
    'escuela_conductores': 'ESCON',
    'revision': 'CITV',
    'lima': 'Lima',
    'provincias': 'Provincias',

    // Estados
    'pending': 'Pendientes',
    'in-progress': 'En Progreso',
    'completed': 'Completados',

    // Categorías de Inventario / Mantenimiento
    'tecnologia': 'Tecnología',
    'muebles': 'Muebles y Enseres',
    'herramientas': 'Herramientas e Instalaciones',
    'infraestructura': 'Infraestructura',
    'vehiculos': 'Vehículos',
    'equipos_de_linea': 'Equipos de Línea',
    'equipos-de-linea': 'Equipos de Línea',
    'pc': 'Equipos de Línea',
    'servidores': 'Servidores',
    'impresoras': 'Impresoras',
    'laptops': 'Laptops',
    'pcs': 'PCs',
    'monitores': 'Monitores',
    'switches': 'Switches',
    'routers': 'Routers',
    'access-points': 'Access Points',
    'radios': 'Radios',
    'nvr': 'NVRs',
    'dvr': 'DVRs',
    'antenas': 'Antenas',
    'herramientas-manuales': 'Herramientas Manuales',
    'herramientas-electricas': 'Herramientas Eléctricas',
    'equipos-medicion': 'Equipos de Medición',
    'mobiliario': 'Mobiliario',
    'sillas': 'Sillas y Sillones',
    'escritorios': 'Escritorios',
    'estantes': 'Archivadores y Estantes',
    'linea-blanca': 'Línea Blanca',
    'aire-acondicionado': 'Aire Acondicionado',
    'generadores': 'Grupos Electrógenos',
    'pozo-tierra': 'Pozos a Tierra',
    'extintores': 'Extintores',
    'luces-emergencia': 'Luces de Emergencia',
    'tableros-electricos': 'Tableros Eléctricos',
    'disks': 'Discos Duros',
    'cameras-disks': 'Discos Duros',
    'ssh': 'Terminal SSH',
    'ftp': 'Servidores FTP',
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
    const currentPath = location.pathname;

    // Helper para formatear o buscar la etiqueta de cada segmento del breadcrumb
    const getSegmentLabel = (segment: string): string => {
        const lower = segment.toLowerCase();
        if (ROUTE_LABELS[lower]) return ROUTE_LABELS[lower];

        // Detectar si es un UUID o un ID numérico para mostrar 'Detalle'
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) || /^\d+$/.test(segment)) {
            return 'Detalle';
        }

        // Formato por defecto: convertir guiones y subguiones a espacios y Capitalizar
        return segment
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    };

    const breadcrumbItems = useMemo(() => {
        return pathnames.map((name, index) => {
            const isLast = index === pathnames.length - 1;
            const fullPath = `/${pathnames.slice(0, index + 1).join('/')}`;
            const label = getSegmentLabel(name);
            return {
                name,
                label,
                path: fullPath,
                isLast,
            };
        });
    }, [location.pathname]);



    const [showUserSettings, setShowUserSettings] = useState(false);

    const [showSutranPopup, setShowSutranPopup] = useState(false);

    const [showHelpModal, setShowHelpModal] = useState(false);

    const [sutranNotifications, setSutranNotifications] = useState<SutranVisit[]>([]);

    const [userLocation, setUserLocation] = useState<string>('');


    const settingsRef = useRef<HTMLDivElement>(null);

    const sutranPopupRef = useRef<HTMLDivElement>(null);

    const helpRef = useRef<HTMLDivElement>(null);













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



                {/* Clean, Modern Breadcrumbs */}
                {showBreadcrumbs && (
                    <nav
                        className="hidden md:flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar py-1"
                        aria-label="Navegación de migajas de pan"
                    >
                        {/* Inicio / Root */}
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors shrink-0 select-none ${
                                breadcrumbItems.length === 0
                                    ? 'font-semibold text-[#002855] bg-slate-100/90 border border-slate-200'
                                    : 'text-slate-500 hover:text-[#002855] hover:bg-slate-100/70 font-medium'
                            }`}
                            title="Ir al Inicio"
                        >
                            <Home size={13} className={breadcrumbItems.length === 0 ? 'text-[#002855]' : 'text-slate-400'} />
                            <span>Inicio</span>
                            {breadcrumbItems.length === 0 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                            )}
                        </button>

                        {/* Migajas dinámicas */}
                        {breadcrumbItems.map((item) => (
                            <div key={item.path} className="flex items-center gap-1.5 shrink-0 min-w-0">
                                <ChevronRight size={13} className="text-slate-300 shrink-0" aria-hidden="true" />
                                {item.isLast ? (
                                    <div
                                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#002855] bg-slate-100/90 border border-slate-200 max-w-[220px] truncate select-none shadow-xs"
                                        title={item.label}
                                    >
                                        <span className="truncate">{item.label}</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => navigate(item.path)}
                                        className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-[#002855] hover:bg-slate-100/70 transition-colors max-w-[150px] truncate select-none"
                                        title={`Navegar a ${item.label}`}
                                    >
                                        <span className="truncate">{item.label}</span>
                                    </button>
                                )}
                            </div>
                        ))}
                    </nav>
                )}
            </div>



            <div className="flex items-center gap-2">

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

                                                <Loader size={16} color1="rgba(255,255,255,0.3)" color2="#ffffff" />

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







