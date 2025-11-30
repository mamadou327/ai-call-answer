-- Update app_role enum to include new admin roles
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'sub_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'pending_admin';