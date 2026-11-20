import { toClassName } from '../../scripts/aem.js';
import { buildArticleItem, resolveAuthor } from '../../scripts/article-items.js';
import {
  DEFAULT_INDEX, fetchArticleIndex, getMatcher, normalize, toList,
} from '../../scripts/article-index.js';

/*
 * Article Search block — searches the blog query index by title keyword and by tags.
 * All labels are authored, as key/value rows:
 *
 * | Article Search |                                   |
 * |----------------|-----------------------------------|
 * | search label   | Search articles                   |
 * | placeholder    | Search by title                   |
 * | button         | Search                            |
 * | tags label     | Filter by tag                     |
 * | results label  | {count} articles                  |  optional, {count} is replaced
 * | result label   | {count} article                   |  optional, used for a single result
 * | empty          | No articles match your search.    |
 * | index          | /blog/query-index.json            |  optional
 *
 * The search is driven by the page URL: ?q=keyword (title contains) and ?tag=Tag (repeatable;
 * an article matches when it has any of the selected tags). Tag links on article cards and
 * article pages open this page with ?tag=… so the results are filtered by that tag.
 */

let instance = 0;

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
    const link = valueCell.querySelector('a[href]');
    config[toClassName(keyCell.textContent)] = link ? link.getAttribute('href') : valueCell.textContent.trim();
  });
  return config;
}

/**
 * @param {string} tag Element name
 * @param {string} className Class
 * @param {string} [text] Text content
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * Reads the current search from the page URL.
 * @returns {{q: string, tags: string[]}}
 */
function readSearch() {
  const params = new URLSearchParams(window.location.search);
  return {
    q: (params.get('q') || '').trim(),
    tags: params.getAll('tag').flatMap(toList),
  };
}

/**
 * Writes the search to the page URL (so it can be shared / bookmarked).
 * @param {{q: string, tags: string[]}} search
 */
function writeSearch({ q, tags }) {
  const url = new URL(window.location.href);
  url.searchParams.delete('q');
  url.searchParams.delete('tag');
  if (q) url.searchParams.set('q', q);
  tags.forEach((tag) => url.searchParams.append('tag', tag));
  window.history.replaceState(null, '', url);
}

/**
 * Returns the distinct tags used in the index, keeping the first spelling seen.
 * @param {object[]} rows
 * @returns {string[]}
 */
function collectTags(rows) {
  const tags = new Map();
  rows.forEach((row) => toList(row.tags).forEach((tag) => {
    if (!tags.has(normalize(tag))) tags.set(normalize(tag), tag);
  }));
  return [...tags.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * loads and decorates the article search block
 * @param {Element} block The article-search block element
 */
export default async function decorate(block) {
  const config = readConfig(block);
  instance += 1;
  const inputId = `article-search-input-${instance}`;
  block.textContent = '';

  // search form
  const form = el('form', 'article-search-form');
  form.setAttribute('role', 'search');
  const label = el('label', 'article-search-label', config['search-label']);
  label.htmlFor = inputId;
  const input = el('input', 'article-search-input');
  input.type = 'search';
  input.id = inputId;
  input.name = 'q';
  if (config.placeholder) input.placeholder = config.placeholder;
  const button = el('button', 'article-search-button', config.button);
  button.type = 'submit';
  if (!config.button) button.hidden = true;
  const field = el('div', 'article-search-field');
  field.append(input, button);
  form.append(label, field);

  // tag filters (toggle buttons)
  const tagsGroup = el('div', 'article-search-filters');
  tagsGroup.setAttribute('role', 'group');
  if (config['tags-label']) {
    const tagsLabel = el('p', 'article-search-filters-label', config['tags-label']);
    tagsLabel.id = `${inputId}-tags`;
    tagsGroup.setAttribute('aria-labelledby', tagsLabel.id);
    tagsGroup.append(tagsLabel);
  }
  const tagList = el('ul', 'article-search-tag-list');
  tagsGroup.append(tagList);
  form.append(tagsGroup);

  const status = el('p', 'article-search-status');
  status.setAttribute('aria-live', 'polite');
  const results = el('ul', 'article-search-results');
  block.append(form, status, results);

  const rows = await fetchArticleIndex(config.index || DEFAULT_INDEX);
  const allTags = collectTags(rows);
  const search = readSearch();
  input.value = search.q;

  // selected tags are matched case-insensitively; keep unknown tags from the URL selectable too
  const selected = new Set(search.tags.map(normalize));
  search.tags.forEach((tag) => {
    if (!allTags.some((t) => normalize(t) === normalize(tag))) allTags.push(tag);
  });

  let renderId = 0;
  const render = async () => {
    renderId += 1;
    const current = renderId;
    const q = input.value.trim();
    const tags = allTags.filter((tag) => selected.has(normalize(tag)));
    writeSearch({ q, tags });

    const byTitle = q ? getMatcher('title', q) : () => true;
    const byTags = tags.length ? getMatcher('tags', tags.join(',')) : () => true;
    const matches = rows.filter((row) => byTitle(row) && byTags(row));

    const items = await Promise.all(matches.map(async (row) => {
      const url = new URL(row.path, window.location.origin);
      const author = await resolveAuthor({ author: row.author, authorUrl: row['author-url'] }, url);
      return buildArticleItem('article-search', {
        url, title: row.title, date: row.date, image: row.image, tags: row.tags,
      }, author);
    }));
    if (current !== renderId) return; // a newer search started meanwhile

    results.replaceChildren(...items);
    if (!matches.length) status.textContent = config.empty || '';
    else {
      const countLabel = (matches.length === 1 && config['result-label']) || config['results-label'] || '';
      status.textContent = countLabel.replace('{count}', matches.length);
    }
  };

  allTags.forEach((tag) => {
    const li = document.createElement('li');
    const toggle = el('button', 'article-search-tag', tag);
    toggle.type = 'button';
    toggle.setAttribute('aria-pressed', selected.has(normalize(tag)));
    toggle.addEventListener('click', () => {
      const key = normalize(tag);
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
      toggle.setAttribute('aria-pressed', selected.has(key));
      render();
    });
    li.append(toggle);
    tagList.append(li);
  });
  if (!allTags.length) tagsGroup.hidden = true;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    render();
  });
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(render, 250);
  });

  render();
}
