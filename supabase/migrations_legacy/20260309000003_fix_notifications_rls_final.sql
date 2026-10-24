-- Fix RLS policies for notifications table - Final version
-- This migration fixes authorization issues with notifications by properly updating existing policies

-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can view notifications for their role" ON public.notifications;
DROP POLICY IF EXISTS "Service insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

-- Create corrected policies with proper permissions
CREATE POLICY "Users can view notifications for their role" ON public.notifications
  FOR SELECT USING (
    target_role = (
      SELECT role FROM public.users 
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "Users can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE USING (
    target_role = (
      SELECT role FROM public.users 
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

-- Grant necessary permissions to authenticated users
GRANT SELECT ON public.notifications TO authenticated;
GRANT INSERT ON public.notifications TO authenticated;
GRANT UPDATE ON public.notifications TO authenticated;

-- Also grant to service role for system operations
GRANT SELECT ON public.notifications TO service_role;
GRANT INSERT ON public.notifications TO service_role;
GRANT UPDATE ON public.notifications TO service_role;

-- Verify permissions were granted
SELECT 
    table_name,
    privilege_type,
    grantee
FROM information_schema.role_table_grants 
WHERE table_name = 'notifications' 
    AND table_schema = 'public'
ORDER BY privilege_type;
