import { getMetadata } from './aem.js';

/*
 * Reads the metadata of other pages (e.g. an article's author page) so blocks and
 * templates can reference a page instead of duplicating its information.
 */

const cache = new Map();

/**
 * Resolves a URL and returns it only when it uses http(s).
 * @param {string} value URL or path
 * @param {string|URL} [base] Base URL
 * @returns {URL|null}
 */
export function toSafeUrl(value, base = window.location.href) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

/**
 * @param {URL} url
 * @returns {boolean} true for the current host or the site's preview/live hosts
 */
export function isSameSite(url) {
  return url.origin === window.location.origin || /\.aem\.(page|live)$/.test(url.hostname);
}

/**
 * Fetches a same-site page and returns its parsed document (cached per path).
 * @param {string} value Page URL or path
 * @returns {Promise<Document|null>}
 */
export function fetchPage(value) {
  const url = toSafeUrl(value);
  if (!url || !isSameSite(url)) return Promise.resolve(null);
  const { pathname } = url;
  if (!cache.has(pathname)) {
    cache.set(pathname, fetch(pathname)
      .then((resp) => (resp.ok ? resp.text() : null))
      .then((html) => (html ? new DOMParser().parseFromString(html, 'text/html') : null))
      .catch(() => null));
  }
  return cache.get(pathname);
}

/**
 * Returns the page's image from its metadata, ignoring missing/placeholder images.
 * @param {Document} doc
 * @returns {string}
 */
function getImage(doc) {
  const image = getMetadata('og:image', doc) || getMetadata('image', doc);
  const url = toSafeUrl(image);
  if (!url || url.pathname.endsWith('/default-meta-image.png')) return '';
  return url.href;
}

/**
 * Returns the page's tags. Edge Delivery publishes the Tags metadata as one
 * `article:tag` meta per tag (getMetadata joins them with ", ").
 * @param {Document} [doc]
 * @returns {string[]}
 */
export function getTags(doc = document) {
  const value = getMetadata('article:tag', doc) || getMetadata('tags', doc);
  return value.split(',').map((tag) => tag.trim()).filter(Boolean);
}

/**
 * Reads the details of an author page from its metadata.
 * @param {string} value Author page URL or path
 * @returns {Promise<object|null>} name, role, description, image, url
 */
export async function fetchAuthor(value) {
  const doc = await fetchPage(value);
  if (!doc) return null;
  return {
    url: new URL(toSafeUrl(value).pathname, window.location.origin).href,
    name: getMetadata('og:title', doc) || doc.title,
    role: getMetadata('role', doc),
    description: getMetadata('description', doc),
    image: getImage(doc),
  };
}

/**
 * Reads the details of an article page from its metadata.
 * @param {string} value Article URL or path
 * @returns {Promise<object|null>} title, brief, author, authorUrl, date, image, imageAlt, tags
 */
export async function fetchArticle(value) {
  const doc = await fetchPage(value);
  if (!doc) return null;
  return {
    title: getMetadata('og:title', doc) || doc.title,
    author: getMetadata('author', doc),
    authorUrl: getMetadata('author-url', doc),
    date: getMetadata('date', doc) || getMetadata('published-time', doc),
    brief: getMetadata('brief', doc),
    image: getImage(doc),
    imageAlt: getMetadata('image-alt', doc),
    tags: getTags(doc),
  };
}

/**
 * Formats an ISO date (YYYY-MM-DD) in the page language.
 * @param {string} value The date
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export function formatDate(value, options = { year: 'numeric', month: 'long', day: 'numeric' }) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(document.documentElement.lang || undefined, options).format(date);
}
