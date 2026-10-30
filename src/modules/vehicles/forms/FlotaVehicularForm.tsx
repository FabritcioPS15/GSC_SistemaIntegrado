import { useState, useEffect } from 'react';
import { Car } from 'lucide-react';
import { supabase, Location, VehicleType } from '../../../shared/services/supabase';
import BaseForm, { FormSection, FormField, FormInput, FormSelect } from '../../../shared/components/forms/BaseForm';
import { useNotify } from '../../../shared/hooks/useNotify';

type FlotaVehicularFormProps = {
  onClose: () => void;
  onSave: () => void;
  editVehicle?: VehicleType;
};

export default function FlotaVehicularForm({ onClose, onSave, editVehicle }: FlotaVehicularFormProps) {
  const { success: notifySuccess } = useNotify();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    placa: editVehicle?.placa || '',
    marca: editVehicle?.marca || '',
    modelo: editVehicle?.modelo || '',
    categoria: editVehicle?.categoria || '',
    color: editVehicle?.color || '',
    año: editVehicle?.año || new Date().getFullYear(),
    estado: editVehicle?.estado || 'activa',
    ubicacion_actual: editVehicle?.ubicacion_actual || '',
    imagen_url: editVehicle?.imagen_url || '',
    fecha_ultimo_mantenimiento: editVehicle?.fecha_ultimo_mantenimiento || new Date().toISOString().split('T')[0],
    // Documentación
    citv_emision: editVehicle?.citv_emision || '',
    citv_vencimiento: editVehicle?.citv_vencimiento || '',
    soat_emision: editVehicle?.soat_emision || '',
    soat_vencimiento: editVehicle?.soat_vencimiento || '',
    poliza_emision: editVehicle?.poliza_emision || '',
    poliza_vencimiento: editVehicle?.poliza_vencimiento || '',
    contrato_alquiler_emision: editVehicle?.contrato_alquiler_emision || '',
    contrato_alquiler_vencimiento: editVehicle?.contrato_alquiler_vencimiento || '',
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .order('name');
    if (data) setLocations(data);
  };

  const validatePlate = (plate: string): boolean => {
    if (!plate) return false;
    // Aceptar cualquier formato de placa peruana con 6-7 caracteres (letras y números)
    // Formatos comunes: ABC-123, ABC-1234, ABC-123X, X123-ABC, 123ABC, 1234ABC, 58868F, etc.
    const plateRegex = /^[A-Z0-9]{6,7}$/;
    return plateRegex.test(plate.toUpperCase().replace(/-/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!formData.placa.trim()) {
      newErrors.placa = 'La placa es requerida';
    } else if (!validatePlate(formData.placa)) {
      newErrors.placa = 'Formato inválido. Debe tener 6-7 caracteres (letras y números). Ej: ABC123, 58868F';
    }

    if (!formData.marca.trim()) {
      newErrors.marca = 'La marca es requerida';
    }

    if (!formData.modelo.trim()) {
      newErrors.modelo = 'El modelo es requerido';
    }

    if (!formData.estado) {
      newErrors.estado = 'El estado es requerido';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setLoading(true);

    const dataToSave = {
      placa: formData.placa.toUpperCase().trim(),
      marca: formData.marca.trim(),
      modelo: formData.modelo.trim(),
      categoria: formData.categoria.trim() || null,
      color: formData.color.trim() || null,
      año: formData.año,
      estado: formData.estado,
      ubicacion_actual: formData.ubicacion_actual.trim() || null,
      imagen_url: formData.imagen_url.trim() || null,
      fecha_ultimo_mantenimiento: formData.fecha_ultimo_mantenimiento || null,
      citv_emision: formData.citv_emision || null,
      citv_vencimiento: formData.citv_vencimiento || null,
      soat_emision: formData.soat_emision || null,
      soat_vencimiento: formData.soat_vencimiento || null,
      poliza_emision: formData.poliza_emision || null,
      poliza_vencimiento: formData.poliza_vencimiento || null,
      contrato_alquiler_emision: formData.contrato_alquiler_emision || null,
      contrato_alquiler_vencimiento: formData.contrato_alquiler_vencimiento || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editVehicle) {
        const { error } = await supabase
          .from('vehiculos')
          .update(dataToSave)
          .eq('id', editVehicle.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vehiculos')
          .insert([dataToSave]);

        if (error) throw error;
      }

      setLoading(false);
      notifySuccess(editVehicle ? 'Unidad actualizada correctamente' : 'Unidad creada correctamente', editVehicle ? 'Actualizada' : 'Creada');
      onSave();
    } catch (err: any) {
      setErrors({ submit: 'Error inesperado: ' + err });
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <BaseForm
      title={editVehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}
      subtitle="Módulo de Gestión de Flota Vehicular"
      onClose={onClose}
      onSubmit={handleSubmit}
      loading={loading}
      error={errors.submit}
      icon={<Car size={24} className="text-blue-600" />}
    >
      {/* Section: Información Principal */}
      <FormSection title="Información del Vehículo" color="blue">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FormField label="Placa" required error={errors.placa}>
            <FormInput
              type="text"
              name="placa"
              value={formData.placa}
              onChange={handleChange}
              placeholder="ABC-123"
              required
              error={errors.placa}
            />
          </FormField>

          <FormField label="Marca" required error={errors.marca}>
            <FormInput
              type="text"
              name="marca"
              value={formData.marca}
              onChange={handleChange}
              placeholder="Toyota, Nissan, Honda"
              required
              error={errors.marca}
            />
          </FormField>

          <FormField label="Modelo" required error={errors.modelo}>
            <FormInput
              type="text"
              name="modelo"
              value={formData.modelo}
              onChange={handleChange}
              placeholder="Corolla, Sentra, Civic"
              required
              error={errors.modelo}
            />
          </FormField>

          <FormField label="Color" error={errors.color}>
            <FormInput
              type="text"
              name="color"
              value={formData.color}
              onChange={handleChange}
              placeholder="Blanco, Negro, Gris"
              error={errors.color}
            />
          </FormField>

          <FormField label="Categoría" error={errors.categoria}>
            <FormInput
              type="text"
              name="categoria"
              value={formData.categoria}
              onChange={handleChange}
              placeholder="Seleccionar"
              list="categorias-vehiculo"
              error={errors.categoria}
            />
            <datalist id="categorias-vehiculo">
              <option value="L5" />
              <option value="M1" />
              <option value="M2" />
              <option value="M3" />
              <option value="N2" />
              <option value="N3" />
            </datalist>
          </FormField>

          <FormField label="Año" error={errors.año}>
            <FormInput
              type="number"
              name="año"
              value={formData.año}
              onChange={handleChange}
              placeholder="2024"
              error={errors.año}
            />
          </FormField>

          <FormField label="Estado" required error={errors.estado}>
            <FormSelect
              name="estado"
              value={formData.estado}
              onChange={handleChange}
              required
              error={errors.estado}
            >
              <option value="activa">Activa</option>
              <option value="inactiva">Inactiva</option>
              <option value="en_proceso">En Proceso</option>
            </FormSelect>
          </FormField>

          <FormField label="Ubicación Actual" error={errors.ubicacion_actual}>
            <FormSelect
              name="ubicacion_actual"
              value={formData.ubicacion_actual}
              onChange={handleChange}
              error={errors.ubicacion_actual}
            >
              <option value="">Seleccionar ubicación</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </FormSelect>
          </FormField>

          <FormField label="URL de Imagen" error={errors.imagen_url}>
            <FormInput
              type="url"
              name="imagen_url"
              value={formData.imagen_url}
              onChange={handleChange}
              placeholder="https://ejemplo.com/imagen.jpg"
              error={errors.imagen_url}
            />
          </FormField>
        </div>
      </FormSection>

      {/* Section: Documentación */}
      <FormSection title="Documentación del Vehículo" color="emerald">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FormField label="Emisión CITV" error={errors.citv_emision}>
            <FormInput
              type="date"
              name="citv_emision"
              value={formData.citv_emision}
              onChange={handleChange}
              error={errors.citv_emision}
            />
          </FormField>

          <FormField label="Vencimiento CITV" error={errors.citv_vencimiento}>
            <FormInput
              type="date"
              name="citv_vencimiento"
              value={formData.citv_vencimiento}
              onChange={handleChange}
              error={errors.citv_vencimiento}
            />
          </FormField>

          <FormField label="Emisión SOAT" error={errors.soat_emision}>
            <FormInput
              type="date"
              name="soat_emision"
              value={formData.soat_emision}
              onChange={handleChange}
              error={errors.soat_emision}
            />
          </FormField>

          <FormField label="Vencimiento SOAT" error={errors.soat_vencimiento}>
            <FormInput
              type="date"
              name="soat_vencimiento"
              value={formData.soat_vencimiento}
              onChange={handleChange}
              error={errors.soat_vencimiento}
            />
          </FormField>

          <FormField label="Emisión Póliza" error={errors.poliza_emision}>
            <FormInput
              type="date"
              name="poliza_emision"
              value={formData.poliza_emision}
              onChange={handleChange}
              error={errors.poliza_emision}
            />
          </FormField>

          <FormField label="Vencimiento Póliza" error={errors.poliza_vencimiento}>
            <FormInput
              type="date"
              name="poliza_vencimiento"
              value={formData.poliza_vencimiento}
              onChange={handleChange}
              error={errors.poliza_vencimiento}
            />
          </FormField>

          <FormField label="Emisión Contrato Alquiler" error={errors.contrato_alquiler_emision}>
            <FormInput
              type="date"
              name="contrato_alquiler_emision"
              value={formData.contrato_alquiler_emision}
              onChange={handleChange}
              error={errors.contrato_alquiler_emision}
            />
          </FormField>

          <FormField label="Vencimiento Contrato Alquiler" error={errors.contrato_alquiler_vencimiento}>
            <FormInput
              type="date"
              name="contrato_alquiler_vencimiento"
              value={formData.contrato_alquiler_vencimiento}
              onChange={handleChange}
              error={errors.contrato_alquiler_vencimiento}
            />
          </FormField>
        </div>
      </FormSection>
    </BaseForm>
  );
}
