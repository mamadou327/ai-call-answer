-- Add opening_context column to business_settings
ALTER TABLE business_settings 
ADD COLUMN IF NOT EXISTS opening_context TEXT;

COMMENT ON COLUMN business_settings.opening_context IS 
'Optional context or announcements the AI should naturally incorporate into its greeting';