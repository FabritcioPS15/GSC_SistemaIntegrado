-- ═══════════════════════════════════════════════════════════════════════════
-- Agrega la columna "categoria" a la tabla de flota vehicular.
-- Es opcional: las unidades existentes quedan con NULL hasta que se complete.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vehiculos
    ADD COLUMN IF NOT EXISTS categoria TEXT;

COMMENT ON COLUMN public.vehiculos.categoria IS
    'Categoría de la unidad de flota (ej. liviano, pesado, camioneta). Opcional.';

CREATE INDEX IF NOT EXISTS idx_vehiculos_categoria
    ON public.vehiculos(categoria);
