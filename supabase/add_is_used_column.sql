-- Add is_used column to email_accounts table
-- Run this in Supabase SQL Editor
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS is_used BOOLEAN DEFAULT false;
