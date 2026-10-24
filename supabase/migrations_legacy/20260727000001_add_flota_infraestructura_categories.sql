-- Migration: Add Flota Vehicular and Infraestructura TI categories
-- Description: Inserts two new inventory categories with their subcategories

-- 1. Insert new categories
INSERT INTO categories (name, slug, icon, description, sort_order) VALUES
('Flota Vehicular', 'flota-vehicular', 'truck', 'Vehículos, maquinaria pesada y equipo de transporte', 7),
('Infraestructura TI', 'infraestructura-ti', 'server', 'Infraestructura de servidores, redes y comunicaciones', 8)
ON CONFLICT (name) DO NOTHING;

-- 2. Insert subcategories for Flota Vehicular
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE slug = 'flota-vehicular';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
        (cat_id, 'Vehículos livianos', 'vehiculos-livianos', 1),
        (cat_id, 'Camionetas', 'camionetas', 2),
        (cat_id, 'Vehículos pesados', 'vehiculos-pesados', 3),
        (cat_id, 'Motocicletas', 'motocicletas', 4),
        (cat_id, 'Maquinaria pesada', 'maquinaria-pesada', 5),
        (cat_id, 'Equipos de carga', 'equipos-carga', 6)
        ON CONFLICT (category_id, slug) DO NOTHING;
    END IF;
END $$;

-- 3. Insert subcategories for Infraestructura TI
DO $$
DECLARE
    cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE slug = 'infraestructura-ti';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
        (cat_id, 'Servidores', 'servidores', 1),
        (cat_id, 'Storage / NAS', 'storage-nas', 2),
        (cat_id, 'Racks de red', 'racks-red', 3),
        (cat_id, 'Switches de red', 'switches-red', 4),
        (cat_id, 'Puntos de acceso Wi-Fi', 'puntos-acceso-wifi', 5),
        (cat_id, 'UPS / Estabilizadores', 'ups-estabilizadores', 6),
        (cat_id, 'Patch panels y cableado', 'patch-panels-cableado', 7),
        (cat_id, 'Torres de telecomunicaciones', 'torres-telecomunicaciones', 8)
        ON CONFLICT (category_id, slug) DO NOTHING;
    END IF;
END $$;
