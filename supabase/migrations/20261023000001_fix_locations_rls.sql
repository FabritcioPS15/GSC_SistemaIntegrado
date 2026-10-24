-- ═══════════════════════════════════════════════════════════════════
-- Corregir RLS para la tabla `locations`
--
-- Causa del error: "new row violates row-level security policy for table locations"
-- La aplicación no utiliza Supabase Auth (auth.users), sino autenticación
-- propia contra la tabla public.users. Por lo tanto, el cliente Supabase
-- en el frontend realiza todas las peticiones con el rol `anon`.
--
-- Al haber habilitado RLS sin una política permissiva para `anon`
-- (o solo para `authenticated`), los INSERTs y UPDATEs son bloqueados.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas previas restrictivas o duplicadas
DROP POLICY IF EXISTS "locations_allow_all" ON public.locations;
DROP POLICY IF EXISTS "locations_allow_all_authenticated" ON public.locations;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.locations;
DROP POLICY IF EXISTS "locations_insert_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_update_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_delete_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_select_policy" ON public.locations;

-- Crear política completa para anon y authenticated
CREATE POLICY "locations_allow_all"
    ON public.locations
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
