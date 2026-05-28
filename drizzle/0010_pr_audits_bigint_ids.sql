-- 0010: widen postedReviewId / postedCheckRunId from int4 to int8.
--
-- GitHub's review and check-run IDs are bigints. In production they routinely
-- exceed 2^31 (the int4 ceiling), causing the final pr_audits UPDATE at the
-- end of the audit to fail with 22003 numeric_value_out_of_range — even
-- though the review and check-run had already been posted successfully on
-- GitHub. The catch path then flipped status to 'failed' incorrectly.
--
-- ALTER TYPE int4 → int8 is a safe widening cast; no data loss.

ALTER TABLE "pr_audits" ALTER COLUMN "postedReviewId"   TYPE bigint;
ALTER TABLE "pr_audits" ALTER COLUMN "postedCheckRunId" TYPE bigint;
