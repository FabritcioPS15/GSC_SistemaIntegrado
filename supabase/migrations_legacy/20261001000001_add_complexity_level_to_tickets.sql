-- =============================================================================
-- Clasificación de complejidad técnica (N1 / N2 / N3) para la Mesa de Ayuda
--
-- `priority` define la URGENCIA del caso y por ende el SLA de respuesta.
-- `complexity_level` define la COMPLEJIDAD TÉCNICA del caso, es decir, el tipo de
-- soporte requerido (soporte básico, soporte técnico o soporte especializado).
-- Ambos ejes son ortogonales: un ticket puede ser urgente (P1) y simple (N1).
--
-- Niveles (solo para category = 'sistemas'):
--   N1 - Soporte básico: casos conocidos, repetitivos y con procedimiento definido.
--   N2 - Soporte técnico: requieren diagnóstico técnico e intervención remota o presencial.
--   N3 - Soporte especializado: intervención avanzada, infraestructura,
--        administración de sistemas o participación de proveedores.
--
-- El nivel es escalable: durante la atención puede subir de N1 a N2/N3 si el
-- diagnóstico revela una intervención de mayor nivel.
--
-- La columna es NULLABLE a propósito: los tickets preexistentes y los de otras
-- áreas (contable, legal, operaciones) no se clasifican, y el técnico puede dejar
-- el caso sin clasificar hasta que determine su complejidad real.
-- =============================================================================

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS complexity_level text;

COMMENT ON COLUMN tickets.complexity_level IS
    'Nivel de complejidad técnica del caso: N1 (soporte básico), N2 (soporte técnico), N3 (soporte especializado). Solo aplica a category = ''sistemas''. Complementa a priority, que define la urgencia.';

-- Restricción de dominio: solo se admiten los tres niveles definidos
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_complexity_level_check;

ALTER TABLE tickets
    ADD CONSTRAINT tickets_complexity_level_check
        CHECK (complexity_level IS NULL OR complexity_level IN ('N1', 'N2', 'N3'));

-- Índices para el filtrado por nivel en el dashboard, el historial y los reportes
CREATE INDEX IF NOT EXISTS idx_tickets_complexity_level
    ON tickets (complexity_level);

CREATE INDEX IF NOT EXISTS idx_tickets_category_complexity_level
    ON tickets (category, complexity_level);

-- Recarga inmediata del cache de esquema de PostgREST.
-- Sin esto la API puede seguir respondiendo
-- "Could not find the 'complexity_level' column of 'tickets' in the schema cache"
-- hasta que expire la caché (~1 min) o se reinicie el proyecto.
NOTIFY pgrst, 'reload schema';

-- NOTA: esta migración NO modifica ninguna fila existente. Los tickets previos
-- quedan con complexity_level = NULL y la UI los muestra como "Sin clasificar"
-- hasta que un técnico los clasifique durante la atención.
