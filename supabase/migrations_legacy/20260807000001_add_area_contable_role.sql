-- Migration: Add 'area_contable' role to check_user_role constraint and update view
-- Created At: 2026-08-07

-- 1. Drop existing check constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_user_role;

-- 2. Re-create the constraint with 'area_contable'
ALTER TABLE public.users 
ADD CONSTRAINT check_user_role 
CHECK (role IN ('super_admin', 'gerencia', 'sistemas', 'supervisores', 'administradores', 'personalizado', 'area_legal', 'area_contable'));

-- 3. Update the description comment on role
COMMENT ON COLUMN public.users.role IS 'User role hierarchy: super_admin > gerencia > sistemas > supervisores > administradores > area_legal > area_contable > personalizado';

-- 4. Re-create the hierarchy view to include 'area_contable'
CREATE OR REPLACE VIEW user_role_hierarchy AS
SELECT 
    id,
    full_name,
    email,
    role,
    CASE role
        WHEN 'super_admin' THEN 1
        WHEN 'gerencia' THEN 2
        WHEN 'sistemas' THEN 3
        WHEN 'supervisores' THEN 4
        WHEN 'administradores' THEN 5
        WHEN 'area_legal' THEN 6
        WHEN 'area_contable' THEN 7
        WHEN 'personalizado' THEN 8
        ELSE 9
    END as role_level,
    status,
    created_at
FROM public.users
ORDER BY role_level, full_name;
