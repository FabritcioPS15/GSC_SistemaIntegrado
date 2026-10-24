/**
 * Punto de entrada de la aplicación.
 *
 * ESTRUCTURA DE RUTAS (Routes ≈ línea 348):
 *   /                     → Dashboard
 *   /inventory/*          → Inventario (con submenú por categoría)
 *   /cameras/*            → Cámaras (con submenu por ubicación)
 *   /maintenance/*        → Mantenimiento
 *   /checklist/*          → Checklist
 *   /tickets/*            → Mesa de Ayuda
 *   /requests             → Solicitudes
 *   /quotations           → Cotizaciones
 *   /reports              → Reportes
 *   /users, /locations, /sutran, /mtc, /servers, /flota-vehicular, etc.
 *
 * CÓMO AGREGAR UN NUEVO MÓDULO:
 * 1. Crear módulo en src/modules/<nombre>/
 * 2. Importar la Page aquí
 * 3. Agregar <Route> con <ProtectedRoute permission="...">
 * 4. Agregar item en Sidebar.tsx
 * 5. Agregar permiso en tabla user_permissions de Supabase
 *
 * PROTECTED ROUTE: controla acceso por permisos.
 * Si no hay permiso → muestra "Acceso Denegado".
 * Si no hay sesión → redirige a /login.
 */

import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';

import Sidebar from './app/layouts/Sidebar';

import TopHeader from './app/layouts/TopHeader';



import Dashboard from './modules/dashboard/pages/DashboardPage';

import Inventory from './modules/inventory/pages/InventoryPage';

import Maintenance from './modules/maintenance/pages/MaintenancePage';

import Enviados from './modules/enviados/pages/EnviadosPage';

import Sutran from './modules/sutran/pages/SutranPage';

import SutranFutureVisits from './modules/sutran/pages/SutranFutureVisitsPage';

import Sedes from './modules/sedes/pages/SedesPage';

import Companies from './modules/companies/pages/CompaniesPage';

import MTCAccesos from './modules/mtc-accesos/pages/MTCAccesosPage';

import Users from './modules/users/pages/UsersPage';

import Audit from './modules/audits/pages/AuditPage';

import SystemIntegrity from './shared/components/SystemIntegrity';
import LoadingSpinner from './shared/components/ui/LoadingSpinner';

import DiagnosticPanel from './shared/components/DiagnosticPanel';

import ConnectionTest from './shared/components/ConnectionTest';

import QuickDiagnostic from './shared/components/QuickDiagnostic';

import Cameras from './modules/cameras/pages/CamerasPage';

import Servers from './modules/servers/pages/ServersPage';

import FlotaVehicular from './modules/vehicles/pages/FlotaVehicularPage';

import Requests from './modules/requests/pages/RequestsPage';

import SpareParts from './modules/spare-parts/pages/SparePartsPage';

import TitulosHabilitantes from './modules/titulos-habilitantes/pages/TitulosHabilitantesPage';

import PlanosDefensaCivil from './modules/planos-defensa-civil/pages/PlanosDefensaCivilPage';

import { useAuth } from './app/providers/AuthContext';

import { LayoutProvider } from './app/providers/LayoutContext';

import Login from './modules/auth/components/Login';

import PasswordSetup from './modules/auth/components/PasswordSetup';

import Checklist from './modules/checklist/pages/ChecklistPage';

import ChecklistInteractive from './modules/checklist/pages/ChecklistInteractivePage';
import Reports from './modules/reports/pages/ReportsPage';
import Quotations from './modules/quotations/pages/QuotationsPage';

import ChecklistDetail from './modules/checklist/pages/ChecklistDetailPage';

import ChecklistObservaciones from './modules/checklist/pages/ChecklistObservacionesPage';

import Vacations from './modules/users/pages/VacationsPage';

import CVsPage from './modules/rrhh/pages/CVsPage';

import Tickets from './modules/tickets/pages/TicketsPage';

import TicketHistory from './modules/tickets/pages/TicketHistoryPage';

import Painpoints from './modules/tickets/pages/PainpointsPage';

import TicketDetail from './modules/tickets/pages/TicketDetailPage';


// Componente para proteger rutas basadas en permisos

function ProtectedRoute({ children, permission }: { children: React.ReactNode, permission?: string }) {

  const { user, hasPermission } = useAuth();

  const location = useLocation();



  if (!user) {

    localStorage.setItem('intended_path', location.pathname + location.search);

    return <Navigate to="/login" state={{ from: location }} />;

  }



  if (permission && !hasPermission(permission)) {

    return (

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">

        <div className="text-center">

          <div className="bg-red-100 text-red-800 p-6 rounded-lg">

            <h2 className="text-xl font-semibold mb-2">Acceso Denegado</h2>

            <p>No tienes permisos para acceder a esta sección.</p>

          </div>

        </div>

      </div>

    );

  }



  return <>{children}</>;

}



// Wrappers para manejar parámetros de ruta similares a activeView.startsWith

function InventoryWrapper() {

  const { category, subcategory } = useParams();

  const { hasPermission } = useAuth();

  const viewId = `inventory-${category}`;

  if (!hasPermission(viewId)) return <Navigate to="/" />;

  return <Inventory categoryFilter={viewId} subcategoryFilter={subcategory} />;

}



function CamerasWrapper() {

  const { subview } = useParams();

  const { hasPermission } = useAuth();

  const viewId = `cameras-${subview}`;

  if (!hasPermission(viewId)) return <Navigate to="/" />;

  return <Cameras subview={viewId} />;

}



function MaintenanceWrapper() {

  const { category } = useParams();

  const { hasPermission } = useAuth();

  const viewId = `maintenance-${category}`;

  if (!hasPermission(viewId)) return <Navigate to="/" />;

  return <Maintenance categoryFilter={viewId} />;

}



function EnviadosWrapper() {

  const { location } = useParams();

  const { hasPermission } = useAuth();

  const viewId = `sent-${location}`;

  if (!hasPermission(viewId)) return <Navigate to="/" />;

  return <Enviados locationFilter={viewId} />;

}



function ChecklistWrapper() {

  const { type } = useParams();

  const { hasPermission } = useAuth();

  const viewId = `checklist-${type}`;

  if (!hasPermission(viewId)) return <Navigate to="/" />;

  return <Checklist type={type} />;

}



function AppContent() {

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const { user, loading, needsPasswordSetup } = useAuth();

  const location = useLocation();



  // Close mobile sidebar on route change

  useEffect(() => {

    setIsMobileSidebarOpen(false);

  }, [location]);



  // Mostrar loading mientras se verifica la autenticación

  if (loading) {

    return (

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <LoadingSpinner minHeight="100vh" label="Cargando sistema..." />
      </div>

    );

  }



  // Mostrar configuración de contraseñas si es necesario

  if (needsPasswordSetup) {

    return <PasswordSetup />;

  }



  // Si no hay usuario y no estamos en login, redirigir a login

  if (!user && location.pathname !== '/login') {

    return <Navigate to="/login" />;

  }



  // Si hay usuario y estamos en login, redirigir a dashboard

  if (user && location.pathname === '/login') {

    return <Navigate to="/" />;

  }



  // Si no hay usuario y estamos en login, mostrar Login

  if (!user && location.pathname === '/login') {

    return <Login />;

  }



  return (

    <LayoutProvider sidebarCollapsed={sidebarCollapsed}>

      <div className="min-h-screen bg-[#f8f9fc] flex overflow-x-hidden">

      <Sidebar

        collapsed={sidebarCollapsed}

        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}

        mobileOpen={isMobileSidebarOpen}

        onCloseMobile={() => setIsMobileSidebarOpen(false)}

      />



      {/* Mobile Overlay */}

      {isMobileSidebarOpen && (

        <div

          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity animate-in fade-in"

          onClick={() => setIsMobileSidebarOpen(false)}

        />

      )}



      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>

        <div className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'lg:left-20' : 'lg:left-72'}`}>

          <TopHeader onMobileMenuClick={() => setIsMobileSidebarOpen(true)} sidebarCollapsed={sidebarCollapsed} />

        </div>

        <main className="flex-1 overflow-x-hidden overflow-y-auto mt-14 page-fade-in">

          <Routes>

            <Route path="/" element={<ProtectedRoute permission="dashboard"><Dashboard /></ProtectedRoute>} />



            {/* Inventario */}

            <Route path="/inventory" element={<ProtectedRoute permission="inventory"><Inventory /></ProtectedRoute>} />

            <Route path="/inventory/all" element={<ProtectedRoute permission="inventory-all"><Inventory /></ProtectedRoute>} />

            <Route path="/inventory/camara" element={<ProtectedRoute permission="inventory-camara"><Cameras /></ProtectedRoute>} />

            <Route path="/inventory/:category" element={<ProtectedRoute><InventoryWrapper /></ProtectedRoute>} />

            <Route path="/inventory/:category/:subcategory" element={<ProtectedRoute><InventoryWrapper /></ProtectedRoute>} />



            {/* Cámaras */}

            <Route path="/cameras" element={<ProtectedRoute permission="cameras"><Cameras /></ProtectedRoute>} />

            <Route path="/cameras/all" element={<ProtectedRoute permission="cameras-all"><Cameras /></ProtectedRoute>} />

            <Route path="/cameras/:subview" element={<ProtectedRoute><CamerasWrapper /></ProtectedRoute>} />



            {/* Mantenimiento */}

            <Route path="/maintenance" element={<ProtectedRoute permission="maintenance"><Maintenance /></ProtectedRoute>} />

            <Route path="/maintenance/all" element={<ProtectedRoute permission="maintenance-all"><Maintenance /></ProtectedRoute>} />

            <Route path="/maintenance/:category" element={<ProtectedRoute><MaintenanceWrapper /></ProtectedRoute>} />



            {/* Enviados */}
            <Route path="/sent" element={<ProtectedRoute permission="sent"><Enviados /></ProtectedRoute>} />
            <Route path="/sent/all" element={<ProtectedRoute permission="sent-all"><Enviados /></ProtectedRoute>} />
            <Route path="/sent/:location" element={<ProtectedRoute><EnviadosWrapper /></ProtectedRoute>} />

            {/* Checklist */}
            {/* La ruta estática gana sobre `/checklist/:type` en el ranking de react-router */}
            <Route path="/checklist" element={<ProtectedRoute permission="checklist"><Checklist /></ProtectedRoute>} />
            <Route path="/checklist/comentarios" element={<ProtectedRoute permission="checklist"><ChecklistObservaciones /></ProtectedRoute>} />
            <Route path="/checklist/observaciones" element={<Navigate to="/checklist/comentarios" replace />} />
            <Route path="/checklist/:type" element={<ProtectedRoute><ChecklistWrapper /></ProtectedRoute>} />
            <Route path="/checklist/:type/:id" element={<ProtectedRoute><ChecklistDetail /></ProtectedRoute>} />


            {/* Vacaciones */}
            <Route path="/vacations" element={<ProtectedRoute permission="vacations"><Vacations /></ProtectedRoute>} />

            {/* Recursos Humanos */}
            <Route path="/cvs" element={<ProtectedRoute permission="cvs"><CVsPage /></ProtectedRoute>} />

            {/* Otras Rutas */}
            <Route path="/sutran" element={<ProtectedRoute permission="sutran"><Sutran /></ProtectedRoute>} />
            <Route path="/sutran/future-visits" element={<ProtectedRoute permission="sutran"><SutranFutureVisits /></ProtectedRoute>} />
            <Route path="/locations" element={<ProtectedRoute permission="locations"><Sedes /></ProtectedRoute>} />
            <Route path="/companies" element={<ProtectedRoute permission="companies"><Companies /></ProtectedRoute>} />
            <Route path="/mtc" element={<ProtectedRoute permission="mtc"><MTCAccesos /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute permission="users"><Users /></ProtectedRoute>} />
            <Route path="/servers" element={<ProtectedRoute permission="servers"><Servers /></ProtectedRoute>} />
            <Route path="/flota-vehicular" element={<ProtectedRoute permission="flota-vehicular"><FlotaVehicular /></ProtectedRoute>} />
            <Route path="/requests" element={<ProtectedRoute permission="requests"><Requests /></ProtectedRoute>} />
            <Route path="/spare-parts" element={<ProtectedRoute permission="spare-parts"><SpareParts /></ProtectedRoute>} />
            <Route path="/titulos-habilitantes" element={<ProtectedRoute permission="titulos-habilitantes"><TitulosHabilitantes /></ProtectedRoute>} />
            <Route path="/planos-defensa-civil" element={<ProtectedRoute permission="planos-defensa-civil"><PlanosDefensaCivil /></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute permission="audit"><Audit /></ProtectedRoute>} />
            <Route path="/integrity" element={<ProtectedRoute permission="integrity"><SystemIntegrity /></ProtectedRoute>} />
            <Route path="/diagnostic" element={<ProtectedRoute permission="diagnostic"><DiagnosticPanel /></ProtectedRoute>} />
            <Route path="/connection-test" element={<ProtectedRoute permission="connection-test"><ConnectionTest /></ProtectedRoute>} />
            <Route path="/quick-diagnostic" element={<ProtectedRoute permission="quick-diagnostic"><QuickDiagnostic /></ProtectedRoute>} />
            <Route path="/tickets" element={<ProtectedRoute permission="tickets"><Tickets /></ProtectedRoute>} />
            <Route path="/tickets/:view" element={<ProtectedRoute permission="tickets"><Tickets /></ProtectedRoute>} />

            <Route path="/tickets/history" element={<ProtectedRoute permission="tickets"><TicketHistory /></ProtectedRoute>} />

            <Route path="/ticket/:ticketId" element={<ProtectedRoute permission="tickets"><TicketDetail /></ProtectedRoute>} />

            <Route path="/painpoint" element={<ProtectedRoute permission="painpoint"><Painpoints /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute permission="reports"><Reports /></ProtectedRoute>} />
            <Route path="/quotations" element={<ProtectedRoute permission="quotations"><Quotations /></ProtectedRoute>} />


            {/* Fallback */}

            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>

        </main>

      </div>

    </div>

    </LayoutProvider>

  );

}


export default AppContent;


