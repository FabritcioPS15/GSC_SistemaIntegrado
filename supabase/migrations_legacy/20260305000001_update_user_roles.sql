-- Migration: Update user roles structure
-- This migration establishes the new role hierarchy:
-- 1. super_admin (exclusive, single person)
-- 2. gerencia (management)
-- 3. sistemas (systems)
-- 4. supervisores (supervisors)
-- 5. administradores (regular admins)
-- 6. personalizado (custom permissions)

-- First, let's see what roles currently exist
-- DO $$ DECLARE
--   existing_roles TEXT[];
-- BEGIN
--   SELECT ARRAY_AGG(DISTINCT role) INTO existing_roles FROM public.users WHERE role IS NOT NULL;
--   RAISE NOTICE 'Existing roles: %', existing_roles;
-- END $$;

-- Update existing roles to new structure
UPDATE public.users SET role = 'super_admin' WHERE role IN ('super_admin', 'root', 'owner');
UPDATE public.users SET role = 'gerencia' WHERE role IN ('management', 'gerencia', 'manager');
UPDATE public.users SET role = 'sistemas' WHERE role IN ('systems', 'system', 'it', 'admin');
UPDATE public.users SET role = 'supervisores' WHERE role IN ('supervisor', 'supervisores', 'lead');
UPDATE public.users SET role = 'administradores' WHERE role IN ('admin', 'administrator', 'user');
UPDATE public.users SET role = 'personalizado' WHERE role IN ('custom', 'personalizado', 'other');

-- Add constraint to ensure only valid roles
-- Drop the constraint first if it exists, then add it
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_user_role;
ALTER TABLE public.users 
ADD CONSTRAINT check_user_role 
CHECK (role IN ('super_admin', 'gerencia', 'sistemas', 'supervisores', 'administradores', 'personalizado'));

-- Add comment to document the role hierarchy
COMMENT ON COLUMN public.users.role IS 'User role hierarchy: super_admin > gerencia > sistemas > supervisores > administradores > personalizado';

-- Create function to check if there's already a super_admin
CREATE OR REPLACE FUNCTION check_super_admin_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'super_admin' THEN
        -- Check if there's already a super_admin (excluding current user if updating)
        IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.role != 'super_admin') THEN
            IF EXISTS (SELECT 1 FROM public.users WHERE role = 'super_admin' AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
                RAISE EXCEPTION 'Solo puede existir un usuario con el rol Super Administrador';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce super_admin limit
DROP TRIGGER IF EXISTS enforce_super_admin_limit ON public.users;
CREATE TRIGGER enforce_super_admin_limit
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION check_super_admin_limit();

-- Create index for better role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);

-- Optional: Create a view for role hierarchy
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
        WHEN 'personalizado' THEN 6
        ELSE 7
    END as role_level,
    status,
    created_at
FROM public.users
ORDER BY role_level, full_name;
