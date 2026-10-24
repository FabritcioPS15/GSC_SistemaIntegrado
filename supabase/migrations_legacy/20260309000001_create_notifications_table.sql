-- Create notifications table
-- This migration creates the infrastructure for system notifications

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('ticket_created', 'ticket_attended', 'ticket_resolved', 'ticket_closed', 'sutran_visit_scheduled', 'sutran_visit_completed')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  location_name TEXT,
  target_role TEXT NOT NULL CHECK (target_role IN ('super_admin', 'gerencia', 'sistemas', 'supervisores', 'staff')),
  read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON public.notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id ON public.notifications(ticket_id);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies para notifications
DROP POLICY IF EXISTS "Users can view notifications for their role" ON public.notifications;
CREATE POLICY "Users can view notifications for their role" ON public.notifications
  FOR SELECT USING (
    target_role = (
      SELECT role FROM public.users 
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "Service insert notifications" ON public.notifications;
CREATE POLICY "Service insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE USING (
    target_role = (
      SELECT role FROM public.users 
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

-- Política adicional para permitir que cualquier usuario autenticado inserte notificaciones
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Función para limpiar notificaciones antiguas (opcional)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM public.notifications 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Comentario para documentación
COMMENT ON TABLE public.notifications IS 'Tabla para almacenar notificaciones del sistema';
COMMENT ON COLUMN public.notifications.type IS 'Tipo de notificación';
COMMENT ON COLUMN public.notifications.target_role IS 'Rol objetivo que recibirá la notificación';
COMMENT ON COLUMN public.notifications.read IS 'Indica si la notificación ha sido leída';
