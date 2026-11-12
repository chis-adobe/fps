/* eslint-disable */
/* global WebImporter */

/**
 * Article List parser: the "Accelerating Science" blog feed -> Article List block.
 * Each row references an imported /blog page; the block renders title, author and
 * date from that page's metadata.
 */
export default function parse(element, { document }) {
  const toLocal = (href) => {
    try {
      const url = new URL(href, 'https://www.thermofisher.com');
      if (url.hostname === 'www.thermofisher.com' && url.pathname.startsWith('/blog/')) {
        return url.pathname.replace(/\/$/, '');
      }
      return url.href;
    } catch (e) {
      return href;
    }
  };

  const hrefs = [...element.querySelectorAll('.post')]
    .map((post) => post.querySelector('a[href]')?.getAttribute('href'))
    .filter(Boolean)
    .map(toLocal);

  const rows = [...new Set(hrefs)].map((href) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = href;
    return [a];
  });

  const table = WebImporter.DOMUtils.createTable([['Article List'], ...rows], document);
  element.replaceWith(table);
}
