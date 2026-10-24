-- ═══════════════════════════════════════════════════════════════════════════
-- Cierre de exposure en tablas que el frontend no consulta
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Que hacer: activar RLS sin crear ninguna policy. Con RLS habilitado y cero
-- policies, ningun rol sin bypassrls (o sea, `anon` y `authenticated`) puede
-- leer ni escribir. La tabla sigue existiendo y las Edge Functions la siguen
-- viendo porque `service_role` tiene BYPASSRLS.
--
-- Que NO hacer y por que:
--
-- - `server_credentials` guarda credenciales de otros sistemas. Era la fuga mas
--   grave de la lista: con RLS desactivada, la clave anon del bundle permitia
--   leerla. Verificado que el frontend no la consulta (0 referencias en src/).
--   Las funciones que la necesitan corren server-side.
--
-- - `checklists` y `checklist_configs` quedaron huerfanas. El modulo de
--   checklist lee `checklist_responses`, `checklist_observaciones` y
--   `locations`; estas dos no aparecen en ningun `from(...)` de src/. Son
--   remanentes de un diseno anterior donde las plantillas vivian en la base.
--   No se borran aqui por si acaso, solo se dejan de exponer.
--
-- ── Lo que queda abierto a proposito, NO cerrar sin migracion ──
--
-- Estas tablas las usa el frontend con la clave anon y por ahora no tienen RLS:
-- users, cameras, camera_disks, mtc_accesos, sutran_visits, shipments,
-- ticket_assignments, requests, notifications.
--
-- La razon es una sola y es la causa raiz de todos los warnings del advisor:
-- la app no usa supabase.auth. El login compara la contrasena en el cliente
-- contra public.users (src/modules/auth/components/Login.tsx). Sin sesion de
-- Supabase Auth no hay auth.uid() contra el cual escribir una policy por
-- usuario, asi que cualquier policy seria falsa seguridad: el navegador
-- manda el id que quiera.
--
-- Cerrar eso requiere la funcion auth-login con service_role + mover las
-- lecturas de perfil a una vista sin la columna password. Es el paso 2.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.server_credentials enable row level security;

alter table public.checklist_configs enable row level security;

alter table public.checklists enable row level security;


-- ───────────────────────────────────────────────────────────────────────────
-- COMO VERIFICAR QUE QUEDO BIEN
--
-- Debe devolver 0 filas. Si devuelve filas, hay un rol con BYPASSRLS leyendo
-- la tabla y el cierre no sirvio.
--
--   select count(*) as filas_visibles
--   from public.server_credentials;
--
-- Para comprobar que RLS quedo activo:
--
--   select c.relname, c.relrowsecurity as rls_activo
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public'
--     and c.relname in ('server_credentials','checklist_configs','checklists')
--   order by c.relname;
--
-- Las tres deben decir rls_activo = true.
--
-- Para revertir este cambio, por si hiciera falta:
--
--   alter table public.server_credentials disable row level security;
-- ═──────────────────────────────────────────────────────────────────────────
