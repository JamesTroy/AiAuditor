-- CLOUD-003: Enable Row Level Security on all application tables.
--
-- Run this in the Supabase SQL Editor or as a migration.
-- Supabase exposes all tables via PostgREST by default. Without RLS,
-- the public anon key grants full CRUD access to all tables.
--
-- This script enables RLS with deny-by-default policies. The application
-- connects via the service role (DATABASE_URL) which bypasses RLS, so
-- application behavior is unaffected.

-- Enable RLS on all tables
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "twoFactor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit" ENABLE ROW LEVEL SECURITY;

-- Deny-by-default policies for the anon role.
-- The service role (used by the application) bypasses RLS entirely.
CREATE POLICY "deny_all_user" ON "user" FOR ALL USING (false);
CREATE POLICY "deny_all_session" ON "session" FOR ALL USING (false);
CREATE POLICY "deny_all_account" ON "account" FOR ALL USING (false);
CREATE POLICY "deny_all_verification" ON "verification" FOR ALL USING (false);
CREATE POLICY "deny_all_twoFactor" ON "twoFactor" FOR ALL USING (false);
CREATE POLICY "deny_all_audit" ON "audit" FOR ALL USING (false);

-- CLOUD-005: Add input length constraint to audit table.
ALTER TABLE "audit" ADD CONSTRAINT audit_input_length CHECK (length(input) <= 100000);
