-- Migración para actualizar los tipos de visita en sutran_visits
-- Ejecutar en el SQL Editor de Supabase

-- 1. Eliminar la constraint CHECK existente primero
ALTER TABLE sutran_visits DROP CONSTRAINT IF EXISTS sutran_visits_visit_type_check;

-- 2. Actualizar los datos existentes con los nuevos tipos
UPDATE sutran_visits 
SET visit_type = CASE 
    WHEN visit_type = 'routine' THEN 'programada'
    WHEN visit_type = 'special' THEN 'no_programada'
    WHEN visit_type = 'emergency' THEN 'no_programada'
    WHEN visit_type = 'follow_up' THEN 'programada'
    WHEN visit_type = 'programadas' THEN 'programada'
    WHEN visit_type = 'no_programadas' THEN 'no_programada'
    WHEN visit_type = 'programa' THEN 'programada'
    WHEN visit_type = 'no_programa' THEN 'no_programada'
    WHEN visit_type = 'de_gabinete' THEN 'de_gabinete'
    ELSE 'programada'
END;

-- 3. Agregar nueva constraint CHECK con los nuevos tipos (femenino singular)
ALTER TABLE sutran_visits 
ADD CONSTRAINT sutran_visits_visit_type_check 
CHECK (visit_type IN ('programada', 'no_programada', 'de_gabinete'));

-- 4. Verificar que los cambios se aplicaron correctamente
SELECT 
    visit_type,
    COUNT(*) as cantidad
FROM sutran_visits 
GROUP BY visit_type
ORDER BY visit_type;

-- 5. Verificar la estructura de la tabla
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sutran_visits' 
AND column_name = 'visit_type';

-- 6. Mostrar algunos registros de ejemplo
SELECT 
    id,
    visit_date,
    inspector_name,
    visit_type,
    status
FROM sutran_visits 
ORDER BY created_at DESC
LIMIT 5;
