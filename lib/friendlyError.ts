/** Sanitize raw API error text into a user-friendly message. */
export function friendlyError(raw: string): string {
  // Try JSON parse for { message: "..." } responses
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string' && parsed.message.length > 0) {
      return parsed.message;
    }
    if (typeof parsed?.error === 'string' && parsed.error.length > 0) {
      return parsed.error;
    }
  } catch { /* not JSON */ }

  // Strip HTML tags (e.g. 502 Bad Gateway pages)
  const stripped = raw.replace(/<[^>]+>/g, '').trim();

  // If stripping left something short and readable, use it
  if (stripped.length > 0 && stripped.length < 200 && !stripped.includes('<!')) {
    return stripped;
  }

  // Fallback
  return 'Something went wrong. Please try again.';
}
