/*
 * Site locales. A locale's pages live under its prefix (e.g. /fr/blog/...); everything else is
 * the default (English) site. Add a locale here when a new language section is created.
 */
const DEFAULT_LOCALE = { prefix: '', lang: 'en' };
const LOCALES = [
  { prefix: '/fr', lang: 'fr' },
];

/**
 * Returns the locale of a path (defaults to the current page).
 * @param {string} [pathname]
 * @returns {{prefix: string, lang: string}}
 */
export function getLocale(pathname = window.location.pathname) {
  // the local workspace preview serves pages under /content/
  const path = window.location.hostname === 'localhost' ? pathname.replace(/^\/content(?=\/)/, '') : pathname;
  return LOCALES.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`))
    || DEFAULT_LOCALE;
}

/**
 * Prefixes a site path with the current page's locale, e.g. /blog/search -> /fr/blog/search.
 * @param {string} path Site path starting with /
 * @returns {string}
 */
export function localizePath(path) {
  return `${getLocale().prefix}${path}`;
}
