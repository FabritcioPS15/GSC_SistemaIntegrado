-- Add archived status to tickets table
-- This migration adds the 'archived' status to the status check constraint and adds tracking columns

-- 1. Add the archived status to the check constraint
ALTER TABLE public.tickets 
  DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE public.tickets 
  ADD CONSTRAINT tickets_status_check 
  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'archived'));

-- 2. Add tracking columns if they don't exist
ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_closed_at ON public.tickets(closed_at);

-- 4. Ensure RLS policies allow archived status
-- Drop existing policies and recreate with archived support
DROP POLICY IF EXISTS "Allow all select tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow all insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow all update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow all delete tickets" ON public.tickets;

CREATE POLICY "Allow all select tickets" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "Allow all insert tickets" ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update tickets" ON public.tickets FOR UPDATE USING (true);
CREATE POLICY "Allow all delete tickets" ON public.tickets FOR DELETE USING (true);
