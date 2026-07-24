const ORIGIN = 'https://aoifuture.com';
const schema = (type, values) => ({
  '@context': 'https://schema.org',
  '@type': type,
  ...values,
});

const itemList = (entries) => ({
  '@type': 'ItemList',
  numberOfItems: entries.length,
  itemListElement: entries.map((entry, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    ...entry,
  })),
});

export function buildEditionMetadata(edition, latestReviewedAt) {
  if (typeof latestReviewedAt !== 'string' || Number.isNaN(Date.parse(latestReviewedAt))) {
    throw new Error('Dated Edition metadata requires a validated reviewed revision event timestamp');
  }
  const url = `${ORIGIN}/news/${edition.edition_date}/`;
  return schema('CollectionPage', {
    name: edition.title,
    description: edition.dek ?? edition.title,
    url,
    datePublished: edition.published_at,
    dateModified: latestReviewedAt,
    mainEntity: itemList(edition.items.map((signal) => ({
      name: signal.title,
      url: `${url}#${signal.id}`,
    }))),
  });
}

export function buildIndexMetadata(catalog) {
  return schema('CollectionPage', {
    name: 'AOIFUTURE News',
    description: 'Finite, source-first AOIFUTURE News Editions.',
    url: `${ORIGIN}/news/`,
    mainEntity: itemList(catalog.editions.map((edition) => ({
      name: edition.title,
      url: `${ORIGIN}/news/${edition.edition_date}/`,
    }))),
  });
}

export function buildArchiveMetadata(catalog) {
  const entries = [
    ...catalog.editions.map((edition) => ({
      name: edition.title,
      url: `${ORIGIN}/news/${edition.edition_date}/`,
    })),
    ...catalog.contexts.map((context) => ({
      name: context.title,
      url: `${ORIGIN}/news/context/${context.slug}/`,
    })),
  ];
  return schema('CollectionPage', {
    name: 'AOIFUTURE News Editorial review index',
    description: 'Bounded entry points for the editorial review Preview; not authorized for production publication.',
    url: `${ORIGIN}/news/archive/`,
    mainEntity: itemList(entries),
  });
}

export function buildContextMetadata(context, catalog) {
  const signalById = new Map(catalog.editions.flatMap((edition) => (
    edition.items.map((signal) => [signal.id, signal])
  )));
  const citations = context.supporting_signal_ids.map((id) => signalById.get(id));
  if (citations.some((signal) => !signal)) {
    throw new Error(`Active Context ${context.id} has unresolved public supporting references`);
  }
  return schema('WebPage', {
    name: context.title,
    description: context.current_view,
    url: `${ORIGIN}/news/context/${context.slug}/`,
    dateModified: context.updated_at,
    citation: citations.map((signal) => ({
      '@type': 'CreativeWork',
      name: signal.source_title,
      url: signal.source_url,
    })),
  });
}
