import {
  validateDocument,
  validateEditionSnapshot,
} from './validator.mjs';

const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
const error = (code, path, message) => ({ code, path, message });
const result = (errors) => ({
  ok: errors.length === 0,
  errors: errors.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code)),
});

export function validateRevisionEvents(events, editions) {
  const errors = [];
  if (!Array.isArray(events)) return result([error('event_collection', '/events', 'must be an array')]);
  if (!Array.isArray(editions)) return result([error('edition_collection', '/editions', 'must be an array')]);

  const editionMap = new Map();
  editions.forEach((edition, index) => {
    const validation = validateEditionSnapshot(edition, `/editions/${index}`);
    errors.push(...validation.errors);
    if (validation.ok) editionMap.set(edition.edition_id, edition);
  });

  const eventIds = new Set();
  const streams = new Map();
  events.forEach((event, index) => {
    const path = `/events/${index}`;
    const validation = validateDocument('editionEvent', event, path);
    errors.push(...validation.errors);
    if (!validation.ok) return;

    if (eventIds.has(event.event_id)) errors.push(error('duplicate_event_id', `${path}/event_id`, 'event IDs must be globally unique'));
    eventIds.add(event.event_id);

    const edition = editionMap.get(event.edition_id);
    if (!edition || edition.edition_date !== event.edition_date) {
      errors.push(error('unresolved_edition_reference', `${path}/edition_id`, 'event must reference a matching public Edition'));
      return;
    }
    const expectedUrl = `https://aoifuture.com/news/${edition.edition_date}/`;
    if (event.edition_url !== expectedUrl) {
      errors.push(error('edition_url', `${path}/edition_url`, `must equal ${expectedUrl}`));
    }
    const signalIds = new Set(edition.items.map((signal) => signal.id));
    event.changed_signal_ids.forEach((signalId, signalIndex) => {
      if (!signalIds.has(signalId)) {
        errors.push(error('unresolved_signal_reference', `${path}/changed_signal_ids/${signalIndex}`, `unknown public Signal ${signalId}`));
      }
    });
    if (['signals-added', 'signal-corrected', 'signal-withdrawn'].includes(event.event_kind)
      && event.changed_signal_ids.length === 0) {
      errors.push(error('changed_signals_required', `${path}/changed_signal_ids`, `${event.event_kind} requires changed public Signals`));
    }
    if (event.event_kind === 'edition-note-updated' && event.changed_signal_ids.length !== 0) {
      errors.push(error('changed_signals_forbidden', `${path}/changed_signal_ids`, 'Edition note events must not claim changed Signals'));
    }
    if (!streams.has(event.edition_id)) streams.set(event.edition_id, []);
    streams.get(event.edition_id).push({ event, path });
  });

  for (const stream of streams.values()) {
    stream.forEach(({ event, path }, index) => {
      if (event.revision !== index + 1) {
        errors.push(error('revision_sequence', `${path}/revision`, 'revisions must start at 1 and increase by exactly one'));
      }
      if ((index === 0) !== (event.event_kind === 'edition-published')) {
        errors.push(error('publication_event', `${path}/event_kind`, 'revision 1 must be the only edition-published event'));
      }
      if (index > 0 && Date.parse(event.published_at) <= Date.parse(stream[index - 1].event.published_at)) {
        errors.push(error('event_time_order', `${path}/published_at`, 'event timestamps must be strictly increasing'));
      }
    });
  }
  return result(errors);
}

export function validateRevisionEventTransition(previousEvents, candidateEvents, editions) {
  const errors = [...validateRevisionEvents(candidateEvents, editions).errors];
  if (!Array.isArray(previousEvents) || !Array.isArray(candidateEvents)) {
    return result([...errors, error('event_prefix', '/events', 'prior events must remain an immutable prefix')]);
  }
  const prefix = candidateEvents.slice(0, previousEvents.length);
  if (candidateEvents.length < previousEvents.length || canonical(prefix) !== canonical(previousEvents)) {
    errors.push(error('event_prefix', '/events', 'prior events must remain an immutable prefix'));
  }
  return result(errors);
}

const snapshotError = (side, validation) => new Error(
  `Invalid public Edition snapshot (${side}): ${validation.errors.map((entry) => `${entry.code} ${entry.path}`).join(', ')}`,
);

function validateClassifierInput(edition, contexts, side) {
  const editionValidation = validateEditionSnapshot(edition, `/${side}`);
  if (!editionValidation.ok) throw snapshotError(side, editionValidation);
  if (!Array.isArray(contexts)) throw new Error(`Invalid public Edition snapshot (${side}): contexts must be an array`);
  contexts.forEach((context, index) => {
    const validation = validateDocument('context', context, `/contexts/${index}`);
    if (!validation.ok) throw snapshotError(side, validation);
  });
}

function comparableSignal(signal, { historical = false } = {}) {
  const copy = structuredClone(signal);
  delete copy.source_fact;
  delete copy.caveat;
  delete copy.change;
  delete copy.corrected_at;
  delete copy.correction_note;
  if (copy.verification) {
    delete copy.verification.checked_at;
    if (historical) delete copy.verification.status;
  }
  if (historical) delete copy.role;
  return copy;
}

export function classifyEditionChange(previous, candidate, contexts = []) {
  validateClassifierInput(previous, contexts, 'previous');
  validateClassifierInput(candidate, contexts, 'candidate');
  if (previous.edition_id !== candidate.edition_id || previous.edition_date !== candidate.edition_date) {
    throw new Error('Invalid public Edition snapshot transition: Edition identity is immutable');
  }

  const previousById = new Map(previous.items.map((signal) => [signal.id, signal]));
  const candidateById = new Map(candidate.items.map((signal) => [signal.id, signal]));
  const removed = [...previousById.keys()].filter((id) => !candidateById.has(id));
  if (removed.length) throw new Error(`Invalid public Edition snapshot transition: Signals cannot be deleted (${removed.join(', ')})`);

  const added = [...candidateById.keys()].filter((id) => !previousById.has(id)).sort();
  const corrected = [];
  const withdrawn = [];
  for (const [id, before] of previousById) {
    const after = candidateById.get(id);
    const becameHistorical = before.verification.status !== after.verification.status
      && ['source-unavailable', 'withdrawn'].includes(after.verification.status);
    const withdrawalChange = before.change?.kind !== after.change?.kind && after.change?.kind === 'withdrawn';
    const historical = becameHistorical || withdrawalChange;
    if (canonical(comparableSignal(before, { historical })) !== canonical(comparableSignal(after, { historical }))) {
      throw new Error(`Invalid public Edition snapshot transition: unsupported public Signal change (${id})`);
    }
    if (becameHistorical || withdrawalChange) withdrawn.push(id);
    if (before.source_fact !== after.source_fact
      || (before.caveat ?? null) !== (after.caveat ?? null)
      || (before.change?.kind ?? null) !== (after.change?.kind ?? null)
      || (before.corrected_at ?? null) !== (after.corrected_at ?? null)
      || (before.correction_note ?? null) !== (after.correction_note ?? null)) {
      if (!withdrawn.includes(id)) corrected.push(id);
    }
  }

  const previousShell = structuredClone(previous);
  const candidateShell = structuredClone(candidate);
  for (const shell of [previousShell, candidateShell]) {
    delete shell.generated_at;
    delete shell.edition_note;
    shell.items = [];
  }
  if (canonical(previousShell) !== canonical(candidateShell)) {
    throw new Error('Invalid public Edition snapshot transition: unsupported Edition-level public change');
  }

  const noteChanged = (previous.edition_note ?? null) !== (candidate.edition_note ?? null);
  if (!added.length && !corrected.length && !withdrawn.length && !noteChanged) return null;

  const changedClasses = [added, corrected, withdrawn].filter((ids) => ids.length).length
    + Number(noteChanged);
  if (changedClasses > 1) {
    throw new Error('Invalid public Edition snapshot transition: multiple event classes require separate reviewed revisions');
  }

  let eventKind;
  let changedSignalIds;
  if (withdrawn.length) {
    eventKind = 'signal-withdrawn';
    changedSignalIds = withdrawn;
  } else if (corrected.length) {
    eventKind = 'signal-corrected';
    changedSignalIds = corrected;
  } else if (added.length) {
    eventKind = 'signals-added';
    changedSignalIds = added;
  } else {
    eventKind = 'edition-note-updated';
    changedSignalIds = [];
  }
  return {
    proposal_version: 'aoi.news.edition-event-proposal.v1',
    edition_id: candidate.edition_id,
    event_kind: eventKind,
    changed_signal_ids: changedSignalIds,
    reasons: [
      ...added.map((id) => `signal-added:${id}`),
      ...corrected.map((id) => `signal-corrected:${id}`),
      ...withdrawn.map((id) => `signal-historical:${id}`),
      ...(noteChanged ? ['edition-note-updated'] : []),
    ],
  };
}

const xmlEscape = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

export function renderRollingFeed(events, editions, { sample = false } = {}) {
  const validation = validateRevisionEvents(events, editions);
  if (!validation.ok) {
    throw new Error(`Revision event validation failed: ${validation.errors.map((entry) => `${entry.code} ${entry.path}`).join(', ')}`);
  }
  const editionMap = new Map(editions.map((edition) => [edition.edition_id, edition]));
  const newestFirst = [...events].sort((left, right) => (
    Date.parse(right.published_at) - Date.parse(left.published_at)
    || right.event_id.localeCompare(left.event_id)
  ));
  const channelTitle = sample
    ? 'AOIFUTURE News Rolling Edition RSS — NON-PRODUCTION SAMPLE'
    : 'AOIFUTURE News Rolling Edition RSS';
  const items = newestFirst.map((event) => {
    const edition = editionMap.get(event.edition_id);
    const signalById = new Map(edition.items.map((signal) => [signal.id, signal]));
    const signalTitles = event.changed_signal_ids.map((id) => signalById.get(id).title);
    const description = signalTitles.length
      ? `${event.summary} Changed Signals: ${signalTitles.join(' / ')}`
      : event.summary;
    return [
      '    <item>',
      `      <title>${xmlEscape(event.title)}</title>`,
      `      <link>${xmlEscape(event.edition_url)}</link>`,
      `      <guid isPermaLink="false">${xmlEscape(event.event_id)}</guid>`,
      `      <pubDate>${new Date(event.published_at).toUTCString()}</pubDate>`,
      `      <description>${xmlEscape(description)}</description>`,
      '    </item>',
    ].join('\n');
  }).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${xmlEscape(channelTitle)}</title>`,
    '    <link>https://aoifuture.com/news/</link>',
    '    <description>Reviewed public changes to the AOIFUTURE News daily Edition.</description>',
    '    <language>ja</language>',
    '    <atom:link href="https://aoifuture.com/news/feed.xml" rel="self" type="application/rss+xml"/>',
    ...(items ? [items] : []),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
