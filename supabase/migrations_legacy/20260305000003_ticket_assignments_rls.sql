-- Habilitar RLS con política simple y funcional
ALTER TABLE ticket_assignments ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can join tickets" ON ticket_assignments;
DROP POLICY IF EXISTS "Users can view assignments" ON ticket_assignments;

-- Política simple: Solo verificar que el usuario se asigne a sí mismo
CREATE POLICY "Users can join tickets" ON ticket_assignments
FOR INSERT TO public
WITH CHECK (auth.uid() = user_id);

-- Política para ver asignaciones
CREATE POLICY "Users can view assignments" ON ticket_assignments
FOR SELECT USING (user_id = auth.uid());
