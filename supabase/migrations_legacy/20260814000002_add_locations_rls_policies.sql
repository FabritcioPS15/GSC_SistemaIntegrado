-- ═══════════════════════════════════════════════
-- RLS POLICIES PARA locations (idempotente)
--
-- Problema: eliminar/desactivar una sede devuelve éxito pero no afecta filas,
-- porque la tabla locations tiene RLS habilitado sin políticas que permitan
-- DELETE/UPDATE al rol authenticated.
--
-- Solución: replicar el patrón usado en categories/subcategories
-- (locations_allow_all_authenticated -> FOR ALL TO authenticated).
-- ═══════════════════════════════════════════════
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'locations'
          AND policyname = 'locations_allow_all_authenticated'
    ) THEN
        CREATE POLICY locations_allow_all_authenticated
            ON public.locations
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
