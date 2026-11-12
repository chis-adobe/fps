/* eslint-disable */
/* global WebImporter */

/*
 * Thermo Fisher homepage import.
 * One input (the homepage) -> several documents:
 *   /index                                    homepage (control)
 *   /experiments/homepage-hero/challenger-N    hero experiment challengers (same page, other hero)
 *   /fragments/nav, /fragments/footer          global header/footer fragments
 *
 * Page sections (each with Section Metadata):
 *   1. hero (full-width)  2. teaser bar (teaser-bar-overlap)
 *   3. Featured Education + Accelerating Science (horizontal)  4. Promotions + New products (teaser-lists)
 */

import heroParser from './parsers/hero.js';
import teaserParser from './parsers/teaser.js';
import articleListParser from './parsers/article-list.js';

const PAGE_TEMPLATE = {
  name: 'homepage',
  blocks: [
    { name: 'hero', instances: ['.offer-content.hr'] },
    { name: 'teaser', instances: ['.offer-content.tf-hero-pod', '.offer-content.tf-hp-edu-lc', '.offer-content.tf-hp-edu-sc', '.offer-content.pc', '.offer-content.np'] },
    { name: 'article-list', instances: ['.dynamic-offer:has(.post)'] },
  ],
};

const EXPERIMENT_ID = 'homepage-hero';
const CHALLENGER_COUNT = 3;

/*
 * Hero campaigns the challengers are built from — all of them run on the Thermo Fisher
 * homepage hero (default + personalized offers) or as homepage campaign banners.
 * The one matching the imported (control) hero is skipped.
 */
const HERO_POOL = [
  {
    headline: 'Invitrogen antibodies',
    subheadline: 'Maximize lab budgets with advanced validation & coverage',
    ctaLabel: 'Shop antibodies',
    ctaHref: 'https://www.thermofisher.com/antibody/primary?icid=Default_OF-14685330-WB',
    image: 'https://dm-images.thermofisher.com/is/image/thermofisherscientific/WB48641_HRV2_8192x1888%3Athermofisher-smart-dm-web-HR',
    imageAlt: 'Invitrogen antibodies',
  },
  {
    headline: 'Dash through discoveries',
    subheadline: 'Save up to $900 and claim festive gear',
    ctaLabel: 'Shop now',
    ctaHref: 'https://www.thermofisher.com/us/en/home/o/b/holiday-sweatshirt.html?icid=OF-16957068-WB_NA_HP_HR_HR',
    image: 'https://dm-images.thermofisher.com/is/image/thermofisherscientific/WB-16961959-HR-V3-8192x2032%3Athermofisher-smart-dm-web-HR',
    imageAlt: 'Life Science seasonal savings',
  },
  {
    headline: 'May your deals be many and bright',
    subheadline: 'Buy 3 qualifying products for the price of 2',
    ctaLabel: 'Shop now',
    ctaHref: 'https://www.thermofisher.com/us/en/home/products-and-services/promotions/sciencesavings.html?icid=OF-17179930-WB_NA_HP_HR_HR',
    image: 'https://dm-images.thermofisher.com/is/image/thermofisherscientific/OF-17179930-WB-HR-8192x2032%3Athermofisher-smart-dm-web-HR',
    imageAlt: '3 For 2 Promotion',
  },
  {
    headline: 'Atomic-resolution Cryo-EM',
    ctaLabel: 'Learn more',
    ctaHref: 'https://www.thermofisher.com/us/en/home/electron-microscopy/products/accessories-em/selectris.html?icid=Default_WB44946',
    image: 'https://dm-images.thermofisher.com/is/image/Invitrogen/WB44946-1200x669',
    imageAlt: 'Selectris imaging filter for cryo-EM',
  },
];

const TF_ORIGIN = 'https://www.thermofisher.com';
const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const absolute = (href) => {
  try { return new URL(href, TF_ORIGIN).href; } catch (e) { return href; }
};

/** Runs a parser on a detached copy of the element and returns the block table it produced. */
function parseBlock(parser, element, document) {
  const holder = document.createElement('div');
  holder.append(element.cloneNode(true));
  parser(holder.firstElementChild, { document, params: {} });
  return holder.firstElementChild;
}

function sectionMetadata(document, style) {
  return WebImporter.DOMUtils.createTable([['Section Metadata'], ['style', style]], document);
}

function metadataTable(document, entries) {
  return WebImporter.DOMUtils.createTable([['Metadata'], ...entries], document);
}

/** h2 + "see all" link heading group (e.g. "Promotions" / "View all promotions"). */
function headingGroup(document, sourceDocument, headingText) {
  const h2Source = [...sourceDocument.querySelectorAll('h2')]
    .find((h) => text(h).toLowerCase() === headingText.toLowerCase());
  const nodes = [];
  const h2 = document.createElement('h2');
  h2.textContent = h2Source ? text(h2Source) : headingText;
  nodes.push(h2);
  const link = h2Source?.parentElement?.querySelector('a[href]');
  if (link && text(link)) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = absolute(link.getAttribute('href'));
    a.textContent = text(link);
    p.append(a);
    nodes.push(p);
  }
  return nodes;
}

/** Builds a source-like hero offer element from pool data, so the hero parser can be reused. */
function heroSource(document, hero) {
  const el = document.createElement('div');
  el.className = 'offer-content hr';
  el.innerHTML = `<div class="offer-bkg-img"><img></div>
    <div class="offer-headline"></div><div class="offer-subheadline"></div>
    <div class="offer-cta"><a></a></div>`;
  const img = el.querySelector('img');
  img.setAttribute('src', hero.image);
  img.setAttribute('alt', hero.imageAlt);
  el.querySelector('.offer-headline').textContent = hero.headline;
  el.querySelector('.offer-subheadline').textContent = hero.subheadline || '';
  const a = el.querySelector('.offer-cta a');
  a.setAttribute('href', hero.ctaHref);
  a.textContent = hero.ctaLabel;
  return el;
}

/** Builds the four homepage sections; heroTable is the hero block for section 1. */
function buildMain(document, source, heroTable) {
  const main = document.createElement('div');
  const hr = () => document.createElement('hr');

  // 1. hero
  main.append(heroTable, sectionMetadata(document, 'full-width'), hr());

  // 2. teaser bar
  source.querySelectorAll('.offer-content.tf-hero-pod').forEach((pod) => {
    main.append(parseBlock(teaserParser, pod, document));
  });
  main.append(sectionMetadata(document, 'teaser-bar-overlap'), hr());

  // 3. Featured Education + Accelerating Science
  main.append(...headingGroup(document, source, 'Featured Education'));
  ['.offer-content.tf-hp-edu-lc', '.offer-content.tf-hp-edu-sc'].forEach((selector) => {
    const el = source.querySelector(selector);
    if (el) main.append(parseBlock(teaserParser, el, document));
  });
  main.append(...headingGroup(document, source, 'Accelerating Science'));
  const posts = source.querySelector('.post')?.closest('.dynamic-offer') || source.querySelector('.post')?.parentElement;
  if (posts) main.append(parseBlock(articleListParser, posts, document));
  main.append(sectionMetadata(document, 'horizontal'), hr());

  // 4. Promotions + New products
  main.append(...headingGroup(document, source, 'Promotions'));
  source.querySelectorAll('.offer-content.pc').forEach((el) => main.append(parseBlock(teaserParser, el, document)));
  main.append(...headingGroup(document, source, 'New products'));
  source.querySelectorAll('.offer-content.np').forEach((el) => main.append(parseBlock(teaserParser, el, document)));
  main.append(sectionMetadata(document, 'teaser-lists'));

  return main;
}

/** Global nav fragment: brand / sections (mega groups) / tools. */
function buildNav(document, source) {
  const nav = document.createElement('div');
  const header = source.querySelector('header') || source;

  // brand
  const brand = document.createElement('p');
  const home = document.createElement('a');
  home.href = '/';
  home.textContent = ':thermofisher-logo:';
  brand.append(home);
  nav.append(brand, document.createElement('hr'));

  // sections: every menu item with exactly one sub-list
  const ul = document.createElement('ul');
  const seen = new Set();
  header.querySelectorAll('li').forEach((li) => {
    const subs = li.querySelectorAll('ul');
    if (subs.length !== 1) return;
    const labelClone = li.cloneNode(true);
    labelClone.querySelectorAll('ul').forEach((u) => u.remove());
    const label = text(labelClone);
    const links = [...subs[0].querySelectorAll('a[href]')]
      .filter((a) => text(a) && !a.getAttribute('href').startsWith('javascript'));
    if (!label || !links.length || seen.has(label) || /sign in|account/i.test(label)) return;
    seen.add(label);
    const item = document.createElement('li');
    item.append(document.createTextNode(label));
    const sub = document.createElement('ul');
    links.forEach((a) => {
      const subItem = document.createElement('li');
      const link = document.createElement('a');
      link.href = absolute(a.getAttribute('href'));
      link.textContent = text(a);
      subItem.append(link);
      sub.append(subItem);
    });
    item.append(sub);
    ul.append(item);
  });
  nav.append(ul, document.createElement('hr'));

  // tools
  const tools = document.createElement('ul');
  ['Order Status', 'Quick Order', 'Promos', 'Sign in'].forEach((label) => {
    const a = [...header.querySelectorAll('a[href]')].find((x) => text(x) === label && !x.getAttribute('href').startsWith('javascript'));
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = a ? absolute(a.getAttribute('href')) : (label === 'Sign in' ? `${TF_ORIGIN}/auth/initiate` : TF_ORIGIN);
    link.textContent = label;
    li.append(link);
    tools.append(li);
  });
  nav.append(tools);
  return nav;
}

/** Global footer fragment: link columns + legal row. */
function buildFooter(document, source) {
  const footerSource = source.querySelector('footer') || source;
  const footer = document.createElement('div');

  const columns = [];
  let legal = null;
  footerSource.querySelectorAll('ul').forEach((list) => {
    const links = [...list.querySelectorAll(':scope > li a[href]')]
      .filter((a) => !a.getAttribute('href').startsWith('javascript'));
    if (!links.length) return;
    if (links.some((a) => /terms/i.test(text(a)))) { legal = links; return; }
    // the source heading also carries the accordion toggle labels ("Plus Icon Minus Icon")
    const heading = text(list.previousElementSibling).replace(/\s*Plus Icon\s*Minus Icon\s*$/i, '');
    if (!heading) return;
    const cell = document.createElement('div');
    const h2 = document.createElement('h2');
    h2.textContent = heading;
    const ul = document.createElement('ul');
    links.forEach((a) => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = absolute(a.getAttribute('href'));
      // the source repeats the label in an icon's alt text
      link.textContent = text(a.cloneNode(true)).replace(/^(.+?)\s+\1$/, '$1');
      li.append(link);
      ul.append(li);
    });
    cell.append(h2, ul);
    columns.push(cell);
  });
  if (columns.length) footer.append(WebImporter.DOMUtils.createTable([['Columns'], columns], document));
  footer.append(document.createElement('hr'));

  if (legal) {
    const ul = document.createElement('ul');
    legal.forEach((a) => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = absolute(a.getAttribute('href'));
      link.textContent = text(a);
      li.append(link);
      ul.append(li);
    });
    footer.append(ul);
  }
  const copyright = [...footerSource.querySelectorAll('*')]
    .find((el) => !el.children.length && text(el).startsWith('©'));
  if (copyright) {
    const p = document.createElement('p');
    p.textContent = text(copyright);
    footer.append(p);
  }
  footer.append(sectionMetadata(document, 'footer-legal'));
  return footer;
}

export default {
  transform: ({ document, url, params }) => {
    const source = document;
    const heroEl = source.querySelector('.offer-content.hr');
    const controlHero = heroEl ? parseBlock(heroParser, heroEl, document) : null;
    const controlHeadline = text(heroEl?.querySelector('.offer-headline')).toLowerCase();

    const challengers = HERO_POOL
      .filter((hero) => hero.headline.toLowerCase() !== controlHeadline)
      .slice(0, CHALLENGER_COUNT);
    const challengerPaths = challengers.map((_, i) => `/experiments/${EXPERIMENT_ID}/challenger-${i + 1}`);

    const title = text(source.querySelector('title')) || 'Thermo Fisher Scientific';
    const description = source.querySelector('meta[name="description"]')?.getAttribute('content') || '';

    // homepage (control)
    const main = buildMain(document, source, controlHero);
    main.append(metadataTable(document, [
      ['Title', title],
      ['Description', description],
      ['Template', 'homepage'],
      ['Experiment', EXPERIMENT_ID],
      ['Experiment Status', 'active'],
      ['Experiment Variants', challengerPaths.join(', ')],
      ['Experiment Split', challengers.map(() => String(Math.floor(100 / (challengers.length + 1)))).join(', ')],
    ]));

    const results = [{
      element: main,
      path: '/index',
      report: { challengers: challengers.map((h) => h.headline).join(' | ') },
    }];

    // challengers: identical page, different hero
    challengers.forEach((hero, i) => {
      const heroTable = parseBlock(heroParser, heroSource(document, hero), document);
      const challengerMain = buildMain(document, source, heroTable);
      challengerMain.append(metadataTable(document, [
        ['Title', title],
        ['Description', description],
        ['Template', 'homepage'],
        ['Robots', 'noindex, nofollow'],
      ]));
      results.push({ element: challengerMain, path: challengerPaths[i] });
    });

    results.push({ element: buildNav(document, source), path: '/fragments/nav' });
    results.push({ element: buildFooter(document, source), path: '/fragments/footer' });
    return results;
  },
};
