-- Migration: Update titulos_habilitantes fields for validity and days left
-- Adds vigencia_del, vigencia_al, vigencia_documento, and dias_para_vencer columns.

ALTER TABLE public.titulos_habilitantes 
ADD COLUMN IF NOT EXISTS vigencia_del date,
ADD COLUMN IF NOT EXISTS vigencia_al date,
ADD COLUMN IF NOT EXISTS vigencia_documento text,
ADD COLUMN IF NOT EXISTS dias_para_vencer integer;

-- Populate new columns with existing data
UPDATE public.titulos_habilitantes
SET vigencia_del = fecha_emision,
    vigencia_al = fecha_vencimiento,
    dias_para_vencer = (fecha_vencimiento - CURRENT_DATE)
WHERE vigencia_del IS NULL AND vigencia_al IS NULL AND fecha_vencimiento IS NOT NULL;
