-- ═══════════════════════════════════════════════════════════
-- VINCULA LAS OBSERVACIONES CON SU SEDE REAL (location_id)
--
-- El Apps Script manda el nombre de la hoja como texto ("ESCON MBS ATE").
-- Ese texto no es FK a locations.id, así que el filtro por sede en la app
-- dependía de comparar nombres normalizados: si la hoja y la sede no se
-- llamaban exactamente igual, el supervisor no veía nada.
--
-- La Edge Function `checklist-ingest` ahora resuelve el nombre contra
-- `locations` y guarda el uuid. location_id queda NULL si no encuentra
-- coincidencia (sede mal nombrada en el Excel) — el super admin igual la ve.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.checklist_observaciones
    ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_checklist_observaciones_location
    ON public.checklist_observaciones (location_id);

-- Reportes por sede sin recorrer la tabla entera
CREATE INDEX IF NOT EXISTS idx_checklist_observaciones_sede_fecha
    ON public.checklist_observaciones (sede, fecha DESC);
