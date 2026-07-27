import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareReviewCandidate, stableJson } from '../scripts/news-bridge/prepare-review-candidate.mjs';
import { validatePublicCatalog } from '../scripts/news-contract/validator.mjs';

const fixture = (path) => JSON.parse(readFileSync(new URL(`../fixtures/news-bridge/${path}`, import.meta.url), 'utf8'));
const packet = () => fixture('private/packet.json');
const receipts = () => fixture('private/receipts.json');
const decisions = () => fixture('private/decisions.json');
const expected = () => fixture('review/review-candidate.json');
const codes = (result) => result.errors.map((entry) => entry.code);

function expectInvalid(mutate, code) {
  const candidatePacket = packet();
  const candidateReceipts = receipts();
  const candidateDecisions = decisions();
  mutate(candidatePacket, candidateReceipts, candidateDecisions);
  const result = prepareReviewCandidate(candidatePacket, candidateReceipts, candidateDecisions);
  expect(result.ok, JSON.stringify(result.errors, null, 2)).toBe(false);
  expect(codes(result)).toContain(code);
}

function writeInputs(root, override = {}) {
  const inputs = { packet: packet(), receipts: receipts(), decisions: decisions(), ...override };
  for (const [name, value] of Object.entries(inputs)) writeFileSync(join(root, `${name}.json`), JSON.stringify(value));
  return inputs;
}

describe('AOIFUTURE News review-only candidate bridge', () => {
  it('creates the public-safe expected review candidate and passes catalog validation in review mode', () => {
    const result = prepareReviewCandidate(packet(), receipts(), decisions());
    expect(result).toEqual({ ok: true, candidate: expected() });
    expect(validatePublicCatalog([result.candidate.edition], [])).toEqual({ ok: true, errors: [] });
  });

  it('accepts a real-shape Signal without source publication time and keeps it review-only', () => {
    const candidatePacket = packet();
    delete candidatePacket.candidates[0].published_at;

    const result = prepareReviewCandidate(candidatePacket, receipts(), decisions());

    expect(result.ok, JSON.stringify(result.errors, null, 2)).toBe(true);
    expect(result.candidate.publication_status).toBe('review-only');
    expect(result.candidate.edition.publication_status).toBe('review-only');
    expect(result.candidate.edition.items[0]).not.toHaveProperty('published_at');
    expect(validatePublicCatalog([result.candidate.edition], [])).toEqual({ ok: true, errors: [] });
  });

  it('rejects an invalid optional Signal source publication time', () => {
    expectInvalid((candidatePacket) => { candidatePacket.candidates[0].published_at = '2026-02-30T08:00:00+09:00'; }, 'schema');
  });

  it('is byte-stable through the explicit-path CLI and never emits gate-only fields', () => {
    const root = mkdtempSync(join(tmpdir(), 'news-bridge-'));
    try {
      writeInputs(root);
      const args = [
        'scripts/news-bridge/prepare-review-candidate.mjs', '--packet', join(root, 'packet.json'),
        '--receipts', join(root, 'receipts.json'), '--decisions', join(root, 'decisions.json'), '--output-dir', join(root, 'output'),
      ];
      execFileSync('node', args, { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
      const first = readFileSync(join(root, 'output/review-candidate.json'), 'utf8');
      execFileSync('node', args, { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
      const second = readFileSync(join(root, 'output/review-candidate.json'), 'utf8');
      expect(first).toBe(second);
      expect(first).toBe(stableJson(expected()));
      for (const privateValue of ['news-editor', 'Agent controls announcement, permissions section', 'candidate_id', 'reviewed_by', 'approved_at', 'claim_locator']) {
        expect(first).not.toContain(privateValue);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails before creating output for invalid private gate data', () => {
    const root = mkdtempSync(join(tmpdir(), 'news-bridge-'));
    try {
      const invalidReceipts = receipts();
      invalidReceipts[0].normalized_source_url = 'https://example.com/other';
      writeInputs(root, { receipts: invalidReceipts });
      expect(() => execFileSync('node', [
        'scripts/news-bridge/prepare-review-candidate.mjs', '--packet', join(root, 'packet.json'),
        '--receipts', join(root, 'receipts.json'), '--decisions', join(root, 'decisions.json'), '--output-dir', join(root, 'output'),
      ], { cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: 'pipe' })).toThrow();
      expect(existsSync(join(root, 'output/review-candidate.json'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['tracked public News content', new URL('../src/content/news', import.meta.url).pathname],
    ['tracked public News content through traversal', `${new URL('../src/content/news', import.meta.url).pathname}/../news`],
    ['generated public site output', new URL('../dist/client/news', import.meta.url).pathname],
    ['generated public site output through traversal', `${new URL('../dist/client/news', import.meta.url).pathname}/..`],
  ])('refuses to write a review candidate into %s', (_name, outputDirectory) => {
    const root = mkdtempSync(join(tmpdir(), 'news-bridge-'));
    try {
      writeInputs(root);
      expect(() => execFileSync('node', [
        'scripts/news-bridge/prepare-review-candidate.mjs', '--packet', join(root, 'packet.json'),
        '--receipts', join(root, 'receipts.json'), '--decisions', join(root, 'decisions.json'), '--output-dir', outputDirectory,
      ], { cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: 'pipe' })).toThrow();
      expect(existsSync(join(outputDirectory, 'review-candidate.json'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['tracked public News content', new URL('../src/content/news', import.meta.url).pathname],
    ['generated public site output', new URL('../dist/client', import.meta.url).pathname],
  ])('refuses a symlink alias for %s before creating a review candidate', (_name, publicRoot) => {
    const root = mkdtempSync(join(tmpdir(), 'news-bridge-'));
    const outputDirectory = join(root, 'public-alias');
    try {
      writeInputs(root);
      symlinkSync(publicRoot, outputDirectory, 'dir');
      expect(() => execFileSync('node', [
        'scripts/news-bridge/prepare-review-candidate.mjs', '--packet', join(root, 'packet.json'),
        '--receipts', join(root, 'receipts.json'), '--decisions', join(root, 'decisions.json'), '--output-dir', outputDirectory,
      ], { cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: 'pipe' })).toThrow();
      expect(existsSync(join(publicRoot, 'review-candidate.json'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects URL mismatch, receipt reuse, raw body, public status, external URL, and unknown fields', () => {
    expectInvalid((_packet, candidateReceipts) => { candidateReceipts[0].normalized_source_url = 'https://example.com/other'; }, 'source_url_mismatch');
    expectInvalid((candidatePacket, candidateReceipts, candidateDecisions) => {
      candidatePacket.candidates.push({ ...candidatePacket.candidates[0], candidate_id: 'sig-radar-agent-controls-002' });
      candidateDecisions.push({ ...candidateDecisions[0], candidate_id: 'sig-radar-agent-controls-002' });
      candidateReceipts.push({ ...candidateReceipts[0], candidate_id: 'sig-radar-agent-controls-002' });
    }, 'duplicate_source_url');
    expectInvalid((candidatePacket) => { candidatePacket.candidates[0].source_body = 'private source text'; }, 'schema');
    expectInvalid((candidatePacket) => { candidatePacket.publication_status = 'public'; }, 'schema');
    expectInvalid((_packet, _receipts, candidateDecisions) => { candidateDecisions[0].public_fields.external_url = 'https://untrusted.example/'; }, 'schema');
    expectInvalid((candidatePacket) => { candidatePacket.edition.internal_score = 99; }, 'schema');
  });
});
