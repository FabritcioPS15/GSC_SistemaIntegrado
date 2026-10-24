-- Renombrar la categoría "Equipos Operativos" a "Equipos de Línea"
-- para que coincida con el nombre que usa el código (PATH_CATEGORY_MAP y Sidebar)
UPDATE categories
SET name = 'Equipos de Línea'
WHERE name = 'Equipos Operativos';
