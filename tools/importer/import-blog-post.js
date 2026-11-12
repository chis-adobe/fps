/* eslint-disable */
/* global WebImporter */

/*
 * Thermo Fisher blog article import.
 * One input (a WordPress article) -> two documents:
 *   /blog/{category}/{slug}   the article (title, featured image, body) + metadata
 *                             (title, author, author url, date, description, template)
 *   /authors/{author}         the author's page (name, headshot/role/bio when available)
 */

import cleanupTransformer from './transformers/thermofisher-blog-cleanup.js';

const PAGE_TEMPLATE = { name: 'blog-post', blocks: [] };

/* Article metadata as specified for this migration, keyed by source path. */
const ARTICLES = {
  '/blog/semiconductors/fib-sem-semiconductor-characterization': {
    title: 'From Manual Control to Automated Insights: Versatile FIB-SEM Workflows for Semiconductor Research',
    author: 'Claudia Bernal',
    date: '2026-11-11',
  },
  '/blog/life-in-the-lab/bioprocessing-cell-culture-engineering-antibody-drug-conjugates': {
    title: 'Engineering the future of antibody-drug conjugates',
    author: 'Bioprocessing Staff',
    date: '2026-11-11',
  },
  '/blog/metals/honoring-those-who-wore-the-metal-tags-veterans-day-2026': {
    title: 'Honoring Those Who Wore the Metal Tags: Veterans Day 2026',
    author: 'Marlene Gasdia-Cochrane',
    date: '2026-11-11',
  },
};

const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const slugify = (value) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const meta = (document, selector) => document.querySelector(selector)?.getAttribute('content') || '';

function metadataTable(document, entries) {
  return WebImporter.DOMUtils.createTable([['Metadata'], ...entries.filter(([, v]) => v)], document);
}

/** Author box on the source page, when it belongs to the given author. */
function readAuthorBox(document, authorName) {
  const box = document.querySelector('.authors-container .author-box-selected, section.author-box');
  if (!box) return null;
  const name = text(box.querySelector('h2, .author-box-title')).replace(/,.*$/, '');
  if (slugify(name) !== slugify(authorName)) return null;
  const headshot = box.querySelector('.author-headshot img');
  const bio = [...box.querySelectorAll('.author-info p:not(.eyebrow):not(.author-title), .author-box-content p')]
    .map(text).filter(Boolean);
  return {
    role: text(box.querySelector('.author-title')),
    bio,
    headshot: headshot?.getAttribute('src'),
  };
}

function buildAuthorPage(document, authorName, box) {
  const main = document.createElement('div');
  if (box?.headshot) {
    const img = document.createElement('img');
    img.src = box.headshot;
    img.alt = authorName;
    main.append(img);
  }
  const h1 = document.createElement('h1');
  h1.textContent = authorName;
  main.append(h1);
  if (box?.role) {
    const p = document.createElement('p');
    p.textContent = box.role;
    main.append(p);
  }
  (box?.bio || []).forEach((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    main.append(p);
  });
  main.append(metadataTable(document, [
    ['Title', authorName],
    ['Description', box?.role || ''],
    ['Template', 'author'],
  ]));
  return main;
}

export default {
  transform: ({ document, url, params }) => {
    const originalUrl = params?.originalURL || url;
    const path = new URL(originalUrl).pathname.replace(/\/$/, '');
    const spec = ARTICLES[path] || {};

    const article = document.querySelector('article') || document.body;
    cleanupTransformer('beforeTransform', article, { document, url, params, template: PAGE_TEMPLATE });

    const title = spec.title || text(article.querySelector('h1'));
    const authorName = spec.author || meta(document, 'meta[name="author"]').replace(/,.*$/, '');
    const authorPath = `/authors/${slugify(authorName)}`;
    const date = spec.date || meta(document, 'meta[property="article:published_time"]').slice(0, 10);
    const description = meta(document, 'meta[name="description"]') || meta(document, 'meta[property="og:description"]');
    const ogImage = meta(document, 'meta[property="og:image"]');

    const main = document.createElement('div');
    const h1 = document.createElement('h1');
    h1.textContent = title;
    main.append(h1);

    const content = article.querySelector('.entry-content') || article;
    // featured image, unless the article body already starts with it
    const firstImg = content.querySelector('img');
    if (ogImage && !(firstImg && content.firstElementChild?.contains(firstImg))) {
      const img = document.createElement('img');
      img.src = ogImage;
      img.alt = '';
      main.append(img);
    }
    main.append(...content.childNodes);

    main.append(metadataTable(document, [
      ['Title', title],
      ['Description', description],
      ['Author', authorName],
      ['Author URL', authorPath],
      ['Date', date],
      ['Image', ogImage ? Object.assign(document.createElement('img'), { src: ogImage, alt: '' }) : ''],
      ['Template', 'blog-post'],
    ]));

    const box = readAuthorBox(document, authorName);
    return [
      { element: main, path },
      { element: buildAuthorPage(document, authorName, box), path: authorPath },
    ];
  },
};
