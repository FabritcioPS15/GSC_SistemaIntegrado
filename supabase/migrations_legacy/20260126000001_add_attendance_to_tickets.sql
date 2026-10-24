-- Migration: Add attendance tracking and fix foreign keys
-- Ensure we reference public.users instead of auth.users

-- 1. Drop ALL OLD POLICIES that might depend on columns we want to alter
DROP POLICY IF EXISTS "Users can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can update their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone can read tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone can update tickets" ON public.tickets;

DROP POLICY IF EXISTS "Users can view all comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Users can insert comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Anyone can read ticket comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Anyone can create ticket comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Anyone can update ticket comments" ON public.ticket_comments;

-- 2. Correct the tickets table references
ALTER TABLE public.tickets 
  DROP CONSTRAINT IF EXISTS tickets_requester_id_fkey,
  DROP CONSTRAINT IF EXISTS tickets_assigned_to_fkey,
  DROP CONSTRAINT IF EXISTS tickets_location_id_fkey;

ALTER TABLE public.tickets
  ALTER COLUMN requester_id TYPE UUID,
  ALTER COLUMN assigned_to TYPE UUID,
  ALTER COLUMN location_id TYPE UUID,
  ADD CONSTRAINT tickets_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id),
  ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id),
  ADD CONSTRAINT tickets_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);

-- 3. Correct the ticket_comments table references
ALTER TABLE public.ticket_comments
  DROP CONSTRAINT IF EXISTS ticket_comments_user_id_fkey;

ALTER TABLE public.ticket_comments
  ALTER COLUMN user_id TYPE UUID,
  ADD CONSTRAINT ticket_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- 4. Add attended_at if it doesn't exist
ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_requester_id ON public.tickets(requester_id);

-- Enable RLS just in case it's not enabled
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- 5. Re-apply NEW global policies for transparency
CREATE POLICY "Anyone can read tickets" ON public.tickets
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create tickets" ON public.tickets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update tickets" ON public.tickets
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can read ticket comments" ON public.ticket_comments
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create ticket comments" ON public.ticket_comments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update ticket comments" ON public.ticket_comments
  FOR UPDATE USING (true);

-- 6. Enable Realtime for these tables
-- Run this if the tables are not already in the publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_comments;
