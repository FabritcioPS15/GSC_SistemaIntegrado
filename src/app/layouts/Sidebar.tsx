/**
 * Sidebar de navegación.
 *
 * CÓMO AGREGAR UNA NUEVA SECCIÓN/MENÚ:
 * 1. Agrega el item en el array `sections` (línea ~120)
 * 2. Agrega la ruta en App.tsx con <Route>
 * 3. Asigna el permiso correspondiente en Supabase (tabla user_permissions)
 *
 * ESTRUCTURA:
 * - sections → items → (submenu)
 * - Cada item tiene: id (permiso), label, icon, path, hasSubmenu, submenu[]
 * - Los permisos se validan con hasPermission(item.id)
 *
 * TIP: Íconos de lucide-react. Si no existe, usa react-icons/gi.
 */

import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Wrench,
  Users,
  MapPin,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Ticket,
  ClipboardList,
  Building2,
  Building,
  Key,
  Car,
  Send,
  FileText,
  Award,
  Map,
  FileCheck,
  BarChart3,
  DollarSign
} from 'lucide-react';
import { GiCctvCamera } from 'react-icons/gi';
import { Trash2 } from 'lucide-react';
import { GrServerCluster } from 'react-icons/gr';
import { useAuth } from '../providers/AuthContext';

interface SubmenuItem {
  id: string;
  label: string;
  path: string;
  hasSubmenu?: boolean;
  submenu?: SubmenuItem[];
  /** Los items estructurales no muestran el botón de eliminar. */
  noDelete?: boolean;
}

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  path: string;
  hasSubmenu?: boolean;
  submenu?: SubmenuItem[];
}

interface Section {
  title: string;
  items: MenuItem[];
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  // State for dynamic checklist items allowing deletion
  const [checklistItems, setChecklistItems] = useState<SubmenuItem[]>([
    { id: 'checklist-all', label: 'Ver Todo', path: '/checklist/all' },
    { id: 'checklist-escon', label: 'ESCON', path: '/checklist/escon' },
    { id: 'checklist-ecsal', label: 'ECSAL', path: '/checklist/ecsal' },
    { id: 'checklist-citv', label: 'CITV', path: '/checklist/citv' },
    { id: 'checklist-comentarios', label: 'Comentarios', path: '/checklist/comentarios', noDelete: true },
  ]);

  const handleDeleteChecklistItem = (id: string) => {
    setChecklistItems(prev => prev.filter(item => item.id !== id));
  };
  const { hasPermission, logout } = useAuth();
  const [openSubmenus, setOpenSubmenus] = useState<Set<string>>(new Set());
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [menuTop, setMenuTop] = useState<number>(0);
  const [adjustedTop, setAdjustedTop] = useState(0);
  const subMenuRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout>();

  const toggleSubmenu = (itemId: string, e: React.MouseEvent) => {
    if (collapsed && window.innerWidth >= 1024) return;

    e.preventDefault();
    const next = new Set(openSubmenus);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setOpenSubmenus(next);
  };

  const handleMouseEnter = (itemId: string, e: React.MouseEvent) => {
    if (window.innerWidth >= 768) {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setMenuTop(rect.top);
      setHoveredItem(itemId);
    }
  };

  const handleMouseLeave = () => {
    if (window.innerWidth >= 1024) {
      closeTimeoutRef.current = setTimeout(() => {
        setHoveredItem(null);
      }, 200);
    }
  };

  useEffect(() => {
    if (hoveredItem && subMenuRef.current) {
      const rect = subMenuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      let top = menuTop;
      if (top + rect.height > viewportHeight) {
        top = viewportHeight - rect.height - 10;
      }
      if (top < 10) top = 10;
      setAdjustedTop(top);
    }
  }, [hoveredItem, menuTop]);

  const sections: Section[] = [
    {
      title: 'Principal',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
        {
          id: 'tickets',
          label: 'Mesa de Ayuda',
          icon: Ticket,
          path: '/tickets',
          hasSubmenu: true,
          submenu: [
            { id: 'tickets-dashboard', label: 'Dashboard General', path: '/tickets/dashboard' },
            { id: 'tickets-mine', label: 'Mis tickets', path: '/tickets/mine' },
            { id: 'tickets-reports', label: 'Reportes', path: '/tickets/reports' },
            { id: 'tickets-history', label: 'Historial de Tickets', path: '/tickets/history' },
          ]
        },
        {
          id: 'checklist',
          label: 'Checklist',
          icon: ClipboardList,
          path: '/checklist',
          hasSubmenu: true,
          submenu: [
            { id: 'checklist-all', label: 'Ver Todo', path: '/checklist/all' },
            { id: 'checklist-escon', label: 'ESCON', path: '/checklist/escon' },
            { id: 'checklist-ecsal', label: 'ECSAL', path: '/checklist/ecsal' },
            { id: 'checklist-citv', label: 'CITV', path: '/checklist/citv' },
            { id: 'checklist-comentarios', label: 'Comentarios', path: '/checklist/comentarios', noDelete: true },
          ]
        },
      ]
    },
    {
      title: 'Operativo',
      items: [
        {
          id: 'inventory',
          label: 'Inventario',
          icon: Package,
          path: '/inventory',
          hasSubmenu: true,
          submenu: [
            { id: 'inventory-all', label: 'Ver Todo', path: '/inventory/all' },
            { id: 'cat-tecnologia', label: 'Tecnología', path: '/inventory/tecnologia' },
            { id: 'cat-seguridad', label: 'Seguridad y Control', path: '/inventory/seguridad-control' },
            { id: 'cat-operativos', label: 'Equipos de Línea', path: '/inventory/equipos-operativos' },
            { id: 'cat-mobiliario', label: 'Mobiliario', path: '/inventory/mobiliario' },
            { id: 'cat-suministros', label: 'Útiles y Suministros', path: '/inventory/utiles-suministros' },
          ]
        },
        {
          id: 'cameras',
          label: 'Cámaras',
          icon: GiCctvCamera,
          path: '/cameras',
          hasSubmenu: true,
          submenu: [
            { id: 'cameras-all', label: 'Ver Todo', path: '/cameras/all' },
            { id: 'cameras-revision', label: 'Revisión', path: '/cameras/revision' },
            { id: 'cameras-escuela', label: 'Escuela', path: '/cameras/escuela' },
            { id: 'cameras-policlinico', label: 'Policlínico', path: '/cameras/policlinico' },
            { id: 'cameras-circuito', label: 'Circuito', path: '/cameras/circuito' },
            { id: 'cameras-disks', label: 'Discos Extraídos', path: '/cameras/disks' },
          ]
        },
        { id: 'maintenance', label: 'Mantenimiento', icon: Wrench, path: '/maintenance' },
        { id: 'flota-vehicular', label: 'Flota Vehicular', icon: Car, path: '/flota-vehicular' },
        { id: 'requests', label: 'Solicitudes', icon: FileCheck, path: '/requests' },
        { id: 'quotations', label: 'Cotizaciones', icon: DollarSign, path: '/quotations' },
      ]
    },
    {
      title: 'Administrativo',
      items: [
        { id: 'cvs', label: "CV's", icon: FileText, path: '/cvs' },
        { id: 'users', label: 'Usuarios', icon: Users, path: '/users' },
        { id: 'locations', label: 'Sedes', icon: MapPin, path: '/locations' },
        { id: 'companies', label: 'Unidades de Negocio', icon: Building, path: '/companies' },
        { id: 'sutran', label: 'Sutran', icon: Building2, path: '/sutran' },
        { id: 'mtc', label: 'MTC Accesos', icon: Key, path: '/mtc' },
        { id: 'servers', label: 'Servidores', icon: GrServerCluster, path: '/servers' },
        { id: 'titulos-habilitantes', label: 'Títulos Habilitantes', icon: Award, path: '/titulos-habilitantes' },
        { id: 'planos-defensa-civil', label: 'Planos Defensa Civil', icon: Map, path: '/planos-defensa-civil' },
        {
          id: 'sent',
          label: 'Enviados',
          icon: Send,
          path: '/sent',
          hasSubmenu: true,
          submenu: [
            { id: 'sent-lima', label: 'Lima', path: '/sent/lima' },
            { id: 'sent-provincias', label: 'Provincias', path: '/sent/provincias' },
          ]
        },
      ]
    },
    {
      title: 'Sistema',
      items: [
        { id: 'reports', label: 'Reportes', icon: BarChart3, path: '/reports' },
        { id: 'audit', label: 'Auditoría', icon: FileText, path: '/audit' },
      ]
    }
  ];

  const isPathActive = (path: string) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <style>
        {`
          .sidebar-scroll::-webkit-scrollbar { width: 4px; }
          .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
          .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
          @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .animate-spin-slow { animation: spin-slow 12s linear infinite; }
          .submenu-transition { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        `}
      </style>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden" onClick={onCloseMobile} />
      )}

      <aside
        className={`
          ${collapsed ? 'w-20' : 'w-72'} 
          bg-[#001529] text-[#a6adb4] h-screen transition-all duration-300 ease-in-out fixed left-0 top-0 z-[110] flex flex-col shadow-2xl overflow-hidden
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/5 shrink-0 overflow-hidden">
          {!collapsed && (
            <div className="flex items-center justify-center transition-opacity duration-300 w-full">
              <img src="/Enblanco.png" alt="Logo" className="h-12 object-contain" />
            </div>
          )}

          <div className={`relative hidden lg:block ${collapsed ? 'mx-auto' : ''}`}>
            <button
              onClick={onToggleCollapse}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-300 text-white/70 hover:text-white group border border-white/20 hover:border-white/30 shadow-lg"
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto sidebar-scroll py-2 flex flex-col">
          {sections.map((section, index) => {
            const filteredItems = section.items.filter(item => {
              if (!hasPermission(item.id)) return false;
              if (item.submenu) return item.submenu.some(sub => hasPermission(sub.id));
              return true;
            });

            if (filteredItems.length === 0) return null;

            return (
              <div key={section.title} className="mb-1 last:mb-0 px-2">
                {!collapsed && (
                  <div className={`px-6 py-2 ${index === 0 ? 'mt-0' : 'mt-2'}`}>
                    <div className="h-[1px] w-full bg-white/10" />
                  </div>
                )}
                <div className="space-y-1">
                  {filteredItems.map(item => {
                    const Icon = item.icon;
                    const isActive = isPathActive(item.path);
                    const isSubmenuOpen = openSubmenus.has(item.id);

                    return (
                      <div key={item.id} className="relative px-2 mb-0.5 last:mb-0">
                        <NavLink
                          to={item.path}
                          onMouseEnter={(e) => handleMouseEnter(item.id, e)}
                          onMouseLeave={handleMouseLeave}
                          onClick={(e) => {
                            if (item.hasSubmenu && (!collapsed || window.innerWidth < 1024)) {
                              toggleSubmenu(item.id, e);
                            } else {
                              if (window.innerWidth < 1024) onCloseMobile?.();
                              setHoveredItem(null);
                            }
                          }}
                          className={({ isActive }) => `
                            relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group/link
                            ${isActive
                              ? 'bg-blue-600/20 text-white font-bold border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                              : 'text-slate-300 hover:text-white hover:bg-white/10'}
                            ${collapsed ? 'justify-center px-0 h-12' : ''}
                          `}
                        >
                          {/* Icon */}
                          <Icon
                            size={collapsed ? 24 : 20}
                            className={`shrink-0 transition-transform duration-200 ${isActive ? 'text-blue-400' : 'text-slate-400 group-hover/link:text-white group-hover/link:scale-110'}`}
                          />

                          {!collapsed && (
                            <>
                              <span className="text-[16px] font-medium tracking-wide flex-1 truncate">
                                {item.label}
                              </span>
                              {item.hasSubmenu && (
                                <ChevronRight
                                  size={16}
                                  className={`transition-transform duration-200 opacity-30 group-hover/link:opacity-100 ${isSubmenuOpen ? 'rotate-90' : ''}`}
                                />
                              )}
                            </>
                          )}

                          {/* Minimal Active Indicator */}
                          {isActive && !collapsed && (
                            <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-1.5 h-6 bg-blue-500 rounded-r-full shadow-[0_0_12px_rgba(59,130,246,0.6)]" />
                          )}
                        </NavLink>

                        {/* Hover Flyout for Collapsed Mode */}
                        {collapsed && hoveredItem === item.id && item.hasSubmenu && (
                          <div
                            ref={subMenuRef}
                            onMouseEnter={() => {
                              if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                              setHoveredItem(item.id);
                            }}
                            onMouseLeave={handleMouseLeave}
                            className="fixed left-[72px] w-64 bg-[#001529] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[999] py-3 animate-in fade-in slide-in-from-left-4 duration-200 backdrop-blur-xl"
                            style={{ top: adjustedTop }}
                          >
                            <div className="px-4 py-2 border-b border-white/5 mb-2">
                              <span className="text-[12px] font-black text-blue-400 tracking-widest">{item.label}</span>
                            </div>
                            <div className="px-2 space-y-1">
                              {item.id === 'checklist' ? (
                                checklistItems.map(sub => (
                                  <div key={sub.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5">
                                    <NavLink
                                      to={sub.path}
                                      className={({ isActive }) => `
                                        flex items-center gap-3 text-[15px] font-medium transition-all
                                        ${isActive ? 'bg-blue-600/20 text-white' : 'text-slate-400 hover:text-white'}
                                      `}
                                    >
                                      <div className={`w-1 h-1 rounded-full ${sub.path === location.pathname ? 'bg-blue-400' : 'bg-slate-600'}`} />
                                      {sub.label}
                                    </NavLink>
                                    {!sub.noDelete && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteChecklistItem(sub.id); }}
                                        className="p-1 hover:text-red-400"
                                        aria-label={`Eliminar ${sub.label}`}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                ))
                              ) : (
                                item.submenu?.map(sub => (
                                  <NavLink
                                    key={sub.id}
                                    to={sub.path}
                                    className={({ isActive }) => `
                                      flex items-center gap-3 px-3 py-2 rounded-lg text-[15px] font-medium transition-all
                                      ${isActive ? 'bg-blue-600/20 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}
                                    `}
                                  >
                                    <div className={`w-1 h-1 rounded-full ${sub.path === location.pathname ? 'bg-blue-400' : 'bg-slate-600'}`} />
                                    {sub.label}
                                  </NavLink>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {/* ACCORDION (Expanded Mode) - Con Efecto Flotante */}
                        {item.hasSubmenu && !collapsed && (
                          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSubmenuOpen ? 'max-h-[500px] mt-1 mb-2 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="ml-4 mr-2 bg-black/20 rounded-xl py-1 px-1 border border-white/5 shadow-inner backdrop-blur-sm">
                              {item.submenu?.map(sub => (
                                <NavLink
                                  key={sub.id}
                                  to={sub.path}
                                  onClick={() => window.innerWidth < 1024 && onCloseMobile?.()}
                                  className={({ isActive }) => `
                                                relative flex items-center gap-3 px-4 py-2 text-[15px] font-medium tracking-wide rounded-lg transition-all mb-0.5 last:mb-0
                                                ${isActive
                                      ? 'text-white bg-blue-600/30 shadow-[0_4px_12px_rgba(0,0,0,0.3)] border border-white/10 translate-x-1'
                                      : 'text-slate-400 hover:text-white hover:bg-white/10 hover:translate-x-1'}
                                            `}
                                >
                                  <div className={`w-1.5 h-1.5 rounded-full transition-all ${isActive ? 'bg-blue-400 scale-125 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-slate-600'}`} />
                                  {sub.label}
                                </NavLink>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 bg-black/30 border-t border-white/5 shrink-0 flex flex-col gap-4">
          <button onClick={logout} className={`w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all tracking-[2px] ${collapsed ? 'px-0' : 'px-4'}`}>
            <LogOut size={16} /> {!collapsed && 'SALIR'}
          </button>
        </div>
      </aside>
    </>
  );
}
