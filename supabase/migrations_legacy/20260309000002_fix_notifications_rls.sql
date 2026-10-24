-- Fix RLS policies for notifications table
-- This migration fixes the authorization issues with notifications

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view notifications for their role" ON public.notifications;
DROP POLICY IF EXISTS "Service insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

-- Create corrected policies
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

-- Grant necessary permissions
GRANT SELECT ON public.notifications TO authenticated;
GRANT INSERT ON public.notifications TO authenticated;
GRANT UPDATE ON public.notifications TO authenticated;
