-- Migration: Add Herramientas y Equipos + Instalaciones categories
-- Date: 2026-07-27

-- Insert new categories
INSERT INTO categories (name, slug, description, icon) VALUES
  ('Herramientas y Equipos', 'herramientas-equipos', 'Herramientas manuales, eléctricas y equipos de trabajo', 'wrench'),
  ('Instalaciones', 'instalaciones', 'Instalaciones eléctricas, sanitarias, iluminación y climatización', 'zap')
ON CONFLICT DO NOTHING;

-- Insert subcategories for Herramientas y Equipos
INSERT INTO subcategories (category_id, name, slug, description) VALUES
  ((SELECT id FROM categories WHERE slug = 'herramientas-equipos'), 'Herramientas Manuales', 'herramientas-manuales', 'Alicates, destornilladores, llaves, martillos, etc.'),
  ((SELECT id FROM categories WHERE slug = 'herramientas-equipos'), 'Herramientas Eléctricas', 'herramientas-electricas', 'Taladros, sierras, soldadoras, amoladoras, etc.'),
  ((SELECT id FROM categories WHERE slug = 'herramientas-equipos'), 'Herramientas de Medición', 'herramientas-medicion', 'Flexómetros, niveles, medidores, etc.'),
  ((SELECT id FROM categories WHERE slug = 'herramientas-equipos'), 'Herramientas de Corte', 'herramientas-corte', 'Cutter, serruchos, ingletadoras, etc.'),
  ((SELECT id FROM categories WHERE slug = 'herramientas-equipos'), 'Equipos de Protección Personal', 'epp', 'Cascos, guantes, lentes, arneses, etc.')
ON CONFLICT DO NOTHING;

-- Insert subcategories for Instalaciones
INSERT INTO subcategories (category_id, name, slug, description) VALUES
  ((SELECT id FROM categories WHERE slug = 'instalaciones'), 'Iluminación', 'iluminacion', 'Lámparas, focos, lámparas LED, reflectores'),
  ((SELECT id FROM categories WHERE slug = 'instalaciones'), 'Climatización', 'climatizacion', 'Aire acondicionado, ventiladores, extractores'),
  ((SELECT id FROM categories WHERE slug = 'instalaciones'), 'Plomería', 'plomeria', 'Grifos, tuberías, llaves de paso, tanques'),
  ((SELECT id FROM categories WHERE slug = 'instalaciones'), 'Eléctrico', 'electrico', 'Interruptores, enchufes, tableros, cableado'),
  ((SELECT id FROM categories WHERE slug = 'instalaciones'), 'Carpintería y Acabados', 'carpinteria-acabados', 'Puertas, ventanas, cerámica, pintura')
ON CONFLICT DO NOTHING;
