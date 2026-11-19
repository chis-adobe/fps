import { fetchArticle, isSameSite, toSafeUrl } from '../../scripts/page-metadata.js';
import { buildArticleItem, resolveAuthor } from '../../scripts/article-items.js';

/*
 * Article List block — one row per referenced article page:
 *
 * | Article List                      |
 * |-----------------------------------|
 * | /blog/semiconductors/fib-sem-...  |
 * | /blog/life-in-the-lab/...         |
 *
 * Title, date and image come from each referenced page's metadata. The author comes from
 * the page's `author url` (the author page's name), or its `author` metadata if it has one.
 */

/**
 * loads and decorates the article list block
 * @param {Element} block The article-list block element
 */
export default async function decorate(block) {
  const refs = [...block.querySelectorAll('a[href]')]
    .map((a) => ({ url: toSafeUrl(a.getAttribute('href')), text: a.textContent.trim() }))
    .filter(({ url }) => url && isSameSite(url))
    // serve every referenced article from the current host (local, preview or live)
    .map(({ url, text }) => ({ url: new URL(url.pathname, window.location.origin), text }));

  const items = await Promise.all(refs.map(async ({ url, text }) => {
    const article = await fetchArticle(url.href);
    const author = article ? await resolveAuthor(article, url) : null;
    return buildArticleItem('article-list', {
      url,
      title: article?.title || text,
      date: article?.date,
      image: article?.image,
    }, author);
  }));

  const list = document.createElement('ul');
  list.append(...items);
  block.textContent = '';
  block.append(list);
}
