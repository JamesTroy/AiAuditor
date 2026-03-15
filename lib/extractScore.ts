// Shared score extraction logic used by both the API route (on save)
// and the dashboard (for backfilling existing records).

/**
 * Extract the overall/composite score from audit markdown output.
 * Checks multiple formats in priority order:
 * 1. Table rows with Overall/Composite/Total label
 * 2. Heading-style score: "## Overall Score: N/100"
 * 3. Bold/emphasized score: "**Overall Score: 72/100**"
 * 4. Explicit "N/100" — last match (overall appears at end)
 * 5. Free-text "Overall Score: N" or "Overall: N/10"
 */
export function extractScore(text: string): number | null {
  // 1. Table row: | **Overall** | 72 | or | **Composite** | 8.5 |
  // Also handles: | Overall Score | 72/100 |
  const tableOverall = text.match(
    /\|\s*\*{0,2}(?:Overall|Composite|Total|Final)(?:\s+Score)?\*{0,2}\s*\|\s*(\d{1,3}(?:\.\d+)?)\s*(?:\/\s*100)?\s*\|/i,
  );
  if (tableOverall) {
    const val = parseFloat(tableOverall[1]);
    if (val <= 10) return Math.round(val * 10);
    if (val >= 0 && val <= 100) return Math.round(val);
  }

  // 2. Heading-style: "## Overall Score: 72/100" or "### Final Score: 85"
  const headingScore = text.match(
    /^#{1,4}\s+(?:Overall|Composite|Total|Final)\s+Score\s*[:：]\s*(\d{1,3}(?:\.\d+)?)\s*(?:\/\s*(\d+))?/im,
  );
  if (headingScore) {
    return normalizeScore(headingScore[1], headingScore[2]);
  }

  // 3. Bold/emphasized: "**Overall Score: 72/100**" or "**Score: 85**"
  const boldScore = text.match(
    /\*{1,2}(?:Overall|Composite|Total|Final)\s+Score\s*[:：]\s*(\d{1,3}(?:\.\d+)?)\s*(?:\/\s*(\d+))?\*{1,2}/i,
  );
  if (boldScore) {
    return normalizeScore(boldScore[1], boldScore[2]);
  }

  // 4. Explicit "N/100" — use LAST match (overall score appears at the end)
  const allSlash100 = [...text.matchAll(/(\d{1,3})\s*\/\s*100/g)];
  if (allSlash100.length > 0) {
    const last = allSlash100[allSlash100.length - 1];
    const val = parseInt(last[1], 10);
    if (val >= 0 && val <= 100) return val;
  }

  // 5. "Overall Score: N" or "Overall: N/10" or "Score: N"
  const overallLine = text.match(
    /(?:overall|composite|total|final)\s*(?:score|rating)?\s*[:：]\s*(\d{1,3}(?:\.\d+)?)\s*(?:\/\s*(\d+))?/i,
  );
  if (overallLine) {
    return normalizeScore(overallLine[1], overallLine[2]);
  }

  return null;
}

/** Normalize a score value with optional denominator to 0-100 scale. */
function normalizeScore(numStr: string, denomStr?: string): number | null {
  const num = parseFloat(numStr);
  const denom = denomStr ? parseInt(denomStr, 10) : null;
  if (denom === 10 && num <= 10) return Math.round(num * 10);
  if (denom === 100 && num <= 100) return Math.round(num);
  if (!denom && num >= 0 && num <= 100) return Math.round(num);
  return null;
}
