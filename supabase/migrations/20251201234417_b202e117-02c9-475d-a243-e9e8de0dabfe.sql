-- Add 'revoked' status to business_status enum
-- This must be in a separate transaction from using the value
ALTER TYPE business_status ADD VALUE IF NOT EXISTS 'revoked';