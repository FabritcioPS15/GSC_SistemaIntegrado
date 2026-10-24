import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../../../shared/services/supabase';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../shared/components/ui/Table';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';

interface FutureVisit {
  id: string;
  visit_date: string;
  last_visit_date?: string;
  inspector_name: string;
  location_name: string;
  visit_type: string;
  status: string;
  estimated_duration?: string;
  estimated_cost?: number;
  observations?: string;
}

export default function SutranFutureVisits() {
  const navigate = useNavigate();
  const [visits, setVisits] = useState<FutureVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFutureVisits = async () => {
    try {
      setLoading(true);

      // 1. Obtener todas las visitas históricas y las pendientes
      const { data: allVisits, error } = await supabase
        .from('sutran_visits')
        .select('*')
        .order('visit_date', { ascending: false });

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(today.getDate() + 90);
      ninetyDaysFromNow.setHours(23, 59, 59, 999);

      // 2. Agrupar por sede
      const visitsByLocation: Record<string, any[]> = {};
      allVisits?.forEach(visit => {
        if (visit.location_id) {
          if (!visitsByLocation[visit.location_id]) {
            visitsByLocation[visit.location_id] = [];
          }
          visitsByLocation[visit.location_id].push(visit);
        }
      });

      const projections: FutureVisit[] = [];

      // 3. Calcular proyección para cada sede
      Object.entries(visitsByLocation).forEach(([locationId, history]) => {
        const completedVisits = history.filter(v => v.status === 'completed');
        const pendingVisits = history.filter(v => v.status === 'pending' || v.status === 'scheduled');

        const lastVisitDate = completedVisits.length > 0 ? completedVisits[0].visit_date : undefined;

        // Si ya hay una visita pendiente futura
        if (pendingVisits.length > 0) {
          const nextPending = pendingVisits[0];
          const pendingDate = new Date(nextPending.visit_date);

          // Solo mostrar si está dentro de los próximos 90 días
          if (pendingDate >= today && pendingDate <= ninetyDaysFromNow) {
            projections.push({
              id: nextPending.id,
              visit_date: nextPending.visit_date,
              last_visit_date: lastVisitDate,
              inspector_name: nextPending.inspector_name || 'Por asignar',
              location_name: nextPending.location_name,
              visit_type: nextPending.visit_type,
              status: 'pending',
              estimated_duration: nextPending.estimated_duration || (completedVisits[0]?.estimated_duration),
              estimated_cost: nextPending.estimated_cost || (completedVisits[0]?.estimated_cost),
              observations: 'Visita ya programada'
            });
          }
          return;
        }

        // Si no hay pendientes, proyectamos basada en la última completada
        if (completedVisits.length > 0) {
          const lastVisit = completedVisits[0];
          const lastDate = new Date(lastVisit.visit_date);

          let intervalDays = 180; // Default: 6 meses

          if (completedVisits.length >= 2) {
            const secondLastVisit = completedVisits[1];
            const secondLastDate = new Date(secondLastVisit.visit_date);
            const diffTime = Math.abs(lastDate.getTime() - secondLastDate.getTime());
            intervalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (intervalDays < 30) intervalDays = 180;
          }

          const projectedDate = new Date(lastDate);
          projectedDate.setDate(lastDate.getDate() + intervalDays);

          // Filtro de 90 días: Solo mostrar si la fecha proyectada cae en los próximos 90 días
          if (projectedDate >= today && projectedDate <= ninetyDaysFromNow) {
            projections.push({
              id: `proj-${locationId}`,
              visit_date: projectedDate.toISOString().split('T')[0],
              last_visit_date: lastVisitDate,
              inspector_name: 'Proyección Automática',
              location_name: lastVisit.location_name,
              visit_type: lastVisit.visit_type,
              status: 'pending',
              estimated_duration: lastVisit.estimated_duration,
              estimated_cost: lastVisit.estimated_cost,
              observations: `Estimado según frecuencia (${intervalDays} días)`
            });
          }
        }
      });

      // Ordenar por fecha
      projections.sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime());

      setVisits(projections);
    } catch (error) {
      console.error('Error calculating future visits:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFutureVisits();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFutureVisits();
  };

  const getDaysRemaining = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    if (diffDays < 0) return `hace ${Math.abs(diffDays)} días`;
    return `en ${diffDays} días`;
  };

  const getVisitTypeLabel = (type: string) => {
    switch (type) {
      case 'programada': return 'Programada';
      case 'no_programada': return 'No programada';
      case 'de_gabinete': return 'De gabinete';
      default: return 'Desconocido';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'programada': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'no_programada': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'de_gabinete': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const filteredVisits = visits.filter(visit =>
    visit.inspector_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    visit.location_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalEstimatedCost = filteredVisits.reduce((sum, visit) => sum + (Number(visit.estimated_cost) || 0), 0);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        {/* Action Bar */}
        <div className="bg-white border border-slate-200 rounded-none p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4 shadow-sm hover:shadow-md transition-all relative">
          <div className="absolute -top-3 -left-3">
            <div className="bg-[#002855] text-white px-3 py-1 text-[10px] font-black uppercase tracking-tight shadow-xl">
              {filteredVisits.length} Próximos 90 Días
            </div>
          </div>

          <div className="flex-1 relative group/search">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[#002855] transition-colors" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 text-[12px] font-black text-[#002855] bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#002855]/30 focus:ring-4 focus:ring-[#002855]/5 outline-none transition-all placeholder:text-slate-300 tracking-[0.1em]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-6 px-4 mr-4 border-r border-slate-100 hidden lg:flex">
              <div className="flex flex-col">
                <span className="text-[12px] font-black text-[#002855] tracking-[0.2em] leading-none mb-1">Presupuesto 90d</span>
                <span className="text-sm font-black text-[#002855]">S/ {totalEstimatedCost.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-3 bg-white text-[#002855] border border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Calculando...' : 'Actualizar Proyecciones'}
            </button>

            <button
              onClick={() => navigate('/sutran')}
              className="flex items-center gap-2 px-4 py-3 bg-[#002855] text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
            >
              <Calendar size={14} />
              Historial Completo
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <LoadingSpinner label="Cargando visitas futuras..." />
        ) : filteredVisits.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-none shadow-sm p-16 text-center">
            <div className="w-24 h-24 rounded-none bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center mx-auto mb-6">
              <Calendar size={48} className="text-slate-300" />
            </div>
            <h3 className="text-[14px] font-black text-slate-700 uppercase tracking-widest mb-2">Sin proyecciones a corto plazo</h3>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No hay visitas estimadas para los próximos 90 días</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden flex flex-col animate-in fade-in duration-500">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Próxima Visita</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Última Visita</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead className="text-center">Plazo</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {filteredVisits.map((visit) => (
                    <TableRow key={visit.id} onClick={() => navigate('/sutran')} className="cursor-pointer">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-none flex items-center justify-center shadow-sm transition-all duration-300 bg-slate-100 text-slate-400 group-hover/row:bg-blue-600 group-hover/row:text-white group-hover/row:shadow-md">
                            <Calendar size={14} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-black text-[#002855] leading-tight group-hover/row:text-blue-600 transition-colors">
                              {new Date(String(visit.visit_date).includes('T') ? String(visit.visit_date) : `${visit.visit_date}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400 tracking-wider mt-1">Estimada</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin size={12} className="text-rose-500" />
                          <span className="text-sm font-bold text-[#002855] uppercase">{visit.location_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">
                            {visit.last_visit_date ? new Date(String(visit.last_visit_date).includes('T') ? String(visit.last_visit_date) : `${visit.last_visit_date}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin registros'}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Fecha Real</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-black tracking-wider border w-fit ${getTypeColor(visit.visit_type)}`}>
                          {getVisitTypeLabel(visit.visit_type)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={12} className="text-amber-500" />
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[200px]">{visit.observations}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-black tracking-wider border ${getDaysRemaining(visit.visit_date).includes('hace') ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                          <Clock size={10} />
                          {getDaysRemaining(visit.visit_date)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
