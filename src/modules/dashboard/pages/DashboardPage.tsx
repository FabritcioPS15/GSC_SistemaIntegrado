import { useEffect, useState } from 'react';
import {
  Package,
  AlertCircle,
  Truck,
  ArrowRight,
  X,
  AlertTriangle,
  Camera,
  CheckSquare,
  MapPin,
  FileText
} from 'lucide-react';
import { supabase } from '../../../shared/services/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthContext';
import ModalOverlay from '../../../shared/components/ui/ModalOverlay';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface QuickStats {
  totalAssets: number;
  activeAssets: number;
  totalCameras: number;
  activeCameras: number;
  camerasByCategory: {
    escuela: { active: number; total: number; views: number };
    revision: { active: number; total: number; views: number };
    ecsal: { active: number; total: number; views: number };
  };
  totalVehicles: number;
  activeVehicles: number;
  maintenanceVehicles: number;
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  archivedTickets: number;
  expiredDocuments: number;
  warningDocuments: number;
  // New detailed vehicle stats
  vehiclesByDocument: {
    soat: { expired: number; warning: number; nextExpiring: Array<{ plate: string; days: number; location: string }> };
    citv: { expired: number; warning: number; nextExpiring: Array<{ plate: string; days: number; location: string }> };
    poliza: { expired: number; warning: number; nextExpiring: Array<{ plate: string; days: number; location: string }> };
  };
  // New ticket participants
  recentTicketParticipants: Array<{
    id: string;
    name: string;
    avatar?: string;
    role: string;
  }>;
  nextSutranVisit: { days: number; date: string; location: string } | null;
  recentNotifications: Array<any>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<QuickStats>({
    totalAssets: 0,
    activeAssets: 0,
    totalCameras: 0,
    activeCameras: 0,
    camerasByCategory: {
      escuela: { active: 0, total: 0, views: 0 },
      revision: { active: 0, total: 0, views: 0 },
      ecsal: { active: 0, total: 0, views: 0 }
    },
    totalVehicles: 0,
    activeVehicles: 0,
    maintenanceVehicles: 0,
    totalTickets: 0,
    openTickets: 0,
    inProgressTickets: 0,
    resolvedTickets: 0,
    closedTickets: 0,
    archivedTickets: 0,
    expiredDocuments: 0,
    warningDocuments: 0,
    vehiclesByDocument: {
      soat: { expired: 0, warning: 0, nextExpiring: [] },
      citv: { expired: 0, warning: 0, nextExpiring: [] },
      poliza: { expired: 0, warning: 0, nextExpiring: [] }
    },
    recentTicketParticipants: [],
    nextSutranVisit: null,
    recentNotifications: []
  });

  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showDocumentPopup, setShowDocumentPopup] = useState<string | null>(null);
  const [documentFilter, setDocumentFilter] = useState<'all' | 'expired' | 'warning'>('all');
  const [expiredVehicles, setExpiredVehicles] = useState<{ plate: string; days: number; expiredDate: Date; location: string }[]>([]);
  const [loadingExpired, setLoadingExpired] = useState(false);
  const [schools, setSchools] = useState<Array<{ id: string, name: string }>>([]);

  // Function to get school name by ID
  const getSchoolName = (schoolId: string) => {
    const school = schools.find(s => s.id === schoolId);
    return school ? school.name : 'Sede Desconocida';
  };

  // Reset filter when popup opens
  useEffect(() => {
    if (showDocumentPopup) {
      setDocumentFilter('all');
    }
  }, [showDocumentPopup]);

  useEffect(() => {
    fetchQuickStats();

    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchQuickStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all stats in parallel
      const promiseResults = await Promise.all([
        supabase.from('assets').select('id', { count: 'exact', head: true }),
        supabase.from('assets').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('cameras').select('status, display_count, locations(type)'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }),
        supabase.from('tickets').select('status'),
        supabase.from('vehiculos').select('estado, soat_vencimiento, citv_vencimiento, poliza_vencimiento, contrato_alquiler_vencimiento, placa, ubicacion_actual'),
        supabase.from('locations').select('id, name').eq('is_active', true),
        supabase.from('tickets')
          .select(`
            id,
            requester:requester_id(id, full_name, avatar_url),
            attendant:assigned_to(id, full_name, avatar_url)
          `)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('sutran_visits')
          .select('visit_date, location_name, status')
          .order('visit_date', { ascending: false }),
        user ? supabase.from('notifications')
          .select('*')
          .eq('target_role', user.role)
          .eq('read', false)
          .order('created_at', { ascending: false })
          .limit(3) : Promise.resolve({ data: [] })
      ]);

      const totalAssets = promiseResults[0].count;
      const activeAssets = promiseResults[1].count;
      const camerasData = promiseResults[2].data || [];
      const totalTickets = promiseResults[3].count;
      const tickets = promiseResults[4].data;
      const vehicles = promiseResults[5].data;
      const schoolsData = promiseResults[6].data;
      const recentTicketsData = promiseResults[7].data;

      let totalCameras = 0;
      let activeCameras = 0;
      const camerasByCategory = {
        escuela: { active: 0, total: 0, views: 0 },
        revision: { active: 0, total: 0, views: 0 },
        ecsal: { active: 0, total: 0, views: 0 }
      };

      camerasData.forEach((cam: any) => {
        totalCameras++;
        const isActive = cam.status === 'active';
        if (isActive) {
          activeCameras++;
        }

        const locType = cam.locations?.type;
        const displayCount = cam.display_count || 0;

        if (locType === 'escuela_conductores') {
          camerasByCategory.escuela.total++;
          if (isActive) {
            camerasByCategory.escuela.active++;
            camerasByCategory.escuela.views += displayCount;
          }
        } else if (locType === 'revision') {
          camerasByCategory.revision.total++;
          if (isActive) {
            camerasByCategory.revision.active++;
            camerasByCategory.revision.views += displayCount;
          }
        } else if (locType === 'policlinico') {
          camerasByCategory.ecsal.total++;
          if (isActive) {
            camerasByCategory.ecsal.active++;
            camerasByCategory.ecsal.views += displayCount;
          }
        }
      });

      // Extract Sutran visit info
      const allVisits = promiseResults[8]?.data || [];
      let nextSutranVisit = null;

      if (allVisits.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day

        // Filter future visits (not cancelled) and find the closest one
        const futureVisits = allVisits
          .filter((visit: any) => {
            const visitDate = new Date(visit.visit_date);
            visitDate.setHours(0, 0, 0, 0);
            return visitDate >= today && visit.status !== 'cancelled';
          })
          .map((visit: any) => ({
            ...visit,
            visitDate: new Date(visit.visit_date)
          }))
          .sort((a, b) => a.visitDate.getTime() - b.visitDate.getTime());

        if (futureVisits.length > 0) {
          const closestVisit = futureVisits[0];
          const daysDiff = differenceInDays(closestVisit.visitDate, today);

          nextSutranVisit = {
            days: daysDiff,
            date: closestVisit.visit_date,
            location: closestVisit.location_name || 'Sin sede'
          };
        }
      }

      // Extract notifications
      const notificationsData = promiseResults[9]?.data || [];

      // Process tickets
      const openTickets = tickets?.filter(t => t.status === 'open').length || 0;
      const inProgressTickets = tickets?.filter(t => t.status === 'in_progress').length || 0;
      const resolvedTickets = tickets?.filter(t => t.status === 'resolved').length || 0;
      const closedTickets = tickets?.filter(t => t.status === 'closed').length || 0;
      const archivedTickets = tickets?.filter(t => t.status === 'archived').length || 0;

      // Extract recent participants
      const participantsMap = new Map();

      recentTicketsData?.forEach((t: any) => {
        if (t.requester) {
          participantsMap.set(t.requester.id, {
            id: t.requester.id,
            name: t.requester.full_name,
            avatar: t.requester.avatar_url,
            role: 'requester'
          });
        }
        if (t.attendant) {
          participantsMap.set(t.attendant.id, {
            id: t.attendant.id,
            name: t.attendant.full_name,
            avatar: t.attendant.avatar_url,
            role: 'attendant'
          });
        }
      });

      const recentTicketParticipants = Array.from(participantsMap.values());

      // Process vehicles
      const totalVehicles = vehicles?.length || 0;
      const activeVehicles = vehicles?.filter(v => v.estado === 'activa').length || 0;
      const maintenanceVehicles = vehicles?.filter(v => v.estado === 'en_proceso').length || 0;

      // Process document expirations with detailed tracking
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      let expiredDocuments = 0;
      let warningDocuments = 0;

      // Detailed document tracking
      const vehiclesByDocument = {
        soat: { expired: 0, warning: 0, nextExpiring: [] as Array<{ plate: string; days: number; location: string }> },
        citv: { expired: 0, warning: 0, nextExpiring: [] as Array<{ plate: string; days: number; location: string }> },
        poliza: { expired: 0, warning: 0, nextExpiring: [] as Array<{ plate: string; days: number; location: string }> }
      };

      vehicles?.forEach((vehicle: any) => {
        // Solo procesar vehículos que tengan placa válida
        if (!vehicle.placa || vehicle.placa.trim() === '') {
          return;
        }

        const documents = [
          { name: 'soat', date: vehicle.soat_vencimiento, plate: vehicle.placa },
          { name: 'citv', date: vehicle.citv_vencimiento, plate: vehicle.placa },
          { name: 'poliza', date: vehicle.poliza_vencimiento, plate: vehicle.placa }
        ];

        documents.forEach(doc => {
          if (doc.date) {
            const date = new Date(doc.date);
            const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (date < today) {
              expiredDocuments++;
              vehiclesByDocument[doc.name as keyof typeof vehiclesByDocument].expired++;
            } else if (date <= thirtyDaysFromNow) {
              warningDocuments++;
              vehiclesByDocument[doc.name as keyof typeof vehiclesByDocument].warning++;

              // Add to next expiring list (show top 3 closest to expiration)
              if (daysUntil > 0) {
                vehiclesByDocument[doc.name as keyof typeof vehiclesByDocument].nextExpiring.push({
                  plate: doc.plate,
                  days: daysUntil,
                  location: vehicle.ubicacion_actual || 'Sin sede'
                });
              }
            }
          }
        });
      });

      // Sort next expiring vehicles (show all, not just top 3)
      Object.keys(vehiclesByDocument).forEach(docType => {
        vehiclesByDocument[docType as keyof typeof vehiclesByDocument].nextExpiring
          .sort((a, b) => a.days - b.days);
        // Removed .splice(3) to show all vehicles
      });

      // Set schools data
      setSchools(schoolsData || []);

      setStats({
        totalAssets: totalAssets || 0,
        activeAssets: activeAssets || 0,
        totalCameras: totalCameras || 0,
        activeCameras: activeCameras || 0,
        camerasByCategory,
        totalVehicles,
        activeVehicles,
        maintenanceVehicles,
        totalTickets: totalTickets || 0,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets,
        archivedTickets,
        expiredDocuments,
        warningDocuments,
        vehiclesByDocument,
        recentTicketParticipants,
        nextSutranVisit,
        recentNotifications: notificationsData
      });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(`Error al cargar los datos: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to get filtered vehicles for popup
  const getFilteredVehicles = (docType: 'soat' | 'citv' | 'poliza') => {
    if (documentFilter === 'expired') {
      return expiredVehicles;
    } else {
      return stats.vehiclesByDocument[docType].nextExpiring;
    }
  };

  // Function to get expired vehicles
  const getExpiredVehicles = async (docType: 'soat' | 'citv' | 'poliza') => {
    try {
      const today = new Date();
      let dateField = '';

      switch (docType) {
        case 'soat':
          dateField = 'soat_vencimiento';
          break;
        case 'citv':
          dateField = 'citv_vencimiento';
          break;
        case 'poliza':
          dateField = 'poliza_vencimiento';
          break;
      }

      const { data, error } = await supabase
        .from('vehiculos')
        .select('placa, ubicacion_actual, ' + dateField)
        .not('placa', 'is', null)
        .not(dateField, 'is', null)
        .lt(dateField, today.toISOString())
        .order(dateField, { ascending: true });

      if (error) throw error;

      return (data as any[])?.map(vehicle => {
        const expiredDate = new Date(vehicle[dateField]);
        const daysExpired = Math.ceil((today.getTime() - expiredDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          plate: vehicle.placa,
          days: -daysExpired, // Negative to indicate expired
          expiredDate: expiredDate,
          location: vehicle.ubicacion_actual || 'Sin sede'
        };
      }) || [];
    } catch (err) {
      console.error('Error fetching expired vehicles:', err);
      return [];
    }
  };

  // Load expired vehicles when filter changes
  useEffect(() => {
    if (showDocumentPopup && documentFilter === 'expired') {
      const loadExpiredVehicles = async () => {
        setLoadingExpired(true);
        const expired = await getExpiredVehicles(showDocumentPopup as 'soat' | 'citv' | 'poliza');
        setExpiredVehicles(expired);
        setLoadingExpired(false);
      };
      loadExpiredVehicles();
    } else {
      setExpiredVehicles([]);
    }
  }, [showDocumentPopup, documentFilter]);


  const alertCards = [
    {
      title: 'Documentos Vencidos',
      count: stats.expiredDocuments,
      icon: AlertTriangle,
      color: 'red',
      description: 'Requieren atención inmediata',
      path: '/flota-vehicular'
    },
    {
      title: 'Documentos por Vencer',
      count: stats.warningDocuments,
      icon: AlertCircle,
      color: 'yellow',
      description: 'Próximos a vencer (30 días)',
      path: '/flota-vehicular'
    }
  ];

  if (loading) {
    return (
      <LoadingSpinner label="Cargando dashboard..." />
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="text-red-600" size={20} />
            <h3 className="text-lg font-normal text-red-800">Error de Conexión</h3>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={fetchQuickStats}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc]">
      {/* Header */}


      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 min-w-0">
        {/* Date and Time Display */}
        <div className="bg-[#002855] rounded-none shadow-sm p-5 sm:p-8 text-white border border-[#002855]">
          <div className="text-center">
            <div className="text-3xl sm:text-4xl lg:text-5xl font-normal mb-2 tracking-wider">
              {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[12px] font-normal opacity-90 uppercase tracking-[0.2em]">
              {currentTime.toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>

        {/* Mixed Size Cards Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card - Inventario */}
          <div className="bg-white rounded-none shadow-sm border border-slate-200 overflow-hidden hover:border-[#002855] transition-all cursor-pointer group min-w-0"
            onClick={() => navigate('/inventory')}>
            {/* Dark Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="text-[#002855]" size={20} />
                  <span className="text-[#002855] font-normal uppercase tracking-[0.2em] text-[12px]">Inventario General</span>
                </div>
                <ArrowRight size={18} className="text-[#002855]/40 group-hover:text-[#002855] transition-colors" />
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-[#002855] text-4xl font-normal mb-2">{stats.totalAssets}</h3>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-[10px] font-normal text-slate-500 uppercase tracking-widest">{stats.activeAssets} activos</span>
              </div>
              <p className="text-[9px] font-normal text-slate-400 uppercase tracking-widest">Equipos y activos operativos</p>
            </div>
          </div>

          {/* Medium Card - Tickets */}
          <div className="bg-white rounded-none shadow-sm border border-slate-200 overflow-hidden hover:border-[#002855] transition-all cursor-pointer group min-w-0"
            onClick={() => navigate('/tickets')}>
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckSquare className="text-[#002855]" size={20} />
                  <span className="text-[#002855] font-normal uppercase tracking-[0.2em] text-[12px]">Mesa de ayuda</span>
                </div>
                <ArrowRight size={18} className="text-[#002855]/40 group-hover:text-[#002855] transition-colors" />
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-[#002855] text-3xl font-normal mb-3">{stats.totalTickets}</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-[10px] font-normal text-slate-500 uppercase tracking-widest">{stats.openTickets} Tickets abiertos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-[10px] font-normal text-slate-500 uppercase tracking-widest">{stats.inProgressTickets} Tickets en atención</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-[10px] font-normal text-slate-500 uppercase tracking-widest">{stats.resolvedTickets} Tickets resueltos</span>
                </div>
              </div>
            </div>
          </div>

          {/* Small Card - Cámaras */}
          <div className="bg-white rounded-none shadow-sm border border-slate-200 overflow-hidden hover:border-[#002855] transition-all cursor-pointer group min-w-0"
            onClick={() => navigate('/cameras')}>
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Camera className="text-[#002855]" size={20} />
                  <span className="text-[#002855] font-normal uppercase tracking-[0.2em] text-[12px]">Accesos a cámaras de videovigilancia</span>
                </div>
                <ArrowRight size={18} className="text-[#002855]/40 group-hover:text-[#002855] transition-colors" />
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-[#002855] text-3xl font-normal mb-2">{stats.totalCameras} accesos</h3>
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-normal text-slate-500 uppercase tracking-wider">
                  <span>Escuelas:</span>
                  <span className="text-[#002855] font-normal">
                    {stats.camerasByCategory.escuela.active} Accesos ({stats.camerasByCategory.escuela.views} cámaras)
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-normal text-slate-500 uppercase tracking-wider">
                  <span>Revisiones:</span>
                  <span className="text-[#002855] font-normal">
                    {stats.camerasByCategory.revision.active} Accesos ({stats.camerasByCategory.revision.views} cámaras)
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-normal text-slate-500 uppercase tracking-wider">
                  <span>ECSAL:</span>
                  <span className="text-[#002855] font-normal">
                    {stats.camerasByCategory.ecsal.active} Accesos ({stats.camerasByCategory.ecsal.views} cámaras)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Document Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          {/* Flota presentada para escuelas — Card unificada */}
          <div className="bg-white rounded-none shadow-sm border border-slate-200 overflow-hidden hover:border-[#002855] transition-all cursor-pointer group h-full flex flex-col min-w-0 col-span-full sm:col-span-3"
            onClick={() => navigate('/flota-vehicular')}>
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Truck className="text-[#002855]" size={18} />
                  <span className="text-[#002855] font-normal uppercase tracking-[0.2em] text-[12px]">Flota presentada para escuelas</span>
                </div>
                <ArrowRight size={16} className="text-[#002855]/40 group-hover:text-[#002855] transition-colors" />
              </div>
            </div>
            <div className="p-6 flex-grow">
              <div className="grid grid-cols-3 gap-3">
                {/* SOAT mini-card */}
                <div
                  className="border border-slate-200 hover:border-[#002855] transition-colors rounded-none overflow-hidden cursor-pointer"
                  onClick={e => { e.stopPropagation(); setShowDocumentPopup('soat'); }}
                >
                  <div className="bg-slate-50 border-b border-slate-200 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="text-[#002855]" size={12} />
                      <span className="text-[9px] font-normal uppercase tracking-[0.2em] text-[#002855]">SOAT</span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div>
                      <span className="text-[9px] text-slate-400 block">Vencidos</span>
                      <span className="text-2xl font-normal text-red-600">{stats.vehiclesByDocument.soat.expired}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block">Por vencer</span>
                      <span className="text-2xl font-normal text-yellow-600">{stats.vehiclesByDocument.soat.warning}</span>
                    </div>
                  </div>
                </div>
                {/* CITV mini-card */}
                <div
                  className="border border-slate-200 hover:border-[#002855] transition-colors rounded-none overflow-hidden cursor-pointer"
                  onClick={e => { e.stopPropagation(); setShowDocumentPopup('citv'); }}
                >
                  <div className="bg-slate-50 border-b border-slate-200 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="text-[#002855]" size={12} />
                      <span className="text-[9px] font-normal uppercase tracking-[0.2em] text-[#002855]">Rev. Técnica</span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div>
                      <span className="text-[9px] text-slate-400 block">Vencidas</span>
                      <span className="text-2xl font-normal text-red-600">{stats.vehiclesByDocument.citv.expired}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block">Por vencer</span>
                      <span className="text-2xl font-normal text-yellow-600">{stats.vehiclesByDocument.citv.warning}</span>
                    </div>
                  </div>
                </div>
                {/* Póliza mini-card */}
                <div
                  className="border border-slate-200 hover:border-[#002855] transition-colors rounded-none overflow-hidden cursor-pointer"
                  onClick={e => { e.stopPropagation(); setShowDocumentPopup('poliza'); }}
                >
                  <div className="bg-slate-50 border-b border-slate-200 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="text-[#002855]" size={12} />
                      <span className="text-[9px] font-normal uppercase tracking-[0.2em] text-[#002855]">Póliza</span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div>
                      <span className="text-[9px] text-slate-400 block">Vencidas</span>
                      <span className="text-2xl font-normal text-red-600">{stats.vehiclesByDocument.poliza.expired}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block">Por vencer</span>
                      <span className="text-2xl font-normal text-yellow-600">{stats.vehiclesByDocument.poliza.warning}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Simplified SUTRAN Alert */}
        {stats.nextSutranVisit && (
          <div className="bg-white shadow-sm border border-slate-200 rounded-none p-4 cursor-pointer hover:border-[#002855] transition-all" onClick={() => navigate('/sutran')}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-none border ${stats.nextSutranVisit.days <= 5 ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                  <AlertTriangle className={stats.nextSutranVisit.days <= 5 ? 'text-red-600' : 'text-orange-600'} size={20} />
                </div>
                <div>
                  <h3 className="text-[12px] font-normal uppercase tracking-[0.2em] text-[#002855]">Próxima Visita SUTRAN</h3>
                  <p className="text-[9px] font-normal text-slate-500 uppercase tracking-widest mt-0.5">Sede: {stats.nextSutranVisit.location}</p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-normal ${stats.nextSutranVisit.days <= 5 ? 'text-red-600 animate-pulse' : 'text-orange-600'}`}>
                  {stats.nextSutranVisit.days < 0
                    ? `VENCIDO (hace ${Math.abs(stats.nextSutranVisit.days)} días)`
                    : `${stats.nextSutranVisit.days} ${stats.nextSutranVisit.days === 1 ? 'DÍA' : 'DÍAS'}`}
                </div>
                <div className="text-[9px] font-normal text-slate-400 uppercase tracking-widest">
                  ESTIMADO: {format(new Date(stats.nextSutranVisit.date), "dd MMM yyyy", { locale: es })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notificaciones Importantes */}
        {stats.recentNotifications && stats.recentNotifications.length > 0 && (
          <div className="bg-white shadow-sm border border-slate-200 rounded-none p-4">
            <h3 className="text-[12px] font-normal uppercase tracking-[0.2em] text-[#002855] mb-3">Notificaciones Importantes</h3>
            <div className="space-y-3">
              {stats.recentNotifications.map((notif: any) => (
                <div key={notif.id} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100">
                  <div className="p-1.5 bg-blue-100 text-blue-600 rounded mt-0.5">
                    <AlertCircle size={14} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-normal uppercase tracking-wider text-slate-700">{notif.title}</h4>
                    <p className="text-[10px] text-slate-600">{notif.message}</p>
                    <span className="text-[9px] font-normal text-slate-400 mt-1 block">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alerts Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {alertCards.map((alert) => {
            const Icon = alert.icon;
            return (
              <div
                key={alert.title}
                onClick={() => navigate(alert.path)}
                className={`bg-white rounded-none shadow-sm border border-slate-200 p-6 hover:border-[#002855] transition-all cursor-pointer group`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-none bg-${alert.color}-50 border border-${alert.color}-100`}>
                    <Icon className={`text-${alert.color}-600`} size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-${alert.color}-600 text-xl font-normal mb-1`}>{alert.count}</h3>
                    <p className={`text-${alert.color}-900 text-[10px] uppercase font-normal tracking-widest`}>{alert.title}</p>
                    <p className="text-[9px] font-normal text-slate-400 uppercase tracking-widest mt-1">{alert.description}</p>
                  </div>
                  <ArrowRight size={18} className={`text-${alert.color}-300 group-hover:text-${alert.color}-500 transition-colors`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-none shadow-sm border border-slate-200 p-6">
          <h3 className="text-[12px] font-normal uppercase tracking-[0.2em] text-[#002855] mb-4">Acciones Rápidas</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => navigate('/inventory')}
              className="flex items-center justify-center gap-2 p-3 bg-slate-50 border border-slate-200 hover:border-[#002855] hover:text-[#002855] text-slate-700 rounded-none transition-colors"
            >
              <Package size={14} />
              <span className="text-[10px] font-normal uppercase tracking-widest">Ver Inventario</span>
            </button>
            <button
              onClick={() => navigate('/tickets')}
              className="flex items-center justify-center gap-2 p-3 bg-slate-50 border border-slate-200 hover:border-orange-600 hover:text-orange-600 text-slate-700 rounded-none transition-colors"
            >
              <CheckSquare size={14} />
              <span className="text-[10px] font-normal uppercase tracking-widest">Tickets</span>
            </button>
            <button
              onClick={() => navigate('/flota-vehicular')}
              className="flex items-center justify-center gap-2 p-3 bg-slate-50 border border-slate-200 hover:border-indigo-600 hover:text-indigo-600 text-slate-700 rounded-none transition-colors"
            >
              <Truck size={14} />
              <span className="text-[10px] font-normal uppercase tracking-widest">Flota</span>
            </button>
            <button
              onClick={() => navigate('/cameras')}
              className="flex items-center justify-center gap-2 p-3 bg-slate-50 border border-slate-200 hover:border-emerald-600 hover:text-emerald-600 text-slate-700 rounded-none transition-colors"
            >
              <Camera size={14} />
              <span className="text-[10px] font-normal uppercase tracking-widest">Cámaras</span>
            </button>
          </div>
        </div>
      </div>


      {/* Document Details Popup */}
      {showDocumentPopup && (
        <ModalOverlay className="bg-slate-900/40 backdrop-blur-sm">
          <div
            className="bg-white w-full h-full md:h-[90vh] max-w-full sm:max-w-md rounded-none shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed header */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-900 px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-6">
                <div className={`w-9 h-9 bg-white/10 rounded-none flex items-center justify-center border border-white/20`}>
                  <FileText size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-normal text-white uppercase tracking-[0.2em] leading-tight">
                    {showDocumentPopup === 'soat' ? 'SOAT' :
                      showDocumentPopup === 'citv' ? 'Revisión Técnica' :
                        'Póliza de Seguro'}
                  </h2>
                  <p className="text-[10px] font-normal text-blue-200 uppercase tracking-widest mt-0.5">Estado de documentos vehiculares</p>
                </div>
              </div>
              <button
                onClick={() => setShowDocumentPopup(null)}
                className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-none transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Color indicator stripe */}
            <div className={`h-1 w-full ${showDocumentPopup === 'soat' ? 'bg-red-500' :
              showDocumentPopup === 'citv' ? 'bg-orange-500' : 'bg-purple-500'
            }`} />

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDocumentFilter('expired')}
                  className={`text-center p-4 rounded-lg transition-all duration-200 border-2 ${documentFilter === 'expired'
                    ? 'bg-red-100 border-red-300 shadow-lg'
                    : 'bg-red-50 border-red-200 hover:bg-red-100'
                    }`}
                >
                  <p className="text-2xl font-normal text-red-600">
                    {showDocumentPopup === 'soat' ? stats.vehiclesByDocument.soat.expired :
                      showDocumentPopup === 'citv' ? stats.vehiclesByDocument.citv.expired :
                        stats.vehiclesByDocument.poliza.expired}
                  </p>
                  <p className="text-sm text-red-700 font-normal">Vencidos</p>
                  {documentFilter === 'expired' && (
                    <div className="mt-2 text-xs text-red-600 font-normal">
                      ✓ Filtrando
                    </div>
                  )}
                </button>
                <button
                  onClick={() => setDocumentFilter('warning')}
                  className={`text-center p-4 rounded-lg transition-all duration-200 border-2 ${documentFilter === 'warning'
                    ? 'bg-yellow-100 border-yellow-300 shadow-lg'
                    : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                    }`}
                >
                  <p className="text-2xl font-normal text-yellow-600">
                    {showDocumentPopup === 'soat' ? stats.vehiclesByDocument.soat.warning :
                      showDocumentPopup === 'citv' ? stats.vehiclesByDocument.citv.warning :
                        stats.vehiclesByDocument.poliza.warning}
                  </p>
                  <p className="text-sm text-yellow-700 font-normal">Por vencer</p>
                  {documentFilter === 'warning' && (
                    <div className="mt-2 text-xs text-yellow-600 font-normal">
                      ✓ Filtrando
                    </div>
                  )}
                </button>
              </div>

              {/* Filter Status */}
              {documentFilter !== 'all' && (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-normal uppercase tracking-widest text-blue-700">
                      Mostrando: {documentFilter === 'expired' ? 'Vencidos' : 'Por vencer'}
                    </span>
                  </div>
                  <button
                    onClick={() => setDocumentFilter('all')}
                    className="text-[10px] font-normal uppercase tracking-widest text-blue-600 hover:text-blue-800"
                  >
                    Limpiar filtro
                  </button>
                </div>
              )}

              {/* Vehicle List — scrollable */}
              {loadingExpired && documentFilter === 'expired' ? (
                <LoadingSpinner
                  className="py-8"
                  minHeight="0"
                  size={32}
                  label="Cargando vehículos vencidos..."
                  labelClassName="text-[10px] font-normal uppercase tracking-widest text-slate-500"
                />
              ) : (
                (() => {
                  const filteredVehicles = getFilteredVehicles(showDocumentPopup as 'soat' | 'citv' | 'poliza');

                  if (filteredVehicles.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <div className="w-14 h-14 bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4">
                          <Truck className="text-slate-400" size={28} />
                        </div>
                        <p className="text-[10px] font-normal uppercase tracking-widest text-slate-500">
                          {documentFilter === 'expired'
                            ? 'No hay vehículos con documentos vencidos'
                            : 'No hay vehículos próximos a vencer'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div>
                      <h4 className="text-[10px] font-normal uppercase tracking-[0.2em] text-[#002855] mb-4 flex items-center gap-2">
                        <div className={`w-2 h-2 animate-pulse ${documentFilter === 'expired' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                        {documentFilter === 'expired' ? 'Vehículos Vencidos' : 'Próximos a Vencer'}
                      </h4>
                      <div className="space-y-2">
                        {filteredVehicles.map((vehicle, idx) => (
                          <div key={idx} className="bg-white border border-slate-200 hover:border-[#002855] transition-colors overflow-hidden">
                            {/* Mini-header */}
                            <div className={`px-4 py-2 border-b flex items-center justify-between ${documentFilter === 'expired' ? 'bg-red-50 border-red-100' :
                              Math.abs(vehicle.days) <= 7 ? 'bg-orange-50 border-orange-100' :
                                'bg-yellow-50 border-yellow-100'
                              }`}>
                              <div className="flex items-center gap-2">
                                <Truck size={12} className={`${documentFilter === 'expired' ? 'text-red-600' :
                                  Math.abs(vehicle.days) <= 7 ? 'text-orange-600' : 'text-yellow-600'
                                  }`} />
                                <span className="text-[10px] font-normal uppercase tracking-wider text-slate-700">{vehicle.plate}</span>
                              </div>
                              <span className={`text-[9px] font-normal uppercase tracking-widest ${documentFilter === 'expired' ? 'text-red-600' :
                                Math.abs(vehicle.days) <= 7 ? 'text-orange-600' : 'text-yellow-600'
                                }`}>
                                {documentFilter === 'expired' ? '¡Vencido!' :
                                  Math.abs(vehicle.days) <= 7 ? 'Crítico' : 'Próximo'}
                              </span>
                            </div>
                            {/* Body */}
                            <div className="px-4 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <MapPin size={10} />
                                <span>{getSchoolName(vehicle.location)}</span>
                              </div>
                              <div className={`text-[12px] font-normal ${documentFilter === 'expired' ? 'text-red-600' :
                                Math.abs(vehicle.days) <= 7 ? 'text-orange-600' : 'text-yellow-600'
                                }`}>
                                {documentFilter === 'expired'
                                  ? `Venció hace ${Math.abs(vehicle.days)}d`
                                  : `${Math.abs(vehicle.days)} días restantes`}
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div className="h-1 w-full bg-slate-100">
                              <div
                                className={`h-1 ${documentFilter === 'expired' ? 'bg-red-500' :
                                  Math.abs(vehicle.days) <= 7 ? 'bg-orange-500' : 'bg-yellow-400'
                                  }`}
                                style={{ width: documentFilter === 'expired' ? '100%' : `${Math.max(8, (Math.abs(vehicle.days) / 30) * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}

              <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex items-center justify-between gap-3 z-10">
                <button
                  onClick={() => setShowDocumentPopup(null)}
                  className="px-6 py-2 text-[10px] font-normal uppercase tracking-[0.2em] text-slate-600 bg-white border border-slate-200 rounded-none hover:bg-slate-50 transition-all"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    navigate('/flota-vehicular');
                    setShowDocumentPopup(null);
                  }}
                  className="px-8 py-2 text-[10px] font-normal uppercase tracking-[0.2em] text-white bg-blue-600 rounded-none hover:bg-blue-700 transition-all shadow-lg"
                >
                  Ver Flota Completa
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}
