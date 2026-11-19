import { createOptimizedPicture, getMetadata } from '../../scripts/aem.js';
import { isSameSite, toSafeUrl } from '../../scripts/page-metadata.js';
import { BLOG_FRAGMENTS, getLabel, useSiteFragments } from '../shared.js';

/*
 * Author template: simplified (blog) header, and the author profile rendered from the
 * page metadata — Title (name), Role, Profile, Expertise (comma-separated), Education,
 * Image (profile picture). Pages that author their profile in the body instead keep it.
 */

/**
 * @param {string} src Image URL
 * @param {string} alt Alt text
 * @returns {Element|null}
 */
function buildPicture(src, alt) {
  const url = toSafeUrl(src);
  if (!url || url.pathname.endsWith('/default-meta-image.png')) return null;
  if (isSameSite(url)) {
    return createOptimizedPicture(url.pathname, alt, true, [{ width: '400' }]);
  }
  const img = document.createElement('img');
  img.src = url.href;
  img.alt = alt;
  return img;
}

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
 * Builds the profile section from the page metadata.
 * @returns {HTMLDivElement|null}
 */
function buildProfile() {
  const name = getMetadata('og:title');
  const role = getMetadata('role');
  const profile = getMetadata('profile');
  const expertise = getMetadata('expertise').split(',').map((v) => v.trim()).filter(Boolean);
  const education = getMetadata('education');
  if (!role && !profile && !expertise.length && !education) return null;

  const section = document.createElement('div');
  const aside = el('aside', 'author-sidebar');
  const picture = buildPicture(getMetadata('og:image'), name);
  if (picture) {
    const media = el('p', 'author-picture');
    media.append(picture);
    aside.append(media);
  }
  if (expertise.length) {
    aside.append(el('h2', 'author-sidebar-title', getLabel('expertise-label', getMetadata)));
    const list = el('ul', 'author-expertise');
    expertise.forEach((value) => list.append(el('li', 'author-expertise-tag', value)));
    aside.append(list);
  }
  if (education) {
    aside.append(el('h2', 'author-sidebar-title', getLabel('education-label', getMetadata)));
    aside.append(el('p', 'author-education', education));
  }

  const article = el('article', 'author-profile');
  if (name) article.append(el('h1', 'author-name', name));
  if (role) article.append(el('p', 'author-role', role));
  if (profile) article.append(el('p', 'author-bio', profile));

  section.append(article, aside);
  return section;
}

/**
 * @param {Document} doc The document
 */
export default function decorate(doc) {
  useSiteFragments(BLOG_FRAGMENTS);
  const main = doc.querySelector('main');
  const profile = main && !main.querySelector('h1') ? buildProfile() : null;
  if (profile) {
    profile.classList.add('author-profile-section');
    main.prepend(profile);
  }
}
