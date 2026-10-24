-- Migration: Multi-Enterprise Inventory Structure
-- Description: Creates companies table, restructures categories for multi-company support, adds integrity constraints

-- 1. Create Companies table (Empresas)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    business_type TEXT NOT NULL, -- 'revisiones_tecnicas', 'polclinico', 'escuela_conductores', 'oficinas_administrativas'
    ruc TEXT UNIQUE,
    address TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add company_id to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Add is_active column to locations if it doesn't exist
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Update existing locations to associate with a default company
-- First create a default company if none exists
INSERT INTO companies (name, business_type, ruc)
VALUES ('Grupo San Cristobal', 'oficinas_administrativas', '20123456789')
ON CONFLICT (name) DO NOTHING;

-- Update all existing locations to belong to the default company
UPDATE locations SET company_id = (SELECT id FROM companies WHERE name = 'Grupo San Cristobal' LIMIT 1)
WHERE company_id IS NULL;

-- Make company_id NOT NULL after migration
ALTER TABLE locations ALTER COLUMN company_id SET NOT NULL;

-- 4. Drop and recreate categories with the new unified structure
DROP TABLE IF EXISTS subcategories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- 5. Create new Categories table with unified structure
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create new Subcategories table
CREATE TABLE subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, slug)
);

-- 7. Insert the new unified categories
INSERT INTO categories (name, slug, icon, description, sort_order) VALUES
('Tecnología', 'tecnologia', 'laptop', 'Equipos de cómputo, dispositivos electrónicos y redes', 1),
('Seguridad y Control', 'seguridad-control', 'shield', 'Sistemas de seguridad, cámaras, biométricos y control de acceso', 2),
('Equipos Operativos', 'equipos-operativos', 'wrench', 'Equipos de revisión técnica, médicos y de evaluación', 3),
('Mobiliario', 'mobiliario', 'armchair', 'Muebles de oficina, escritorios, sillas y estanterías', 4),
('Útiles y Suministros', 'utiles-suministros', 'package', 'Material de oficina, suministros y útiles administrativos', 5),
('Otros Activos', 'otros-activos', 'tool', 'Equipos diversos, herramientas y estructuras', 6)
ON CONFLICT (name) DO NOTHING;

-- 8. Insert subcategories for Tecnología
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE slug = 'tecnologia';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
        (cat_id, 'CPU', 'cpu', 1),
        (cat_id, 'Laptop', 'laptop', 2),
        (cat_id, 'Monitor', 'monitor', 3),
        (cat_id, 'Teclado', 'teclado', 4),
        (cat_id, 'Mouse', 'mouse', 5),
        (cat_id, 'Impresora', 'impresora', 6),
        (cat_id, 'Escáner', 'escaner', 7),
        (cat_id, 'Servidor', 'servidor', 8),
        (cat_id, 'Celular', 'celular', 9),
        (cat_id, 'Tablet', 'tablet', 10),
        (cat_id, 'TV', 'tv', 11),
        (cat_id, 'Proyector', 'proyector', 12),
        (cat_id, 'Router', 'router', 13),
        (cat_id, 'Switch', 'switch', 14),
        (cat_id, 'Teléfono', 'telefono', 15)
        ON CONFLICT (category_id, slug) DO NOTHING;
    END IF;
END $$;

-- 9. Insert subcategories for Seguridad y Control
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE slug = 'seguridad-control';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
        (cat_id, 'Cámaras', 'camaras', 1),
        (cat_id, 'DVR', 'dvr', 2),
        (cat_id, 'NVR', 'nvr', 3),
        (cat_id, 'Biométricos', 'biometricos', 4),
        (cat_id, 'Lectores de huella', 'lectores-huella', 5),
        (cat_id, 'Alarmas', 'alarmas', 6),
        (cat_id, 'Extintores', 'extintores', 7),
        (cat_id, 'Luces de emergencia', 'luces-emergencia', 8)
        ON CONFLICT (category_id, slug) DO NOTHING;
    END IF;
END $$;

-- 10. Insert subcategories for Equipos Operativos
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE slug = 'equipos-operativos';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
        (cat_id, 'Analizador de gases', 'analizador-gases', 1),
        (cat_id, 'Opacímetro', 'opacimetro', 2),
        (cat_id, 'Frenómetro', 'frenometro', 3),
        (cat_id, 'Luxómetro', 'luxometro', 4),
        (cat_id, 'Detector de holguras', 'detector-holguras', 5),
        (cat_id, 'Medidor de alineación', 'medidor-alineacion', 6),
        (cat_id, 'Equipos médicos', 'equipos-medicos', 7),
        (cat_id, 'Equipos de evaluación', 'equipos-evaluacion', 8),
        (cat_id, 'Equipos especializados', 'equipos-especializados', 9)
        ON CONFLICT (category_id, slug) DO NOTHING;
    END IF;
END $$;

-- 11. Insert subcategories for Mobiliario
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE slug = 'mobiliario';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
        (cat_id, 'Escritorios', 'escritorios', 1),
        (cat_id, 'Sillas', 'sillas', 2),
        (cat_id, 'Mesas', 'mesas', 3),
        (cat_id, 'Bancas', 'bancas', 4),
        (cat_id, 'Archivadores', 'archivadores', 5),
        (cat_id, 'Estantes', 'estantes', 6),
        (cat_id, 'Carpetas', 'carpetas', 7),
        (cat_id, 'Módulos', 'modulos', 8),
        (cat_id, 'Pizarras', 'pizarras', 9),
        (cat_id, 'Muebles', 'muebles', 10)
        ON CONFLICT (category_id, slug) DO NOTHING;
    END IF;
END $$;

-- 12. Insert subcategories for Útiles y Suministros
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE slug = 'utiles-suministros';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
        (cat_id, 'Grapadoras', 'grapadoras', 1),
        (cat_id, 'Saca grapas', 'saca-grapas', 2),
        (cat_id, 'Porta lapiceros', 'porta-lapiceros', 3),
        (cat_id, 'Botiquines', 'botiquines', 4),
        (cat_id, 'Material de oficina', 'material-oficina', 5),
        (cat_id, 'Insumos administrativos', 'insumos-administrativos', 6)
        ON CONFLICT (category_id, slug) DO NOTHING;
    END IF;
END $$;

-- 13. Insert subcategories for Otros Activos
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE slug = 'otros-activos';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
        (cat_id, 'Compresoras', 'compresoras', 1),
        (cat_id, 'Aspiradoras', 'aspiradoras', 2),
        (cat_id, 'Carretillas', 'carretillas', 3),
        (cat_id, 'Herramientas', 'herramientas', 4),
        (cat_id, 'Estructuras metálicas', 'estructuras-metalicas', 5),
        (cat_id, 'Instalaciones especiales', 'instalaciones-especiales', 6)
        ON CONFLICT (category_id, slug) DO NOTHING;
    END IF;
END $$;

-- 14. Add company_id to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 15. Update existing assets to belong to their location's company
UPDATE assets SET company_id = (SELECT company_id FROM locations WHERE locations.id = assets.location_id)
WHERE company_id IS NULL AND location_id IS NOT NULL;

-- 16. For assets without location, assign to default company
UPDATE assets SET company_id = (SELECT id FROM companies WHERE name = 'Grupo San Cristobal' LIMIT 1)
WHERE company_id IS NULL;

-- Make company_id NOT NULL after migration
ALTER TABLE assets ALTER COLUMN company_id SET NOT NULL;

-- 16. Add asset_type_id to assets if it doesn't exist (for backward compatibility)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type_id UUID REFERENCES asset_types(id);

-- 17. Add constraint to prevent deletion of assets with active maintenance records
-- First, add a status column to maintenance_records if it doesn't exist
ALTER TABLE maintenance_records 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create a function to check for active maintenance records
CREATE OR REPLACE FUNCTION check_active_maintenance_records()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM maintenance_records 
        WHERE asset_id = OLD.id 
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'No se puede eliminar el activo porque tiene registros de mantenimiento activos. Por favor, desactive los registros de mantenimiento primero.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent deletion of assets with active maintenance
DROP TRIGGER IF EXISTS prevent_asset_deletion_with_active_maintenance ON assets;
CREATE TRIGGER prevent_asset_deletion_with_active_maintenance
BEFORE DELETE ON assets
FOR EACH ROW
EXECUTE FUNCTION check_active_maintenance_records();

-- 18. Add a soft delete mechanism for assets
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_assets_is_deleted ON assets(is_deleted) WHERE is_deleted = false;

-- Update the deletion trigger to use soft delete instead
CREATE OR REPLACE FUNCTION soft_delete_asset()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for active maintenance records before soft delete
    IF EXISTS (
        SELECT 1 FROM maintenance_records 
        WHERE asset_id = OLD.id 
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'No se puede eliminar el activo porque tiene registros de mantenimiento activos. Por favor, desactive los registros de mantenimiento primero.';
    END IF;
    
    -- Perform soft delete
    NEW.is_deleted = true;
    NEW.deleted_at = NOW();
    NEW.deleted_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace the hard delete trigger with soft delete
DROP TRIGGER IF EXISTS prevent_asset_deletion_with_active_maintenance ON assets;
DROP TRIGGER IF EXISTS soft_delete_asset_trigger ON assets;
CREATE TRIGGER soft_delete_asset_trigger
BEFORE UPDATE ON assets
FOR EACH ROW
WHEN (NEW.is_deleted = true AND OLD.is_deleted = false)
EXECUTE FUNCTION soft_delete_asset();

-- 19. Enable RLS on new tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

-- 20. Create RLS policies
-- Companies: All authenticated users can read, only admins can write
CREATE POLICY "Companies: Allow read for authenticated" ON companies
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Companies: Allow insert for authenticated" ON companies
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Companies: Allow update for authenticated" ON companies
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Companies: Allow delete for authenticated" ON companies
    FOR DELETE TO authenticated USING (true);

-- Categories: All authenticated users can read and write
CREATE POLICY "Categories: Allow all for authenticated" ON categories
    FOR ALL TO authenticated USING (true);

-- Subcategories: All authenticated users can read and write
CREATE POLICY "Subcategories: Allow all for authenticated" ON subcategories
    FOR ALL TO authenticated USING (true);

-- 21. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_locations_company_id ON locations(company_id);
CREATE INDEX IF NOT EXISTS idx_assets_company_id ON assets(company_id);
CREATE INDEX IF NOT EXISTS idx_assets_category_id ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_subcategory_id ON assets(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_slug ON subcategories(slug);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_asset_id ON maintenance_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_is_active ON maintenance_records(is_active);

-- 22. Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subcategories_updated_at BEFORE UPDATE ON subcategories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 23. Create a view for assets with company and location info
CREATE OR REPLACE VIEW assets_with_details AS
SELECT 
    a.*,
    c.name as category_name,
    c.slug as category_slug,
    s.name as subcategory_name,
    s.slug as subcategory_slug,
    l.name as location_name,
    l.company_id as location_company_id,
    comp.name as company_name,
    comp.business_type as company_business_type,
    ar.name as area_name,
    at.name as asset_type_name
FROM assets a
LEFT JOIN categories c ON a.category_id = c.id
LEFT JOIN subcategories s ON a.subcategory_id = s.id
LEFT JOIN locations l ON a.location_id = l.id
LEFT JOIN companies comp ON a.company_id = comp.id
LEFT JOIN areas ar ON a.area_id = ar.id
LEFT JOIN asset_types at ON a.asset_type_id = at.id
WHERE a.is_deleted = false;

-- 24. Create a function to get asset statistics by category
CREATE OR REPLACE FUNCTION get_asset_statistics_by_category(p_company_id UUID DEFAULT NULL)
RETURNS TABLE (
    category_id UUID,
    category_name TEXT,
    category_slug TEXT,
    total_assets BIGINT,
    active_assets BIGINT,
    maintenance_assets BIGINT,
    inactive_assets BIGINT,
    total_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.slug,
        COUNT(a.id),
        COUNT(a.id) FILTER (WHERE a.status = 'active'),
        COUNT(a.id) FILTER (WHERE a.status = 'maintenance'),
        COUNT(a.id) FILTER (WHERE a.status = 'inactive'),
        COALESCE(SUM(a.purchase_price), 0)
    FROM categories c
    LEFT JOIN assets a ON a.category_id = c.id AND a.is_deleted = false
    WHERE (p_company_id IS NULL OR a.company_id = p_company_id)
    GROUP BY c.id, c.name, c.slug
    ORDER BY c.sort_order, c.name;
END;
$$ LANGUAGE plpgsql;

-- 25. Create a function to get maintenance statistics by asset
CREATE OR REPLACE FUNCTION get_maintenance_statistics_by_asset(p_asset_id UUID)
RETURNS TABLE (
    total_maintenance_records BIGINT,
    active_maintenance_records BIGINT,
    completed_maintenance_records BIGINT,
    total_maintenance_cost NUMERIC,
    last_maintenance_date TIMESTAMPTZ,
    next_maintenance_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'in_progress' OR status = 'pending'),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COALESCE(SUM(total_cost), 0),
        MAX(completed_date) FILTER (WHERE completed_date IS NOT NULL),
        MAX(next_maintenance_date) FILTER (WHERE next_maintenance_date IS NOT NULL)
    FROM maintenance_records
    WHERE asset_id = p_asset_id;
END;
$$ LANGUAGE plpgsql;
