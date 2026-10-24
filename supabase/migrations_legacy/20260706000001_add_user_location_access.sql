-- Tabla para gestionar accesos múltiples de usuarios a sedes
-- Esto permite que un usuario tenga acceso a varias sedes, no solo una

CREATE TABLE IF NOT EXISTS user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  UNIQUE(user_id, location_id)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_location_id ON user_locations(location_id);

-- RLS (Row Level Security)
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- Política: Solo super_admin y gerencia pueden ver todos los accesos
CREATE POLICY "Super admins and gerencia can view all user locations"
  ON user_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'gerencia')
    )
  );

-- Política: Los usuarios pueden ver sus propios accesos
CREATE POLICY "Users can view their own location access"
  ON user_locations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Política: Solo super_admin y gerencia pueden insertar accesos
CREATE POLICY "Super admins and gerencia can insert user locations"
  ON user_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'gerencia')
    )
  );

-- Política: Solo super_admin y gerencia pueden eliminar accesos
CREATE POLICY "Super admins and gerencia can delete user locations"
  ON user_locations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'gerencia')
    )
  );

-- Migrar datos existentes: usuarios con location_id individual a la nueva tabla
INSERT INTO user_locations (user_id, location_id, created_by)
SELECT id, location_id, id
FROM users
WHERE location_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM user_locations
  WHERE user_locations.user_id = users.id
  AND user_locations.location_id = users.location_id
);

-- Comentario sobre la tabla
COMMENT ON TABLE user_locations IS 'Relación muchos-a-muchos entre usuarios y sedes para controlar accesos';
