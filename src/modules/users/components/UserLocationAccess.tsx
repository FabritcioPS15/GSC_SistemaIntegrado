import { useState, useEffect } from 'react';
import { MapPin, Plus, X, Check, Shield } from 'lucide-react';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import { supabase, Location } from '../../../shared/services/supabase';
import { useNotify } from '../../../shared/hooks/useNotify';
import ModalOverlay from '../../../shared/components/ui/ModalOverlay';

interface UserLocationAccessProps {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserLocationAccess({ userId, userName, isOpen, onClose }: UserLocationAccessProps) {
  const { success: notifySuccess, error: notifyError } = useNotify();
  const [locations, setLocations] = useState<Location[]>([]);
  const [userLocationIds, setUserLocationIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Cargar todas las sedes activas
      const { data: locationsData } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (locationsData) {
        setLocations(locationsData);
      }

      // Cargar las sedes a las que tiene acceso el usuario
      const { data: userLocations } = await supabase
        .from('user_locations')
        .select('location_id')
        .eq('user_id', userId);

      if (userLocations) {
        setUserLocationIds(new Set(userLocations.map(ul => ul.location_id)));
      }
    } catch (err: any) {
      console.error('Error cargando datos:', err);
      notifyError('Error al cargar las sedes');
    } finally {
      setLoading(false);
    }
  };

  const toggleLocation = async (locationId: string) => {
    const newLocationIds = new Set(userLocationIds);
    
    if (newLocationIds.has(locationId)) {
      // Quitar acceso
      newLocationIds.delete(locationId);
      const { error } = await supabase
        .from('user_locations')
        .delete()
        .eq('user_id', userId)
        .eq('location_id', locationId);

      if (error) throw error;
    } else {
      // Agregar acceso
      newLocationIds.add(locationId);
      const { error } = await supabase
        .from('user_locations')
        .insert({
          user_id: userId,
          location_id: locationId
        });

      if (error) throw error;
    }

    setUserLocationIds(newLocationIds);
    notifySuccess(
      newLocationIds.has(locationId) ? 'Acceso a sede agregado' : 'Acceso a sede eliminado',
      'Actualizado'
    );
  };

  const handleSave = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay className="bg-slate-900/40 backdrop-blur-sm" onClose={onClose} closeOnBackdrop>
      <div className="bg-white w-full sm:max-w-2xl rounded-none shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-900 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-9 h-9 bg-white/10 rounded-none flex items-center justify-center border border-white/20">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-normal text-white uppercase tracking-[0.2em] leading-tight">Accesos a Sedes</h2>
              <p className="text-[10px] font-normal text-blue-200 uppercase tracking-widest mt-0.5">{userName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-none transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {loading ? (
            <LoadingSpinner minHeight="0" size={40} className="py-8" label="Cargando sedes..." />
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mb-3 ml-1">
                Selecciona las sedes a las que este usuario tiene acceso:
              </p>
              
              {locations.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <MapPin className="mx-auto mb-2 opacity-50" size={32} />
                  <p className="text-sm font-normal">No hay sedes disponibles</p>
                </div>
              ) : (
                locations.map((location) => {
                  const hasAccess = userLocationIds.has(location.id);
                  return (
                    <button
                      key={location.id}
                      onClick={() => toggleLocation(location.id)}
                      className={`w-full flex items-center justify-between p-3 border transition-all ${
                        hasAccess
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 ${hasAccess ? 'bg-blue-500' : 'bg-slate-200'}`}>
                          <MapPin className={hasAccess ? 'text-white' : 'text-slate-500'} size={16} />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-normal text-slate-800 uppercase">{location.name}</p>
                          {location.address && (
                            <p className="text-[9px] font-normal text-slate-500 mt-0.5">{location.address}</p>
                          )}
                        </div>
                      </div>
                      <div className={`p-1.5 ${hasAccess ? 'bg-blue-500' : 'bg-slate-200'}`}>
                        {hasAccess ? <Check className="text-white" size={14} /> : <Plus className="text-slate-500" size={14} />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex items-center justify-between gap-3 z-10">
          <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">
            {userLocationIds.size} sede(s) seleccionada(s)
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-[10px] font-normal uppercase tracking-[0.2em] text-slate-600 bg-white border border-slate-200 rounded-none hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-2 text-[10px] font-normal uppercase tracking-[0.2em] text-white bg-blue-600 rounded-none hover:bg-blue-700 transition-all shadow-lg"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
