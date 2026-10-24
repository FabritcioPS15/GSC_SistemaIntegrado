-- Agregando columnas requeridas para el formulario dinámico
ALTER TABLE assets ADD COLUMN IF NOT EXISTS campos_especificos JSONB DEFAULT '{}';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS tipo_activo TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS responsable_asignado TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS proveedor TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS garantia_hasta DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS area_ubicacion TEXT;
