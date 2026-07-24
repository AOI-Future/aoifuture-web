export type NewsSourceKind =
  | 'official'
  | 'documentation'
  | 'release'
  | 'repository'
  | 'paper'
  | 'advisory'
  | 'regulator'
  | 'original-reporting'
  | 'analysis';

export type NewsSignalRole = 'lead' | 'major' | 'brief' | 'detour' | 'watch';
export type NewsVerificationStatus = 'verified' | 'source-unavailable' | 'withdrawn';

export interface NewsSignal {
  id: string;
  title: string;
  source_url: string;
  source_title: string;
  source_domain: string;
  source_kind: NewsSourceKind;
  language: 'ja' | 'en' | 'other';
  published_at?: string;
  observed_at: string;
  context_ids: string[];
  change?: {
    kind: 'new' | 'updated' | 'corrected' | 'superseded' | 'withdrawn';
    previous_signal_ids?: string[];
  };
  source_fact: string;
  aoi_note: string;
  caveat?: string;
  topics: string[];
  role: NewsSignalRole;
  verification: {
    status: NewsVerificationStatus;
    checked_at: string;
  };
  corrected_at?: string;
  correction_note?: string;
}

export interface NewsTopic {
  id: string;
  label_ja: string;
  label_en?: string;
  description?: string;
}

export interface NewsEdition {
  schema_version: 'aoi.news.edition.v1';
  edition_id: string;
  edition_date: string;
  generated_at: string;
  published_at: string;
  corrected_at?: string;
  title: string;
  dek?: string;
  edition_note?: string;
  items: NewsSignal[];
  topics: NewsTopic[];
}

export interface NewsContextRevision {
  id: string;
  changed_at: string;
  change_reason: string;
  resulting_view: string;
  evidence_signal_ids: string[];
}

export interface NewsOperatorContext {
  capability?: string;
  authority?: string;
  control?: string;
  evidence?: string;
  cost_route?: string;
  operational_impact?: string;
  unresolved?: string;
}

export interface NewsContext {
  schema_version: 'aoi.news.context.v1';
  id: string;
  slug: string;
  title: string;
  current_view: string;
  updated_at: string;
  operator_context?: NewsOperatorContext;
  supporting_signal_ids: string[];
  revisions: NewsContextRevision[];
}

export interface NewsCatalog {
  editions: NewsEdition[];
  contexts: NewsContext[];
}

export type NewsEditionEventKind =
  | 'edition-published'
  | 'signals-added'
  | 'signal-corrected'
  | 'signal-withdrawn'
  | 'edition-note-updated';

export interface NewsEditionEvent {
  schema_version: 'aoi.news.edition-event.v1';
  event_id: string;
  edition_id: string;
  edition_date: string;
  revision: number;
  event_kind: NewsEditionEventKind;
  title: string;
  summary: string;
  published_at: string;
  edition_url: string;
  changed_signal_ids: string[];
}

export interface NewsSignalReference {
  editionDate: string;
  signal: NewsSignal;
}
