-- Audit-row tagging by auto-detected stack.
-- Captured at audit time from lib/detectAgents.ts; historical rows stay NULL.
-- Enables dashboard filters like "all my Next.js audits".

ALTER TABLE "audit" ADD COLUMN IF NOT EXISTS "detectedLanguage"  text;
ALTER TABLE "audit" ADD COLUMN IF NOT EXISTS "detectedFramework" text;
ALTER TABLE "audit" ADD COLUMN IF NOT EXISTS "detectedPatterns"  text;

CREATE INDEX IF NOT EXISTS "idx_audit_user_framework" ON "audit" ("userId","detectedFramework");
