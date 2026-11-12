import { getMetadata } from '../../scripts/aem.js';
import { useSiteFragments } from '../shared.js';

/**
 * Formats an ISO date (YYYY-MM-DD) for display in the page language.
 * @param {string} value The date
 * @returns {string} The formatted date, or the value itself if it is not a valid date
 */
export function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
}

/**
 * Returns a safe same-site/http(s) href, or null.
 * @param {string} value The URL
 * @returns {string|null}
 */
export function safeHref(value) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Builds the author + date byline from the page metadata.
 * @returns {HTMLElement|null}
 */
function buildByline() {
  const author = getMetadata('author');
  const date = getMetadata('date');
  if (!author && !date) return null;

  const byline = document.createElement('p');
  byline.className = 'blog-post-byline';
  if (author) {
    const href = safeHref(getMetadata('author-url'));
    const name = document.createElement(href ? 'a' : 'span');
    name.className = 'blog-post-author';
    name.textContent = author;
    if (href) name.href = href;
    byline.append(name);
  }
  if (date) {
    const time = document.createElement('time');
    time.className = 'blog-post-date';
    time.dateTime = date;
    time.textContent = formatDate(date);
    byline.append(time);
  }
  return byline;
}

/**
 * Blog post template: shared header/footer fragments and an author/date byline under the title.
 * @param {Document} doc The document
 */
export default function decorate(doc) {
  useSiteFragments();
  const h1 = doc.querySelector('main h1');
  const byline = buildByline();
  if (h1 && byline) h1.after(byline);
}
