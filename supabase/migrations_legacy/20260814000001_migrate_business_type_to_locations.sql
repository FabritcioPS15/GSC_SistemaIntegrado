-- 1. Agregar la columna business_type a locations
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS business_type text;

-- 2. Migrar los datos existentes (Copia el rubro de la empresa a sus sedes)
UPDATE public.locations
SET business_type = c.business_type
FROM public.companies c
WHERE public.locations.company_id = c.id
AND c.business_type IS NOT NULL;

-- Asegurar un valor por defecto
UPDATE public.locations
SET business_type = 'oficinas_administrativas'
WHERE business_type IS NULL;

-- 3. Eliminar la vista que depende de la columna (y luego recrearla)
DROP VIEW IF EXISTS public.assets_with_details CASCADE;

-- 4. Eliminar la columna de la tabla companies
ALTER TABLE public.companies 
DROP COLUMN IF EXISTS business_type;

-- 5. Recrear la vista assets_with_details (Actualizada con business_type desde locations)
CREATE OR REPLACE VIEW public.assets_with_details AS
SELECT 
    a.*,
    c.name as category_name,
    c.slug as category_slug,
    s.name as subcategory_name,
    s.slug as subcategory_slug,
    l.name as location_name,
    l.company_id as location_company_id,
    l.business_type as location_business_type,
    comp.name as company_name,
    ar.name as area_name,
    at.name as asset_type_name
FROM public.assets a
LEFT JOIN public.categories c ON a.category_id = c.id
LEFT JOIN public.subcategories s ON a.subcategory_id = s.id
LEFT JOIN public.locations l ON a.location_id = l.id
LEFT JOIN public.companies comp ON a.company_id = comp.id
LEFT JOIN public.areas ar ON a.area_id = ar.id
LEFT JOIN public.asset_types at ON a.asset_type_id = at.id
WHERE a.is_deleted = false;
