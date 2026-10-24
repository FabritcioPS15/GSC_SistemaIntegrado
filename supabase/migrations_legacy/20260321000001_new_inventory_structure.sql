-- Migration: New Inventory Structure
-- Description: Creates categories, subcategories, areas, and movements tables. Updates assets with new fields.

-- 1. Create Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, name)
);

-- 3. Create Areas table
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(location_id, name)
);

-- 4. Create Inventory Movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'entry', 'exit', 'transfer', 'maintenance', 'adjustment'
    origin_location_id UUID REFERENCES locations(id),
    origin_area_id UUID REFERENCES areas(id),
    destination_location_id UUID REFERENCES locations(id),
    destination_area_id UUID REFERENCES areas(id),
    quantity INTEGER DEFAULT 1,
    reason TEXT,
    performed_by UUID REFERENCES auth.users(id),
    movement_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Add new columns to assets
ALTER TABLE assets ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS codigo_unico TEXT UNIQUE;

-- 6. Insert initial Categories
INSERT INTO categories (name) VALUES
('Equipos de Cómputo y TI'),
('Equipos Biométricos y Control'),
('Equipos Médicos'),
('Mobiliario'),
('Seguridad'),
('Útiles de Oficina')
ON CONFLICT (name) DO NOTHING;

-- 7. Insert Subcategories for Equipos de Cómputo y TI
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE name = 'Equipos de Cómputo y TI';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name) VALUES
        (cat_id, 'Computadoras (CPU)'),
        (cat_id, 'Monitores'),
        (cat_id, 'Laptops'),
        (cat_id, 'Teclados'),
        (cat_id, 'Mouse'),
        (cat_id, 'Impresoras'),
        (cat_id, 'Impresoras multifuncionales'),
        (cat_id, 'Estabilizadores'),
        (cat_id, 'Proyectores'),
        (cat_id, 'Audio (parlantes y micrófonos)'),
        (cat_id, 'Redes (router y DVR)'),
        (cat_id, 'Cámaras'),
        (cat_id, 'Accesorios TI')
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- 8. Insert Subcategories for Equipos Biométricos y Control
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE name = 'Equipos Biométricos y Control';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name) VALUES
        (cat_id, 'Biométricos'),
        (cat_id, 'Control de huella'),
        (cat_id, 'Accesorios biométricos (tampón y tampón de huella)')
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- 9. Insert Subcategories for Equipos Médicos (including Laboratorio and Evaluación Técnica)
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE name = 'Equipos Médicos';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name) VALUES
        (cat_id, 'Diagnóstico general'),
        (cat_id, 'Equipos de medición'),
        (cat_id, 'Equipos clínicos'),
        (cat_id, 'Equipos de oftalmología'),
        (cat_id, 'Equipos de otorrinolaringología'),
        (cat_id, 'Equipos psicotécnicos'),
        (cat_id, 'Instrumentos médicos'),
        -- Laboratorio sub-division as subcategories
        (cat_id, 'Laboratorio - Equipos de análisis'),
        (cat_id, 'Laboratorio - Equipos de esterilización'),
        (cat_id, 'Laboratorio - Equipos de muestras'),
        (cat_id, 'Laboratorio - Equipos ópticos'),
        -- Evaluación Técnica sub-division as subcategories
        (cat_id, 'Evaluación Técnica - Equipos de evaluación visual'),
        (cat_id, 'Evaluación Técnica - Equipos de evaluación auditiva'),
        (cat_id, 'Evaluación Técnica - Equipos psicotécnicos'),
        (cat_id, 'Evaluación Técnica - Equipos de simulación o pruebas')
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- 10. Insert Subcategories for Mobiliario (including Infraestructura y Servicios)
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE name = 'Mobiliario';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name) VALUES
        (cat_id, 'Escritorios'),
        (cat_id, 'Mesas'),
        (cat_id, 'Sillas'),
        (cat_id, 'Estantes'),
        (cat_id, 'Armarios'),
        (cat_id, 'Muebles de archivo'),
        (cat_id, 'Módulos'),
        (cat_id, 'Biombos'),
        -- Infraestructura y Servicios sub-division as subcategories
        (cat_id, 'Infraestructura - Refrigeración'),
        (cat_id, 'Infraestructura - Lavaderos'),
        (cat_id, 'Infraestructura - Instalaciones de agua'),
        (cat_id, 'Infraestructura - Dispensadores'),
        (cat_id, 'Infraestructura - Ventilación'),
        (cat_id, 'Infraestructura - Instalaciones del local')
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- 11. Insert Subcategories for Seguridad
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE name = 'Seguridad';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name) VALUES
        (cat_id, 'Extintores'),
        (cat_id, 'Detectores de humo'),
        (cat_id, 'Luces de emergencia'),
        (cat_id, 'Botiquines'),
        (cat_id, 'Seguridad electrónica (cámaras)')
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- 12. Insert Subcategories for Útiles de Oficina
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE name = 'Útiles de Oficina';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name) VALUES
        (cat_id, 'Herramientas de oficina'),
        (cat_id, 'Organización de escritorio'),
        (cat_id, 'Papelería'),
        (cat_id, 'Accesorios')
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- 13. Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- 14. Support generated unique codes for existing assets
UPDATE assets SET codigo_unico = 'ACT-' || LPAD(floor(random() * 1000000)::text, 6, '0') WHERE codigo_unico IS NULL;

-- 15. Create default area for each location to avoid nulls during migration
INSERT INTO areas (location_id, name)
SELECT id, 'General' FROM locations
ON CONFLICT (location_id, name) DO NOTHING;

-- 16. Grant access to all authenticated users
CREATE POLICY "Allow all for authenticated" ON categories FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON subcategories FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON areas FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON inventory_movements FOR ALL TO authenticated USING (true);
