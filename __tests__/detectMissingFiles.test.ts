import { describe, it, expect } from 'vitest';
import { detectMissingFiles } from '@/lib/detectMissingFiles';

describe('detectMissingFiles', () => {
  it('returns no missing imports when the paste only has npm imports', () => {
    const code = `
      import { z } from 'zod';
      import express from 'express';
      const app = express();
    `;
    const { missing } = detectMissingFiles(code);
    expect(missing).toEqual([]);
  });

  it('flags a single unresolved alias-prefixed import in single-file paste', () => {
    const code = `
      import { db } from '@/lib/db';
      import { auth } from '@/lib/auth';
      export function handler() { return db.query(); }
    `;
    const { missing } = detectMissingFiles(code);
    const paths = missing.map((m) => m.importPath).sort();
    expect(paths).toEqual(['@/lib/auth', '@/lib/db']);
    expect(missing[0].fromFile).toBeNull();
  });

  it('flags a relative import not in the bundle', () => {
    const code = `import { helper } from './utils';\nexport function f() {}`;
    const { missing } = detectMissingFiles(code);
    expect(missing.map((m) => m.importPath)).toEqual(['./utils']);
  });

  it('resolves alias imports against bundled files (--- path ---)', () => {
    const code = [
      '--- app/api/users/route.ts ---',
      "import { db } from '@/lib/db';",
      "import { auth } from '@/lib/auth';",
      'export function GET() { return db.query(); }',
      '',
      '--- lib/db.ts ---',
      'export const db = { query: () => null };',
      '',
      '--- lib/auth.ts ---',
      'export const auth = { check: () => true };',
    ].join('\n');
    const { missing } = detectMissingFiles(code);
    expect(missing).toEqual([]);
  });

  it('flags only the unresolved import when one is bundled and one is not', () => {
    const code = [
      '--- app/api/users/route.ts ---',
      "import { db } from '@/lib/db';",
      "import { auth } from '@/lib/auth';",
      'export function GET() { return db.query(); }',
      '',
      '--- lib/db.ts ---',
      'export const db = { query: () => null };',
    ].join('\n');
    const { missing } = detectMissingFiles(code);
    expect(missing.map((m) => m.importPath)).toEqual(['@/lib/auth']);
    expect(missing[0].fromFile).toBe('app/api/users/route.ts');
  });

  it('handles CommonJS require()', () => {
    const code = `const helper = require('./helper');\nmodule.exports = helper();`;
    const { missing } = detectMissingFiles(code);
    expect(missing.map((m) => m.importPath)).toEqual(['./helper']);
  });

  it('handles Python relative imports', () => {
    const code = `from .helpers import compute\nfrom typing import List\ndef f(): pass`;
    const { missing } = detectMissingFiles(code);
    expect(missing.map((m) => m.importPath)).toEqual(['.helpers']);
  });

  it('ignores duplicate imports', () => {
    const code = `
      import { a } from '@/lib/utils';
      import { b } from '@/lib/utils';
      import { c } from '@/lib/utils';
    `;
    const { missing } = detectMissingFiles(code);
    expect(missing).toHaveLength(1);
  });
});
