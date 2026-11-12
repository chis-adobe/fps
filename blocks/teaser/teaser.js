import { createOptimizedPicture, toClassName } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/*
 * Teaser block — authored as key/value rows:
 *
 * | Teaser      |                       |
 * |-------------|-----------------------|
 * | title       | Gibco MediaSelect Tool|
 * | description | (optional)            |
 * | image       | (optional picture)    |
 * | cta label   | Get started           |
 * | cta url     | https://…             |
 */

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/**
 * Reads the key/value rows into a map of key -> value cell.
 * @param {Element} block The block
 * @returns {Map<string, Element>}
 */
function readFields(block) {
  const fields = new Map();
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    if (!keyCell || !valueCell) return;
    const key = toClassName(keyCell.textContent);
    if (key && !fields.has(key)) fields.set(key, valueCell);
  });
  return fields;
}

const hasContent = (cell) => Boolean(cell && (cell.textContent.trim() || cell.querySelector('picture, img')));

/**
 * Builds the title heading, keeping an authored heading level (defaults to h3).
 * @param {Element} cell The title cell
 * @returns {HTMLElement}
 */
function buildTitle(cell) {
  const authored = cell.querySelector(HEADINGS);
  const title = authored || document.createElement('h3');
  if (!authored) title.textContent = cell.textContent.trim();
  title.classList.add('teaser-title');
  return title;
}

/**
 * Resolves the CTA href from the cta url cell (a link or plain text URL).
 * @param {Element} cell The cta url cell
 * @returns {string|null}
 */
function getHref(cell) {
  if (!cell) return null;
  const value = cell.querySelector('a')?.getAttribute('href') || cell.textContent.trim();
  if (!value) return null;
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * loads and decorates the teaser block
 * @param {Element} block The teaser block element
 */
export default function decorate(block) {
  const fields = readFields(block);
  const titleCell = fields.get('title');
  const descriptionCell = fields.get('description');
  const imageCell = fields.get('image');
  const ctaLabelCell = fields.get('cta-label');
  const ctaUrlCell = fields.get('cta-url');

  const content = document.createElement('div');
  content.className = 'teaser-content';

  if (hasContent(titleCell)) content.append(buildTitle(titleCell));

  if (hasContent(descriptionCell)) {
    const description = document.createElement('div');
    description.className = 'teaser-description';
    description.append(...descriptionCell.childNodes);
    content.append(description);
  }

  const href = getHref(ctaUrlCell);
  const label = ctaLabelCell?.textContent.trim() || ctaUrlCell?.textContent.trim();
  if (href && label) {
    const cta = document.createElement('p');
    cta.className = 'teaser-cta';
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    link.className = 'teaser-link';
    const authoredLink = ctaUrlCell.querySelector('a');
    if (authoredLink) moveInstrumentation(authoredLink, link);
    cta.append(link);
    content.append(cta);
  }

  let media = null;
  const img = imageCell?.querySelector('img');
  if (img) {
    media = document.createElement('div');
    media.className = 'teaser-image';
    // only same-origin (media bus) images can be resized; external images are kept as authored
    if (new URL(img.src, window.location.href).origin === window.location.origin) {
      const picture = createOptimizedPicture(img.src, img.alt, false, [
        { media: '(min-width: 900px)', width: '1200' },
        { width: '750' },
      ]);
      moveInstrumentation(img, picture.querySelector('img'));
      media.append(picture);
    } else {
      img.loading = 'lazy';
      media.append(img.closest('picture') || img);
    }
  }

  block.textContent = '';
  if (media) block.append(media);
  block.append(content);
  block.classList.add(media ? 'teaser-has-image' : 'teaser-no-image');
}
