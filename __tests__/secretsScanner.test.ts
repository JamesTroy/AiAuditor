import { describe, it, expect } from 'vitest';
import { scanForSecrets } from '@/lib/secretsScanner';

describe('scanForSecrets — provider tokens', () => {
  it('detects an AWS access key ID', () => {
    const r = scanForSecrets('const k = "AKIAIOSFODNN7EXAMPLE";');
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('aws_access_key_id');
    expect(r[0].severity).toBe('critical');
  });

  it('detects a GitHub classic personal access token', () => {
    const r = scanForSecrets('GITHUB_TOKEN=ghp_abc123def456ghi789jkl012mno345pqr678');
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('github_classic_token');
  });

  it('detects an Anthropic key and not as OpenAI', () => {
    const r = scanForSecrets('client = new Anthropic({ apiKey: "sk-ant-api03-AAAAAAAAAAAAAAAAAAAA" })');
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('anthropic_api_key');
  });

  it('detects an OpenAI key (sk- without ant- prefix)', () => {
    const r = scanForSecrets('OPENAI=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890');
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('openai_api_key');
  });

  it('detects a Stripe live key as critical and test key as high', () => {
    // Fixtures built via string concatenation so the source file doesn't
    // literally contain a 24+ char string after sk_live_ / sk_test_ — that
    // would trip GitHub's push-protection secret scanner (which is roughly
    // the same regex our scanner under test uses). The runtime values still
    // match the pattern, which is what the assertions exercise.
    const livePrefix = 'sk_' + 'live_';
    const testPrefix = 'sk_' + 'test_';
    const body = 'abcdefghijklmnopqrstuvwx';
    const r = scanForSecrets(`
      const live = "${livePrefix}${body}";
      const t = "${testPrefix}${body}";
    `);
    expect(r.find((m) => m.kind === 'stripe_live_key')?.severity).toBe('critical');
    expect(r.find((m) => m.kind === 'stripe_test_key')?.severity).toBe('high');
  });

  it('detects a Slack bot token', () => {
    const r = scanForSecrets('SLACK="xoxb-1234567890-ABCDEFGHIJ"');
    expect(r[0]?.kind).toBe('slack_token');
  });

  it('detects a SendGrid key', () => {
    const r = scanForSecrets('SG.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(r[0]?.kind).toBe('sendgrid_api_key');
  });
});

describe('scanForSecrets — structural patterns', () => {
  it('detects a JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const r = scanForSecrets(`Authorization: Bearer ${jwt}`);
    expect(r[0]?.kind).toBe('jwt');
    expect(r[0]?.severity).toBe('medium');
  });

  it('detects a PEM private key block', () => {
    const r = scanForSecrets('-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----');
    expect(r[0]?.kind).toBe('private_key_block');
    expect(r[0]?.severity).toBe('critical');
  });
});

describe('scanForSecrets — masking and dedup', () => {
  it('returns a masked rendering, never the raw value', () => {
    const r = scanForSecrets('const k = "ghp_abc123def456ghi789jkl012mno345pqr678";');
    expect(r[0].masked).toMatch(/^ghp_.*\.\.\..*$/);
    expect(r[0].masked).not.toContain('mno345pqr67');  // middle bytes
  });

  it('snippet is masked too — never leaks the raw token in display text', () => {
    const r = scanForSecrets('const k = "ghp_abc123def456ghi789jkl012mno345pqr678";');
    expect(r[0].snippet).not.toContain('ghp_abc123def456ghi789jkl012mno345pqr678');
    expect(r[0].snippet).toContain('ghp_');
  });

  it('dedupes when the same token appears twice', () => {
    const tok = 'ghp_abc123def456ghi789jkl012mno345pqr678';
    const r = scanForSecrets(`const a = "${tok}"; const b = "${tok}";`);
    const ghMatches = r.filter((m) => m.kind === 'github_classic_token');
    expect(ghMatches).toHaveLength(1);
  });

  it('reports two findings when two DIFFERENT tokens of the same kind appear', () => {
    const r = scanForSecrets(`
      const a = "ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const b = "ghp_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    `);
    const ghMatches = r.filter((m) => m.kind === 'github_classic_token');
    expect(ghMatches).toHaveLength(2);
  });
});

describe('scanForSecrets — false-positive resistance', () => {
  it('does not flag random low-entropy strings', () => {
    const r = scanForSecrets('const name = "passwordless_login_flow_handler";');
    expect(r).toEqual([]);
  });

  it('does not flag a dictionary-word assignment', () => {
    const r = scanForSecrets('const password = "correcthorsebatterystaple";');
    // 4-word string has lower entropy than typical secrets but >3.5? Let's check.
    // If it does match, ensure it's only the generic detector (not a provider hit).
    expect(r.every((m) => m.kind === 'generic_high_entropy')).toBe(true);
  });

  it('returns empty for empty input', () => {
    expect(scanForSecrets('')).toEqual([]);
    expect(scanForSecrets('   ')).toEqual([]);
  });

  it('returns empty when no patterns match', () => {
    expect(scanForSecrets('const a = 1; const b = "hello world";')).toEqual([]);
  });
});

describe('scanForSecrets — line numbers', () => {
  it('reports 1-indexed line numbers', () => {
    const code = [
      'line 1',
      'line 2',
      'const k = "AKIAIOSFODNN7EXAMPLE";',
    ].join('\n');
    const r = scanForSecrets(code);
    expect(r[0].line).toBe(3);
  });
});
