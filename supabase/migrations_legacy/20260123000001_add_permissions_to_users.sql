-- Add permissions column to users table
-- This migration adds support for custom permissions per user

-- Add the permissions column as a JSONB array
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS permissions TEXT[];

-- Add a comment to document the column
COMMENT ON COLUMN public.users.permissions IS 'Array of custom permission strings for this user. Takes priority over role-based permissions.';

-- Optional: Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_permissions ON public.users USING GIN (permissions);
