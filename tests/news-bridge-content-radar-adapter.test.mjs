import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, linkSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { adaptContentRadarPacket, stableJson } from '../scripts/news-bridge/adapt-content-radar-packet.mjs';

const root = new URL('..', import.meta.url);
const sortValue = (value) => {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  return value;
};
const packetIntegrity = (packet) => createHash('sha256')
  .update(JSON.stringify(sortValue(Object.fromEntries(Object.entries(packet).filter(([key]) => key !== 'integrity')))))
  .digest('hex');

function packet(items = [{
  source: {
    url: 'https://arxiv.org/abs/2607.01234?utm_source=content-radar&b=2&a=1#abstract',
    title: 'Private source title must not cross the boundary',
    domain: 'arxiv.org',
    kind: 'paper',
  },
  observed_at: '2026-07-27T09:00:00+09:00',
  headline: 'Private upstream headline must not cross the boundary',
  summary: 'Private upstream summary must not cross the boundary',
  source_type: 'radar_source_brief_note',
  provenance_locator: '/private/radar/2026-07-27.json',
}]) {
  const result = {
    schema: 'content-radar.private-candidate-packet.v1',
    version: 1,
    generated_at: '2026-07-27T09:05:00+09:00',
    selected_count: items.length,
    items,
  };
  result.integrity = { algorithm: 'sha256', content_sha256: packetIntegrity(result) };
  return result;
}

function config() {
  return {
    schema_version: 'aoi.news.content-radar-adapter-config.v1',
    candidate_language: 'en',
    edition: {
      edition_id: '2026-07-27-0900',
      edition_date: '2026-07-27',
      coverage_kind: 'selection-snapshot',
      coverage_observed_at: '2026-07-27T09:00:00+09:00',
      generated_at: '2026-07-27T09:10:00+09:00',
      published_at: '2026-07-27T09:10:00+09:00',
      title: 'Private review framing supplied locally',
      topics: [{ id: 'ai-research', label_ja: 'AI研究', label_en: 'AI research' }],
    },
  };
}

function invalid(mutate, expectedCode) {
  const sourcePacket = packet();
  const adapterConfig = config();
  mutate(sourcePacket, adapterConfig);
  const result = adaptContentRadarPacket(sourcePacket, adapterConfig);
  expect(result.ok, JSON.stringify(result.errors, null, 2)).toBe(false);
  expect(result.errors.map((entry) => entry.code)).toContain(expectedCode);
}

function writeInputs(directory, sourcePacket = packet(), adapterConfig = config()) {
  writeFileSync(join(directory, 'packet.json'), JSON.stringify(sourcePacket));
  writeFileSync(join(directory, 'config.json'), JSON.stringify(adapterConfig));
}

describe('Content Radar packet adapter', () => {
  it('emits only deterministic AOIFUTURE private review input fields with opaque identities', () => {
    const result = adaptContentRadarPacket(packet(), config());
    expect(result.ok, JSON.stringify(result.errors, null, 2)).toBe(true);
    expect(result.packet).toEqual({
      schema_version: 'aoi.news.private-candidate-packet.v1',
      edition: config().edition,
      candidates: [{
        candidate_id: expect.stringMatching(/^cr-[0-9a-f]{64}$/),
        source_url: 'https://arxiv.org/abs/2607.01234?a=1&b=2',
        source_kind: 'paper',
        language: 'en',
        observed_at: '2026-07-27T09:00:00+09:00',
        context_ids: [],
      }],
    });
    const rendered = stableJson(result.packet);
    for (const privateValue of [
      'Private source title', 'Private upstream headline', 'Private upstream summary',
      'provenance_locator', '/private/radar', 'radar_source_brief_note', 'content_sha256',
    ]) expect(rendered).not.toContain(privateValue);
  });

  it('rejects invalid upstream identity, schema, integrity, privacy fields, URLs, times, kinds, and duplicate canonical sources', () => {
    invalid((sourcePacket) => { sourcePacket.schema = 'content-radar.other.v1'; sourcePacket.integrity.content_sha256 = packetIntegrity(sourcePacket); }, 'schema');
    invalid((sourcePacket) => { sourcePacket.items[0].summary = 'tampered'; }, 'integrity');
    invalid((sourcePacket) => { sourcePacket.items[0].score = 99; sourcePacket.integrity.content_sha256 = packetIntegrity(sourcePacket); }, 'schema');
    invalid((sourcePacket) => { sourcePacket.items[0].source.url = 'https://user:pass@arxiv.org/abs/2607.01234'; sourcePacket.integrity.content_sha256 = packetIntegrity(sourcePacket); }, 'schema');
    invalid((sourcePacket) => { sourcePacket.items[0].observed_at = 'not-a-time'; sourcePacket.integrity.content_sha256 = packetIntegrity(sourcePacket); }, 'schema');
    invalid((sourcePacket) => { sourcePacket.items[0].source.kind = 'unknown'; sourcePacket.integrity.content_sha256 = packetIntegrity(sourcePacket); }, 'unsupported_source_kind');
    invalid((sourcePacket) => {
      sourcePacket.items.push({ ...sourcePacket.items[0], source: { ...sourcePacket.items[0].source, url: 'https://arxiv.org/abs/2607.01234?a=1&b=2' } });
      sourcePacket.selected_count = 2;
      sourcePacket.integrity.content_sha256 = packetIntegrity(sourcePacket);
    }, 'duplicate_source_url');
  });

  it('rejects an unexpected or malformed local framing config', () => {
    invalid((_sourcePacket, adapterConfig) => { adapterConfig.unexpected = 'private'; }, 'schema');
    invalid((_sourcePacket, adapterConfig) => { adapterConfig.edition.edition_date = '2026-07-28'; }, 'edition_date_coherence');
    invalid((_sourcePacket, adapterConfig) => { adapterConfig.candidate_language = 'fr'; }, 'schema');
  });

  it('writes only stable output atomically after valid input and refuses public roots and aliases', () => {
    const directory = mkdtempSync(join(tmpdir(), 'content-radar-adapter-'));
    try {
      writeInputs(directory);
      const output = join(directory, 'output', 'private-candidate-packet.json');
      const args = [
        'scripts/news-bridge/adapt-content-radar-packet.mjs', '--packet', join(directory, 'packet.json'),
        '--config', join(directory, 'config.json'), '--output', output,
      ];
      execFileSync('node', args, { cwd: root, encoding: 'utf8' });
      const first = readFileSync(output, 'utf8');
      execFileSync('node', args, { cwd: root, encoding: 'utf8' });
      expect(readFileSync(output, 'utf8')).toBe(first);

      const publicOutput = new URL('../src/content/news/content-radar-adapter.json', import.meta.url).pathname;
      expect(() => execFileSync('node', [
        'scripts/news-bridge/adapt-content-radar-packet.mjs', '--packet', join(directory, 'packet.json'),
        '--config', join(directory, 'config.json'), '--output', publicOutput,
      ], { cwd: root, encoding: 'utf8', stdio: 'pipe' })).toThrow();
      expect(existsSync(publicOutput)).toBe(false);

      const alias = join(directory, 'public-alias');
      symlinkSync(new URL('../dist/client', import.meta.url).pathname, alias, 'dir');
      expect(() => execFileSync('node', [
        'scripts/news-bridge/adapt-content-radar-packet.mjs', '--packet', join(directory, 'packet.json'),
        '--config', join(directory, 'config.json'), '--output', join(alias, 'packet.json'),
      ], { cwd: root, encoding: 'utf8', stdio: 'pipe' })).toThrow();
      expect(existsSync(join(alias, 'packet.json'))).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects symlink outputs and canonical aliases of either input without replacing private files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'content-radar-adapter-'));
    try {
      writeInputs(directory);
      const packetPath = join(directory, 'packet.json');
      const configPath = join(directory, 'config.json');
      const args = (output, configInput = configPath) => [
        'scripts/news-bridge/adapt-content-radar-packet.mjs', '--packet', packetPath,
        '--config', configInput, '--output', output,
      ];

      const privateTarget = join(directory, 'private-target.json');
      const privateContents = '{"private":"must remain unchanged"}\n';
      writeFileSync(privateTarget, privateContents);
      const outputLink = join(directory, 'output-link.json');
      symlinkSync(privateTarget, outputLink, 'file');
      expect(() => execFileSync('node', args(outputLink), { cwd: root, encoding: 'utf8', stdio: 'pipe' })).toThrow();
      expect(readFileSync(privateTarget, 'utf8')).toBe(privateContents);

      const packetContents = readFileSync(packetPath, 'utf8');
      const packetAlias = join(directory, 'packet-alias.json');
      symlinkSync(packetPath, packetAlias, 'file');
      expect(() => execFileSync('node', args(packetAlias), { cwd: root, encoding: 'utf8', stdio: 'pipe' })).toThrow();
      expect(readFileSync(packetPath, 'utf8')).toBe(packetContents);

      const packetHardLink = join(directory, 'packet-hard-link.json');
      linkSync(packetPath, packetHardLink);
      expect(() => execFileSync('node', args(packetHardLink), { cwd: root, encoding: 'utf8', stdio: 'pipe' })).toThrow();
      expect(readFileSync(packetPath, 'utf8')).toBe(packetContents);

      const configContents = readFileSync(configPath, 'utf8');
      const configAlias = join(directory, 'config-alias.json');
      symlinkSync(configPath, configAlias, 'file');
      expect(() => execFileSync('node', args(configPath, configAlias), { cwd: root, encoding: 'utf8', stdio: 'pipe' })).toThrow();
      expect(readFileSync(configPath, 'utf8')).toBe(configContents);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not create output when validation fails', () => {
    const directory = mkdtempSync(join(tmpdir(), 'content-radar-adapter-'));
    try {
      const sourcePacket = packet();
      sourcePacket.items[0].source.kind = 'unknown';
      sourcePacket.integrity.content_sha256 = packetIntegrity(sourcePacket);
      writeInputs(directory, sourcePacket);
      const output = join(directory, 'output', 'private-candidate-packet.json');
      expect(() => execFileSync('node', [
        'scripts/news-bridge/adapt-content-radar-packet.mjs', '--packet', join(directory, 'packet.json'),
        '--config', join(directory, 'config.json'), '--output', output,
      ], { cwd: root, encoding: 'utf8', stdio: 'pipe' })).toThrow();
      expect(existsSync(output)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
