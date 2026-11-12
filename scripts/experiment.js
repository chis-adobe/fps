/*
 * Lightweight content experimentation (A/B/n), driven by page metadata:
 *
 * | Metadata            |                                                     |
 * |---------------------|-----------------------------------------------------|
 * | Experiment          | homepage-hero                                       |
 * | Experiment Variants | /experiments/homepage-hero/challenger-1, ...        |
 * | Experiment Split    | 25, 25, 25   (optional, % per challenger)           |
 * | Experiment Status   | active       (optional, anything else disables it)  |
 *
 * The control is the page itself and gets the remaining share of traffic; without a split
 * all variants share traffic evenly. A variant is picked on every page load. Add
 * `?experiment={id}/{variant}` (e.g. `homepage-hero/challenger-2` or `homepage-hero/control`)
 * to force a variant. A challenger's content replaces the page's main content before the page
 * is decorated, so header, footer and metadata stay those of the control page.
 */
import { getMetadata, toClassName, DOMPURIFY } from './aem.js';

const CONTROL = 'control';

/**
 * Parses the challenger page paths from the metadata (same-origin paths only).
 * @returns {string[]} Challenger paths
 */
function getChallengerPaths() {
  return getMetadata('experiment-variants')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        const url = new URL(value, window.location.href);
        return url.origin === window.location.origin ? url.pathname.replace(/\.html$/, '') : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Computes the traffic share of each variant (control first).
 * @param {number} challengerCount Number of challengers
 * @returns {number[]} Weights, control first
 */
function getWeights(challengerCount) {
  const even = Array(challengerCount + 1).fill(1 / (challengerCount + 1));
  const split = getMetadata('experiment-split');
  if (!split) return even;
  const shares = split.split(',').map((value) => Number.parseFloat(value) / 100);
  if (shares.length !== challengerCount || shares.some((v) => !Number.isFinite(v) || v < 0)) {
    return even;
  }
  const control = 1 - shares.reduce((sum, v) => sum + v, 0);
  return control < 0 ? even : [control, ...shares];
}

/**
 * Picks a variant index from the weights.
 * @param {number[]} weights Variant weights
 * @returns {number} The chosen index
 */
function pickVariant(weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  // not security-sensitive: only decides which content variant a visitor sees
  // eslint-disable-next-line sonarjs/pseudo-random
  let point = Math.random() * total;
  const index = weights.findIndex((weight) => {
    point -= weight;
    return point < 0;
  });
  return index === -1 ? 0 : index;
}

/**
 * Resolves a variant forced via the `experiment` query parameter.
 * @param {string} id The experiment id
 * @param {string[]} names Variant names
 * @returns {number} The forced index or -1
 */
function getForcedVariant(id, names) {
  const forced = new URLSearchParams(window.location.search).get('experiment');
  if (!forced) return -1;
  const [forcedId, forcedVariant] = forced.includes('/') ? forced.split('/') : [id, forced];
  if (toClassName(forcedId) !== id) return -1;
  return names.indexOf(toClassName(forcedVariant));
}

/**
 * Replaces the main content with the challenger page's content.
 * @param {Document} doc The document
 * @param {string} path The challenger path
 * @param {() => Promise<void>} ensureDOMPurify Loads DOMPurify
 * @returns {Promise<boolean>} true if the content was replaced
 */
async function applyChallenger(doc, path, ensureDOMPurify) {
  const resp = await fetch(`${path}.plain.html`);
  if (!resp.ok) return false;
  await ensureDOMPurify();
  const main = doc.querySelector('main');
  if (!main) return false;
  main.innerHTML = window.DOMPurify.sanitize(await resp.text(), DOMPURIFY);
  // media paths are relative to the challenger page
  const base = new URL(path, window.location.href);
  main.querySelectorAll('img[src^="./media_"], source[srcset^="./media_"]').forEach((el) => {
    const attr = el.tagName === 'IMG' ? 'src' : 'srcset';
    el.setAttribute(attr, new URL(el.getAttribute(attr), base).href);
  });
  return true;
}

/**
 * Runs the page's experiment, if any.
 * @param {Document} doc The document
 * @param {{ ensureDOMPurify: () => Promise<void> }} options Helpers from scripts.js
 * @returns {Promise<{id: string, variant: string}|null>} The served variant
 */
export default async function runExperiment(doc, { ensureDOMPurify }) {
  const id = toClassName(getMetadata('experiment'));
  const status = getMetadata('experiment-status');
  if (!id || (status && toClassName(status) !== 'active')) return null;

  const challengers = getChallengerPaths();
  if (!challengers.length) return null;

  const names = [CONTROL, ...challengers.map((_, i) => `challenger-${i + 1}`)];
  const forced = getForcedVariant(id, names);
  let index = forced >= 0 ? forced : pickVariant(getWeights(challengers.length));

  if (index > 0) {
    const applied = await applyChallenger(doc, challengers[index - 1], ensureDOMPurify)
      .catch(() => false);
    if (!applied) index = 0;
  }

  const variant = names[index];
  doc.body.dataset.experiment = id;
  doc.body.dataset.experimentVariant = variant;
  window.hlx = window.hlx || {};
  window.hlx.experiment = { id, variant, variants: names };
  return { id, variant };
}
