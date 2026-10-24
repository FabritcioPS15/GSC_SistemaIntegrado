-- =============================================================
-- Habilitar RLS en todas las tablas que lo necesitan
-- =============================================================

-- 1. Habilitar RLS en tablas críticas (con datos sensibles)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- 2. Habilitar RLS en tablas principales del sistema
ALTER TABLE public.asset_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camera_disks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- Políticas RLS para tablas críticas (solo authenticated)
-- =============================================================

-- Users: solo authenticated pueden leer/escribir (no anonymous)
DROP POLICY IF EXISTS "Users: Allow all for authenticated" ON public.users;
CREATE POLICY "Users: Allow all for authenticated" ON public.users
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Servers: solo authenticated
DROP POLICY IF EXISTS "Servers: Allow all for authenticated" ON public.servers;
CREATE POLICY "Servers: Allow all for authenticated" ON public.servers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Cameras: solo authenticated
DROP POLICY IF EXISTS "Cameras: Allow all for authenticated" ON public.cameras;
CREATE POLICY "Cameras: Allow all for authenticated" ON public.cameras
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Assets: solo authenticated
DROP POLICY IF EXISTS "Assets: Allow all for authenticated" ON public.assets;
CREATE POLICY "Assets: Allow all for authenticated" ON public.assets
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Asset types: solo authenticated
DROP POLICY IF EXISTS "Asset types: Allow all for authenticated" ON public.asset_types;
CREATE POLICY "Asset types: Allow all for authenticated" ON public.asset_types
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Maintenance records: solo authenticated
DROP POLICY IF EXISTS "Maintenance records: Allow all for authenticated" ON public.maintenance_records;
CREATE POLICY "Maintenance records: Allow all for authenticated" ON public.maintenance_records
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Shipments: solo authenticated
DROP POLICY IF EXISTS "Shipments: Allow all for authenticated" ON public.shipments;
CREATE POLICY "Shipments: Allow all for authenticated" ON public.shipments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Audit logs: solo authenticated
DROP POLICY IF EXISTS "Audit logs: Allow all for authenticated" ON public.audit_logs;
CREATE POLICY "Audit logs: Allow all for authenticated" ON public.audit_logs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Camera disks: solo authenticated
DROP POLICY IF EXISTS "Camera disks: Allow all for authenticated" ON public.camera_disks;
CREATE POLICY "Camera disks: Allow all for authenticated" ON public.camera_disks
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- User registration requests: solo authenticated
DROP POLICY IF EXISTS "User registration requests: Allow all for authenticated" ON public.user_registration_requests;
CREATE POLICY "User registration requests: Allow all for authenticated" ON public.user_registration_requests
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Branch audits: solo authenticated
DROP POLICY IF EXISTS "Branch audits: Allow all for authenticated" ON public.branch_audits;
CREATE POLICY "Branch audits: Allow all for authenticated" ON public.branch_audits
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Vehicle types: solo authenticated
DROP POLICY IF EXISTS "Vehicle types: Allow all for authenticated" ON public.vehicle_types;
CREATE POLICY "Vehicle types: Allow all for authenticated" ON public.vehicle_types
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
