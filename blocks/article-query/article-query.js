import { toClassName } from '../../scripts/aem.js';
import { buildArticleItem, resolveAuthor } from '../../scripts/article-items.js';
import { fetchArticleIndex, getMatcher } from '../../scripts/article-index.js';

/*
 * Article Query block — lists articles from the blog query index that match one
 * parameter/value pair. Authored as key/value rows:
 *
 * | Article Query |                          |
 * |---------------|--------------------------|
 * | parameter     | author                   |  author, tag(s), title, or any index column
 * | value         | /authors/dennis-koehler  |  author page path (or name), tag(s), keyword…
 * | limit         | 10                       |  optional
 * | index         | /blog/query-index.json   |  optional (default: the page language's blog index)
 * | empty         | No articles yet.         |  optional text shown when nothing matches
 *
 * Matching: author = same author page (or author name); tag/tags = any of the given
 * comma-separated tags; title and other columns = case-insensitive "contains".
 * Results are sorted newest first.
 */

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
  const rows = (await fetchArticleIndex(config.index || undefined))
    .filter((row) => row.path !== currentPath)
    .filter(getMatcher(parameter, value))
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
      url, title: row.title, date: row.date, image: row.image, tags: row.tags,
    }, author);
  }));

  const list = document.createElement('ul');
  list.append(...items);
  block.append(list);
}
