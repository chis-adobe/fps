/* eslint-disable */
/* global WebImporter */

/**
 * Cleanup for Thermo Fisher (WordPress) blog articles.
 * beforeTransform: inside .entry-content, drop the table of contents, share bars and related
 * posts, and flatten the FAQ accordion into plain headings + text.
 */
export default function transform(hookName, element, payload) {
  if (hookName !== 'beforeTransform') return;
  const { document } = payload;
  const content = element.querySelector('.entry-content') || element;

  WebImporter.DOMUtils.remove(content, [
    '#toc_container',
    '.mashsb-container',
    '.mashsb-box',
    '.jp-relatedposts',
    '.related-post',
    '.sharedaddy',
    '.authors-container',
    '.author-box',
    'script',
    'style',
    'noscript',
    'form',
    'button:empty',
  ]);

  // FAQ accordion: header -> h3 with the question, pane -> its content
  content.querySelectorAll('.kt-accordion-header-wrap').forEach((header) => {
    const h3 = document.createElement('h3');
    h3.textContent = (header.querySelector('.kt-blocks-accordion-title') || header).textContent.replace(/\s+/g, ' ').trim();
    header.replaceWith(h3);
  });
  content.querySelectorAll('.kt-accordion-panel-inner').forEach((panel) => {
    panel.replaceWith(...panel.childNodes);
  });

  // drop empty paragraphs
  content.querySelectorAll('p').forEach((p) => {
    if (!p.textContent.trim() && !p.querySelector('img, picture')) p.remove();
  });

  // images: keep the best rendition, drop responsive noise
  content.querySelectorAll('img').forEach((img) => {
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.removeAttribute('style');
    img.removeAttribute('width');
    img.removeAttribute('height');
  });
}
