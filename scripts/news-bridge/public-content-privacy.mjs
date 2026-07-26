import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const privateMarkers = [
  ['private receipt schema', /aoi\.news\.source-read-receipt\.v1/i],
  ['private decision schema', /aoi\.news\.editorial-decision\.v1/i],
  ['private candidate packet schema', /aoi\.news\.private-candidate-packet\.v1/i],
  ['receipt candidate ID', /\bcandidate_id\b/i],
  ['receipt normalized URL', /\bnormalized_source_url\b/i],
  ['receipt claim locator', /\bclaim_locator\b/i],
  ['receipt reviewer identity', /\breviewed_by\b/i],
  ['receipt approval timestamp', /\bapproved_at\b/i],
  ['editorial inclusion decision', /\binclusion_decision\b/i],
  ['editorial public fields wrapper', /\bpublic_fields\b/i],
  ['private decision reason', /\bdecision_reason\b/i],
  ['raw source body field', /\bsource_body\b/i],
  ['raw source text field', /\braw_source_text\b/i],
  ['raw source article text field', /\barticle_text\b/i],
  ['private local path', /\/(?:Users|private|tmp|var\/folders)\//i],
  ['file URL', /\bfile:\/\//i],
  ['Windows local path', /\b[A-Z]:\\/i],
  ['Content Radar bridge artifact', /\b(?:content-radar|news-bridge|prepare-review-candidate|review-candidate\.json)\b/i],
];

function walkFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

function scanPublicNewsTree(root) {
  return walkFiles(root).flatMap((path) => {
    const content = readFileSync(path, 'utf8');
    return privateMarkers
      .filter(([, pattern]) => pattern.test(content))
      .map(([marker]) => ({ path: relative(root, path), marker }));
  });
}

export { scanPublicNewsTree };
