const EDITION_ID = /^\d{4}-\d{2}-\d{2}(?:-(?:[01]\d|2[0-3])[0-5]\d)?$/;

interface ChainEntry {
  id: string;
  article: HTMLElement | null;
  nextId: string | null;
  nextHref: string | null;
}

function initHistoryLoader(loader: HTMLElement) {
  const historyContainer = document.querySelector<HTMLElement>('[data-news-history]');
  const status = loader.querySelector<HTMLElement>('[data-news-history-status]');
  const baseId = loader.dataset.currentEdition;
  if (!historyContainer || !status || !baseId || !EDITION_ID.test(baseId)) return;

  const chain: ChainEntry[] = [{
    id: baseId,
    article: null,
    nextId: loader.querySelector<HTMLElement>('[data-news-history-link]')?.dataset.targetEdition ?? null,
    nextHref: loader.querySelector<HTMLAnchorElement>('[data-news-history-link]')?.getAttribute('href') ?? null,
  }];
  let pending = false;

  const setLoaderTarget = (id: string | null, href: string | null) => {
    let link = loader.querySelector<HTMLAnchorElement>('a');
    if (!id || !href) {
      if (!link) {
        link = document.createElement('a');
        link.className = 'news-history-loader__link';
        loader.append(link);
      }
      link.textContent = 'Archiveを見る';
      link.href = '/news/archive/';
      link.removeAttribute('data-news-history-link');
      link.removeAttribute('data-target-edition');
      return;
    }
    if (!link) {
      link = document.createElement('a');
      link.className = 'news-history-loader__link';
      loader.append(link);
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

  const fetchNext = async (expectedId: string, href: string, focus: boolean): Promise<boolean> => {
    if (pending || !EDITION_ID.test(expectedId) || chain.some((entry) => entry.id === expectedId)) return false;
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return false;
    pending = true;
    const link = loader.querySelector<HTMLAnchorElement>('[data-news-history-link]');
    link?.setAttribute('aria-disabled', 'true');
    status.textContent = '前のEditionを読み込んでいます。';
    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: 'text/html' },
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('invalid response');
      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
      const articles = parsed.querySelectorAll<HTMLElement>('[data-news-edition]');
      if (articles.length !== 1 || articles[0].dataset.newsEdition !== expectedId) throw new Error('invalid Edition document');
      const headings = articles[0].querySelectorAll<HTMLHeadingElement>('h1[data-news-edition-heading]');
      if (headings.length !== 1) throw new Error('invalid Edition heading');
      const article = document.importNode(articles[0], true);
      const heading = article.querySelector<HTMLHeadingElement>('h1[data-news-edition-heading]')!;
      const replacement = document.createElement('h2');
      for (const attribute of heading.attributes) replacement.setAttribute(attribute.name, attribute.value);
      replacement.append(...heading.childNodes);
      heading.replaceWith(replacement);

      const fetchedLoader = parsed.querySelector<HTMLElement>('[data-news-history-loader]');
      if (!fetchedLoader || fetchedLoader.dataset.currentEdition !== expectedId) throw new Error('invalid Edition loader');
      const fetchedLink = fetchedLoader?.querySelector<HTMLAnchorElement>('[data-news-history-link]');
      const nextId = fetchedLink?.dataset.targetEdition ?? null;
      const nextHref = fetchedLink?.getAttribute('href') ?? null;
      if (Boolean(nextId) !== Boolean(nextHref)) throw new Error('incomplete next Edition');
      if ((nextId && !EDITION_ID.test(nextId)) || (nextHref && new URL(nextHref, url).origin !== location.origin)) throw new Error('invalid next Edition');

      historyContainer.append(article);
      chain.push({ id: expectedId, article, nextId, nextHref });
      updateFromTail();
      status.textContent = `${expectedId} Editionを追加しました。`;
      if (focus) {
        replacement.tabIndex = -1;
        replacement.focus();
      }
      return true;
    } catch {
      status.textContent = 'Editionを読み込めませんでした。リンクから個別ページを開けます。';
      return false;
    } finally {
      pending = false;
      loader.querySelector('[data-news-history-link]')?.removeAttribute('aria-disabled');
    }
  };

  const throughUrl = (id: string | null) => {
    const url = new URL(location.href);
    if (id && id !== baseId) url.searchParams.set('through', id);
    else url.searchParams.delete('through');
    return `${url.pathname}${url.search}${url.hash}`;
  };

  const reconcile = async (target: string | null, focus = false) => {
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
      if (!await fetchNext(tail.nextId, tail.nextHref, focus && tail.nextId === target)) return false;
    }
    return true;
  };

  loader.addEventListener('click', async (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('[data-news-history-link]');
    if (!link || pending) return;
    const target = link.dataset.targetEdition;
    const url = new URL(link.href, location.href);
    if (!target || !EDITION_ID.test(target) || url.origin !== location.origin) return;
    event.preventDefault();
    if (await fetchNext(target, link.getAttribute('href')!, true)) history.pushState({}, '', throughUrl(target));
  });

  addEventListener('popstate', async () => {
    const target = new URL(location.href).searchParams.get('through');
    if (!await reconcile(target)) history.replaceState({}, '', throughUrl(chain.at(-1)!.id));
  });

  const initial = new URL(location.href).searchParams.get('through');
  if (initial) void reconcile(initial).then((ok) => {
    if (!ok) history.replaceState({}, '', throughUrl(chain.at(-1)!.id));
  });
}

document.querySelectorAll<HTMLElement>('[data-news-history-loader]').forEach(initHistoryLoader);
