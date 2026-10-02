-- ═══════════════════════════════════════════════════════════════
-- Soft-delete para checklist_observaciones
--
-- Los comentarios que ya se revisaron se archivan en vez de borrarse:
-- si alguien eliminó de más, el dato sigue en la base y se puede
-- recuperar. Mismo criterio que el status 'archived' de tickets
-- (20260304000001_add_archived_status.sql).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.checklist_observaciones
  ADD COLUMN IF NOT EXISTS archivado boolean NOT NULL DEFAULT false;

-- La pantalla filtra por archivado en casi todas las consultas, así que
-- un índice parcial rinde mejor que uno entero: solo cubre las filas
-- vivas, que son las que se listan siempre.
CREATE INDEX IF NOT EXISTS idx_checklist_observaciones_vivas
  ON public.checklist_observaciones (fecha DESC, sede)
  WHERE archivado = false;

-- RLS: hasta acá solo había policy de SELECT, así que el UPDATE que hace
-- la app al archivar devolvería 0 filas sin error. Mismo criterio que el
-- resto de la app: la política va a anon porque el login es propio y nunca
-- abre sesión de Supabase Auth, así que el rol real de cada petición es anon.
DROP POLICY IF EXISTS "checklist_observaciones_update_anon" ON public.checklist_observaciones;

CREATE POLICY "checklist_observaciones_update_anon"
  ON public.checklist_observaciones
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- La pantalla también ofrece borrado definitivo (además de archivar).
-- Sin esta policy el DELETE devolvía 0 filas sin error, igual que el SELECT
-- antes de que se lo abriera a anon.
DROP POLICY IF EXISTS "checklist_observaciones_delete_anon" ON public.checklist_observaciones;

CREATE POLICY "checklist_observaciones_delete_anon"
  ON public.checklist_observaciones
  FOR DELETE
  TO anon, authenticated
  USING (true);
