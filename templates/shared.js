import { setDefaultMetadata } from '../scripts/scripts.js';

/** Global header and footer fragments for the main site. */
export const SITE_FRAGMENTS = {
  nav: '/fragments/nav',
  footer: '/fragments/footer',
};

/** Simplified header (blog navigation) used by blog articles and author pages. */
export const BLOG_FRAGMENTS = {
  nav: '/fragments/nav-blog',
  footer: '/fragments/footer',
};

/**
 * Points the header and footer blocks at the given fragments
 * (a page can still override them with its own `nav` / `footer` metadata).
 * @param {{nav: string, footer: string}} [fragments]
 */
export function useSiteFragments(fragments = SITE_FRAGMENTS) {
  Object.entries(fragments).forEach(([name, path]) => setDefaultMetadata(name, path));
}

/**
 * Default labels used by templates. Each can be overridden per page with metadata of the
 * same name (e.g. `Expertise Label`), which keeps the text authorable and translatable.
 */
const LABELS = {
  'expertise-label': 'Expertise',
  'education-label': 'Education',
};

/**
 * @param {string} key Label key, e.g. `expertise-label`
 * @param {(name: string) => string} getMetadata Metadata reader
 * @returns {string}
 */
export function getLabel(key, getMetadata) {
  return getMetadata(key) || LABELS[key] || '';
}
