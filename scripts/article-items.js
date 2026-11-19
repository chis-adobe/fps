import { createOptimizedPicture } from './aem.js';
import {
  fetchAuthor, formatDate, isSameSite, toSafeUrl,
} from './page-metadata.js';

/*
 * Shared rendering of article teasers (image, title, author, date) for blocks that list
 * articles, e.g. article-list (hand-picked references) and article-query (query index results).
 * Class names are prefixed with the block name so each block keeps its own styling.
 */

/**
 * Builds the article image.
 * @param {string} src Image URL
 * @returns {Element|null}
 */
function buildImage(src) {
  const url = toSafeUrl(src);
  if (!url || url.pathname.endsWith('/default-meta-image.png')) return null;
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
 * Resolves an article's author name and link: the `author` value when present, otherwise the
 * name of the page referenced by `authorUrl`.
 * @param {{author?: string, authorUrl?: string}} article
 * @param {string|URL} [base] Base for relative author links
 * @returns {Promise<{name: string, href: string|null}|null>}
 */
export async function resolveAuthor(article, base = window.location.href) {
  const authorUrl = toSafeUrl(article.authorUrl, base);
  const href = authorUrl ? new URL(authorUrl.pathname, window.location.origin).href : null;
  if (article.author) return { name: article.author, href };
  if (!href) return null;
  const author = await fetchAuthor(href);
  return author?.name ? { name: author.name, href } : null;
}

/**
 * Builds one article list item.
 * @param {string} prefix Class prefix (the block name)
 * @param {{url: URL, title: string, date?: string, image?: string}} article
 * @param {{name: string, href: string|null}|null} author
 * @returns {HTMLLIElement}
 */
export function buildArticleItem(prefix, article, author) {
  const li = document.createElement('li');
  li.className = `${prefix}-item`;

  const image = article.image ? buildImage(article.image) : null;
  if (image) {
    const media = document.createElement('a');
    media.className = `${prefix}-image`;
    media.href = article.url.href;
    media.tabIndex = -1;
    media.setAttribute('aria-hidden', 'true');
    media.append(image);
    li.append(media);
  }

  const body = document.createElement('div');
  body.className = `${prefix}-body`;

  const title = document.createElement('h3');
  title.className = `${prefix}-title`;
  const titleLink = document.createElement('a');
  titleLink.href = article.url.href;
  titleLink.textContent = article.title;
  title.append(titleLink);
  body.append(title);

  if (author || article.date) {
    const meta = document.createElement('p');
    meta.className = `${prefix}-meta`;
    if (author) {
      const name = document.createElement(author.href ? 'a' : 'span');
      name.className = `${prefix}-author`;
      name.textContent = author.name;
      if (author.href) name.href = author.href;
      meta.append(name);
    }
    if (article.date) {
      const time = document.createElement('time');
      time.className = `${prefix}-date`;
      time.dateTime = article.date;
      time.textContent = formatDate(article.date, { year: 'numeric', month: 'short', day: 'numeric' });
      meta.append(time);
    }
    body.append(meta);
  }

  li.append(body);
  return li;
}
