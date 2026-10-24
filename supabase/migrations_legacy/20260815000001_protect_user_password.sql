-- Migration: Proteger la contraseña de usuarios contra reseteos accidentales
-- 
-- Problema: al editar un usuario desde el panel, si algún flujo envía password
-- vacío ('' o NULL), la tabla users lo sobrescribe y el usuario pierde su clave.
--
-- Solución: trigger BEFORE UPDATE que conserva la contraseña anterior cuando
-- el nuevo valor viene vacío o NULL. Solo se actualiza cuando se envía una
-- contraseña nueva no vacía (flujos de creación, cambio de clave y PasswordSetup).

CREATE OR REPLACE FUNCTION protect_user_password()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.password IS NULL OR NEW.password = '' THEN
            NEW.password := OLD.password;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_user_password_trigger ON public.users;
CREATE TRIGGER protect_user_password_trigger
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION protect_user_password();
