/* eslint-disable */
/* global WebImporter */

/*
 * Accelerating Science contributor (author) page import.
 * One input (https://admin.acceleratingscience.com/contributor/{slug}/) -> two documents:
 *   /authors/{first-last}    metadata only: Title (name), Description, Role, Profile,
 *                            Expertise, Education, Image (profile picture), Template
 *   /fragments/nav-blog      the simplified blog navigation used by blog + author pages
 */

import AEM_ASSETS from './aem-assets.js';

const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

/** Name -> URL slug, transliterating umlauts (Köhler -> koehler). */
export function authorSlug(name) {
  return name.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Source image URL -> AEM Assets URL when known. */
function assetUrl(src) {
  const name = (src || '').split('?')[0].split('/').pop();
  return AEM_ASSETS[name] || src;
}

/** First sentences of the profile, as a short description. */
function summarize(profile, maxLength = 240) {
  const sentences = profile.match(/[^.!?]+[.!?]+/g) || [profile];
  let out = '';
  sentences.some((sentence) => {
    if (out && (out + sentence).length > maxLength) return true;
    out += sentence;
    return false;
  });
  return out.trim();
}

function metadataTable(document, entries) {
  return WebImporter.DOMUtils.createTable([['Metadata'], ...entries.filter(([, v]) => v)], document);
}

/** Simplified blog navigation: brand (logo + blog name) / Categories, About Us, Contact. */
function buildBlogNav(document) {
  const header = document.querySelector('header.site-header') || document;
  const nav = document.createElement('div');

  const logo = document.createElement('p');
  const home = document.createElement('a');
  home.href = '/';
  home.textContent = ':thermofisher-logo:';
  logo.append(home);
  const site = document.createElement('p');
  const blogHome = document.createElement('a');
  blogHome.href = 'https://www.thermofisher.com/blog/';
  blogHome.textContent = 'Accelerating Science';
  site.append(blogHome);
  nav.append(logo, site, document.createElement('hr'));

  const ul = document.createElement('ul');
  header.querySelectorAll('nav .menu > li').forEach((li) => {
    const label = text(li.querySelector(':scope > a'));
    const sub = li.querySelector(':scope > ul');
    const item = document.createElement('li');
    if (sub) {
      item.append(document.createTextNode(label));
      const list = document.createElement('ul');
      sub.querySelectorAll('a[href]').forEach((a) => {
        const subItem = document.createElement('li');
        const link = document.createElement('a');
        link.href = a.href;
        link.textContent = text(a);
        subItem.append(link);
        list.append(subItem);
      });
      item.append(list);
    } else {
      const a = li.querySelector('a[href]');
      if (!a) return;
      const link = document.createElement('a');
      link.href = a.href.replace(/\?.*$/, '');
      link.textContent = label;
      item.append(link);
    }
    ul.append(item);
  });
  nav.append(ul);
  return nav;
}

export default {
  transform: ({ document }) => {
    const name = text(document.querySelector('.contributor-content-wrapper h1, article h1'));
    const role = text(document.querySelector('article h1 + p'));
    const profile = [...document.querySelectorAll('article .entry-content p')].map(text).filter(Boolean).join(' ');
    const expertise = [...document.querySelectorAll('.expertise-tag')].map(text).filter(Boolean).join(', ');
    const educationHeading = [...document.querySelectorAll('h2')].find((h) => /education/i.test(text(h)));
    const education = text(educationHeading?.nextElementSibling);
    const headshot = document.querySelector('.headshot img');

    let image = '';
    if (headshot) {
      image = document.createElement('img');
      image.src = assetUrl(headshot.getAttribute('src'));
      image.alt = headshot.getAttribute('alt') || name;
    }

    const main = document.createElement('div');
    main.append(metadataTable(document, [
      ['Title', name],
      ['Description', summarize(profile)],
      ['Role', role],
      ['Profile', profile],
      ['Expertise', expertise],
      ['Education', education],
      ['Image', image],
      ['Template', 'author'],
    ]));

    return [
      { element: main, path: `/authors/${authorSlug(name)}` },
      { element: buildBlogNav(document), path: '/fragments/nav-blog' },
    ];
  },
};
