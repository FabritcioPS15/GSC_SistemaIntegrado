-- Add new password columns to servers table
ALTER TABLE servers
ADD COLUMN IF NOT EXISTS anydesk_password text,
ADD COLUMN IF NOT EXISTS backup_scanner_password text;
