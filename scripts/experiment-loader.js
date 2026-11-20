/*
 * Loads the AEM Experimentation plugin (plugins/experimentation, adobe/aem-experimentation v2)
 * only on pages that define an experiment, campaign or audience in their metadata.
 * See plugins/experimentation/README.md.
 */

const PLUGIN = '../plugins/experimentation/src/index.js';

/**
 * @returns {boolean} true when the page defines experiments, campaigns or audiences
 */
const isExperimentationEnabled = () => Boolean(
  document.head.querySelector('[name^="experiment"],[name^="campaign-"],[name^="audience-"],[property^="campaign:"],[property^="audience:"]')
  || [...document.querySelectorAll('.section-metadata div')].some((d) => d.textContent.match(/Experiment|Campaign|Audience/i)),
);

/**
 * Editors and layout previews show the page being edited inside a frame: don't swap in a
 * variant there unless one is requested with ?experiment=…
 * @returns {boolean}
 */
function isFramedEditingView() {
  if (new URLSearchParams(window.location.search).has('experiment')) return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Answers the Sidekick panel's config request on pages without experiments.
 */
function answerEmptyConfig() {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'hlx:experimentation-get-config') {
      event.source.postMessage({
        type: 'hlx:experimentation-config',
        config: { experiments: [], audiences: [], campaigns: [] },
        source: 'no-experiments',
      }, '*');
    }
  });
}

/**
 * Runs experiments, campaigns and audiences (eager phase, before the page is decorated).
 * @param {Document} document
 * @param {object} config Experimentation configuration
 * @returns {Promise<*>}
 */
export async function runExperimentation(document, config) {
  if (!isExperimentationEnabled() || isFramedEditingView()) {
    answerEmptyConfig();
    return null;
  }
  try {
    const { loadEager } = await import(PLUGIN);
    return loadEager(document, config);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load experimentation module (eager):', error);
    return null;
  }
}

/**
 * Loads the Sidekick simulation panel support (lazy phase, preview and local only).
 * @param {Document} document
 * @param {object} config Experimentation configuration
 * @returns {Promise<*>}
 */
export async function runExperimentationLazy(document, config) {
  const { host, hostname, origin } = window.location;
  const isPreview = hostname === 'localhost'
    || hostname.endsWith('.page')
    || (typeof config.isProd === 'function' && !config.isProd())
    || (config.prodHost && ![host, hostname, origin].includes(config.prodHost));
  if (!isPreview) return null;
  try {
    const { loadLazy } = await import(PLUGIN);
    return loadLazy(document, config);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load experimentation module (lazy):', error);
    return null;
  }
}
