import { fetchArticle, isSameSite, toSafeUrl } from '../../scripts/page-metadata.js';
import { buildArticleItem, resolveAuthor } from '../../scripts/article-items.js';
import {
  DEFAULT_INDEX, fetchArticleIndex, getTagsOfInterest, normalize, TAGS_OF_INTEREST_EVENT, toList,
} from '../../scripts/article-index.js';

/*
 * Article Personalization block — article cards picked from the visitor's "tags of interest"
 * (tags they clicked on article cards, article pages or the search filters; stored in their
 * browser only). Authored with fallback articles, one link per row:
 *
 * | Article Personalization                  |
 * |------------------------------------------|
 * | /blog/can-uhplc-take-over-serial-...     |
 * | /blog/is-low-elsd-sensitivity-...        |
 *
 * It shows as many cards as there are fallback articles (2 above). Articles with the most
 * recently clicked tag come first; older tags of interest order the rest. The
 * fallback articles show when the visitor has no tags of interest yet, or when fewer matching
 * articles than cards are found. The cards update as soon as the visitor clicks another tag.
 */

const DEFAULT_COUNT = 2;

/**
 * Reads the fallback article links (same-site only, served from the current host).
 * @param {Element} block
 * @returns {URL[]}
 */
function readFallbacks(block) {
  return [...block.querySelectorAll('a[href]')]
    .map((a) => toSafeUrl(a.getAttribute('href')))
    .filter((url) => url && isSameSite(url))
    .map((url) => new URL(url.pathname, window.location.origin));
}

/**
 * Ranks index rows against the tags of interest. The most recent tag counts more than all
 * older tags together (weights 1, 1/2, 1/4, …), so articles with the latest clicked tag always
 * come first; older tags only order articles among themselves. Newer articles win exact ties.
 * @param {object[]} rows Index rows
 * @param {string[]} interests Tags of interest, most recent first
 * @returns {object[]} Matching rows, best first
 */
function rankByInterest(rows, interests) {
  const weights = new Map();
  interests.forEach((tag, i) => {
    const key = normalize(tag);
    if (!weights.has(key)) weights.set(key, 2 ** -i);
  });
  const currentPath = window.location.pathname.replace(/\/$/, '');
  return rows
    .filter((row) => row.path !== currentPath)
    .map((row) => {
      const tags = new Set(toList(row.tags).map(normalize));
      const score = [...tags].reduce((sum, tag) => sum + (weights.get(tag) || 0), 0);
      return { row, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (b.row.date || '').localeCompare(a.row.date || ''))
    .map(({ row }) => row);
}

/**
 * Builds cards from index rows.
 * @param {object[]} rows
 * @returns {Promise<HTMLLIElement[]>}
 */
function cardsFromIndex(rows) {
  return Promise.all(rows.map(async (row) => {
    const url = new URL(row.path, window.location.origin);
    const author = await resolveAuthor({ author: row.author, authorUrl: row['author-url'] }, url);
    return buildArticleItem('article-personalization', {
      url, title: row.title, date: row.date, image: row.image, tags: row.tags,
    }, author);
  }));
}

/**
 * Builds cards for the fallback articles from their page metadata.
 * @param {URL[]} urls
 * @returns {Promise<HTMLLIElement[]>}
 */
function cardsFromPages(urls) {
  return Promise.all(urls.map(async (url) => {
    const article = await fetchArticle(url.href);
    const author = article ? await resolveAuthor(article, url) : null;
    return buildArticleItem('article-personalization', {
      url,
      title: article?.title || url.pathname,
      date: article?.date,
      image: article?.image,
      tags: article?.tags,
    }, author);
  }));
}

/**
 * loads and decorates the article personalization block
 * @param {Element} block The article-personalization block element
 */
export default async function decorate(block) {
  const fallbacks = readFallbacks(block);
  const count = fallbacks.length || DEFAULT_COUNT;
  const list = document.createElement('ul');
  block.textContent = '';
  block.append(list);

  let renderId = 0;
  const render = async () => {
    renderId += 1;
    const current = renderId;
    const interests = getTagsOfInterest();
    const matches = interests.length
      ? rankByInterest(await fetchArticleIndex(DEFAULT_INDEX), interests)
      : [];
    const personalized = matches.length >= count;
    const cards = personalized
      ? await cardsFromIndex(matches.slice(0, count))
      : await cardsFromPages(fallbacks);
    if (current !== renderId) return; // a newer render started meanwhile
    list.replaceChildren(...cards);
    block.dataset.source = personalized ? 'interests' : 'fallback';
  };

  window.addEventListener(TAGS_OF_INTEREST_EVENT, render);
  await render();
}
