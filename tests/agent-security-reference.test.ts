import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const routeFiles = [
  'src/pages/agent-security/index.astro',
  'src/pages/agent-security/checklist/index.astro',
  'src/pages/agent-security/evidence-demo/index.astro',
  'src/pages/agent-security/reference/tool-and-action-safety/index.astro',
];

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('AI Agent Security Reference Hub', () => {
  it('ships all four initial public routes with claim boundaries', () => {
    for (const route of routeFiles) {
      const source = read(route);
      expect(source).toContain('AgentSecurityLayout');
      expect(source).not.toMatch(/guaranteed safe|completely secure|auditor accepts|監査.*受け入れられる|安全性を保証/iu);
    }
    expect(read('src/pages/agent-security/index.astro')).toContain('認証するものではありません');
    expect(read('src/pages/agent-security/evidence-demo/index.astro')).toContain('監査受容を保証しません');
  });

  it('uses source-specific Gumroad attribution', () => {
    const data = read('src/data/agent-security.ts');
    expect(data).toContain("utm_source: 'aoifuture_reference'");
    expect(data).toContain("utm_medium: 'organic'");
    expect(data).toContain("utm_campaign: 'agent_security_funnel'");
    for (const route of routeFiles) {
      const source = read(route);
      if (source.includes('gumroadUrl(')) expect(source).toContain('data-as-track="gumroad_click"');
    }
  });

  it('explains TH, CT, REQ, and VT before readers need the book', () => {
    const guide = read('src/components/SecurityNotationGuide.astro');
    const data = read('src/data/agent-security.ts');
    const layout = read('src/layouts/AgentSecurityLayout.astro');
    const hub = read('src/pages/agent-security/index.astro');
    const linkedRoutes = routeFiles.slice(1).map(read);

    expect(hub).toContain('<SecurityNotationGuide />');
    expect(guide).toContain('id="how-to-read"');
    expect(guide).toContain('専門家だけが使う暗号ではありません');
    expect(guide).toContain('VT-S-011-SHELL');
    expect(guide).toContain('一対一の変換でも、総合点でもなく');
    expect(data).toContain("code: 'TH'");
    expect(data).toContain("code: 'CT'");
    expect(data).toContain("code: 'REQ'");
    expect(data).toContain("code: 'VT'");
    expect(data).toContain('SHALLは必須');
    expect(layout).toContain('/agent-security/#how-to-read');
    for (const source of linkedRoutes) expect(source).toContain('/agent-security/#how-to-read');
  });

  it('publishes the verified sample archive and manifest references', () => {
    const zipPath = join(root, 'public/agent-security/evidence-demo/AI-Agent-Security-Sample-Evidence.zip');
    const digest = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
    expect(digest).toBe('90b494ddea862e0d595ec6303597f275b04303f7756c5d2296320a92e4de1cbf');

    const names = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
    expect(names).toContain('sample-evidence-fail/sample-verification-fail.json');
    expect(names).toContain('sample-evidence-fail/sample-verification-fail.pdf');
    expect(names).toContain('sample-evidence-fail/sample-verification-fail.manifest.json');
    expect(names).toContain('sample-evidence-fail/sample-verification-fail.tsr');

    const jsonBytes = execFileSync('unzip', ['-p', zipPath, 'sample-evidence-fail/sample-verification-fail.json']);
    const artifact = JSON.parse(jsonBytes.toString('utf8'));
    const ids = artifact.results.map((result: { id: string }) => result.id);
    expect(ids).toHaveLength(28);
    expect(new Set(ids).size).toBe(28);
    expect(artifact.summary.counts).toEqual({ PASS: 7, FAIL: 20, SKIP: 1, ERROR: 0 });

    const byTitle = new Map(artifact.results.map((result: { title: string }) => [result.title, result]));
    expect(byTitle.get("Code tool 'shell' runs sandboxed")).toMatchObject({ id: 'VT-S-012B-SHELL', requirement: 'REQ-012', threat: 'TH-02' });
    expect(byTitle.get("High-impact tool 'wire-transfer' approval shows concrete effects")).toMatchObject({ id: 'VT-S-015A-WIRE-TRANSFER', requirement: 'REQ-015', threat: 'TH-02' });
    expect(byTitle.get('Memory writes are privileged and reversible')).toMatchObject({ id: 'VT-S-022', requirement: 'REQ-022', threat: 'TH-04' });
    expect(byTitle.get('Webhook rejects a tampered body')).toMatchObject({ id: 'VT-D-011B', requirement: 'REQ-011', threat: 'TH-02' });

    const manifestText = execFileSync('unzip', ['-p', zipPath, 'sample-evidence-fail/sample-verification-fail.manifest.json'], { encoding: 'utf8' });
    const manifest = JSON.parse(manifestText);
    const jsonDigest = createHash('sha256').update(jsonBytes).digest('hex');
    expect(jsonDigest).toBe('5f630a55fabc0732dc01b89f4f89252602f8d8740fa88ef061ad6f62c3523370');
    expect(manifest.report_json_sha256).toBe(jsonDigest);
    expect(manifest.report_json).toBe('sample-verification-fail.json');
    expect(manifest.timestamp.token_file).toBe('sample-verification-fail.tsr');

    const readme = execFileSync('unzip', ['-p', zipPath, 'sample-evidence-fail/README.md'], { encoding: 'utf8' });
    expect(readme).toContain('Input configuration: not included');
    expect(readme).toContain('not a customer assessment');
    expect(readme).toContain('core-runtime-v1');
    expect(readme).toContain('https://freetsa.org/files/cacert.pem');
    expect(readme).toContain('curl -fsSLo freetsa-cacert.pem');
    expect(readme).toContain('2151b61137ffa86bf664691ba67e7da0b19f98c758e3d228d5d8ebf27e044438');
  });

  it('keeps the checklist downloadable and local-only', () => {
    const page = read('src/pages/agent-security/checklist/index.astro');
    const markdown = read('public/agent-security/ai-agent-security-checklist-ja.md');
    expect(page).toContain('localStorage');
    expect(page).not.toContain('fetch(');
    expect(markdown).toContain('REQ-001');
    expect(markdown).toContain('REQ-050');
    expect(markdown).toContain('安全性や準拠を認証するものではありません');
  });

  it('does not hide the page behind client hydration', () => {
    const transition = read('src/components/PageTransition.tsx');
    expect(transition).not.toMatch(/body\s*\{[^}]*opacity:\s*0/s);
    expect(transition).toContain('body { opacity: 1; }');
  });
});
