import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, MapPin, X, Copy, Wrench, AlertTriangle, ArrowRight, Star } from 'lucide-react';
import { supabase, AssetWithDetails } from '../../../shared/services/supabase';
import DetailModal, {
  DetailModalHeader,
  DetailModalBody,
  DetailModalGrid,
  DetailModalSection,
  DetailModalCard,
  DetailModalRow,
  StandardModalFooter
} from '../../../shared/components/ui/DetailModal';

type AssetDetailsProps = {
  asset: AssetWithDetails;
  onClose: () => void;
  onEdit?: () => void;
};

export default function AssetDetails({ asset, onClose, onEdit }: AssetDetailsProps) {
  const navigate = useNavigate();
  const [hasMaintenance, setHasMaintenance] = useState(false);
  const [maintenanceCount, setMaintenanceCount] = useState(0);

  useEffect(() => {
    const checkMaintenance = async () => {
      const { count, error } = await supabase
        .from('maintenance_records')
        .select('*', { count: 'exact', head: true })
        .eq('asset_id', asset.id);

      if (!error && count && count > 0) {
        setHasMaintenance(true);
        setMaintenanceCount(count);
      }
    };
    checkMaintenance();
  }, [asset.id]);

  const handleMaintenanceClick = () => {
    onClose();
    navigate('/maintenance', { state: { assetFilter: asset.id } });
  };

  const copyToClipboard = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch { }
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    active: { label: 'Activo', color: 'emerald' },
    inactive: { label: 'Inactivo', color: 'slate' },
    maintenance: { label: 'Mantenimiento', color: 'amber' },
    extracted: { label: 'Extraído', color: 'rose' }
  };

  const status = statusMap[asset.status] || { label: asset.status, color: 'slate' };

  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700',
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
  };

  const getCondicionColor = (condicion?: string | null): string => {
    if (condicion === 'Nuevo' || condicion === 'Bueno') return 'bg-emerald-100 text-emerald-700';
    if (condicion === 'Regular') return 'bg-amber-100 text-amber-700';
    if (condicion === 'Malo') return 'bg-rose-100 text-rose-700';
    return 'bg-slate-100 text-slate-600';
  };

  const getEstadoUsoColor = (estado_uso?: string | null): string => {
    if (estado_uso === 'Operativo') return 'bg-emerald-100 text-emerald-700';
    if (estado_uso === 'Inoperativo') return 'bg-slate-100 text-slate-600';
    if (estado_uso === 'En Reparación') return 'bg-amber-100 text-amber-700';
    if (estado_uso === 'Baja') return 'bg-rose-100 text-rose-700';
    return 'bg-slate-100 text-slate-600';
  };

  const assetTitle = asset.item || asset.descripcion || `${asset.brand || ''} ${asset.model || ''}`.trim() || 'Activo';
  const hasTechSpecs = Boolean(asset.processor || asset.ram || asset.capacity || asset.almacenamiento || asset.operating_system || asset.ip_address || asset.anydesk_id);
  const hasPrinterSpecs = Boolean(asset.tipo_impresion || asset.tecnologia_impresion || asset.velocidad_impresion || asset.resolucion);
  const hasMobileSpecs = Boolean(asset.imei || asset.operator || asset.data_plan || asset.bateria_estado || asset.accesorios);

  return (
    <DetailModal maxWidth="5xl" onClose={onClose} closeOnBackdrop>
      <DetailModalHeader>
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 pr-1">
          <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-white/10 border border-white/20 flex items-center justify-center text-white">
            <Package size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xs sm:text-base md:text-[18px] font-normal text-white tracking-tight leading-snug line-clamp-2 sm:line-clamp-1">
              {assetTitle}
            </h2>
            <p className="text-[9px] sm:text-[10px] font-normal text-blue-200 tracking-wide mt-1 flex items-start sm:items-center gap-1.5">
              <MapPin size={10} className="shrink-0 mt-0.5 sm:mt-0" />
              <span className="line-clamp-2 sm:truncate">
                {asset.locations?.name || 'UBICACIÓN INTEGRAL'}
                {asset.areas?.name ? ` • ${asset.areas.name}` : asset.area ? ` • ${asset.area}` : ''}
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 text-white/50 hover:text-white hover:bg-white/10 transition-all -mr-1"
          aria-label="Cerrar detalle"
        >
          <X size={22} />
        </button>
      </DetailModalHeader>

      <DetailModalBody>
        <DetailModalGrid layout="stack-until-xl">

          {/* Sección 1: Especificaciones */}
          <DetailModalSection title="Especificaciones">
            <div className="space-y-2.5 sm:space-y-3">
              <DetailModalCard className="space-y-2.5 sm:space-y-3">
                <DetailModalRow label="Estado Operativo">
                  <span className={`text-[14px] font-semibold ${colorClasses[status.color] || colorClasses.slate}`}>
                    {status.label}
                  </span>
                </DetailModalRow>
                <DetailModalRow label="Condición">
                  <span className={`text-[12px] font-semibold px-2 py-0.5 ${getCondicionColor(asset.condicion)}`}>
                    {asset.condicion || 'Bueno'}
                  </span>
                </DetailModalRow>
                <DetailModalRow label="Estado de Uso">
                  <span className={`text-[12px] font-semibold px-2 py-0.5 ${getEstadoUsoColor(asset.estado_uso)}`}>
                    {asset.estado_uso || 'Operativo'}
                  </span>
                </DetailModalRow>
                <DetailModalRow label="Marca / Modelo">
                  <span className="text-[10px] sm:text-[12px] font-normal text-[#002855] uppercase break-words">
                    {asset.brand || 'GENÉRICA'} {asset.model || ''}
                  </span>
                </DetailModalRow>
                <DetailModalRow label="Categoría">
                  <span className="text-[10px] sm:text-[12px] font-normal text-[#002855] uppercase break-words">
                    {asset.categories?.name || '—'} {asset.subcategories?.name ? `(${asset.subcategories.name})` : ''}
                  </span>
                </DetailModalRow>
              </DetailModalCard>

              <DetailModalCard className="space-y-2.5 sm:space-y-3">
                <DetailModalRow label="Código Único">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="font-mono text-[10px] sm:text-xs font-bold text-slate-700">
                      {asset.codigo_unico || 'S/C'}
                    </span>
                    {asset.codigo_unico && (
                      <button type="button" onClick={() => copyToClipboard(asset.codigo_unico)} className="p-1 hover:text-blue-600 transition-colors" title="Copiar">
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                </DetailModalRow>
                <DetailModalRow label="Nº de Serie">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="font-mono text-[10px] sm:text-xs font-normal text-slate-700">
                      {asset.serial_number || 'S/N'}
                    </span>
                    {asset.serial_number && (
                      <button type="button" onClick={() => copyToClipboard(asset.serial_number)} className="p-1 hover:text-blue-600 transition-colors" title="Copiar">
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                </DetailModalRow>
                <DetailModalRow label="Color / Cantidad">
                  <span className="text-[10px] sm:text-[12px] font-normal text-slate-600 uppercase">
                    {asset.color || '—'} (Cant: {asset.cantidad || 1})
                  </span>
                </DetailModalRow>
                <DetailModalRow label="Fecha Adquisición">
                  <span className="text-[10px] sm:text-[12px] font-normal text-slate-600">
                    {asset.fecha_adquisicion ? new Date(String(asset.fecha_adquisicion).includes('T') ? String(asset.fecha_adquisicion) : `${asset.fecha_adquisicion}T12:00:00`).toLocaleDateString('es-PE') : '—'}
                  </span>
                </DetailModalRow>
                <DetailModalRow label="Costo">
                  <span className="text-[10px] sm:text-[12px] font-semibold text-emerald-700">
                    S/. {asset.valor_estimado ? Number(asset.valor_estimado).toFixed(2) : '0.00'}
                  </span>
                </DetailModalRow>
                <DetailModalRow label="Agregado el">
                  <span className="text-[10px] sm:text-[12px] font-normal text-slate-600">
                    {asset.created_at ? new Date(String(asset.created_at).includes('T') ? String(asset.created_at) : `${asset.created_at}T12:00:00`).toLocaleDateString('es-PE') : '—'}
                  </span>
                </DetailModalRow>
                <DetailModalRow label="Modificado el">
                  <span className="text-[10px] sm:text-[12px] font-normal text-slate-600">
                    {asset.updated_at ? new Date(String(asset.updated_at).includes('T') ? String(asset.updated_at) : `${asset.updated_at}T12:00:00`).toLocaleDateString('es-PE') : '—'}
                  </span>
                </DetailModalRow>
              </DetailModalCard>
            </div>
          </DetailModalSection>

          {/* Sección 2: Ubicación y Datos Técnicos */}
          <DetailModalSection title="Ubicación y Datos Técnicos">
            <DetailModalCard className="space-y-2.5 sm:space-y-3">
              <DetailModalRow label="Sede Principal">
                <span className="text-[10px] sm:text-[12px] font-normal text-[#002855] uppercase break-words">
                  {asset.locations?.name || 'No asignada'}
                </span>
              </DetailModalRow>
              <DetailModalRow label="Departamento / Área">
                <span className="text-[10px] sm:text-[12px] font-normal text-slate-600 uppercase break-words">
                  {asset.areas?.name || asset.area || 'Área General'}
                </span>
              </DetailModalRow>

              {/* Red y Acceso Remoto */}
              {(asset.ip_address || asset.anydesk_id) && (
                <div className="space-y-2.5 sm:space-y-3 mt-3 sm:mt-4 pt-3 border-t border-slate-200/80">
                  {asset.ip_address && (
                    <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-sm">
                      <span className="text-[8px] sm:text-[9px] font-normal text-slate-400 block mb-1.5">Dirección IPv4</span>
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="font-mono text-[11px] sm:text-xs font-normal text-blue-600 break-all">{asset.ip_address}</span>
                        <button type="button" onClick={() => copyToClipboard(asset.ip_address)} className="p-1 hover:text-blue-600 transition-colors" title="Copiar">
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  {asset.anydesk_id && (
                    <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-sm">
                      <span className="text-[8px] sm:text-[9px] font-normal text-slate-400 block mb-1.5">AnyDesk ID</span>
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="font-mono text-[11px] sm:text-xs font-normal text-blue-600 break-all">{asset.anydesk_id}</span>
                        <button type="button" onClick={() => copyToClipboard(asset.anydesk_id)} className="p-1 hover:text-blue-600 transition-colors" title="Copiar">
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Especificaciones de Cómputo */}
              {hasTechSpecs && (
                <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-sm space-y-2 mt-2">
                  <span className="text-[8px] sm:text-[9px] font-normal text-slate-400 uppercase tracking-wide block">Hardware & Cómputo</span>
                  <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-[11px]">
                    {asset.processor && (
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Procesador</span>
                        <span className="text-slate-700 font-medium">{asset.processor}</span>
                      </div>
                    )}
                    {asset.ram && (
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">RAM</span>
                        <span className="text-slate-700 font-medium">{asset.ram}</span>
                      </div>
                    )}
                    {(asset.capacity || asset.almacenamiento) && (
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Almacenamiento</span>
                        <span className="text-slate-700 font-medium">{asset.capacity || asset.almacenamiento}</span>
                      </div>
                    )}
                    {asset.operating_system && (
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Sistema Operativo</span>
                        <span className="text-slate-700 font-medium">{asset.operating_system}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Especificaciones de Impresora */}
              {hasPrinterSpecs && (
                <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-sm space-y-2 mt-2">
                  <span className="text-[8px] sm:text-[9px] font-normal text-slate-400 uppercase tracking-wide block">Datos de Impresión</span>
                  <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-[11px]">
                    {asset.tipo_impresion && (
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Tipo</span>
                        <span className="text-slate-700 font-medium uppercase">{asset.tipo_impresion}</span>
                      </div>
                    )}
                    {asset.tecnologia_impresion && (
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Tecnología</span>
                        <span className="text-slate-700 font-medium uppercase">{asset.tecnologia_impresion}</span>
                      </div>
                    )}
                    {asset.velocidad_impresion && (
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Velocidad</span>
                        <span className="text-slate-700 font-medium uppercase">{asset.velocidad_impresion}</span>
                      </div>
                    )}
                    {asset.resolucion && (
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Resolución</span>
                        <span className="text-slate-700 font-medium uppercase">{asset.resolucion}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Especificaciones de Equipo Móvil */}
              {hasMobileSpecs && (
                <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-sm space-y-2 mt-2">
                  <span className="text-[8px] sm:text-[9px] font-normal text-slate-400 uppercase tracking-wide block">Equipo Móvil</span>
                  <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-[11px]">
                    {asset.imei && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[8px] uppercase">IMEI</span>
                        <span className="text-slate-700 font-mono text-[10px]">{asset.imei}</span>
                      </div>
                    )}
                    {asset.operator && (
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Operador</span>
                        <span className="text-slate-700 font-medium uppercase">{asset.operator}</span>
                      </div>
                    )}
                    {asset.data_plan && (
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Plan</span>
                        <span className="text-slate-700 font-medium uppercase">{asset.data_plan}</span>
                      </div>
                    )}
                    {asset.bateria_estado && (
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Batería</span>
                        <span className="text-slate-700 font-medium uppercase">{asset.bateria_estado}</span>
                      </div>
                    )}
                    {asset.accesorios && (
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Accesorios</span>
                        <span className="text-slate-700 font-medium uppercase">{asset.accesorios}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </DetailModalCard>
          </DetailModalSection>

          {/* Sección 3: Mantenimiento y Observaciones */}
          <DetailModalSection title="Mantenimiento y Observaciones">
            <div className="space-y-2.5 sm:space-y-4">
              {asset.status === 'maintenance' && (
                <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block">Equipo en Mantenimiento</span>
                    <p className="text-[10px] sm:text-[11px] text-amber-700 mt-0.5">En proceso de revisión técnica o reparación.</p>
                  </div>
                </div>
              )}

              {hasMaintenance ? (
                <div className="p-3 sm:p-4 bg-slate-900 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-blue-600/10 rounded-full blur-3xl" />
                  <div className="relative z-10 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] sm:text-[9px] font-normal tracking-wide text-blue-400 uppercase">Mantenimiento GS</span>
                      <span className="text-[10px] font-bold text-slate-300">
                        {maintenanceCount} REGISTRO{maintenanceCount > 1 ? 'S' : ''}
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-slate-300 font-normal leading-relaxed">
                      Historial de intervenciones y revisiones técnicas registradas para este activo.
                    </p>
                    <button
                      type="button"
                      onClick={handleMaintenanceClick}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-[9px] sm:text-[10px] font-normal uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                    >
                      <Wrench size={12} /> Ver Historial ({maintenanceCount})
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[9px] sm:text-[10px] font-normal text-slate-400 tracking-widest block">
                    Sin intervenciones de mantenimiento
                  </span>
                </div>
              )}

              {asset.notes ? (
                <div className="p-3 sm:p-4 bg-amber-50 border border-amber-100">
                  <span className="text-[8px] sm:text-[9px] font-normal text-amber-600 tracking-widest mb-1.5 flex items-center gap-1">
                    <Star size={10} /> Observaciones
                  </span>
                  <p className="text-[10px] sm:text-[11px] font-medium text-amber-900 leading-relaxed">
                    {asset.notes}
                  </p>
                </div>
              ) : (
                <div className="p-6 sm:p-8 border-2 border-dashed border-slate-200 text-center">
                  <span className="text-[9px] sm:text-[10px] font-normal text-slate-300 tracking-widest">
                    Sin observaciones adicionales
                  </span>
                </div>
              )}
            </div>
          </DetailModalSection>

        </DetailModalGrid>
      </DetailModalBody>

      <StandardModalFooter
        onClose={onClose}
        onEdit={onEdit}
        editLabel="Editar Activo"
      />
    </DetailModal>
  );
}

