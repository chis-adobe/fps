/* eslint-disable */
/* global WebImporter */

/*
 * Blog article import (metadata-first structure).
 * One input (a Thermo Fisher WordPress article) -> /blog/{category}/{slug}:
 *   body:     the article content only (no title, no byline, no author box)
 *   metadata: Title, Description, Author URL (-> /authors/{first-last}), Date, Breadcrumb, Template
 * The blog-post template renders title, breadcrumb, byline and author card from the metadata
 * and the referenced author page.
 */

import cleanupTransformer from './transformers/thermofisher-blog-cleanup.js';
import AEM_ASSETS from './aem-assets.js';

const PAGE_TEMPLATE = { name: 'blog-article', blocks: [] };

const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const meta = (document, selector) => document.querySelector(selector)?.getAttribute('content') || '';

/** Name -> URL slug, transliterating umlauts (Köhler -> koehler). Same as import-author.js. */
function authorSlug(name) {
  return name.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Source image URL -> AEM Assets URL when known (matches with or without WP size suffix). */
function assetUrl(src) {
  const name = (src || '').split('?')[0].split('/').pop();
  const base = name.replace(/-\d+x\d+(\.\w+)$/, '$1');
  return AEM_ASSETS[name] || AEM_ASSETS[base] || src;
}

function metadataTable(document, entries) {
  return WebImporter.DOMUtils.createTable([['Metadata'], ...entries.filter(([, v]) => v)], document);
}

export default {
  transform: ({ document, url, params }) => {
    const originalUrl = params?.originalURL || url;
    const path = new URL(originalUrl).pathname.replace(/\/$/, '');

    const article = document.querySelector('article') || document.body;
    cleanupTransformer('beforeTransform', article, { document, url, params, template: PAGE_TEMPLATE });

    const title = text(article.querySelector('h1.entry-title, h1')) || meta(document, 'meta[property="og:title"]');
    const description = meta(document, 'meta[name="description"]') || meta(document, 'meta[property="og:description"]');
    const date = meta(document, 'meta[property="article:published_time"]').slice(0, 10);
    const authorName = text(document.querySelector('.entry-header a[rel="author"], .entry-header a[href*="/contributor/"]'))
      || meta(document, 'meta[name="author"]');

    // breadcrumb trail labels from the source header (the page itself is added by the template)
    const crumbs = [...document.querySelectorAll('.breadcrumb-link-wrap, .site-header li[itemscope]')]
      .map(text).filter(Boolean);
    const breadcrumb = [...new Set(crumbs)].join(' > ');

    const content = article.querySelector('.entry-content') || article;
    content.querySelectorAll('img').forEach((img) => img.setAttribute('src', assetUrl(img.getAttribute('src'))));

    const main = document.createElement('div');
    main.append(...content.childNodes);
    main.append(metadataTable(document, [
      ['Title', title],
      ['Description', description],
      ['Author URL', authorName ? `/authors/${authorSlug(authorName)}` : ''],
      ['Date', date],
      ['Breadcrumb', breadcrumb],
      ['Template', 'blog-post'],
    ]));

    return [{ element: main, path }];
  },
};
