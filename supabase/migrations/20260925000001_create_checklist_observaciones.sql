-- ═══════════════════════════════════════════════════════════
-- OBSERVACIONES DE CHECKLIST RECIBIDAS DESDE GOOGLE SHEETS
--
-- El Apps Script "Sistema Centralizado Multisede - ESCON" lee los
-- bloques de comentarios del checklist (celdas combinadas) y los
-- empuja vía la Edge Function `checklist-ingest`.
--
-- Cada fila = 1 sección con comentario, belonging a 1 sede + 1 fecha.
-- Las secciones SIN comentario no se envían (queda fuera del reporte).
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.checklist_observaciones (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sede        text        NOT NULL,
    fecha       date        NOT NULL DEFAULT current_date,
    bloque      text        NOT NULL DEFAULT 'COMENTARIOS',
    seccion     text        NOT NULL,
    comentario  text        NOT NULL,
    origen      text        NOT NULL DEFAULT 'google-apps-script',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Idempotencia: reenviar el mismo checklist desde la misma sede/fecha
-- no duplica filas, sobrescribe las anteriores.
CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_observaciones_unico
    ON public.checklist_observaciones (sede, fecha, bloque, seccion);

CREATE INDEX IF NOT EXISTS idx_checklist_observaciones_fecha
    ON public.checklist_observaciones (fecha DESC);

CREATE INDEX IF NOT EXISTS idx_checklist_observaciones_sede
    ON public.checklist_observaciones (sede);

-- Mantener updated_at al hacer upsert desde la Edge Function.
CREATE OR REPLACE FUNCTION public.touch_checklist_observaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_checklist_observaciones_updated_at
    ON public.checklist_observaciones;

CREATE TRIGGER trg_checklist_observaciones_updated_at
    BEFORE UPDATE ON public.checklist_observaciones
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_checklist_observaciones_updated_at();

-- ═══════════════════════════════════════════════════════════
-- RLS
--
-- - SELECT: cualquier usuario autenticado puede leer (la app los muestra).
-- - INSERT/UPDATE/DELETE: SIN políticas. Únicamente la Edge Function
--   escribe, y lo hace con la service role key, que ignora RLS.
--   Así nadie desde el navegador puede inyectar observaciones falsas.
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.checklist_observaciones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'checklist_observaciones'
          AND policyname = 'checklist_observaciones_select_authenticated'
    ) THEN
        CREATE POLICY checklist_observaciones_select_authenticated
            ON public.checklist_observaciones
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END $$;
