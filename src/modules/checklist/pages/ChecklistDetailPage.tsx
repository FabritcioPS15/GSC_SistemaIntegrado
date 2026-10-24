import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, History, ExternalLink, GraduationCap, Stethoscope, Car, MapPin, Building2, Trash2 } from 'lucide-react';
import { supabase, Location } from '../../../shared/services/supabase';
import { useNotify } from '../../../shared/hooks/useNotify';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';

export default function ChecklistDetail() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const { confirm, success: notifySuccess, error: notifyError } = useNotify();
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLocation = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setLocation(data as Location);
    } catch (err) {
      console.error('Error fetching location:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm('¿Estás seguro de eliminar esta sede y su checklist?', 'Eliminar Sede');
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id);
      if (error) throw error;
      notifySuccess('Sede eliminada correctamente', 'Eliminada');
      navigate('/checklist');
    } catch (err) {
      console.error('Error deleting location:', err);
      notifyError('Error al eliminar la sede: ' + (err instanceof Error ? err.message : String(err)), 'Error');
    }
  };

  useEffect(() => {
    fetchLocation();
  }, [id]);

  const getTypeInfo = () => {
    switch (type) {
      case 'escon':
        return {
          title: 'ESCON',
          icon: <GraduationCap size={32} />,
          color: 'blue',
          description: 'Escuela de Conductores'
        };
      case 'ecsal':
        return {
          title: 'ECSAL',
          icon: <Stethoscope size={32} />,
          color: 'emerald',
          description: 'Policlínico'
        };
      case 'citv':
        return {
          title: 'CITV',
          icon: <Car size={32} />,
          color: 'orange',
          description: 'Revisión Técnica'
        };
      default:
        return {
          title: 'UBICACIÓN',
          icon: <Building2 size={32} />,
          color: 'slate',
          description: 'Ubicación'
        };
    }
  };

  const typeInfo = getTypeInfo();

  if (loading) {
    return (
      <LoadingSpinner label="Cargando checklist..." />
    );
  }

  if (!location) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-500 font-medium">No se encontró la ubicación.</p>
      </div>
    );
  }

  const getTypeLink = (type: 'drive' | 'evidence') => {
    if (!location) return '';
    return type === 'drive' ? (location.checklist_url || '') : (location.history_url || '');
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc]">
      <div className="p-8 flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <button
            onClick={() => navigate('/checklist')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-6"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-normal">Volver a Checklist</span>
          </button>
          <button onClick={handleDelete} className="flex items-center gap-2 text-red-600 hover:text-red-800 transition-colors mb-6">
            <Trash2 size={20} />
            <span className="text-sm font-normal">Eliminar checklist</span>
          </button>

          {/* Location Info Card */}
          <div className="bg-white border border-slate-200 rounded-none shadow-sm overflow-hidden mb-8">
            <div className={`bg-gradient-to-r from-${typeInfo.color}-600 to-${typeInfo.color}-600 px-8 py-6`}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  {typeInfo.icon}
                </div>
                <div>
                  <h1 className="text-2xl font-normal text-white uppercase tracking-tight">{location.name}</h1>
                  <p className="text-white/80 text-sm font-normal uppercase tracking-wider">{typeInfo.description}</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin size={16} className="text-slate-400" />
                <span className="text-sm font-normal uppercase tracking-wider">{location.address || 'Sin dirección registrada'}</span>
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Checklist Card */}
            <div
              className="bg-white border border-slate-200 rounded-none shadow-sm hover:shadow-lg transition-all cursor-pointer group overflow-hidden"
              onClick={() => {
                const link = getTypeLink('drive');
                if (link) {
                  window.open(link, '_blank');
                }
              }}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <FileText size={24} className="text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <ExternalLink size={20} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                </div>
                <h3 className="text-lg font-normal text-slate-900 uppercase mb-2">Realizar Checklist</h3>
                <p className="text-sm text-slate-600 font-medium">Acceder al formulario de checklist para esta ubicación</p>
              </div>
              <div className={`bg-${typeInfo.color}-100 px-6 py-3 border-t border-${typeInfo.color}-200`}>
                <span className={`text-xs font-normal uppercase tracking-widest text-${typeInfo.color}-700`}>
                  Abrir en Drive
                </span>
              </div>
            </div>

            {/* History Card */}
            <div
              className="bg-white border border-slate-200 rounded-none shadow-sm hover:shadow-lg transition-all cursor-pointer group overflow-hidden"
              onClick={() => {
                const link = getTypeLink('evidence');
                if (link) {
                  window.open(link, '_blank');
                }
              }}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <History size={24} className="text-emerald-600 group-hover:text-white transition-colors" />
                  </div>
                  <ExternalLink size={20} className="text-slate-300 group-hover:text-emerald-600 transition-colors" />
                </div>
                <h3 className="text-lg font-normal text-slate-900 uppercase mb-2">Ver Historial</h3>
                <p className="text-sm text-slate-600 font-medium">Acceder a la carpeta de evidencias y documentos históricos</p>
              </div>
              <div className="bg-emerald-100 px-6 py-3 border-t border-emerald-200">
                <span className="text-xs font-normal uppercase tracking-widest text-emerald-700">
                  Abrir Evidencias
                </span>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-8 bg-white border border-slate-200 rounded-none shadow-sm p-6">
            <h3 className="text-sm font-normal text-slate-900 uppercase tracking-wider mb-4">Información de la Ubicación</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-500 font-normal uppercase tracking-widest block mb-1">Nombre</span>
                <span className="text-sm font-normal text-slate-900">{location.name}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-normal uppercase tracking-widest block mb-1">Tipo</span>
                <span className="text-sm font-normal text-slate-900">{typeInfo.description}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
