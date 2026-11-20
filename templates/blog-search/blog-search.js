import { BLOG_FRAGMENTS, useSiteFragments } from '../shared.js';

/**
 * Blog search template: the simplified (blog) header and the site footer.
 */
export default function decorate() {
  useSiteFragments(BLOG_FRAGMENTS);
}
