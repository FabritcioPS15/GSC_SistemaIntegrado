-- Migration: Add Missing Asset Columns
-- Description: Adds all columns used by the AssetForm to the assets table.
-- These fields cover inventory details, technical specs, mobile, printer, monitor, 
-- camera, electrical, and network properties.

-- ═══════════════════════════════════════════════
-- INVENTORY / GENERAL DETAILS
-- ═══════════════════════════════════════════════
ALTER TABLE assets ADD COLUMN IF NOT EXISTS item TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS unidad_medida TEXT DEFAULT 'UNIDADES';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS cantidad INTEGER DEFAULT 1;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS condicion TEXT DEFAULT 'Nuevo';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS gama TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS fecha_adquisicion DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC(12,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS estado_uso TEXT DEFAULT 'Operativo';

-- ═══════════════════════════════════════════════
-- TECHNICAL FIELDS (COMPUTING / GENERIC)
-- ═══════════════════════════════════════════════
ALTER TABLE assets ADD COLUMN IF NOT EXISTS processor TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ram TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS operating_system TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS bios_mode TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS placa TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS mac_address TEXT;

-- ═══════════════════════════════════════════════
-- CAMERA FIELDS
-- ═══════════════════════════════════════════════
ALTER TABLE assets ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS port TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS access_type TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS auth_code TEXT;

-- ═══════════════════════════════════════════════
-- MOBILE / CELULAR FIELDS
-- ═══════════════════════════════════════════════
ALTER TABLE assets ADD COLUMN IF NOT EXISTS imei TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS operator TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS data_plan TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS physical_condition TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS sistema_operativo TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS version_so TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS almacenamiento TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS bateria_estado TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS accesorios TEXT;

-- ═══════════════════════════════════════════════
-- PRINTER FIELDS
-- ═══════════════════════════════════════════════
ALTER TABLE assets ADD COLUMN IF NOT EXISTS tipo_impresion TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS tecnologia_impresion TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS velocidad_impresion TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS resolucion TEXT;

-- ═══════════════════════════════════════════════
-- MONITOR / PROJECTOR FIELDS
-- ═══════════════════════════════════════════════
ALTER TABLE assets ADD COLUMN IF NOT EXISTS tamaño_pantalla TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS resolucion_pantalla TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS tipo_conexion TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS luminosidad TEXT;

-- ═══════════════════════════════════════════════
-- ELECTRICAL / NETWORK FIELDS
-- ═══════════════════════════════════════════════
ALTER TABLE assets ADD COLUMN IF NOT EXISTS potencia_w NUMERIC;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS estabilizador_w NUMERIC;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS voltage_v NUMERIC;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS frecuencia_hz NUMERIC;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS brillo_lumens NUMERIC;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS velocidad_internet TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS tipo_conector TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS marca_motor TEXT;

-- ═══════════════════════════════════════════════
-- INDEXES FOR COMMON QUERIES
-- ═══════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_assets_condicion ON assets(condicion);
CREATE INDEX IF NOT EXISTS idx_assets_estado_uso ON assets(estado_uso);
CREATE INDEX IF NOT EXISTS idx_assets_color ON assets(color);
CREATE INDEX IF NOT EXISTS idx_assets_fecha_adquisicion ON assets(fecha_adquisicion);

-- Drop NOT NULL constraint on asset_type_id if it exists since we use category_id now
ALTER TABLE assets ALTER COLUMN asset_type_id DROP NOT NULL;

-- ═══════════════════════════════════════════════
-- ENSURE CATEGORIES TABLE EXISTS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT UNIQUE,
    icon TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to categories (if table already existed with fewer columns)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ═══════════════════════════════════════════════
-- ENSURE SUBCATEGORIES TABLE EXISTS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, name)
);

ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ═══════════════════════════════════════════════
-- INSERT 6 CATEGORIES (Migración Nueva)
-- ═══════════════════════════════════════════════
INSERT INTO categories (name, slug, icon, description, sort_order) VALUES
('Tecnología', 'tecnologia', 'laptop', 'Equipos de cómputo, dispositivos electrónicos y redes', 1),
('Seguridad y Control', 'seguridad-control', 'shield', 'Sistemas de seguridad, cámaras, biométricos y control de acceso', 2),
('Equipos Operativos', 'equipos-operativos', 'wrench', 'Equipos de revisión técnica, médicos y de evaluación', 3),
('Mobiliario', 'mobiliario', 'armchair', 'Muebles de oficina, escritorios, sillas y estanterías', 4),
('Útiles y Suministros', 'utiles-suministros', 'package', 'Material de oficina, suministros y útiles administrativos', 5),
('Otros Activos', 'otros-activos', 'tool', 'Equipos diversos, herramientas y estructuras', 6)
ON CONFLICT (name) DO UPDATE SET
    slug = EXCLUDED.slug,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

-- ═══════════════════════════════════════════════
-- INSERT SUBCATEGORIES: Tecnología
-- ═══════════════════════════════════════════════
DO $$
DECLARE cat_id UUID;
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
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- ═══════════════════════════════════════════════
-- INSERT SUBCATEGORIES: Seguridad y Control
-- ═══════════════════════════════════════════════
DO $$
DECLARE cat_id UUID;
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
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- ═══════════════════════════════════════════════
-- INSERT SUBCATEGORIES: Equipos Operativos
-- ═══════════════════════════════════════════════
DO $$
DECLARE cat_id UUID;
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
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- ═══════════════════════════════════════════════
-- INSERT SUBCATEGORIES: Mobiliario
-- ═══════════════════════════════════════════════
DO $$
DECLARE cat_id UUID;
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
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- ═══════════════════════════════════════════════
-- INSERT SUBCATEGORIES: Útiles y Suministros
-- ═══════════════════════════════════════════════
DO $$
DECLARE cat_id UUID;
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
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- ═══════════════════════════════════════════════
-- INSERT SUBCATEGORIES: Otros Activos
-- ═══════════════════════════════════════════════
DO $$
DECLARE cat_id UUID;
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
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- ═══════════════════════════════════════════════
-- RLS POLICIES (idempotent)
-- ═══════════════════════════════════════════════
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'categories_allow_all_authenticated') THEN
        CREATE POLICY categories_allow_all_authenticated ON categories FOR ALL TO authenticated USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subcategories' AND policyname = 'subcategories_allow_all_authenticated') THEN
        CREATE POLICY subcategories_allow_all_authenticated ON subcategories FOR ALL TO authenticated USING (true);
    END IF;
END $$;
