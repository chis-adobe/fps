/* eslint-disable */
/* global WebImporter */

/**
 * Hero parser: the Thermo Fisher hero offer (.offer-content.hr) -> Hero block.
 * Row 1: block name. Row 2: background image. Row 3: heading, subheading, CTA.
 */
export default function parse(element, { document }) {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const imageUrl = (src) => {
    try {
      const url = new URL(src, 'https://www.thermofisher.com');
      return url.hostname === 'dm-images.thermofisher.com'
        ? `${url.origin}${url.pathname}` : url.href;
    } catch (e) {
      return src;
    }
  };

  const sourceImg = element.querySelector('.offer-bkg-img img');
  let image = '';
  const src = sourceImg?.getAttribute('src') || sourceImg?.getAttribute('data-src');
  if (src) {
    image = document.createElement('img');
    image.src = imageUrl(src);
    image.alt = (sourceImg.getAttribute('alt') || '').trim();
  }

  const content = document.createElement('div');
  const h1 = document.createElement('h1');
  h1.textContent = text(element.querySelector('.offer-headline'));
  content.append(h1);

  const subheadline = text(element.querySelector('.offer-subheadline'));
  if (subheadline) {
    const p = document.createElement('p');
    p.textContent = subheadline;
    content.append(p);
  }

  const cta = element.querySelector('.offer-cta a');
  if (cta && text(cta)) {
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    const a = document.createElement('a');
    a.href = new URL(cta.getAttribute('href'), 'https://www.thermofisher.com').href;
    a.textContent = text(cta);
    strong.append(a);
    p.append(strong);
    content.append(p);
  }

  // dark headline text on a light image -> "Hero (dark)" variant
  const blockName = element.querySelector('.offer-text.txt-dark') ? 'Hero (dark)' : 'Hero';
  const table = WebImporter.DOMUtils.createTable([
    [blockName],
    [image],
    [content],
  ], document);
  element.replaceWith(table);
}
