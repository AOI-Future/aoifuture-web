import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { candidateHash, promoteReviewedCandidate, stableJson } from '../scripts/news-promotion/promote-reviewed-candidate.mjs';

const root = new URL('..', import.meta.url);
const reviewCandidate = () => JSON.parse(readFileSync(new URL('../fixtures/news-bridge/review/review-candidate.json', import.meta.url), 'utf8'));
const approvalFor = (candidate, overrides = {}) => ({
  schema_version: 'aoi.news.public-promotion-approval.v1',
  edition_id: candidate.edition.edition_id,
  candidate_sha256: candidateHash(candidate),
  target_publication_status: 'public',
  approved_at: '2026-07-26T10:00:00+09:00',
  ...overrides,
});

function catalog(rootDirectory) {
  const directory = join(rootDirectory, 'catalog');
  for (const path of ['editions', 'events', 'contexts']) {
    mkdirSync(join(directory, path), { recursive: true });
    writeFileSync(join(directory, path, '.gitkeep'), '');
  }
  return directory;
}

function outputPaths(directory, editionId = reviewCandidate().edition.edition_id) {
  return [
    join(directory, 'editions', `${editionId}.json`),
    join(directory, 'events', `${editionId}.json`),
  ];
}

function expectNoOutput(directory, editionId) {
  for (const path of outputPaths(directory, editionId)) expect(existsSync(path)).toBe(false);
}

describe('AOIFUTURE News reviewed candidate promotion', () => {
  it('promotes only a reviewed candidate bound to a separate approval into deterministic public Edition and event objects', () => {
    const candidate = reviewCandidate();
    const approval = approvalFor(candidate);
    const directory = mkdtempSync(join(tmpdir(), 'news-reviewed-promotion-'));
    try {
      const outputDirectory = catalog(directory);
      const first = promoteReviewedCandidate(candidate, approval, outputDirectory);
      expect(first.ok, JSON.stringify(first.errors, null, 2)).toBe(true);
      expect(first.edition.publication_status).toBe('public');
      expect(first.event).toMatchObject({
        schema_version: 'aoi.news.edition-event.v1',
        event_id: 'aoi-news-2026-07-26-0900-r001',
        edition_id: '2026-07-26-0900',
        revision: 1,
        event_kind: 'edition-published',
        changed_signal_ids: ['sig-radar-agent-controls-001'],
      });
      const firstBytes = outputPaths(outputDirectory).map((path) => readFileSync(path, 'utf8'));
      const second = promoteReviewedCandidate(candidate, approval, outputDirectory);
      expect(second.ok, JSON.stringify(second.errors, null, 2)).toBe(true);
      expect(outputPaths(outputDirectory).map((path) => readFileSync(path, 'utf8'))).toEqual(firstBytes);
      expect(firstBytes[0]).toBe(stableJson(first.edition));
      expect(firstBytes[1]).toBe(stableJson([first.event]));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    ['wrong candidate status', (candidate, approval) => { candidate.publication_status = 'public'; return approval; }, 'review_only_required'],
    ['missing approval', (_candidate, _approval) => undefined, 'approval_missing'],
    ['approval edition mismatch', (_candidate, approval) => ({ ...approval, edition_id: '2026-07-26-0910' }), 'approval_binding'],
    ['approval hash mismatch', (_candidate, approval) => ({ ...approval, candidate_sha256: '0'.repeat(64) }), 'approval_binding'],
    ['approval target status', (_candidate, approval) => ({ ...approval, target_publication_status: 'review-only' }), 'approval_target_status'],
    ['private field injection', (candidate, approval) => { candidate.edition.items[0].source_body = 'private source text'; return approval; }, 'private_field'],
    ['local path injection', (candidate, approval) => { candidate.edition.edition_note = '/Users/editor/private/note'; return approval; }, 'private_field'],
  ])('fails closed with no writes for %s', (_name, mutate, expectedCode) => {
    const candidate = reviewCandidate();
    const approval = approvalFor(candidate);
    const directory = mkdtempSync(join(tmpdir(), 'news-reviewed-promotion-'));
    try {
      const outputDirectory = catalog(directory);
      const result = promoteReviewedCandidate(candidate, mutate(candidate, approval), outputDirectory);
      expect(result.ok).toBe(false);
      expect(result.errors.map((entry) => entry.code)).toContain(expectedCode);
      expectNoOutput(outputDirectory);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects duplicate Edition/event history conflicts before writing either tracked public file', () => {
    const candidate = reviewCandidate();
    const directory = mkdtempSync(join(tmpdir(), 'news-reviewed-promotion-'));
    try {
      const outputDirectory = catalog(directory);
      writeFileSync(join(outputDirectory, 'editions', `${candidate.edition.edition_id}.json`), stableJson({ ...candidate.edition, publication_status: 'public' }));
      writeFileSync(join(outputDirectory, 'events', `${candidate.edition.edition_id}.json`), stableJson([{ event_id: 'aoi-news-2026-07-26-0900-r002' }]));
      const before = outputPaths(outputDirectory).map((path) => readFileSync(path, 'utf8'));
      const result = promoteReviewedCandidate(candidate, approvalFor(candidate), outputDirectory);
      expect(result.ok).toBe(false);
      expect(result.errors.map((entry) => entry.code)).toContain('duplicate_edition_id');
      expect(outputPaths(outputDirectory).map((path) => readFileSync(path, 'utf8'))).toEqual(before);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rolls back the Edition when committing the Event fails, without changing pre-existing catalog files', () => {
    const candidate = reviewCandidate();
    const directory = mkdtempSync(join(tmpdir(), 'news-reviewed-promotion-'));
    try {
      const outputDirectory = catalog(directory);
      const retainedPath = join(outputDirectory, 'contexts', '.gitkeep');
      writeFileSync(retainedPath, 'retained before promotion');
      const retainedBytes = readFileSync(retainedPath, 'utf8');
      let commits = 0;
      const result = promoteReviewedCandidate(candidate, approvalFor(candidate), outputDirectory, {
        commit: (temporary, output) => {
          commits += 1;
          if (commits === 2) throw new Error('injected Event commit failure');
          writeFileSync(output, readFileSync(temporary));
        },
      });
      expect(result.ok).toBe(false);
      expect(result.errors.map((entry) => entry.code)).toContain('promotion_commit');
      expect(commits).toBe(2);
      expectNoOutput(outputDirectory, candidate.edition.edition_id);
      expect(readFileSync(retainedPath, 'utf8')).toBe(retainedBytes);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not clobber an output created after validation but before commit', () => {
    const candidate = reviewCandidate();
    const directory = mkdtempSync(join(tmpdir(), 'news-reviewed-promotion-'));
    try {
      const outputDirectory = catalog(directory);
      const [editionPath, eventPath] = outputPaths(outputDirectory, candidate.edition.edition_id);
      const result = promoteReviewedCandidate(candidate, approvalFor(candidate), outputDirectory, {
        commit: (temporary, output) => {
          writeFileSync(output, 'concurrent pre-existing Edition');
          linkSync(temporary, output);
        },
      });
      expect(result.ok).toBe(false);
      expect(result.errors.map((entry) => entry.code)).toContain('tracked_output_collision');
      expect(readFileSync(editionPath, 'utf8')).toBe('concurrent pre-existing Edition');
      expect(existsSync(eventPath)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('CLI accepts only candidate, approval, and catalog arguments and writes no output for rejected raw input', () => {
    const directory = mkdtempSync(join(tmpdir(), 'news-reviewed-promotion-'));
    try {
      const candidate = reviewCandidate();
      const outputDirectory = catalog(directory);
      writeFileSync(join(directory, 'candidate.json'), stableJson(candidate));
      writeFileSync(join(directory, 'approval.json'), stableJson(approvalFor(candidate)));
      execFileSync('node', [
        'scripts/news-promotion/promote-reviewed-candidate.mjs', '--candidate', join(directory, 'candidate.json'),
        '--approval', join(directory, 'approval.json'), '--catalog-dir', outputDirectory,
      ], { cwd: root, encoding: 'utf8' });
      expect(readdirSync(join(outputDirectory, 'editions'))).toContain(`${candidate.edition.edition_id}.json`);
      expect(() => execFileSync('node', [
        'scripts/news-promotion/promote-reviewed-candidate.mjs', '--packet', join(directory, 'candidate.json'),
        '--approval', join(directory, 'approval.json'), '--catalog-dir', outputDirectory,
      ], { cwd: root, encoding: 'utf8', stdio: 'pipe' })).toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
