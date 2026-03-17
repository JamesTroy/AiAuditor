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
  // 1. Table row: | **Overall** | 72 | or | **Composite** | 8.5/10 |
  // Also handles: | Overall Score | 72/100 |, | Net Risk Posture | 7 |
  const tableOverall = text.match(
    /\|\s*\*{0,2}(?:Overall|Composite|Total|Final|Net Risk Posture)(?:\s+Score)?\*{0,2}\s*\|\s*(\d{1,3}(?:\.\d+)?)\s*(?:\/\s*(\d+))?\s*\|/i,
  );
  if (tableOverall) {
    // Most agents use 1-10 scale in tables; if no denominator and value ≤ 10,
    // assume it's on a 1-10 scale and multiply by 10.
    return normalizeScore(tableOverall[1], tableOverall[2] ?? (parseFloat(tableOverall[1]) <= 10 ? '10' : undefined));
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

  // 4b. Explicit "N/10" — use LAST match (composite score at end of table)
  const allSlash10 = [...text.matchAll(/(\d{1,2}(?:\.\d+)?)\s*\/\s*10(?!\d)/g)];
  if (allSlash10.length > 0) {
    const last = allSlash10[allSlash10.length - 1];
    const val = parseFloat(last[1]);
    if (val >= 0 && val <= 10) return Math.round(val * 10);
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

// FP-005: Sanity-check score against severity counts from the same report.
// If the score seems inconsistent with finding severity distribution, clamp
// it to a reasonable range. This catches agents that accidentally scored
// [SUGGESTION] findings as defects.
export function sanityCheckScore(score: number | null, markdown: string): number | null {
  if (score === null) return null;

  const severityRe = /\*?\*?\[?(CRITICAL|HIGH|MEDIUM|LOW|INFORMATIONAL)\]?\*?\*?\s*[-—]/gi;
  const severities: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = severityRe.exec(markdown)) !== null) {
    severities.push(match[1].toUpperCase());
  }

  const criticals = severities.filter((s) => s === 'CRITICAL').length;
  const highs = severities.filter((s) => s === 'HIGH').length;

  // If many critical/high findings but score is suspiciously high, cap it
  if (criticals >= 3 && score > 60) return Math.min(score, 60);
  if (criticals >= 1 && highs >= 3 && score > 70) return Math.min(score, 70);

  // If only suggestions/informational and score is suspiciously low, floor it
  const onlySuggestions = severities.length > 0 &&
    severities.every((s) => s === 'INFORMATIONAL' || s === 'LOW');
  if (onlySuggestions && score < 60) return Math.max(score, 60);

  return score;
}
