-- Description: Adds missing inventory categories (Herramientas y Equipos, Instalaciones, Equipos de Revisión RTV/CITV, Infraestructura TI) with their subcategories

-- ═══════════════════════════════════════════════
-- INSERT MISSING CATEGORIES
-- ═══════════════════════════════════════════════
INSERT INTO categories (name, slug, icon, description, sort_order) VALUES
('Herramientas y Equipos', 'herramientas-equipos', 'tool', 'Herramientas de trabajo, equipos de taller y consumibles de construcción', 7),
('Instalaciones', 'instalaciones', 'building', 'Instalaciones eléctricas, sanitarias, climatización y acabados', 8),
('Equipos de Revisión (RTV/CITV)', 'equipos-revision', 'clipboard-check', 'Equipos de revisión técnica vehicular: opacímetros, frenómetros, entre otros', 9),
('Infraestructura TI', 'infraestructura-ti', 'server', 'Racks, cableado estructurado, servidores y equipamiento de red', 10)
ON CONFLICT (name) DO UPDATE SET
    slug = EXCLUDED.slug,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

-- ═══════════════════════════════════════════════
-- INSERT SUBCATEGORIES: Herramientas y Equipos
-- ═══════════════════════════════════════════════
DO $$
DECLARE cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE slug = 'herramientas-equipos';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
        (cat_id, 'Herramientas de mano', 'herramientas-mano', 1),
        (cat_id, 'Herramientas eléctricas', 'herramientas-electricas', 2),
        (cat_id, 'Equipos de medición', 'equipos-medicion', 3),
        (cat_id, 'Ferretería', 'ferreteria', 4),
        (cat_id, 'Equipos de soldadura', 'equipos-soldadura', 5)
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- ═══════════════════════════════════════════════
-- INSERT SUBCATEGORIES: Instalaciones
-- ═══════════════════════════════════════════════
DO $$
DECLARE cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE slug = 'instalaciones';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
        (cat_id, 'Iluminación', 'iluminacion', 1),
        (cat_id, 'Climatización', 'climatizacion', 2),
        (cat_id, 'Instalaciones sanitarias', 'instalaciones-sanitarias', 3),
        (cat_id, 'Instalaciones eléctricas', 'instalaciones-electricas', 4),
        (cat_id, 'Ventilación y extracción', 'ventilacion-extraccion', 5),
        (cat_id, 'Carpintería y acabados', 'carpinteria-acabados', 6)
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- ═══════════════════════════════════════════════
-- INSERT SUBCATEGORIES: Equipos de Revisión (RTV/CITV)
-- ═══════════════════════════════════════════════
DO $$
DECLARE cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE slug = 'equipos-revision';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
        (cat_id, 'Analizadores de gases', 'analizadores-gases', 1),
        (cat_id, 'Opacímetros', 'opacimetros', 2),
        (cat_id, 'Frenómetros', 'frenometros', 3),
        (cat_id, 'Luxómetros', 'luxometros', 4),
        (cat_id, 'Detectores de holguras', 'detectores-holguras', 5),
        (cat_id, 'Bancos de suspensión', 'bancos-suspension', 6),
        (cat_id, 'Alineadores', 'alineadores', 7),
        (cat_id, 'PIT y fosos', 'pit-fosos', 8)
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;

-- ═══════════════════════════════════════════════
-- INSERT SUBCATEGORIES: Infraestructura TI
-- ═══════════════════════════════════════════════
DO $$
DECLARE cat_id UUID;
BEGIN
    SELECT id INTO cat_id FROM categories WHERE slug = 'infraestructura-ti';
    IF cat_id IS NOT NULL THEN
        INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
        (cat_id, 'Racks y gabinetes', 'racks-gabinetes', 1),
        (cat_id, 'Cableado estructurado', 'cableado-estructurado', 2),
        (cat_id, 'Energía y respaldo', 'energia-respaldo', 3),
        (cat_id, 'Almacenamiento', 'almacenamiento', 4),
        (cat_id, 'Redes inalámbricas', 'redes-inalambricas', 5),
        (cat_id, 'Equipamiento de red', 'equipamiento-red', 6)
        ON CONFLICT (category_id, name) DO NOTHING;
    END IF;
END $$;