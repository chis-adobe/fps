/* eslint-disable */
/* global WebImporter */

/*
 * Blog article import (metadata-first structure).
 * One input (a Thermo Fisher WordPress article) -> /blog/{slug} (directly under /blog):
 *   body:     the article content only (no title, brief, top image, byline or author box)
 *   metadata: Title, Brief, Image (+ Image Alt), Description, Author URL (-> /authors/{first-last}),
 *             Date, Tags, Breadcrumb, Template
 * The blog-post template renders breadcrumb, title, byline, brief, image and author card from the
 * metadata and the referenced author page, so other pages (e.g. the homepage) can reference them.
 */

import cleanupTransformer from './transformers/thermofisher-blog-cleanup.js';
import AEM_ASSETS from './aem-assets.js';

const PAGE_TEMPLATE = { name: 'blog-article', blocks: [] };

/*
 * Curated tags (from the approved list on the options tab of /docs/library/blocks.json),
 * shared across articles; they replace the source keywords for these articles.
 */
const TAGS = {
  'can-uhplc-take-over-serial-dilutions': ['Chromatography', 'UHPLC', 'Automation', 'Industrial'],
  'is-low-elsd-sensitivity-limiting-your-impurity-analysis': ['Chromatography', 'HPLC', 'Impurity Analysis', 'Industrial'],
};

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

/** Article tags from the JSON-LD keywords (read in preprocess, before scripts are removed). */
function readKeywords(document) {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const json = JSON.parse(script.textContent);
      const nodes = Array.isArray(json['@graph']) ? json['@graph'] : [json];
      const node = nodes.find((n) => Array.isArray(n.keywords));
      if (node) return node.keywords.map((k) => `${k}`.trim()).filter(Boolean);
    } catch (e) { /* ignore invalid JSON-LD */ }
  }
  return [];
}

/** Fallback tags from the WordPress tag-* classes on the article. */
function readTagClasses(article) {
  return [...(article.className || '').matchAll(/\btag-([a-z0-9-]+)/g)]
    .map((m) => m[1].replace(/-/g, ' '));
}

export default {
  preprocess: ({ document, params }) => {
    params.keywords = readKeywords(document);
  },

  transform: ({ document, url, params }) => {
    const originalUrl = params?.originalURL || url;
    const slug = new URL(originalUrl).pathname.replace(/\/$/, '').split('/').pop();
    const path = `/blog/${slug}`;

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

    // brief: the heading 2 that opens the article
    let brief = '';
    const opening = content.firstElementChild;
    if (opening?.tagName === 'H2') {
      brief = text(opening);
      opening.remove();
    }

    // image: the article's top image (its figure is removed from the body)
    let image = '';
    let imageAlt = '';
    const topBlock = content.firstElementChild;
    const topImg = topBlock?.matches('img') ? topBlock : topBlock?.querySelector('img');
    if (topImg && !text(topBlock)) {
      image = document.createElement('img');
      image.src = topImg.getAttribute('src');
      imageAlt = (topImg.getAttribute('alt') || '').trim();
      image.alt = imageAlt;
      topBlock.remove();
    }

    const main = document.createElement('div');
    main.append(...content.childNodes);
    main.append(metadataTable(document, [
      ['Title', title],
      ['Brief', brief],
      ['Image', image],
      ['Image Alt', imageAlt],
      ['Description', description],
      ['Author URL', authorName ? `/authors/${authorSlug(authorName)}` : ''],
      ['Date', date],
      ['Tags', (TAGS[slug] || (params?.keywords?.length ? params.keywords : readTagClasses(article))).join(', ')],
      ['Breadcrumb', breadcrumb],
      ['Template', 'blog-post'],
    ]));

    return [{ element: main, path }];
  },
};
