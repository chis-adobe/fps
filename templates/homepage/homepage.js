import { useSiteFragments } from '../shared.js';

/**
 * Homepage template: pulls in the shared header/footer fragments.
 * Used by the homepage and all of its experiment challengers.
 */
export default function decorate() {
  useSiteFragments();
}
