-- Renombrar el tipo de activo "PC" a "EQUIPOS DE LÍNEA" para evitar confusión
-- con equipos como el computador del sonómetro
UPDATE asset_types
SET name = 'EQUIPOS DE LÍNEA'
WHERE name = 'PC';
