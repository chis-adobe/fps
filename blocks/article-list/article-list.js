import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  fetchArticle, fetchAuthor, formatDate, isSameSite, toSafeUrl,
} from '../../scripts/page-metadata.js';

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
 * Builds the article image.
 * @param {string} src Image URL from the article metadata
 * @returns {Element|null}
 */
function buildImage(src) {
  const url = toSafeUrl(src);
  if (!url) return null;
  if (isSameSite(url)) {
    return createOptimizedPicture(url.pathname, '', false, [{ width: '400' }]);
  }
  const img = document.createElement('img');
  img.src = url.href;
  img.alt = '';
  img.loading = 'lazy';
  return img;
}

/**
 * Resolves the article's author name and link.
 * @param {object} article Article metadata
 * @param {URL} articleUrl Article URL (base for relative author links)
 * @returns {Promise<{name: string, href: string|null}|null>}
 */
async function resolveAuthor(article, articleUrl) {
  const authorUrl = toSafeUrl(article.authorUrl, articleUrl);
  const href = authorUrl ? new URL(authorUrl.pathname, window.location.origin).href : null;
  if (article.author) return { name: article.author, href };
  if (!href) return null;
  const author = await fetchAuthor(href);
  return author?.name ? { name: author.name, href } : null;
}

/**
 * Builds one list item.
 * @param {URL} url Article URL
 * @param {string} fallbackTitle Title to use if the page can't be read
 * @param {object|null} article Article metadata
 * @param {object|null} author Author name and link
 * @returns {HTMLLIElement}
 */
function buildItem(url, fallbackTitle, article, author) {
  const li = document.createElement('li');
  li.className = 'article-list-item';

  const image = article?.image ? buildImage(article.image) : null;
  if (image) {
    const media = document.createElement('a');
    media.className = 'article-list-image';
    media.href = url.href;
    media.tabIndex = -1;
    media.setAttribute('aria-hidden', 'true');
    media.append(image);
    li.append(media);
  }

  const body = document.createElement('div');
  body.className = 'article-list-body';

  const title = document.createElement('h3');
  title.className = 'article-list-title';
  const titleLink = document.createElement('a');
  titleLink.href = url.href;
  titleLink.textContent = article?.title || fallbackTitle;
  title.append(titleLink);
  body.append(title);

  if (author || article?.date) {
    const meta = document.createElement('p');
    meta.className = 'article-list-meta';
    if (author) {
      const name = document.createElement(author.href ? 'a' : 'span');
      name.className = 'article-list-author';
      name.textContent = author.name;
      if (author.href) name.href = author.href;
      meta.append(name);
    }
    if (article?.date) {
      const time = document.createElement('time');
      time.className = 'article-list-date';
      time.dateTime = article.date;
      time.textContent = formatDate(article.date, { year: 'numeric', month: 'short', day: 'numeric' });
      meta.append(time);
    }
    body.append(meta);
  }

  li.append(body);
  return li;
}

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
    return buildItem(url, text, article, author);
  }));

  const list = document.createElement('ul');
  list.append(...items);
  block.textContent = '';
  block.append(list);
}
