-- Actualizar la restricción (check constraint) de categorías para los tickets
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_category_check;

-- Añadir las nuevas categorías utilizadas en el frontend y mantener las anteriores por compatibilidad
ALTER TABLE tickets ADD CONSTRAINT tickets_category_check 
CHECK (category IN (
    'hardware', 
    'software', 
    'network', 
    'access', 
    'other', 
    'sistemas', 
    'contable', 
    'legal', 
    'operaciones'
));
