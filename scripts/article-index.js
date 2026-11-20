import { isSameSite, toSafeUrl } from './page-metadata.js';
import { getLocale, localizePath } from './locale.js';

/*
 * Shared access to the blog query index for the blocks that list or search articles.
 * Each language has its own blog and index (config/query.yaml): /blog/query-index.json for
 * English, /fr/blog/query-index.json for French, so a page only lists articles in its language.
 */

/**
 * The blog query index of the current page's language.
 * @returns {string}
 */
export function getBlogIndexPath() {
  return localizePath('/blog/query-index.json');
}

/**
 * The article search page of the current page's language; tag links open it with ?tag=….
 * @returns {string}
 */
export function getArticleSearchPath() {
  return localizePath('/blog/search');
}

/** Template of the pages the index should return (other /blog pages, e.g. the search page, are skipped). */
const ARTICLE_TEMPLATE = 'blog-post';

const MAX_ROWS = 500;
const cache = new Map();

/**
 * Lowercases and trims a value for matching.
 * @param {*} value
 * @returns {string}
 */
export const normalize = (value) => (value ?? '').toString().trim().toLowerCase();

/**
 * Turns a list value into an array of trimmed strings: an array (index JSON), a JSON array
 * string, or comma-separated text.
 * @param {*} value
 * @returns {string[]}
 */
export function toList(value) {
  if (Array.isArray(value)) return value.map((v) => `${v}`.trim()).filter(Boolean);
  const text = (value ?? '').toString().trim();
  if (text.startsWith('[')) {
    try {
      const list = JSON.parse(text);
      if (Array.isArray(list)) return list.map((v) => `${v}`.trim()).filter(Boolean);
    } catch {
      // not JSON: comma-separated
    }
  }
  return text.split(',').map((v) => v.trim()).filter(Boolean);
}

/**
 * Normalizes a page reference (path or URL) to its pathname without trailing slash.
 * @param {string} value
 * @returns {string}
 */
function toPath(value) {
  const url = toSafeUrl(value);
  return url ? url.pathname.replace(/\/$/, '').toLowerCase() : normalize(value);
}

/**
 * Builds a matcher for a parameter/value pair.
 * author: same author page (path) or author name; tag/tags: any of the comma-separated tags;
 * anything else (e.g. title): case-insensitive "contains" on that index column.
 * @param {string} parameter
 * @param {string} value
 * @returns {(row: object) => boolean}
 */
export function getMatcher(parameter, value) {
  const wanted = normalize(value);
  switch (parameter) {
    case 'author':
    case 'author-url': {
      const path = toPath(value);
      return (row) => (row['author-url'] && toPath(row['author-url']) === path)
        || normalize(row.author) === wanted;
    }
    case 'tag':
    case 'tags': {
      const tags = toList(value).map(normalize);
      return (row) => toList(row.tags).map(normalize).some((tag) => tags.includes(tag));
    }
    default:
      return (row) => normalize(row[parameter]).includes(wanted);
  }
}

/**
 * Fetches the article rows of a query index (cached per path), newest first.
 * @param {string} [indexPath]
 * @returns {Promise<object[]>}
 */
export function fetchArticleIndex(indexPath = getBlogIndexPath()) {
  const url = toSafeUrl(indexPath);
  if (!url || !isSameSite(url)) return Promise.resolve([]);
  if (!cache.has(url.pathname)) {
    // revalidate with the server instead of reusing a browser-cached copy (cached for up to
    // 2 hours on the live site), so newly published articles show up right away
    cache.set(url.pathname, fetch(`${url.pathname}?limit=${MAX_ROWS}`, { cache: 'no-cache' })
      .then((resp) => (resp.ok ? resp.json() : { data: [] }))
      .then((json) => (Array.isArray(json.data) ? json.data : []))
      .then((rows) => rows
        .filter((row) => row.path && (!row.template || row.template === ARTICLE_TEMPLATE))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')))
      .catch(() => []));
  }
  return cache.get(url.pathname);
}

/* === tags of interest === */

/**
 * Browser storage key for the tags a visitor clicked (most recent first), per language since
 * each language has its own tags.
 * @returns {string}
 */
function getTagsOfInterestKey() {
  const { prefix, lang } = getLocale();
  return prefix ? `blog-tags-of-interest-${lang}` : 'blog-tags-of-interest';
}
const MAX_TAGS_OF_INTEREST = 10;

/** Event fired on window when the tags of interest change (detail: the new list). */
export const TAGS_OF_INTEREST_EVENT = 'tags-of-interest-change';

/**
 * Returns the visitor's tags of interest, most recent first.
 * @returns {string[]}
 */
export function getTagsOfInterest() {
  try {
    const list = JSON.parse(window.localStorage.getItem(getTagsOfInterestKey()) || '[]');
    return Array.isArray(list) ? list.filter((tag) => typeof tag === 'string' && tag.trim()) : [];
  } catch {
    return [];
  }
}

/**
 * Records a tag the visitor showed interest in (clicked tag link or selected tag filter).
 * Stored only in this browser.
 * @param {string} tag
 */
export function addTagOfInterest(tag) {
  const value = `${tag ?? ''}`.trim().slice(0, 100);
  if (!value) return;
  const list = [value, ...getTagsOfInterest().filter((t) => normalize(t) !== normalize(value))]
    .slice(0, MAX_TAGS_OF_INTEREST);
  try {
    window.localStorage.setItem(getTagsOfInterestKey(), JSON.stringify(list));
  } catch {
    // storage unavailable (e.g. blocked): nothing to remember
  }
  window.dispatchEvent(new CustomEvent(TAGS_OF_INTEREST_EVENT, { detail: list }));
}

/**
 * Link to the article search page filtered by a tag.
 * @param {string} tag
 * @returns {string}
 */
export function getTagSearchUrl(tag) {
  const url = new URL(getArticleSearchPath(), window.location.origin);
  url.searchParams.set('tag', tag);
  return url.href;
}
