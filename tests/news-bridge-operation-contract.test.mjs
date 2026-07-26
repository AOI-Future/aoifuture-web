import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanPublicNewsTree } from '../scripts/news-bridge/public-content-privacy.mjs';

const root = new URL('..', import.meta.url);
const fixture = (path) => JSON.parse(readFileSync(new URL(`../fixtures/news-bridge/${path}`, import.meta.url), 'utf8'));

function writeBridgeInputs(directory) {
  for (const [name, value] of Object.entries({
    packet: fixture('private/packet.json'),
    receipts: fixture('private/receipts.json'),
    decisions: fixture('private/decisions.json'),
  })) writeFileSync(join(directory, `${name}.json`), JSON.stringify(value));
}

describe('AOIFUTURE News bridge operation privacy contract', () => {
  it('keeps tracked public News content free of private bridge markers', () => {
    expect(scanPublicNewsTree(new URL('../src/content/news', import.meta.url).pathname)).toEqual([]);
  });

  it.each([
    ['receipt field', 'candidate_id'],
    ['private decision field', 'inclusion_decision'],
    ['local path', '/Users/editor/private/receipts.json'],
    ['raw source text field', 'source_body'],
    ['internal bridge artifact', 'content-radar'],
  ])('detects a %s in a public artifact', (_name, marker) => {
    const directory = mkdtempSync(join(tmpdir(), 'news-public-privacy-'));
    try {
      writeFileSync(join(directory, 'index.html'), `<p>${marker}</p>`);
      expect(scanPublicNewsTree(directory)).toEqual([{ path: 'index.html', marker: expect.any(String) }]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('creates an inspectable review-only candidate outside public content without promotion', () => {
    const directory = mkdtempSync(join(tmpdir(), 'news-review-inspection-'));
    try {
      writeBridgeInputs(directory);
      execFileSync('node', [
        'scripts/news-bridge/prepare-review-candidate.mjs', '--packet', join(directory, 'packet.json'),
        '--receipts', join(directory, 'receipts.json'), '--decisions', join(directory, 'decisions.json'), '--output-dir', join(directory, 'inspection'),
      ], { cwd: root, encoding: 'utf8' });
      const outputDirectory = join(directory, 'inspection');
      const candidate = JSON.parse(readFileSync(join(outputDirectory, 'review-candidate.json'), 'utf8'));
      expect(readdirSync(outputDirectory)).toEqual(['review-candidate.json']);
      expect(candidate.publication_status).toBe('review-only');
      expect(candidate.edition.publication_status).toBe('review-only');
      expect(scanPublicNewsTree(outputDirectory)).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
