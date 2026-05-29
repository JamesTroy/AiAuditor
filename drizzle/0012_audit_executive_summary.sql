-- Cached executive summary for an audit.
--
-- The synth call is ~3s + ~$0.01, so we generate on first view (lazy) and
-- cache the result on the audit row. Subsequent views are instant. Users
-- can request a regenerate to force a refresh after dismissing findings.
--
-- The summary stores plain-English prose only — no code snippets, no
-- severity tags. Bounded by the application layer to keep row size sane.

ALTER TABLE "audit"
  ADD COLUMN IF NOT EXISTS "executiveSummary" text,
  ADD COLUMN IF NOT EXISTS "executiveSummaryGeneratedAt" timestamp with time zone;
