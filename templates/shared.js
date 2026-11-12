import { setDefaultMetadata } from '../scripts/scripts.js';

/** Global header and footer fragments shared by all page templates. */
export const SITE_FRAGMENTS = {
  nav: '/fragments/nav',
  footer: '/fragments/footer',
};

/**
 * Points the header and footer blocks at the shared fragments
 * (a page can still override them with its own `nav` / `footer` metadata).
 */
export function useSiteFragments() {
  Object.entries(SITE_FRAGMENTS).forEach(([name, path]) => setDefaultMetadata(name, path));
}
