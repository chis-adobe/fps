import { createOptimizedPicture, getMetadata } from '../../scripts/aem.js';

/*
 * Article List block — one row per referenced article page:
 *
 * | Article List                      |
 * |-----------------------------------|
 * | /blog/semiconductors/fib-sem-...  |
 * | /blog/life-in-the-lab/...         |
 *
 * Title, author (linked to the author page), date and image come from each
 * referenced page's metadata (title, author, author url, date, image).
 */

/**
 * Resolves a URL and returns it only when it uses http(s).
 * @param {string} value URL or path
 * @param {string|URL} base Base URL
 * @returns {URL|null}
 */
function toSafeUrl(value, base = window.location.href) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

const isSameSite = (url) => url.origin === window.location.origin
  || /\.aem\.(page|live)$/.test(url.hostname);

/**
 * Formats an ISO date (YYYY-MM-DD) in the page language.
 * @param {string} value The date
 * @returns {string}
 */
function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(date);
}

/**
 * Fetches a page and reads the metadata the list renders.
 * @param {URL} url The article URL (same origin)
 * @returns {Promise<object|null>}
 */
async function fetchArticle(url) {
  try {
    const resp = await fetch(url.pathname);
    if (!resp.ok) return null;
    const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');
    return {
      title: getMetadata('og:title', doc) || doc.title,
      author: getMetadata('author', doc),
      authorUrl: getMetadata('author-url', doc),
      date: getMetadata('date', doc) || getMetadata('published-time', doc),
      image: getMetadata('og:image', doc),
      imageAlt: getMetadata('og:image:alt', doc),
    };
  } catch {
    return null;
  }
}

/**
 * Builds the article image.
 * @param {string} src Image URL from the article metadata
 * @param {string} alt Alt text
 * @returns {Element|null}
 */
function buildImage(src, alt) {
  const url = toSafeUrl(src);
  if (!url) return null;
  if (isSameSite(url)) {
    return createOptimizedPicture(url.pathname, alt, false, [{ width: '400' }]);
  }
  const img = document.createElement('img');
  img.src = url.href;
  img.alt = alt;
  img.loading = 'lazy';
  return img;
}

/**
 * Builds one list item.
 * @param {URL} url Article URL
 * @param {string} fallbackTitle Title to use if the page can't be read
 * @param {object|null} article Article metadata
 * @returns {HTMLLIElement}
 */
function buildItem(url, fallbackTitle, article) {
  const li = document.createElement('li');
  li.className = 'article-list-item';

  const image = article?.image ? buildImage(article.image, '') : null;
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

  if (article?.author || article?.date) {
    const meta = document.createElement('p');
    meta.className = 'article-list-meta';
    if (article.author) {
      const authorUrl = toSafeUrl(article.authorUrl, url);
      const author = document.createElement(authorUrl ? 'a' : 'span');
      author.className = 'article-list-author';
      author.textContent = article.author;
      if (authorUrl) author.href = authorUrl.href;
      meta.append(author);
    }
    if (article.date) {
      const time = document.createElement('time');
      time.className = 'article-list-date';
      time.dateTime = article.date;
      time.textContent = formatDate(article.date);
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

  const articles = await Promise.all(refs.map(({ url }) => fetchArticle(url)));

  const list = document.createElement('ul');
  refs.forEach(({ url, text }, i) => list.append(buildItem(url, text, articles[i])));

  block.textContent = '';
  block.append(list);
}
