const EDITION_ID = /^\d{4}-\d{2}-\d{2}(?:-(?:[01]\d|2[0-3])[0-5]\d)?$/;

interface ChainEntry {
  id: string;
  article: HTMLElement | null;
  nextId: string | null;
  nextHref: string | null;
}

interface AppendOptions {
  trigger: 'manual' | 'automatic' | 'restore';
  focusHeading: boolean;
  historyMode: 'push' | 'replace' | 'none';
}

function initHistoryLoader(loader: HTMLElement) {
  const historyContainer = document.querySelector<HTMLElement>('[data-news-history]');
  const status = loader.querySelector<HTMLElement>('[data-news-history-status]');
  const sentinel = loader.querySelector<HTMLElement>('[data-news-history-sentinel]');
  const baseId = loader.dataset.currentEdition;
  if (!historyContainer || !status || !sentinel || !baseId || !EDITION_ID.test(baseId)) return;

  const initialLink = loader.querySelector<HTMLAnchorElement>('[data-news-history-link]');
  const chain: ChainEntry[] = [{
    id: baseId,
    article: null,
    nextId: initialLink?.dataset.targetEdition ?? null,
    nextHref: initialLink?.getAttribute('href') ?? null,
  }];
  let pending = false;
  let reconciling = false;
  let scrollIntentAt = 0;
  let scrollIntentY = scrollY;
  let automaticEligible = false;
  let observer: IntersectionObserver | null = null;

  const exactEditionUrl = (id: string, href: string, base = location.href) => {
    if (!EDITION_ID.test(id)) return null;
    const url = new URL(href, base);
    return url.origin === location.origin
      && url.pathname === `/news/${id}/`
      && !url.search
      && !url.hash
      ? url
      : null;
  };

  const disconnectObserver = () => observer?.disconnect();

  const setLoaderTarget = (id: string | null, href: string | null) => {
    let link = loader.querySelector<HTMLAnchorElement>('a');
    if (!id || !href) {
      if (!link) {
        link = document.createElement('a');
        link.className = 'news-history-loader__link';
        loader.insertBefore(link, sentinel);
      }
      link.textContent = 'Archiveを見る';
      link.href = '/news/archive/';
      link.removeAttribute('data-news-history-link');
      link.removeAttribute('data-target-edition');
      disconnectObserver();
      return;
    }
    if (!link) {
      link = document.createElement('a');
      link.className = 'news-history-loader__link';
      loader.insertBefore(link, sentinel);
    }
    link.textContent = '前のEditionを読む';
    link.setAttribute('data-news-history-link', '');
    link.dataset.targetEdition = id;
    link.href = href;
  };

  const updateFromTail = () => {
    const tail = chain.at(-1)!;
    setLoaderTarget(tail.nextId, tail.nextHref);
  };

  const throughUrl = (id: string | null) => {
    const url = new URL(location.href);
    if (id && id !== baseId) url.searchParams.set('through', id);
    else url.searchParams.delete('through');
    return `${url.pathname}${url.search}${url.hash}`;
  };

  const appendNext = async (expectedId: string, href: string, options: AppendOptions) => {
    const url = exactEditionUrl(expectedId, href);
    if (pending || !url || chain.some((entry) => entry.id === expectedId)) return false;
    pending = true;
    disconnectObserver();
    const link = loader.querySelector<HTMLAnchorElement>('[data-news-history-link]');
    link?.setAttribute('aria-disabled', 'true');
    status.textContent = '前のEditionを読み込んでいます。';
    try {
      const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('invalid response');
      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
      const articles = parsed.querySelectorAll<HTMLElement>('[data-news-edition]');
      if (articles.length !== 1 || articles[0].dataset.newsEdition !== expectedId) throw new Error('invalid Edition document');
      const headings = articles[0].querySelectorAll<HTMLHeadingElement>('h1[data-news-edition-heading]');
      if (headings.length !== 1) throw new Error('invalid Edition heading');
      const fetchedLoaders = parsed.querySelectorAll<HTMLElement>('[data-news-history-loader]');
      if (fetchedLoaders.length !== 1 || fetchedLoaders[0].dataset.currentEdition !== expectedId) throw new Error('invalid Edition loader');
      const fetchedLink = fetchedLoaders[0].querySelector<HTMLAnchorElement>('[data-news-history-link]');
      const nextId = fetchedLink?.dataset.targetEdition ?? null;
      const nextHref = fetchedLink?.getAttribute('href') ?? null;
      if (Boolean(nextId) !== Boolean(nextHref)) throw new Error('incomplete next Edition');
      if (nextId && (!nextHref || !exactEditionUrl(nextId, nextHref, url.href))) throw new Error('invalid next Edition');
      if (nextId && chain.some((entry) => entry.id === nextId)) throw new Error('cyclic Edition chain');

      const article = document.importNode(articles[0], true);
      const heading = article.querySelector<HTMLHeadingElement>('h1[data-news-edition-heading]')!;
      const replacement = document.createElement('h2');
      for (const attribute of heading.attributes) replacement.setAttribute(attribute.name, attribute.value);
      replacement.append(...heading.childNodes);
      heading.replaceWith(replacement);
      historyContainer.append(article);
      chain.push({ id: expectedId, article, nextId, nextHref });
      updateFromTail();
      status.textContent = `${expectedId} Editionを追加しました。`;
      if (options.historyMode === 'push') history.pushState({}, '', throughUrl(expectedId));
      if (options.historyMode === 'replace') history.replaceState({}, '', throughUrl(expectedId));
      if (options.focusHeading) {
        replacement.tabIndex = -1;
        replacement.focus();
      }
      return true;
    } catch {
      status.textContent = 'Editionを読み込めませんでした。リンクから個別ページを開けます。';
      return false;
    } finally {
      pending = false;
      automaticEligible = false;
      loader.querySelector('[data-news-history-link]')?.removeAttribute('aria-disabled');
    }
  };

  const observeWhenEligible = () => {
    if (!automaticEligible || pending || reconciling || !loader.querySelector('[data-news-history-link]')) return;
    if (!('IntersectionObserver' in window)) return;
    observer ??= new IntersectionObserver((entries) => {
      if (!automaticEligible || pending || reconciling || !entries.some((entry) => entry.isIntersecting)) return;
      const tail = chain.at(-1)!;
      if (!tail.nextId || !tail.nextHref) return;
      automaticEligible = false;
      disconnectObserver();
      void appendNext(tail.nextId, tail.nextHref, {
        trigger: 'automatic', focusHeading: false, historyMode: 'replace',
      });
    }, { rootMargin: '0px 0px 160px' });
    observer.observe(sentinel);
  };

  const recordScrollIntent = (event: Event) => {
    if (!event.isTrusted) return;
    scrollIntentAt = performance.now();
    scrollIntentY = scrollY;
  };
  addEventListener('wheel', recordScrollIntent, { passive: true });
  addEventListener('touchmove', recordScrollIntent, { passive: true });
  addEventListener('keydown', (event) => {
    if (['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End', ' '].includes(event.key)) recordScrollIntent(event);
  });
  addEventListener('scroll', () => {
    if (!scrollIntentAt || performance.now() - scrollIntentAt > 1500 || scrollY === scrollIntentY) return;
    scrollIntentAt = 0;
    automaticEligible = true;
    observeWhenEligible();
  }, { passive: true });

  const reconcile = async (target: string | null) => {
    disconnectObserver();
    automaticEligible = false;
    if (!target || target === baseId) {
      while (chain.length > 1) chain.pop()!.article?.remove();
      updateFromTail();
      return target === baseId || target === null;
    }
    if (!EDITION_ID.test(target)) return false;
    const loadedIndex = chain.findIndex((entry) => entry.id === target);
    if (loadedIndex >= 0) {
      while (chain.length > loadedIndex + 1) chain.pop()!.article?.remove();
      updateFromTail();
      return true;
    }
    const encountered = new Set(chain.map((entry) => entry.id));
    while (chain.at(-1)!.id !== target) {
      const tail = chain.at(-1)!;
      if (!tail.nextId || !tail.nextHref || encountered.has(tail.nextId)) return false;
      encountered.add(tail.nextId);
      if (!await appendNext(tail.nextId, tail.nextHref, { trigger: 'restore', focusHeading: false, historyMode: 'none' })) return false;
    }
    return true;
  };

  const runReconcile = async (target: string | null) => {
    if (reconciling) return false;
    reconciling = true;
    try {
      return await reconcile(target);
    } finally {
      reconciling = false;
    }
  };

  loader.addEventListener('click', async (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('[data-news-history-link]');
    if (!link) return;
    const target = link.dataset.targetEdition;
    if (!target || !exactEditionUrl(target, link.getAttribute('href') ?? '')) return;
    event.preventDefault();
    if (pending || reconciling) return;
    disconnectObserver();
    await appendNext(target, link.getAttribute('href')!, { trigger: 'manual', focusHeading: true, historyMode: 'push' });
  });

  addEventListener('popstate', async () => {
    disconnectObserver();
    const target = new URL(location.href).searchParams.get('through');
    if (!await runReconcile(target)) history.replaceState({}, '', throughUrl(chain.at(-1)!.id));
  });

  const initial = new URL(location.href).searchParams.get('through');
  if (initial) {
    void runReconcile(initial).then((ok) => {
      if (!ok) history.replaceState({}, '', throughUrl(chain.at(-1)!.id));
    });
  }
}

document.querySelectorAll<HTMLElement>('[data-news-history-loader]').forEach(initHistoryLoader);
