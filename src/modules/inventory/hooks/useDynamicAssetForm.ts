import { useState, useEffect, useCallback } from 'react';
import { useNotify } from '../../../shared/hooks/useNotify';
import { useAllowedLocations } from '../../../shared/hooks/useAllowedLocations';
import { supabase, Category, Location, Area, AssetWithDetails } from '../../../shared/services/supabase';

export type DynamicAssetFormData = {
  codigo_unico: string;
  item: string;
  location_id: string;
  area_ubicacion: string;
  brand: string;
  model: string;
  serial_number: string;
  estado_uso: string; // Operativo, En reparación, De baja, En almacén
  responsable_asignado: string;
  fecha_adquisicion: string;
  proveedor: string;
  valor_estimado: string;
  garantia_hasta: string;
  image_url: string;
  descripcion: string;
  category_id: string;
  tipo_activo: string;
  tipo_activo_custom: string;
};

export type UseDynamicAssetFormProps = {
  editAsset?: AssetWithDetails;
  initialCategoryId?: string;
  onSaved?: () => void;
};

export type UseDynamicAssetFormReturn = {
  formData: DynamicAssetFormData;
  setFormData: React.Dispatch<React.SetStateAction<DynamicAssetFormData>>;
  camposEspecificos: Record<string, any>;
  setCamposEspecificos: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  categories: Category[];
  locations: Location[];
  areas: Area[];
  loading: boolean;
  errors: Record<string, string>;
  editSingleUnitFromGroup: boolean;
  setEditSingleUnitFromGroup: (val: boolean) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleCamposEspecificosChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleCamposEspecificosCheckedChange: (key: string, checked: boolean) => void;
  setField: (name: string, value: string) => void;
  handleSubmit: () => Promise<void>;
};

const BASE_FIELDS: DynamicAssetFormData = {
  codigo_unico: '',
  item: '',
  location_id: '',
  area_ubicacion: '',
  brand: '',
  model: '',
  serial_number: '',
  estado_uso: 'Operativo',
  responsable_asignado: '',
  fecha_adquisicion: '',
  proveedor: '',
  valor_estimado: '',
  garantia_hasta: '',
  image_url: '',
  descripcion: '',
  category_id: '',
  tipo_activo: '',
  tipo_activo_custom: '',
};

function buildInitialFields(editAsset?: AssetWithDetails, initialCategoryId?: string, allowedLocations?: string[] | null): DynamicAssetFormData {
  const fields = { ...BASE_FIELDS };

  if (editAsset) {
    fields.codigo_unico = editAsset.codigo_unico || '';
    fields.item = editAsset.item || '';
    fields.location_id = editAsset.location_id || '';
    fields.brand = editAsset.brand || '';
    fields.model = editAsset.model || '';
    fields.serial_number = editAsset.serial_number || '';
    fields.estado_uso = editAsset.estado_uso || 'Operativo';
    fields.fecha_adquisicion = editAsset.fecha_adquisicion || '';
    fields.valor_estimado = editAsset.valor_estimado ? String(editAsset.valor_estimado) : '';
    fields.image_url = editAsset.image_url || '';
    fields.descripcion = editAsset.descripcion || '';
    fields.category_id = editAsset.category_id || '';

    // Get fields from the new columns or fallbacks from old ones if mapping them, here we map the flat ones that correspond
    const anyAsset = editAsset as any;
    fields.area_ubicacion = anyAsset.area_ubicacion || anyAsset.area || '';
    fields.responsable_asignado = anyAsset.responsable_asignado || '';
    fields.proveedor = anyAsset.proveedor || '';
    fields.garantia_hasta = anyAsset.garantia_hasta || '';
    fields.tipo_activo = anyAsset.tipo_activo || '';

    // Si tipo_activo no es de los conocidos, podríamos querer poner "Otro" y asignar el valor a tipo_activo_custom.
    // Eso lo haremos a nivel componente o aquí mismo si tuviéramos acceso fácil a todos los keywords.
  }

  if (!editAsset) {
    if (initialCategoryId) fields.category_id = initialCategoryId;
    // Si el usuario está restringido a una sola sede, predefinirla automáticamente
    if (allowedLocations && allowedLocations.length === 1 && !fields.location_id) {
      fields.location_id = allowedLocations[0];
    }
    if (!fields.codigo_unico) {
      fields.codigo_unico = 'ACT-' + Math.floor(100000 + Math.random() * 900000).toString();
    }
  }

  return fields;
}

function buildInitialCamposEspecificos(editAsset?: AssetWithDetails): Record<string, any> {
  if (editAsset && (editAsset as any).campos_especificos) {
    try {
      return typeof (editAsset as any).campos_especificos === 'string'
        ? JSON.parse((editAsset as any).campos_especificos)
        : (editAsset as any).campos_especificos;
    } catch (e) {
      console.error("Error parsing campos_especificos", e);
      return {};
    }
  }
  return {};
}

export function useDynamicAssetForm({ editAsset, initialCategoryId, onSaved }: UseDynamicAssetFormProps): UseDynamicAssetFormReturn {
  const { success: notifySuccess, error: notifyError } = useNotify();
  const allowedLocations = useAllowedLocations();
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<DynamicAssetFormData>(() =>
    buildInitialFields(editAsset, initialCategoryId, allowedLocations)
  );

  const [camposEspecificos, setCamposEspecificos] = useState<Record<string, any>>(() =>
    buildInitialCamposEspecificos(editAsset)
  );

  // Si el usuario está restringido a una sola sede, forzar (y fijar) esa sede
  const isSingleLocationRestricted = allowedLocations !== null && allowedLocations.length === 1;
  useEffect(() => {
    if (!editAsset && isSingleLocationRestricted && allowedLocations[0]) {
      setFormData(prev => ({ ...prev, location_id: allowedLocations[0] }));
    }
  }, [isSingleLocationRestricted, allowedLocations, editAsset]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      // Sin sedes asignadas y usuario restringido → no hay sedes que mostrar
      if (allowedLocations !== null && allowedLocations.length === 0) {
        const catRes = await supabase.from('categories').select('*');
        if (catRes.error) {
          setErrors(prev => ({ ...prev, submit: `Error cargando categorías: ${catRes.error.message}` }));
          return;
        }
        setCategories(catRes.data || []);
        setLocations([]);
        setAreas([]);
        return;
      }

      let locQuery = supabase.from('locations').select('*').eq('is_active', true).order('name');
      if (allowedLocations !== null && allowedLocations.length > 0) {
        locQuery = locQuery.in('id', allowedLocations);
      }

      const [catRes, locRes, areasRes] = await Promise.all([
        supabase.from('categories').select('*'),
        locQuery,
        supabase.from('areas').select('id, name, location_id').order('name'),
      ]);

      if (catRes.error) {
        setErrors(prev => ({ ...prev, submit: `Error cargando categorías: ${catRes.error.message}` }));
        return;
      }

      setCategories(catRes.data || []);
      if (locRes.data) setLocations(locRes.data);
      if (areasRes.data) setAreas((areasRes.data as Area[]) || []);
    } catch {
      setErrors(prev => ({ ...prev, submit: 'Error de conexión con la base de datos' }));
    }
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  }, [errors]);

  const handleCamposEspecificosChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCamposEspecificos(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleCamposEspecificosCheckedChange = useCallback((name: string, checked: boolean) => {
    setCamposEspecificos(prev => ({ ...prev, [name]: checked }));
  }, []);

  const [editSingleUnitFromGroup, setEditSingleUnitFromGroup] = useState<boolean>(false);

  const setField = useCallback((name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setErrors({});

    try {
      if (!formData.item) throw new Error('El nombre del activo es obligatorio');
      if (!formData.location_id) throw new Error('La sede es obligatoria');
      if (!formData.estado_uso) throw new Error('El estado es obligatorio');
      if (!formData.category_id) throw new Error('La categoría es obligatoria');

      const esTipoOtro = formData.tipo_activo === 'Otro';
      // Si el usuario elige "Otro", el activo se registra como tipo "Otro" (no se crea un tipo nuevo);
      // el texto personalizado se conserva dentro de campos_especificos.
      const finalTipoActivo = esTipoOtro ? 'Otro' : formData.tipo_activo;
      const camposFinales = esTipoOtro && formData.tipo_activo_custom
        ? { ...camposEspecificos, tipo_activo_custom: formData.tipo_activo_custom }
        : camposEspecificos;

      const dataToSave: Record<string, any> = {
        updated_at: new Date().toISOString(),
        codigo_unico: formData.codigo_unico || 'ACT-' + Math.floor(100000 + Math.random() * 900000).toString(),
        item: formData.item,
        location_id: formData.location_id,
        area_ubicacion: formData.area_ubicacion || null,
        brand: formData.brand || null,
        model: formData.model || null,
        serial_number: formData.serial_number || null,
        estado_uso: formData.estado_uso,
        responsable_asignado: formData.responsable_asignado || null,
        fecha_adquisicion: formData.fecha_adquisicion || null,
        proveedor: formData.proveedor || null,
        valor_estimado: formData.valor_estimado ? parseFloat(formData.valor_estimado) : null,
        garantia_hasta: formData.garantia_hasta || null,
        image_url: formData.image_url || null,
        descripcion: formData.descripcion || null,
        category_id: formData.category_id,
        tipo_activo: finalTipoActivo || null,
        campos_especificos: camposFinales,
      };

      if (editAsset) {
        const origCount = Math.max(1, parseInt(editAsset.cantidad?.toString() || '1', 10));

        if (editSingleUnitFromGroup && origCount > 1) {
          // Descontar 1 unidad del lote original
          const { error: updateError } = await supabase
            .from('assets')
            .update({ cantidad: origCount - 1, updated_at: new Date().toISOString() })
            .eq('id', editAsset.id);
          if (updateError) throw updateError;

          // Crear la unidad desacoplada individual con los datos guardados
          const singleUnitData = {
            ...dataToSave,
            cantidad: 1,
            codigo_unico: 'ACT-' + Math.floor(100000 + Math.random() * 900000).toString(),
          };
          const { error: insertError } = await supabase.from('assets').insert([singleUnitData]);
          if (insertError) throw insertError;

          notifySuccess(`Se extrajo y actualizó 1 unidad individual. El grupo original conserva ${origCount - 1} unidades.`, '¡Unidad individual guardada!');
        } else {
          // Actualización normal del activo/grupo completo
          const { error } = await supabase.from('assets').update(dataToSave).eq('id', editAsset.id);
          if (error) throw error;
          notifySuccess('El activo se actualizó correctamente', '¡Excelente!');
        }
      } else {
        const { error } = await supabase.from('assets').insert([dataToSave]);
        if (error) throw error;
        notifySuccess('El activo se creó correctamente', '¡Buen trabajo!');
      }
      onSaved?.();
    } catch (error: any) {
      setErrors({ submit: error.message });
      notifyError(error.message, 'Error');
    } finally {
      setLoading(false);
    }
  }, [formData, camposEspecificos, editAsset, editSingleUnitFromGroup, onSaved]);

  return {
    formData,
    setFormData,
    camposEspecificos,
    setCamposEspecificos,
    categories,
    locations,
    areas,
    loading,
    errors,
    editSingleUnitFromGroup,
    setEditSingleUnitFromGroup,
    handleChange,
    handleCamposEspecificosChange,
    handleCamposEspecificosCheckedChange,
    setField,
    handleSubmit,
  };
}
