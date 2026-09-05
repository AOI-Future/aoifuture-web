// Edition titles are authored with a brand prefix ("AOIFUTURE News：..." or
// "AOIFUTURE News — ..."). The News layout already carries the brand in the
// header, the `| AOIFUTURE News` title suffix, og:site_name, and the RSS
// channel title, so the prefix is stripped everywhere the title is *rendered*.
// Source content JSON keeps the prefix unchanged for hash/audit stability.
const BRAND_PREFIX = /^AOIFUTURE\s+News\s*(?:：|:|—|–|―|・|-)\s*/;

export function displayEditionTitle(title) {
  if (typeof title !== 'string') return title;
  const stripped = title.replace(BRAND_PREFIX, '').trim();
  return stripped.length > 0 ? stripped : title;
}
