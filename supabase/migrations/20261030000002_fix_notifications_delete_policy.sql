-- ═══════════════════════════════════════════════════════════════════════════
-- Permite eliminar notificaciones desde el frontend.
--
-- La app no usa Supabase Auth (opera con la llave anon), por lo que las
-- políticas basadas en auth.uid() no aplican. Se mantiene el mismo criterio
-- abierto que ya usa el resto de tablas de la aplicación.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
DROP POLICY IF EXISTS notifications_delete_allow_all ON public.notifications;

CREATE POLICY notifications_delete_allow_all ON public.notifications
    FOR DELETE TO anon, authenticated
    USING (true);

GRANT DELETE ON public.notifications TO anon, authenticated;
