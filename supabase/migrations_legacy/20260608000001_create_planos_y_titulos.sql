-- Migration: Create Planos de Defensa Civil and Títulos Habilitantes tables

-- 1. Create planos_defensa_civil table
CREATE TABLE IF NOT EXISTS public.planos_defensa_civil (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre text NOT NULL,
    tipo text NOT NULL,
    ubicacion_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
    fecha_actualizacion date NOT NULL,
    estado text CHECK (estado IN ('vigente', 'actualizado', 'pendiente')) DEFAULT 'vigente',
    descripcion text,
    archivo_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create titulos_habilitantes table
CREATE TABLE IF NOT EXISTS public.titulos_habilitantes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo text NOT NULL,
    tipo text NOT NULL,
    numero text NOT NULL,
    fecha_emision date,
    fecha_vencimiento date NOT NULL,
    ubicacion_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
    estado text CHECK (estado IN ('vigente', 'por_vencer', 'vencido')) DEFAULT 'vigente',
    notas text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security (RLS)
ALTER TABLE public.planos_defensa_civil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titulos_habilitantes ENABLE ROW LEVEL SECURITY;

-- Policies for planos_defensa_civil
CREATE POLICY "Enable read access for all authenticated users" ON public.planos_defensa_civil
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.planos_defensa_civil
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.planos_defensa_civil
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON public.planos_defensa_civil
    FOR DELETE TO authenticated USING (true);

-- Policies for titulos_habilitantes
CREATE POLICY "Enable read access for all authenticated users" ON public.titulos_habilitantes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.titulos_habilitantes
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.titulos_habilitantes
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON public.titulos_habilitantes
    FOR DELETE TO authenticated USING (true);

-- Trigger to update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_planos_defensa_civil_updated_at
    BEFORE UPDATE ON public.planos_defensa_civil
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_titulos_habilitantes_updated_at
    BEFORE UPDATE ON public.titulos_habilitantes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
