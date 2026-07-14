import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Turnstile client lifecycle', () => {
  it('resets consumed tokens on edit, failure, and success in both AOI forms', async () => {
    const contact = await readFile(new URL('../src/pages/contact.astro', import.meta.url), 'utf8');
    const consultation = await readFile(new URL('../src/scripts/consultation-intake.ts', import.meta.url), 'utf8');
    for (const source of [contact, consultation]) {
      expect(source).toContain('resetTurnstile');
      expect(source).toMatch(/reset\?\./);
      expect(source).toMatch(/catch\s*\{\s*resetTurnstile\(\)/);
      expect(source).toMatch(/form\.reset\(\);\s*resetTurnstile\(\)/);
    }
  });
});
