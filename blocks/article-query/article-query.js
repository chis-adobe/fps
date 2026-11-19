import { toClassName } from '../../scripts/aem.js';
import { isSameSite, toSafeUrl } from '../../scripts/page-metadata.js';
import { buildArticleItem, resolveAuthor } from '../../scripts/article-items.js';

/*
 * Article Query block — lists articles from the blog query index that match one
 * parameter/value pair. Authored as key/value rows:
 *
 * | Article Query |                          |
 * |---------------|--------------------------|
 * | parameter     | author                   |  author, tag(s), title, or any index column
 * | value         | /authors/dennis-koehler  |  author page path (or name), tag(s), keyword…
 * | limit         | 10                       |  optional
 * | index         | /blog/query-index.json   |  optional
 * | empty         | No articles yet.         |  optional text shown when nothing matches
 *
 * Matching: author = same author page (or author name); tag/tags = any of the given
 * comma-separated tags; title and other columns = case-insensitive "contains".
 * Results are sorted newest first.
 */

const DEFAULT_INDEX = '/blog/query-index.json';
const MAX_RESULTS = 500;

/**
 * Reads the key/value rows.
 * @param {Element} block
 * @returns {Record<string, string>}
 */
function readConfig(block) {
  const config = {};
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    if (!keyCell || !valueCell) return;
    const key = toClassName(keyCell.textContent);
    const link = valueCell.querySelector('a[href]');
    config[key] = link ? link.getAttribute('href') : valueCell.textContent.trim();
  });
  return config;
}

const normalize = (value) => (value || '').toString().trim().toLowerCase();
const splitList = (value) => (value || '').split(',').map(normalize).filter(Boolean);

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
 * Builds the matcher for the parameter/value pair.
 * @param {string} parameter
 * @param {string} value
 * @returns {(row: object) => boolean}
 */
function getMatcher(parameter, value) {
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
      const tags = splitList(value);
      return (row) => splitList(row.tags).some((tag) => tags.includes(tag));
    }
    default:
      return (row) => normalize(row[parameter]).includes(wanted);
  }
}

/**
 * Fetches the query index rows.
 * @param {string} indexPath
 * @returns {Promise<object[]>}
 */
async function fetchIndex(indexPath) {
  const url = toSafeUrl(indexPath);
  if (!url || !isSameSite(url)) return [];
  try {
    const resp = await fetch(`${url.pathname}?limit=${MAX_RESULTS}`);
    if (!resp.ok) return [];
    const json = await resp.json();
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

/**
 * loads and decorates the article query block
 * @param {Element} block The article-query block element
 */
export default async function decorate(block) {
  const config = readConfig(block);
  const parameter = toClassName(config.parameter || '');
  const { value } = config;
  const limit = Number.parseInt(config.limit, 10) || MAX_RESULTS;
  block.textContent = '';
  if (!parameter || !value) return;

  const currentPath = window.location.pathname.replace(/\/$/, '');
  const rows = (await fetchIndex(config.index || DEFAULT_INDEX))
    .filter((row) => row.path && row.path !== currentPath)
    .filter(getMatcher(parameter, value))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, limit);

  if (!rows.length) {
    if (config.empty) {
      const p = document.createElement('p');
      p.className = 'article-query-empty';
      p.textContent = config.empty;
      block.append(p);
    }
    return;
  }

  const items = await Promise.all(rows.map(async (row) => {
    const url = new URL(row.path, window.location.origin);
    const author = await resolveAuthor({ author: row.author, authorUrl: row['author-url'] }, url);
    return buildArticleItem('article-query', {
      url, title: row.title, date: row.date, image: row.image,
    }, author);
  }));

  const list = document.createElement('ul');
  list.append(...items);
  block.append(list);
}
