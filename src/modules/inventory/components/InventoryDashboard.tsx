import { useState, useEffect, useMemo } from 'react';
import {
  Package, Building2, MapPin, Wrench, TrendingUp, AlertTriangle,
  CheckCircle, DollarSign, BarChart3, PieChart, Filter, RefreshCw,
  Activity, Percent, Layers, ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase, AssetWithDetails } from '../../../shared/services/supabase';
import {
  MaintenanceRecord,
  Company,
  Location,
  Category,
  BUSINESS_TYPE_LABELS,
} from '../../../shared/types/inventory.types';
import AssetDetails from './AssetDetails';
import FilterBar from '../../../shared/components/ui/FilterBar';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';

// Estado de uso constants
const ESTADO_USO_LABELS: Record<string, string> = {
  Operativo: 'Operativo',
  Inoperativo: 'Inoperativo',
  'En Reparacion': 'En Reparacion',
  Baja: 'De Baja',
  'Sin Estado': 'Sin Estado',
};

const ESTADO_USO_HEX_COLORS: Record<string, string> = {
  Operativo: '#10b981',
  Inoperativo: '#94a3b8',
  'En Reparacion': '#f59e0b',
  Baja: '#f43f5e',
  'Sin Estado': '#d1d5db',
};

const ESTADO_USO_ORDER = ['Operativo', 'Inoperativo', 'En Reparacion', 'Baja', 'Sin Estado'];
const KNOWN_ESTADOS = ['Operativo', 'Inoperativo', 'En Reparacion', 'Baja'];

const BAR_PALETTE = [
  '#002855', '#0284c7', '#0d9488', '#3b82f6', '#10b981',
  '#1e40af', '#0f766e', '#6366f1', '#f59e0b', '#0369a1',
];

interface InventoryDashboardProps {
  companyId?: string;
  locationId?: string;
}

const getAssetName = (asset?: any): string => {
  if (!asset) return 'Activo';
  const name = asset.item || asset.descripcion || '';
  if (name.trim()) return name;
  const brandModel = `${asset.brand || ''} ${asset.model || ''}`.trim();
  return brandModel || 'Activo';
};

interface RawData {
  assets: AssetWithDetails[];
  companies: Company[];
  locations: Location[];
  categories: Category[];
  recentMaintenance: MaintenanceRecord[];
  totalMaintenanceCost: number;
}

export default function InventoryDashboard({ companyId, locationId }: InventoryDashboardProps) {
  const [rawData, setRawData] = useState<RawData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetWithDetails | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);

  const [filterCompany, setFilterCompany] = useState<string>(companyId || '');
  const [filterLocation, setFilterLocation] = useState<string>(locationId || '');
  const [filterBusinessType, setFilterBusinessType] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  useEffect(() => { fetchAll(); }, [companyId, locationId]);

  useEffect(() => {
    setFilterCompany(companyId || '');
    setFilterLocation(locationId || '');
    setFilterBusinessType('');
    setFilterCategory('');
  }, [companyId, locationId]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [assetsRes, companiesRes, locationsRes, categoriesRes, maintenanceRes, mainCostRes] =
        await Promise.all([
          supabase.from('assets').select('*, companies(*), locations(*)').eq('is_deleted', false).order('created_at', { ascending: false }),
          supabase.from('companies').select('*').eq('is_active', true),
          supabase.from('locations').select('*').eq('is_active', true),
          supabase.from('categories').select('*').eq('is_active', true),
          supabase.from('maintenance_records').select('*, assets(*)').order('created_at', { ascending: false }).limit(5),
          supabase.from('maintenance_records').select('total_cost').eq('status', 'completed'),
        ]);

      if (assetsRes.error) throw assetsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (locationsRes.error) throw locationsRes.error;

      const totalMaintenanceCost = ((mainCostRes.data ?? []) as any[]).reduce((s, r) => s + (r.total_cost || 0), 0);

      setRawData({
        assets: (assetsRes.data as AssetWithDetails[]) || [],
        companies: (companiesRes.data as Company[]) || [],
        locations: (locationsRes.data as Location[]) || [],
        categories: (categoriesRes.data as Category[]) || [],
        recentMaintenance: (maintenanceRes.data as MaintenanceRecord[]) || [],
        totalMaintenanceCost,
      });
    } catch (err: any) {
      console.error('Error fetching dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const availableLocations = useMemo(() => {
    if (!rawData) return [];
    return rawData.locations.filter(l => !filterCompany || l.company_id === filterCompany);
  }, [rawData, filterCompany]);

  const filteredAssets = useMemo(() => {
    if (!rawData) return [];
    return rawData.assets.filter(asset => {
      const loc = rawData.locations.find(l => l.id === asset.location_id);
      const assetCompanyId = asset.company_id || loc?.company_id || (asset as any).companies?.id;

      if (filterCompany && assetCompanyId !== filterCompany) return false;
      if (filterLocation && asset.location_id !== filterLocation) return false;
      if (filterBusinessType) {
        if (!loc || loc.business_type !== filterBusinessType) return false;
      }
      if (filterCategory && asset.category_id !== filterCategory) return false;
      return true;
    });
  }, [rawData, filterCompany, filterLocation, filterBusinessType, filterCategory]);

  const metrics = useMemo(() => {
    if (!rawData) return null;

    const byStatus: Record<string, number> = {
      Operativo: 0, Inoperativo: 0, 'En Reparacion': 0, Baja: 0, 'Sin Estado': 0,
    };
    filteredAssets.forEach(a => {
      const key = a.estado_uso && KNOWN_ESTADOS.includes(a.estado_uso) ? a.estado_uso : 'Sin Estado';
      byStatus[key] = (byStatus[key] || 0) + 1;
    });

    const totalValue = filteredAssets.reduce((s, a) => s + ((a as any).valor_estimado || 0), 0);

    const locationMap: Record<string, { name: string; count: number; value: number }> = {};
    filteredAssets.forEach(a => {
      const loc = rawData.locations.find(l => l.id === a.location_id);
      const name = loc?.name || 'Sin Sede';
      if (!locationMap[name]) locationMap[name] = { name, count: 0, value: 0 };
      locationMap[name].count += 1;
      locationMap[name].value += (a as any).valor_estimado || 0;
    });
    const byLocation = Object.values(locationMap).sort((a, b) => b.count - a.count).slice(0, 8);

    const rubroMap: Record<string, { name: string; count: number; value: number }> = {};
    filteredAssets.forEach(a => {
      const loc = rawData.locations.find(l => l.id === a.location_id);
      const bt = loc?.business_type || 'sin_rubro';
      const name = (BUSINESS_TYPE_LABELS as any)[bt] || bt;
      if (!rubroMap[name]) rubroMap[name] = { name, count: 0, value: 0 };
      rubroMap[name].count += 1;
      rubroMap[name].value += (a as any).valor_estimado || 0;
    });
    const byRubro = Object.values(rubroMap).sort((a, b) => b.count - a.count);

    const catMap: Record<string, { name: string; count: number; value: number }> = {};
    filteredAssets.forEach(a => {
      const cat = (a as any).categories?.name || rawData.categories.find(c => c.id === a.category_id)?.name || 'Sin Categoria';
      if (!catMap[cat]) catMap[cat] = { name: cat, count: 0, value: 0 };
      catMap[cat].count += 1;
      catMap[cat].value += (a as any).valor_estimado || 0;
    });
    const byCategory = Object.values(catMap).sort((a, b) => b.count - a.count).slice(0, 10);

    const operativos = byStatus['Operativo'] || 0;
    const enReparacion = byStatus['En Reparacion'] || 0;
    const total = filteredAssets.length;

    return {
      total, totalValue, byStatus, byLocation, byRubro, byCategory, operativos, enReparacion,
      pctOperativos: total > 0 ? Math.round((operativos / total) * 100) : 0,
      avgValue: total > 0 ? totalValue / total : 0,
      recentMaintenance: rawData.recentMaintenance,
      totalMaintenanceCost: rawData.totalMaintenanceCost,
      recentAssets: filteredAssets.slice(0, 5),
      assetsNeedingMaintenance: filteredAssets.filter(a => a.estado_uso === 'En Reparacion'),
    };
  }, [rawData, filteredAssets]);

  if (loading) {
    return (
      <LoadingSpinner label="Cargando dashboard..." />
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
        <AlertTriangle className="mx-auto mb-4 text-red-500" size={40} />
        <p className="text-red-800 font-semibold">Error al cargar metricas</p>
        <p className="text-red-500 text-sm mt-2">{error}</p>
        <button onClick={fetchAll} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
          Reintentar
        </button>
      </div>
    );
  }

  if (!metrics || !rawData) return null;

  const SummaryMetric = ({ title, value, icon: Icon, sub, iconClassName = 'text-[#002855]', iconBg = 'bg-slate-100', valueClassName = 'text-slate-800', className = 'bg-white' }: {
    title: string; value: string | number; icon: any; sub?: string; iconClassName?: string; iconBg?: string; valueClassName?: string; className?: string;
  }) => (
    <div className={`flex items-start gap-3 p-4 sm:p-5 min-w-0 ${className}`}>
      <div className={`p-2 sm:p-2.5 rounded-lg shrink-0 ${iconBg} ${iconClassName}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">{title}</p>
        <p className={`text-lg sm:text-xl font-bold tabular-nums leading-tight mt-0.5 truncate ${valueClassName}`}>{value}</p>
        {sub && <p className="text-[9px] sm:text-[10px] font-semibold text-slate-400 mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );

  const HBarChart = ({ title, icon: Icon, items, colorOffset = 0 }: {
    title: string; icon: any; items: { name: string; count: number; value: number }[]; colorOffset?: number;
  }) => {
    const maxCount = Math.max(...items.map(i => i.count), 1);
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2 uppercase tracking-wider">
          <Icon size={18} className="text-[#002855]" />
          {title}
        </h3>
        {items.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">Sin datos con los filtros actuales</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => {
              const pct = (item.count / maxCount) * 100;
              const color = BAR_PALETTE[(i + colorOffset) % BAR_PALETTE.length];
              return (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700 truncate max-w-[55%]" title={item.name}>{item.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] font-semibold text-slate-400">S/ {item.value.toLocaleString()}</span>
                      <span className="text-xs font-bold text-slate-800 w-6 text-right tabular-nums">{item.count}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const DonutChart = () => {
    const counts = metrics!.byStatus;
    const entries = ESTADO_USO_ORDER.filter(s => counts[s] > 0).map(s => ({ status: s, count: counts[s] }));
    const total = entries.reduce((s, e) => s + e.count, 0);
    const RADIUS = 54;
    const STROKE = 18;
    const CIRC = 2 * Math.PI * RADIUS;
    let acc = 1;
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2 uppercase tracking-wider">
          <PieChart size={18} className="text-[#002855]" />
          Activos por Estado
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-8 justify-center">
          <div className="relative w-[160px] h-[160px] shrink-0">
            <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
              <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="#f1f5f9" strokeWidth={STROKE} />
              {entries.map(({ status, count }) => {
                const seg = (count / (total || 1)) * CIRC;
                const el = (
                  <circle key={status} cx="70" cy="70" r={RADIUS} fill="none"
                    stroke={ESTADO_USO_HEX_COLORS[status] || '#94a3b8'}
                    strokeWidth={STROKE}
                    strokeDasharray={`${seg} ${CIRC - seg}`}
                    strokeDashoffset={-acc}
                    strokeLinecap="round" />
                );
                acc += seg;
                return el;
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-slate-800 tabular-nums">{total}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Activos</span>
            </div>
          </div>
          <div className="space-y-2.5">
            {entries.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ESTADO_USO_HEX_COLORS[status] || '#94a3b8' }} />
                <span className="text-xs font-semibold text-slate-600 w-28">{ESTADO_USO_LABELS[status] || status}</span>
                <span className="text-sm font-bold text-slate-800 tabular-nums w-8 text-right">{count}</span>
                <span className="text-[10px] font-semibold text-slate-400 w-10">
                  {total > 0 ? Math.round((count / total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard de Inventario</h2>
          <p className="text-slate-400 text-sm font-semibold mt-0.5">
            {metrics.total} activos &middot; S/ {metrics.totalValue.toLocaleString()} en costo total
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#002855] text-white rounded-xl hover:bg-[#001d40] active:scale-95 transition-all text-xs font-bold uppercase tracking-wider shadow-sm"
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {/* Filtros internos con estilo institucional FilterBar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <FilterBar
            filters={[
              {
                key: 'company',
                placeholder: 'TODAS LAS EMPRESAS',
                icon: Building2,
                iconClassName: 'text-[#002855]',
                wrapperClassName: 'flex-1 min-w-[200px]',
                multiple: false,
                options: rawData.companies.map(c => ({ value: c.id, label: c.name }))
              },
              {
                key: 'location',
                placeholder: 'TODAS LAS SEDES',
                icon: MapPin,
                iconClassName: 'text-rose-500',
                wrapperClassName: 'flex-1 min-w-[200px]',
                multiple: false,
                options: availableLocations.map(l => ({ value: l.id, label: l.name }))
              },
              {
                key: 'business_type',
                placeholder: 'TODOS LOS RUBROS',
                icon: Filter,
                iconClassName: 'text-blue-500',
                wrapperClassName: 'flex-1 min-w-[200px]',
                multiple: false,
                options: Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => ({ value, label }))
              },
              {
                key: 'category',
                placeholder: 'TODAS LAS CATEGORÍAS',
                icon: Layers,
                iconClassName: 'text-amber-500',
                wrapperClassName: 'flex-1 min-w-[200px]',
                multiple: false,
                options: rawData.categories.map(c => ({ value: c.id, label: c.name }))
              },
            ]}
            values={{
              company: filterCompany,
              location: filterLocation,
              business_type: filterBusinessType,
              category: filterCategory,
            }}
            onChange={(key, value) => {
              const val = Array.isArray(value) ? (value[0] || '') : (value || '');
              if (key === 'company') {
                setFilterCompany(val);
                setFilterLocation('');
              } else if (key === 'location') {
                setFilterLocation(val);
              } else if (key === 'business_type') {
                setFilterBusinessType(val);
              } else if (key === 'category') {
                setFilterCategory(val);
              }
            }}
            onClearAll={() => {
              setFilterCompany('');
              setFilterLocation('');
              setFilterBusinessType('');
              setFilterCategory('');
            }}
          />
        </div>
      </div>

      {/* Resumen general consolidado */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <BarChart3 size={18} className="text-[#002855]" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Resumen General</h3>
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Indicadores consolidados del inventario</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSummaryOpen(prev => !prev)}
            aria-expanded={summaryOpen}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-[#002855] hover:bg-slate-50 transition-colors"
          >
            {summaryOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {summaryOpen ? 'Ocultar detalle' : 'Mostrar detalle'}
          </button>
        </div>

        {summaryOpen && (
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-100">
              <SummaryMetric title="Total Activos" value={metrics.total} icon={Package} sub={`${rawData.companies.length} empresa(s)`} iconClassName="text-[#002855]" iconBg="bg-blue-50" />
              <SummaryMetric title="Costo Total" value={`S/ ${metrics.totalValue.toLocaleString()}`} icon={DollarSign} sub="Suma del costo por activo" iconClassName="text-emerald-700" iconBg="bg-emerald-50" valueClassName="text-emerald-700" />
              <SummaryMetric title="Operativos" value={`${metrics.pctOperativos}%`} icon={Percent} sub={`${metrics.operativos} de ${metrics.total}`} iconClassName="text-blue-700" iconBg="bg-blue-50" />
              <SummaryMetric title="En Reparación" value={metrics.enReparacion} icon={AlertTriangle} sub={metrics.enReparacion > 0 ? 'Requieren atención' : 'Sin alertas'} iconClassName={metrics.enReparacion > 0 ? 'text-amber-600' : 'text-slate-500'} iconBg={metrics.enReparacion > 0 ? 'bg-amber-50' : 'bg-slate-100'} valueClassName={metrics.enReparacion > 0 ? 'text-amber-600' : 'text-slate-800'} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-100 border-t border-slate-200">
              <SummaryMetric title="Sedes" value={rawData.locations.length} icon={MapPin} iconClassName="text-rose-600" iconBg="bg-rose-50" className="bg-slate-50/60" />
              <SummaryMetric title="Empresas" value={rawData.companies.length} icon={Building2} iconClassName="text-indigo-600" iconBg="bg-indigo-50" className="bg-slate-50/60" />
              <SummaryMetric title="Costo Mantenimiento" value={`S/ ${metrics.totalMaintenanceCost.toLocaleString()}`} icon={Wrench} iconClassName="text-rose-600" iconBg="bg-rose-50" className="bg-slate-50/60" />
              <SummaryMetric title="Promedio por Activo" value={`S/ ${Math.round(metrics.avgValue).toLocaleString()}`} icon={TrendingUp} sub="Costo promedio por activo" iconClassName="text-teal-700" iconBg="bg-teal-50" className="bg-slate-50/60" />
            </div>
          </div>
        )}
      </div>

      {/* Donut + Categorias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DonutChart />
        <HBarChart title="Activos por Categoria" icon={BarChart3} items={metrics.byCategory} colorOffset={2} />
      </div>

      {/* Por Sede + Por Rubro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HBarChart title="Activos por Sede" icon={MapPin} items={metrics.byLocation} colorOffset={0} />
        <HBarChart title="Activos por Rubro" icon={Activity} items={metrics.byRubro} colorOffset={4} />
      </div>

      {/* Ultimos activos + En reparacion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2 uppercase tracking-wider">
            <Package size={18} className="text-[#002855]" />
            Ultimos Activos Agregados
          </h3>
          <div className="space-y-2.5">
            {metrics.recentAssets.length > 0 ? (
              metrics.recentAssets.map((asset, i) => (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 hover:border-[#002855]/30 hover:shadow-sm rounded-xl border border-slate-100 transition-all cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0 transition-transform group-hover:scale-105" style={{ backgroundColor: BAR_PALETTE[i % BAR_PALETTE.length] }}>
                    {(getAssetName(asset)[0] || 'A').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-[#002855] truncate transition-colors">{getAssetName(asset)}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {asset.codigo_unico || 'Sin codigo'}
                      {(asset.brand || asset.model) ? ` · ${[asset.brand, asset.model].filter(Boolean).join(' ')}` : ''}
                      {(asset as any).locations?.name ? ` · ${(asset as any).locations.name}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-emerald-600 tabular-nums">S/ {((asset as any).valor_estimado || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(String(asset.created_at).includes('T') ? String(asset.created_at) : `${asset.created_at}T12:00:00`).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-400 text-sm py-8">Sin activos con los filtros actuales</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2 uppercase tracking-wider">
            <AlertTriangle size={18} className="text-amber-500" />
            Activos en Reparacion
            {metrics.assetsNeedingMaintenance.length > 0 && (
              <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">
                {metrics.assetsNeedingMaintenance.length}
              </span>
            )}
          </h3>
          <div className="space-y-2.5">
            {metrics.assetsNeedingMaintenance.length > 0 ? (
              metrics.assetsNeedingMaintenance.slice(0, 5).map(asset => (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className="flex items-center gap-3 p-3 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 hover:shadow-sm rounded-xl border border-amber-100 transition-all cursor-pointer group"
                >
                  <div className="p-2 bg-amber-200 rounded-lg shrink-0 transition-transform group-hover:scale-105">
                    <Wrench size={14} className="text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-amber-800 truncate transition-colors">{getAssetName(asset)}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {asset.codigo_unico || 'Sin codigo'}
                      {(asset.brand || asset.model) ? ` · ${[asset.brand, asset.model].filter(Boolean).join(' ')}` : ''}
                    </p>
                  </div>
                  <p className="text-[10px] font-bold text-amber-600 shrink-0">{(asset as any).locations?.name || 'Sede N/A'}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="mx-auto mb-3 text-emerald-500" size={32} />
                <p className="text-emerald-600 font-bold text-sm">Sin activos en reparacion</p>
                <p className="text-slate-400 text-xs mt-1">Todo operativo con los filtros actuales</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mantenimientos recientes */}
      {metrics.recentMaintenance.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2 uppercase tracking-wider">
            <Wrench size={18} className="text-[#002855]" />
            Mantenimientos Recientes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.recentMaintenance.map(record => (
              <div
                key={record.id}
                onClick={() => record.assets && setSelectedAsset(record.assets as AssetWithDetails)}
                className={`flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 transition-all ${record.assets ? 'cursor-pointer hover:bg-slate-100 hover:border-[#002855]/30 hover:shadow-sm group' : ''}`}
              >
                <div className="p-2 bg-[#002855]/10 rounded-lg shrink-0">
                  <Wrench size={14} className="text-[#002855]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 group-hover:text-[#002855] truncate transition-colors">{getAssetName(record.assets)}</p>
                  <p className="text-[10px] text-slate-400 truncate">{record.description}</p>
                </div>
                <p className="text-[10px] font-semibold text-slate-500 shrink-0">
                  {new Date(String(record.created_at).includes('T') ? String(record.created_at) : `${record.created_at}T12:00:00`).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de detalle del activo */}
      {selectedAsset && (
        <AssetDetails
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}

    </div>
  );
}
