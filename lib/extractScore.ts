// Shared score extraction logic used by both the API route (on save)
// and the dashboard (for backfilling existing records).

/**
 * Extract the overall/composite score from audit markdown output.
 * Checks multiple formats: table rows, N/100 patterns (last match),
 * and free-text "Overall Score: N".
 */
export function extractScore(text: string): number | null {
  // 1. Table row: | **Overall** | 72 | or | **Composite** | 8.5 |
  const tableOverall = text.match(
    /\|\s*\*{0,2}(?:Overall|Composite|Total)\*{0,2}\s*\|\s*(\d{1,3}(?:\.\d+)?)\s*\|/i,
  );
  if (tableOverall) {
    const val = parseFloat(tableOverall[1]);
    if (val <= 10) return Math.round(val * 10);
    if (val >= 0 && val <= 100) return Math.round(val);
  }

  // 2. Explicit "N/100" — use LAST match (overall score appears at the end)
  const allSlash100 = [...text.matchAll(/(\d{1,3})\s*\/\s*100/g)];
  if (allSlash100.length > 0) {
    const last = allSlash100[allSlash100.length - 1];
    const val = parseInt(last[1], 10);
    if (val >= 0 && val <= 100) return val;
  }

  // 3. "Overall Score: N" or "Overall: N/10"
  const overallLine = text.match(
    /overall\s*(?:score|rating)?\s*[:]\s*(\d{1,3}(?:\.\d+)?)\s*(?:\/\s*(\d+))?/i,
  );
  if (overallLine) {
    const num = parseFloat(overallLine[1]);
    const denom = overallLine[2] ? parseInt(overallLine[2], 10) : null;
    if (denom === 10 && num <= 10) return Math.round(num * 10);
    if (denom === 100 && num <= 100) return Math.round(num);
    if (!denom && num >= 0 && num <= 100) return Math.round(num);
  }

  return null;
}
