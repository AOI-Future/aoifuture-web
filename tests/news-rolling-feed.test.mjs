import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  classifyEditionChange,
  renderRollingFeed,
  validateRevisionEvents,
  validateRevisionEventTransition,
} from '../scripts/news-contract/rolling-feed.mjs';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const edition = readJson('../src/content/news/editions/2026-07-23.json');
const context = readJson('../src/content/news/contexts/agent-authority.json');
const events = readJson('../src/content/news/events/2026-07-23.json');
const reviewedEdition = readJson('../src/content/news/editions/2026-07-24.json');
const reviewedEvents = readJson('../src/content/news/events/2026-07-24.json');
const clone = (value) => structuredClone(value);
const codes = (result) => result.errors.map((entry) => entry.code);

const privateTerms = [
  'reviewed_by', 'receipt', 'claim_locator', 'source_body', 'local_path',
  'internal_score', 'prompt', 'reasoning', 'reader_id', 'unpublished_url',
];

describe('Rolling Edition public revision-event contract', () => {
  it('accepts the append-only non-production sample backed only by the two staged Signals', () => {
    expect(events).toHaveLength(2);
    expect(events.flatMap((event) => event.changed_signal_ids).sort()).toEqual(
      edition.items.map((signal) => signal.id).sort(),
    );
    expect(validateRevisionEvents(events, [edition])).toEqual({ ok: true, errors: [] });
  });

  it('accepts the reviewed Preview publication event with all six exact Signal IDs', () => {
    expect(reviewedEvents).toHaveLength(1);
    expect(reviewedEvents[0]).toMatchObject({
      event_id: 'aoi-news-2026-07-24-r001',
      revision: 1,
      event_kind: 'edition-published',
      published_at: reviewedEdition.published_at,
    });
    expect(reviewedEvents[0].changed_signal_ids).toEqual(reviewedEdition.items.map((signal) => signal.id));
    expect(validateRevisionEvents([...events, ...reviewedEvents], [edition, reviewedEdition]))
      .toEqual({ ok: true, errors: [] });
  });

  it.each([
    ['additional private field', (candidate) => { candidate[0].reviewed_by = 'private-editor'; }, 'schema'],
    ['raw source body', (candidate) => { candidate[0].source_body = 'copied article'; }, 'schema'],
    ['fractional revision', (candidate) => { candidate[1].revision = 1.5; }, 'schema'],
    ['duplicate changed Signal', (candidate) => { candidate[0].changed_signal_ids.push(candidate[0].changed_signal_ids[0]); }, 'schema'],
    ['duplicate event ID', (candidate) => { candidate[1].event_id = candidate[0].event_id; }, 'duplicate_event_id'],
    ['schema-shaped but non-derived event ID', (candidate) => { candidate[1].event_id = 'aoi-news-2026-07-22-r002'; }, 'deterministic_event_id'],
    ['non-padded event revision ID', (candidate) => { candidate[1].event_id = 'aoi-news-2026-07-23-r2'; }, 'schema'],
    ['non-monotonic revision', (candidate) => { candidate[1].revision = 1; }, 'revision_sequence'],
    ['non-publication first revision', (candidate) => { candidate[0].event_kind = 'signals-added'; }, 'publication_event'],
    ['repeated publication event', (candidate) => { candidate[1].event_kind = 'edition-published'; }, 'publication_event'],
    ['publication timestamp divergent from the Edition', (candidate) => { candidate[0].published_at = '2026-07-23T09:01:00+09:00'; }, 'publication_time'],
    ['unordered timestamp', (candidate) => { candidate[1].published_at = candidate[0].published_at; }, 'event_time_order'],
    ['wrong canonical host', (candidate) => { candidate[0].edition_url = 'https://www.aoifuture.com/news/2026-07-23/'; }, 'schema'],
    ['missing trailing slash', (candidate) => { candidate[0].edition_url = 'https://aoifuture.com/news/2026-07-23'; }, 'schema'],
    ['mismatched dated Edition URL', (candidate) => { candidate[0].edition_url = 'https://aoifuture.com/news/2026-07-22/'; }, 'edition_url'],
    ['unknown Signal', (candidate) => { candidate[1].changed_signal_ids = ['sig-private']; }, 'unresolved_signal_reference'],
    ['Signal-less signals-added event', (candidate) => { candidate[1].changed_signal_ids = []; }, 'changed_signals_required'],
  ])('fails closed on %s', (_name, mutate, code) => {
    const candidate = clone(events);
    mutate(candidate);
    const result = validateRevisionEvents(candidate, [edition]);
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain(code);
  });

  it.each([
    ['rewritten prior event', (candidate) => { candidate[0].summary = 'silently rewritten'; }],
    ['deleted prior event', (candidate) => { candidate.shift(); }],
    ['reordered prior events', (candidate) => { candidate.reverse(); }],
  ])('rejects %s and preserves prior-event immutability', (_name, mutate) => {
    const candidate = clone(events);
    mutate(candidate);
    expect(codes(validateRevisionEventTransition(events, candidate, [edition])))
      .toContain('event_prefix');
  });

  it('accepts a valid event appended after the immutable published prefix', () => {
    const candidate = clone(events);
    candidate.push({
      ...candidate[1],
      event_id: 'aoi-news-2026-07-23-r003',
      revision: 3,
      event_kind: 'signal-corrected',
      title: 'NON-PRODUCTION SAMPLE: 公開訂正イベント',
      summary: '検証用の公開訂正イベント。',
      published_at: '2026-07-23T09:10:00+09:00',
    });
    expect(validateRevisionEventTransition(events, candidate, [edition])).toEqual({ ok: true, errors: [] });
  });

  it('accepts a source-unavailable event as distinct from a withdrawal event', () => {
    const candidateEdition = clone(edition);
    candidateEdition.items[0].verification.status = 'source-unavailable';
    const candidateEvents = clone(events);
    candidateEvents.push({
      ...candidateEvents[1],
      event_id: 'aoi-news-2026-07-23-r003',
      revision: 3,
      event_kind: 'signal-source-unavailable',
      title: 'NON-PRODUCTION SAMPLE: 公開ソース確認不能イベント',
      summary: '検証用の公開ソース確認不能イベント。',
      published_at: '2026-07-23T09:10:00+09:00',
      changed_signal_ids: [candidateEdition.items[0].id],
    });
    expect(validateRevisionEvents(candidateEvents, [candidateEdition])).toEqual({ ok: true, errors: [] });
  });

  it('rejects a source-unavailable event when the resulting public Signal is still verified', () => {
    const candidateEvents = clone(events);
    candidateEvents.push({
      ...candidateEvents[1],
      event_id: 'aoi-news-2026-07-23-r003',
      revision: 3,
      event_kind: 'signal-source-unavailable',
      published_at: '2026-07-23T09:10:00+09:00',
      changed_signal_ids: [edition.items[0].id],
    });
    expect(codes(validateRevisionEvents(candidateEvents, [edition])))
      .toContain('source_unavailable_event_semantics');
  });
});

describe('model-free meaningful-change proposal classifier', () => {
  it('does not propose an event when only generated/check timestamps advance', () => {
    const candidate = clone(edition);
    candidate.generated_at = '2026-07-23T11:00:00+09:00';
    candidate.items.forEach((signal) => { signal.verification.checked_at = '2026-07-23T11:00:00+09:00'; });
    expect(classifyEditionChange(edition, candidate, [context])).toBeNull();
  });

  it('does not propose an event for item order or internal object-key order changes', () => {
    const candidate = clone(edition);
    candidate.items.reverse();
    expect(classifyEditionChange(edition, candidate, [context])).toBeNull();
  });

  it.each([
    ['public Source fact correction', (candidate) => {
      candidate.items[0].source_fact += ' 公開訂正。';
      candidate.items[0].change = { kind: 'corrected' };
      candidate.items[0].corrected_at = '2026-07-23T11:00:00+09:00';
      candidate.items[0].correction_note = '公開訂正内容。';
      candidate.corrected_at = candidate.items[0].corrected_at;
    }, 'signal-corrected'],
    ['public Caveat correction', (candidate) => {
      candidate.items[0].caveat += ' 公開条件を追記。';
      candidate.items[0].change = { kind: 'corrected' };
      candidate.items[0].corrected_at = '2026-07-23T11:00:00+09:00';
      candidate.items[0].correction_note = '公開Caveatの訂正内容。';
      candidate.corrected_at = candidate.items[0].corrected_at;
    }, 'signal-corrected'],
    ['withdrawal', (candidate) => {
      candidate.items[1].change = { kind: 'withdrawn' };
      candidate.items[1].verification.status = 'withdrawn';
      candidate.items[1].role = 'brief';
    }, 'signal-withdrawn'],
    ['source unavailable', (candidate) => {
      candidate.items[0].verification.status = 'source-unavailable';
    }, 'signal-source-unavailable'],
    ['Edition note', (candidate) => { candidate.edition_note += ' 公開追記。'; }, 'edition-note-updated'],
  ])('proposes exactly one reviewed-public event class for %s', (_name, mutate, eventKind) => {
    const candidate = clone(edition);
    mutate(candidate);
    const proposal = classifyEditionChange(edition, candidate, [context]);
    expect(proposal?.event_kind).toBe(eventKind);
    expect(proposal?.changed_signal_ids).toEqual(eventKind === 'edition-note-updated' ? [] : [edition.items[eventKind === 'signal-withdrawn' ? 1 : 0].id]);
    if (eventKind === 'signal-source-unavailable') {
      expect(proposal?.reasons).toEqual([`signal-source-unavailable:${edition.items[0].id}`]);
      expect(proposal?.reasons.join(' ')).not.toContain('withdrawn');
    }
    expect(proposal).not.toHaveProperty('published_at');
    expect(proposal).not.toHaveProperty('event_id');
  });

  it('proposes signals-added for one newly validated public Signal without inventing content', () => {
    const previous = clone(edition);
    previous.items = previous.items.slice(0, 1);
    const proposal = classifyEditionChange(previous, edition, [context]);
    expect(proposal).toMatchObject({
      event_kind: 'signals-added',
      changed_signal_ids: [edition.items[1].id],
    });
  });

  it.each([
    ['invalid snapshot', (candidate) => { candidate.items[0].source_url = 'http://private.invalid/'; }],
    ['private snapshot field', (candidate) => { candidate.items[0].internal_score = 0.99; }],
  ])('fails closed instead of proposing from an %s', (_name, mutate) => {
    const candidate = clone(edition);
    mutate(candidate);
    expect(() => classifyEditionChange(edition, candidate, [context])).toThrow(/invalid public Edition snapshot/i);
  });

  it('fails closed on an unsupported verification recovery instead of treating it as clock-only', () => {
    const previous = clone(edition);
    previous.items[0].verification.status = 'source-unavailable';
    expect(() => classifyEditionChange(previous, edition, [context])).toThrow(/unsupported public Signal change/i);
  });

  it('fails closed when source unavailability is combined with an unrelated role change', () => {
    const candidate = clone(edition);
    candidate.items[0].verification.status = 'source-unavailable';
    candidate.items[0].role = 'brief';
    expect(() => classifyEditionChange(edition, candidate, [context])).toThrow(/unsupported public Signal change/i);
  });

  it.each([
    ['bare Source fact mutation', (candidate) => { candidate.items[0].source_fact += ' サイレント変更。'; }],
    ['bare Caveat mutation', (candidate) => { candidate.items[0].caveat += ' サイレント変更。'; }],
    ['missing Edition corrected_at', (candidate) => {
      candidate.items[0].source_fact += ' 公開訂正。';
      candidate.items[0].change = { kind: 'corrected' };
      candidate.items[0].corrected_at = '2026-07-23T11:00:00+09:00';
      candidate.items[0].correction_note = '公開訂正内容。';
    }],
    ['mismatched Edition corrected_at', (candidate) => {
      candidate.items[0].source_fact += ' 公開訂正。';
      candidate.items[0].change = { kind: 'corrected' };
      candidate.items[0].corrected_at = '2026-07-23T11:00:00+09:00';
      candidate.items[0].correction_note = '公開訂正内容。';
      candidate.corrected_at = '2026-07-23T11:01:00+09:00';
    }],
    ['non-advancing correction timestamp', (candidate) => {
      candidate.items[0].source_fact += ' 公開訂正。';
      candidate.items[0].change = { kind: 'corrected' };
      candidate.items[0].corrected_at = candidate.published_at;
      candidate.items[0].correction_note = '公開訂正内容。';
      candidate.corrected_at = candidate.items[0].corrected_at;
    }],
    ['Edition corrected_at without a Signal correction', (candidate) => {
      candidate.corrected_at = '2026-07-23T11:00:00+09:00';
    }],
  ])('fails closed on %s', (_name, mutate) => {
    const candidate = clone(edition);
    mutate(candidate);
    expect(() => classifyEditionChange(edition, candidate, [context])).toThrow(/correction|unsupported Edition-level/i);
  });

  it('requires repeated correction timestamps and Edition corrected_at to advance together', () => {
    const previous = clone(edition);
    previous.items[0].change = { kind: 'corrected' };
    previous.items[0].corrected_at = '2026-07-23T10:00:00+09:00';
    previous.items[0].correction_note = '最初の公開訂正。';
    previous.corrected_at = previous.items[0].corrected_at;

    const candidate = clone(previous);
    candidate.items[0].source_fact += ' 二回目の公開訂正。';
    candidate.items[0].corrected_at = '2026-07-23T11:00:00+09:00';
    candidate.items[0].correction_note = '二回目の公開訂正。';
    candidate.corrected_at = candidate.items[0].corrected_at;
    expect(classifyEditionChange(previous, candidate, [context])).toMatchObject({
      event_kind: 'signal-corrected',
      changed_signal_ids: [candidate.items[0].id],
    });

    candidate.items[0].corrected_at = previous.items[0].corrected_at;
    candidate.corrected_at = previous.corrected_at;
    expect(() => classifyEditionChange(previous, candidate, [context])).toThrow(/timestamp must advance/i);
  });

  it('requires separate reviewed revisions for simultaneous event classes', () => {
    const previous = clone(edition);
    previous.items = previous.items.slice(0, 1);
    const candidate = clone(edition);
    candidate.items[0].source_fact += ' 公開訂正。';
    candidate.items[0].change = { kind: 'corrected' };
    candidate.items[0].corrected_at = '2026-07-23T11:00:00+09:00';
    candidate.items[0].correction_note = '公開訂正内容。';
    candidate.corrected_at = candidate.items[0].corrected_at;
    expect(() => classifyEditionChange(previous, candidate, [context])).toThrow(/separate reviewed revisions/i);
  });
});

describe('deterministic Rolling Edition RSS', () => {
  it('renders only public Edition events in production when passed the projected graph', () => {
    const xml = renderRollingFeed(reviewedEvents, [reviewedEdition], { mode: 'production' });
    expect(xml).toContain('<title>AOIFUTURE News Rolling Edition RSS</title>');
    expect(xml).toContain('aoi-news-2026-07-24-r001');
    expect(xml).not.toContain('2026-07-23');
    expect(xml).not.toContain('NON-PRODUCTION SAMPLE');
    expect((xml.match(/<item>/g) ?? [])).toHaveLength(1);
  });
  it('renders the reviewed Preview event first with its deterministic GUID and preview boundary', () => {
    const allEvents = [...events, ...reviewedEvents];
    const xml = renderRollingFeed(allEvents, [edition, reviewedEdition], { sample: true });
    expect(xml).toContain('AOIFUTURE News Rolling Edition RSS — EDITORIAL REVIEW PREVIEW');
    expect(xml).toContain('<guid isPermaLink="false">aoi-news-2026-07-24-r001</guid>');
    expect(xml.indexOf('aoi-news-2026-07-24-r001')).toBeLessThan(xml.indexOf('aoi-news-2026-07-23-r002'));
    expect((xml.match(/<item>/g) ?? [])).toHaveLength(3);
  });

  it('uses reviewed events as stable GUID items, newest first, and is byte-stable', () => {
    const first = renderRollingFeed(events, [edition], { sample: true });
    const second = renderRollingFeed(clone(events), [clone(edition)], { sample: true });
    expect(second).toBe(first);
    expect(first).toContain('<rss version="2.0"');
    expect(first).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    expect(first).toContain('<atom:link href="https://aoifuture.com/news/feed.xml" rel="self" type="application/rss+xml"/>');
    expect(first.indexOf(events[1].event_id)).toBeLessThan(first.indexOf(events[0].event_id));
    for (const event of events) {
      expect(event.event_id).toBe(`aoi-news-${event.edition_id}-r${String(event.revision).padStart(3, '0')}`);
      expect(first).toContain(`<guid isPermaLink="false">${event.event_id}</guid>`);
      expect(first).toContain(new Date(event.published_at).toUTCString());
    }
    expect(first).not.toContain(edition.generated_at);
  });

  it('contains only reviewed event text and changed public Signal titles, with no private terms or source article body', () => {
    const xml = renderRollingFeed(events, [edition], { sample: true });
    for (const event of events) {
      expect(xml).toContain(event.title);
      expect(xml).toContain(event.summary);
    }
    for (const signal of edition.items) expect(xml).toContain(signal.title);
    for (const term of privateTerms) expect(xml.toLowerCase()).not.toContain(term);
    expect(xml).not.toContain(edition.items[0].source_fact);
    expect(xml).not.toContain(edition.items[0].aoi_note);
    expect(xml).not.toContain(edition.items[0].source_url);
  });

  it('requires explicit reviewed public events and never renders a classifier proposal as an RSS item', () => {
    const candidate = clone(edition);
    candidate.edition_note += ' 公開追記。';
    const proposal = classifyEditionChange(edition, candidate, [context]);
    expect(renderRollingFeed([], [edition], { sample: true })).not.toContain('<item>');
    expect(() => renderRollingFeed([proposal], [candidate], { sample: true })).toThrow(/revision event validation failed/i);
  });
});
