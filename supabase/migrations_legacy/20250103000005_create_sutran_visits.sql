-- Migración para crear la tabla sutran_visits
-- Ejecutar en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS sutran_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_date DATE NOT NULL,
  inspector_name VARCHAR(255) NOT NULL,
  inspector_email VARCHAR(255),
  inspector_phone VARCHAR(20),
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  location_name VARCHAR(255) NOT NULL,
  visit_type VARCHAR(50) DEFAULT 'routine' CHECK (visit_type IN ('routine', 'special', 'emergency', 'follow_up')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  observations TEXT,
  findings TEXT,
  recommendations TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_sutran_visits_date ON sutran_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_sutran_visits_status ON sutran_visits(status);
CREATE INDEX IF NOT EXISTS idx_sutran_visits_location ON sutran_visits(location_id);
CREATE INDEX IF NOT EXISTS idx_sutran_visits_inspector ON sutran_visits(inspector_name);

-- Habilitar RLS
ALTER TABLE sutran_visits ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS básicas (ajustar según necesidades)
CREATE POLICY "Users can view all sutran visits" ON sutran_visits
  FOR SELECT USING (true);

CREATE POLICY "Users can insert sutran visits" ON sutran_visits
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update sutran visits" ON sutran_visits
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete sutran visits" ON sutran_visits
  FOR DELETE USING (true);

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_sutran_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para updated_at
CREATE TRIGGER trigger_update_sutran_visits_updated_at
  BEFORE UPDATE ON sutran_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_sutran_visits_updated_at();

-- Insertar datos de ejemplo
INSERT INTO sutran_visits (
  visit_date, 
  inspector_name, 
  inspector_email, 
  location_name, 
  visit_type, 
  status, 
  observations, 
  findings, 
  recommendations,
  documents
) VALUES 
(
  '2024-01-15',
  'Juan Pérez',
  'juan.perez@sutran.gob.pe',
  'Oficina Principal - Lima',
  'routine',
  'completed',
  'Inspección rutinaria completada sin observaciones',
  'Todas las áreas funcionando correctamente',
  'Continuar con el programa de mantenimiento preventivo',
  '["reporte_inspeccion.pdf", "fotos_inspeccion.zip"]'::jsonb
),
(
  '2024-01-20',
  'María González',
  'maria.gonzalez@sutran.gob.pe',
  'Sede Norte - Trujillo',
  'special',
  'pending',
  'Pendiente de programar',
  NULL,
  NULL,
  '[]'::jsonb
),
(
  '2024-01-25',
  'Carlos Rodríguez',
  'carlos.rodriguez@sutran.gob.pe',
  'Sede Sur - Arequipa',
  'follow_up',
  'completed',
  'Se encontraron algunas áreas que requieren mantenimiento',
  'Equipos de comunicación necesitan actualización',
  'Programar mantenimiento correctivo para la próxima semana',
  '["reporte_mantenimiento.pdf"]'::jsonb
);
