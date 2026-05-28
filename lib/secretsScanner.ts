// Deterministic secrets scanner — catches leaked tokens that an LLM agent
// might miss (or partially quote in a finding, exposing the value).
//
// Pure function: takes a code string, returns the secrets found with
// line numbers and a masked rendering safe to show in the UI. Patterns
// follow standard provider prefixes (AWS, GitHub, OpenAI, Anthropic,
// Stripe, Slack, SendGrid, Twilio) plus structural detectors (JWT,
// PEM private key blocks). Generic high-entropy detection is gated on
// a key=value or secret=value lexical hint to keep noise down.
//
// Performance: ~10ms for a 100KB input on a single regex pass. Safe to
// run unconditionally before every audit.

export type SecretKind =
  | 'aws_access_key_id'
  | 'aws_secret_access_key'
  | 'github_classic_token'
  | 'github_fine_grained_token'
  | 'github_oauth_token'
  | 'github_user_server_token'
  | 'github_installation_token'
  | 'github_refresh_token'
  | 'openai_api_key'
  | 'anthropic_api_key'
  | 'slack_token'
  | 'stripe_live_key'
  | 'stripe_test_key'
  | 'stripe_publishable_key'
  | 'sendgrid_api_key'
  | 'twilio_account_sid'
  | 'jwt'
  | 'private_key_block'
  | 'generic_high_entropy';

export interface SecretMatch {
  kind: SecretKind;
  /** 1-indexed line where the secret was found. */
  line: number;
  /** Whole line (truncated to 200 chars) for human context — already masked. */
  snippet: string;
  /** Just the redacted token value (e.g. "sk-ant-abcd...wxyz"). */
  masked: string;
  /**
   * 'critical' for live production-grade credentials, 'high' for test-mode
   * or lower-impact secrets, 'medium' for structural hits like JWTs.
   */
  severity: 'critical' | 'high' | 'medium';
}

interface PatternRule {
  kind: SecretKind;
  pattern: RegExp;
  severity: SecretMatch['severity'];
}

// Order matters slightly — more specific patterns first so a generic
// fallback doesn't claim a hit a specific one would have matched.
const RULES: PatternRule[] = [
  // AWS
  { kind: 'aws_access_key_id', pattern: /\bAKIA[0-9A-Z]{16}\b/g, severity: 'critical' },
  {
    kind: 'aws_secret_access_key',
    pattern: /\baws[_-]?secret(?:[_-]?access)?[_-]?key\s*[:=]\s*['"]?([A-Za-z0-9/+]{40})['"]?/gi,
    severity: 'critical',
  },
  // GitHub
  { kind: 'github_classic_token', pattern: /\bghp_[0-9A-Za-z]{36}\b/g, severity: 'critical' },
  { kind: 'github_fine_grained_token', pattern: /\bgithub_pat_[0-9A-Za-z_]{82,}\b/g, severity: 'critical' },
  { kind: 'github_oauth_token', pattern: /\bgho_[0-9A-Za-z]{36}\b/g, severity: 'critical' },
  { kind: 'github_user_server_token', pattern: /\bghu_[0-9A-Za-z]{36}\b/g, severity: 'critical' },
  { kind: 'github_installation_token', pattern: /\bghs_[0-9A-Za-z]{36}\b/g, severity: 'critical' },
  { kind: 'github_refresh_token', pattern: /\bghr_[0-9A-Za-z]{36}\b/g, severity: 'critical' },
  // OpenAI / Anthropic — keep Anthropic first since both start with "sk-".
  { kind: 'anthropic_api_key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, severity: 'critical' },
  { kind: 'openai_api_key', pattern: /\bsk-[A-Za-z0-9_-]{32,}\b/g, severity: 'critical' },
  // Slack
  { kind: 'slack_token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, severity: 'critical' },
  // Stripe — live vs test severity diverges by 2 tiers.
  { kind: 'stripe_live_key', pattern: /\bsk_live_[A-Za-z0-9]{24,}\b/g, severity: 'critical' },
  { kind: 'stripe_test_key', pattern: /\bsk_test_[A-Za-z0-9]{24,}\b/g, severity: 'high' },
  { kind: 'stripe_publishable_key', pattern: /\bpk_(?:live|test)_[A-Za-z0-9]{24,}\b/g, severity: 'high' },
  // SendGrid
  { kind: 'sendgrid_api_key', pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, severity: 'critical' },
  // Twilio Account SID (the SID itself isn't secret, but its colocation with an auth token usually means a leak nearby).
  { kind: 'twilio_account_sid', pattern: /\bAC[0-9a-f]{32}\b/g, severity: 'high' },
  // JWT — three base64 segments. Match length-bounded to skip random base64 in code.
  { kind: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, severity: 'medium' },
  // PEM private key block
  {
    kind: 'private_key_block',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
    severity: 'critical',
  },
];

// Generic high-entropy detection — only flags when the value is on the
// right-hand side of an assignment AND looks high-entropy. Avoids hits on
// random base64 in code (image data URIs etc.).
const GENERIC_ASSIGNMENT = /\b(?:api[_-]?key|secret|token|password|passwd|auth)\s*[:=]\s*['"]?([A-Za-z0-9/+_-]{20,})['"]?/gi;

function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function maskToken(token: string): string {
  if (token.length <= 8) return token[0] + '***';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function maskLineFor(line: string, token: string): string {
  // Replace every occurrence of the token in the line with the masked form,
  // then cap length.
  const masked = line.replaceAll(token, maskToken(token));
  return masked.length > 200 ? masked.slice(0, 197) + '...' : masked;
}

function lineNumberFor(input: string, byteIndex: number): number {
  let line = 1;
  for (let i = 0; i < byteIndex && i < input.length; i++) {
    if (input[i] === '\n') line++;
  }
  return line;
}

function lineAt(input: string, byteIndex: number): string {
  const start = input.lastIndexOf('\n', byteIndex - 1) + 1;
  let end = input.indexOf('\n', byteIndex);
  if (end === -1) end = input.length;
  return input.slice(start, end);
}

/**
 * Scan input for secrets. Returns a deduped list keyed by (kind, token)
 * so the same key appearing twice doesn't produce two findings.
 */
export function scanForSecrets(input: string): SecretMatch[] {
  if (!input || input.length < 8) return [];

  const matches: SecretMatch[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.pattern.exec(input)) !== null) {
      // For rules with a capture group (e.g. aws_secret_access_key), the
      // capture is the secret. Otherwise the whole match is the secret.
      const token = m[1] ?? m[0];
      const key = `${rule.kind}::${token}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const line = lineNumberFor(input, m.index);
      matches.push({
        kind: rule.kind,
        line,
        snippet: maskLineFor(lineAt(input, m.index), token),
        masked: maskToken(token),
        severity: rule.severity,
      });
    }
  }

  // Generic high-entropy assignments.
  GENERIC_ASSIGNMENT.lastIndex = 0;
  let g: RegExpExecArray | null;
  while ((g = GENERIC_ASSIGNMENT.exec(input)) !== null) {
    const token = g[1];
    if (!token || token.length < 20) continue;
    if (shannonEntropy(token) < 3.5) continue;  // 3.5+ bits/char filters dictionary words and constants
    const key = `generic_high_entropy::${token}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const line = lineNumberFor(input, g.index);
    matches.push({
      kind: 'generic_high_entropy',
      line,
      snippet: maskLineFor(lineAt(input, g.index), token),
      masked: maskToken(token),
      severity: 'high',
    });
  }

  // Stable sort: severity > line.
  const SEV_RANK = { critical: 0, high: 1, medium: 2 } as const;
  matches.sort(
    (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.line - b.line,
  );
  return matches;
}
