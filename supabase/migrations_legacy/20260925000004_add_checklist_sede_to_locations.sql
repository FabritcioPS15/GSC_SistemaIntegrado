-- ═══════════════════════════════════════════════════════════════
-- Vincular sedes de locations con las hojas de checklist
--
-- Por qué una columna y no un mapa en el código:
--
-- El nombre de la hoja ("ESCON MBS ATE") y el de la sede en la app
-- ("Mi Brevete Seguro ATE") no comparten ni una palabra, así que no hay
-- forma de deducirlos uno del otro. Alguna parte tiene que declarar el
-- vínculo. La diferencia entre hardcodearlo en el Code.gs y ponerlo acá
-- es que esto es UN solo lugar, se corrige con un UPDATE, y gerencia
-- puede mapear una sede nueva sin que nadie toque código ni redespliegue
-- la Edge Function.
--
-- Con esto el mapa hardcodeado de la función se vuelve innecesario: la
-- Edge Function pasa a resolver por esta columna.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS checklist_sede text;

-- Permite dejar varias hojas pegadas a una misma sede (por ejemplo, una
-- sede con un checklist de mañana y otro de tarde).
CREATE INDEX IF NOT EXISTS idx_locations_checklist_sede
  ON public.locations (checklist_sede)
  WHERE checklist_sede IS NOT NULL;

-- Las 8 hojas ESCON contra sus sedes. Se hace por nombre de sede, que es
-- lo único estable: los uuid cambian si alguien recrea la sede, el
-- nombre no.
UPDATE public.locations SET checklist_sede = 'ESCON MBS ATE'
  WHERE name = 'Mi Brevete Seguro ATE';

UPDATE public.locations SET checklist_sede = 'ESCON MBS AYACUCHO'
  WHERE name = 'Mi Brevete Seguro Ayacucho';

UPDATE public.locations SET checklist_sede = 'ESCON MBS HUANCAVELICA'
  WHERE name = 'Mi Brevete Seguro Huancavelica';

UPDATE public.locations SET checklist_sede = 'ESCON SCVIP CALLAO'
  WHERE name = 'San Cristóbal Vip Callao';

UPDATE public.locations SET checklist_sede = 'ESCON SCVIP HUACHO'
  WHERE name = 'San Cristóbal Vip Huacho';

-- ÍZAGUIRRE: el nombre de la hoja dice "SCVIP IZAGUIRRE" pero la sede se
-- llama "Lima" (el distrito de Izaguirre es de la región Lima). Es la
-- única fila que hubo que deducir del patrón de nombres, no de un dato.
-- Si en realidad corresponde a otra sede, se corrige con un UPDATE.
UPDATE public.locations SET checklist_sede = 'ESCON SCVIP IZAGUIRRE'
  WHERE name = 'San Crístobal Vip Lima';

UPDATE public.locations SET checklist_sede = 'ESCON SCP ICA'
  WHERE name = 'San Cristóbal del Perú Ica';

UPDATE public.locations SET checklist_sede = 'ESCON SCP ANDAHUAYLAS'
  WHERE name = 'San Cristóbal del Perú Andahuaylas';

-- Verificación: tiene que devolver 8. Si devuelve menos, algún nombre de
-- sede no coincidió y esa hoja quedaría sin vincular.
--   select count(*) from locations where checklist_sede is not null;
