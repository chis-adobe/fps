import { createOptimizedPicture, getMetadata } from '../../scripts/aem.js';
import {
  fetchAuthor, formatDate, getTags, isSameSite, toSafeUrl,
} from '../../scripts/page-metadata.js';
import { buildTagList } from '../../scripts/article-items.js';
import { BLOG_FRAGMENTS, useSiteFragments } from '../shared.js';

/*
 * Blog post template: simplified (blog) header, a breadcrumb under it, then title, tags (linking
 * to the article search), byline (author + date), brief and image, the article content, and an author card at the end.
 * Title, Brief and Image (+ Image Alt) come from the page metadata when the body has no heading 1
 * (older articles keep their authored title and image). Author details come from the page
 * referenced by `Author URL`.
 *
 * Breadcrumb metadata lists the trail labels, e.g. `Accelerating Science > AnalyteGuru > UHPLC`.
 * Each label links to the blog navigation entry with the same text (if any); the page title
 * is appended as the current page.
 */

/**
 * @param {string} tag Element name
 * @param {string} className Class
 * @param {string} [text] Text content
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * Collects label -> href for every link in the blog navigation fragment.
 * @returns {Promise<Map<string, string>>}
 */
async function getNavLinks() {
  const navPath = getMetadata('nav') || BLOG_FRAGMENTS.nav;
  const links = new Map();
  try {
    const resp = await fetch(`${new URL(navPath, window.location).pathname}.plain.html`);
    if (!resp.ok) return links;
    const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');
    doc.querySelectorAll('a[href]').forEach((a) => {
      const label = a.textContent.trim().toLowerCase();
      const url = toSafeUrl(a.getAttribute('href'));
      if (label && url && !links.has(label)) links.set(label, url.href);
    });
  } catch {
    // breadcrumb labels stay unlinked
  }
  return links;
}

/**
 * Builds the breadcrumb from the `breadcrumb` metadata (links are filled in asynchronously).
 * @param {string} title Current page title
 * @returns {HTMLElement|null}
 */
function buildBreadcrumb(title) {
  const labels = getMetadata('breadcrumb').split('>').map((v) => v.trim()).filter(Boolean);
  if (!labels.length) return null;
  const nav = el('nav', 'blog-post-breadcrumb');
  const ol = document.createElement('ol');
  labels.forEach((label) => ol.append(el('li', 'blog-post-breadcrumb-item', label)));
  if (title) {
    const current = el('li', 'blog-post-breadcrumb-item', title);
    current.setAttribute('aria-current', 'page');
    ol.append(current);
  }
  nav.append(ol);

  getNavLinks().then((links) => {
    [...ol.children].forEach((li) => {
      const href = !li.hasAttribute('aria-current') && links.get(li.textContent.toLowerCase());
      if (!href) return;
      const a = document.createElement('a');
      a.href = href;
      a.textContent = li.textContent;
      li.textContent = '';
      li.append(a);
    });
  });
  return nav;
}

/**
 * @param {string} src Image URL
 * @param {string} alt Alt text
 * @returns {Element|null}
 */
function buildPicture(src, alt) {
  const url = toSafeUrl(src);
  if (!url) return null;
  if (isSameSite(url)) return createOptimizedPicture(url.pathname, alt, false, [{ width: '200' }]);
  const img = document.createElement('img');
  img.src = url.href;
  img.alt = alt;
  img.loading = 'lazy';
  return img;
}

/**
 * Builds the article's top image (above the fold, so it loads eagerly).
 * @param {string} src Image URL from the page metadata
 * @param {string} alt Alt text from the page metadata
 * @returns {Element|null}
 */
function buildHeroImage(src, alt) {
  const url = toSafeUrl(src);
  if (!url || url.pathname.endsWith('/default-meta-image.png')) return null;
  if (isSameSite(url)) {
    return createOptimizedPicture(url.pathname, alt, true, [
      { media: '(min-width: 600px)', width: '1200' },
      { width: '750' },
    ]);
  }
  const img = document.createElement('img');
  img.src = url.href;
  img.alt = alt;
  img.fetchPriority = 'high';
  return img;
}

/**
 * Fills the byline author and the author card from the author page.
 * @param {HTMLElement} authorSlot Byline element for the author name
 * @param {HTMLElement} card Author card element
 * @param {HTMLElement} section Section holding the card (removed when there is no author page)
 */
async function fillAuthor(authorSlot, card, section) {
  const authorUrl = toSafeUrl(getMetadata('author-url'));
  const author = authorUrl ? await fetchAuthor(authorUrl.href) : null;
  const name = author?.name || getMetadata('author');

  if (name) {
    const link = el(author ? 'a' : 'span', 'blog-post-author', name);
    if (author) link.href = author.url;
    authorSlot.replaceWith(link);
  } else {
    authorSlot.remove();
  }

  if (!author) {
    section.remove();
    return;
  }
  const picture = author.image ? buildPicture(author.image, name) : null;
  if (picture) {
    const media = el('p', 'blog-post-author-card-picture');
    media.append(picture);
    card.append(media);
  }
  const info = el('div', 'blog-post-author-card-info');
  const heading = el('h2', 'blog-post-author-card-name');
  const link = el('a', '', name);
  link.href = author.url;
  heading.append(link);
  info.append(heading);
  if (author.role) info.append(el('p', 'blog-post-author-card-role', author.role));
  if (author.description) info.append(el('p', 'blog-post-author-card-description', author.description));
  card.append(info);
}

/**
 * Blog post template.
 * @param {Document} doc The document
 */
export default function decorate(doc) {
  useSiteFragments(BLOG_FRAGMENTS);
  const main = doc.querySelector('main');
  if (!main) return;
  let first = main.querySelector(':scope > div');
  if (!first) {
    first = document.createElement('div');
    main.prepend(first);
  }

  // metadata-first articles have no heading 1 in the body: title, brief and image come from
  // the page metadata (so other pages can reference them too)
  let h1 = main.querySelector('h1');
  const metadataFirst = !h1;
  const title = h1?.textContent.trim() || getMetadata('og:title');
  if (metadataFirst && title) {
    h1 = el('h1', 'blog-post-title', title);
    first.prepend(h1);
  }

  const breadcrumb = buildBreadcrumb(title);
  if (breadcrumb) first.prepend(breadcrumb);
  if (!h1) return;

  // order under the title: tags, byline (author, date), brief, image, then the article content
  let anchor = h1;
  const place = (node) => {
    anchor.after(node);
    anchor = node;
  };

  // tags link to the article search, filtered by the tag
  const tags = buildTagList('blog-post-tags', getTags());
  if (tags) place(tags);

  const date = getMetadata('date');
  const hasAuthor = getMetadata('author-url') || getMetadata('author');
  const authorSlot = el('span', 'blog-post-author');
  if (date || hasAuthor) {
    const byline = el('p', 'blog-post-byline');
    if (hasAuthor) byline.append(authorSlot);
    if (date) {
      const time = el('time', 'blog-post-date', formatDate(date));
      time.dateTime = date;
      byline.append(time);
    }
    place(byline);
  }

  if (metadataFirst) {
    const brief = getMetadata('brief');
    if (brief) place(el('p', 'blog-post-brief', brief));
    const picture = buildHeroImage(getMetadata('og:image') || getMetadata('image'), getMetadata('image-alt'));
    if (picture) {
      const media = el('p', 'blog-post-image');
      media.append(picture);
      place(media);
    }
  }

  // author card at the end of the article
  if (hasAuthor) {
    const section = document.createElement('div');
    const card = el('aside', 'blog-post-author-card');
    section.append(card);
    main.append(section);
    fillAuthor(authorSlot, card, section);
  }
}
