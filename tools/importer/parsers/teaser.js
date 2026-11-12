/* eslint-disable */
/* global WebImporter */

/**
 * Teaser parser: a Thermo Fisher dynamic offer (.offer-content) -> Teaser block with
 * key/value rows: title, description, image, cta label, cta url.
 * Title is an h2 in the teaser bar (no section heading above it), h3 elsewhere.
 * Description and image rows stay empty when the source has none.
 */
export default function parse(element, { document }) {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const absolute = (href) => {
    try {
      const url = new URL(href, 'https://www.thermofisher.com');
      if (url.hostname === 'www.thermofisher.com' && /^\/blog\/[^/]+\/[^/]+\/?$/.test(url.pathname)) {
        return url.pathname.replace(/\/$/, '');
      }
      return url.href;
    } catch (e) {
      return href;
    }
  };
  // Dynamic Media smart-crop renditions are already sized for the slot; only drop cache-busting params
  const imageUrl = (src) => {
    try {
      const url = new URL(src, 'https://www.thermofisher.com');
      return url.hostname === 'dm-images.thermofisher.com'
        ? `${url.origin}${url.pathname}` : url.href;
    } catch (e) {
      return src;
    }
  };

  const title = document.createElement(element.matches('.tf-hero-pod') ? 'h2' : 'h3');
  title.textContent = text(element.querySelector('.offer-headline'));

  const description = document.createElement('div');
  const sub = element.querySelector('.offer-subheadline');
  if (sub && text(sub)) {
    sub.querySelectorAll('p, ul').forEach((el) => {
      const copy = document.createElement(el.tagName.toLowerCase());
      if (el.tagName === 'UL') {
        el.querySelectorAll('li').forEach((li) => {
          const item = document.createElement('li');
          item.textContent = text(li);
          copy.append(item);
        });
      } else {
        copy.textContent = text(el);
      }
      if (text(copy)) description.append(copy);
    });
    if (!description.children.length) description.textContent = text(sub);
  }

  let image = '';
  const sourceImg = element.querySelector('.offer-bkg-img img');
  const src = sourceImg?.getAttribute('src') || sourceImg?.getAttribute('data-src');
  if (src) {
    image = document.createElement('img');
    image.src = imageUrl(src);
    image.alt = (sourceImg.getAttribute('alt') || '').trim();
  }

  const ctaSource = element.querySelector('.offer-cta a');
  const href = ctaSource?.getAttribute('href')
    || element.querySelector('.entireClickable a')?.getAttribute('href');
  let ctaUrl = '';
  if (href) {
    ctaUrl = document.createElement('a');
    ctaUrl.href = absolute(href);
    ctaUrl.textContent = ctaUrl.getAttribute('href');
  }

  const table = WebImporter.DOMUtils.createTable([
    ['Teaser'],
    ['title', title],
    ['description', description.childNodes.length ? description : ''],
    ['image', image],
    ['cta label', text(ctaSource)],
    ['cta url', ctaUrl],
  ], document);
  element.replaceWith(table);
}
