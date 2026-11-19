/* eslint-disable */

/*
 * Source image file name -> AEM Assets URL (publish-p130746-e1275972), for images that live in
 * AEM Assets (/content/dam/thermofisher/...). Importers swap a source image for its AEM Assets
 * URL when it is listed here (with or without the WordPress size suffix, e.g. -1024x512);
 * unlisted images keep their source URL.
 */
const AEM = 'https://publish-p130746-e1275972.adobeaemcloud.com/content/dam/thermofisher';

export default {
  // Can UHPLC Take Over Serial Dilutions?
  'kohler-main-image-1.png': `${AEM}/blog/can-uhplc-take-over-serial-dilutions/kohler-main-image-1.jpg`,
  'Figure-1_Koehler-blog.png': `${AEM}/blog/can-uhplc-take-over-serial-dilutions/figure-1-koehler-blog.jpg`,
  'Figure-2_Koehler.png': `${AEM}/blog/can-uhplc-take-over-serial-dilutions/figure-2-koehler.jpg`,
  // authors
  'dennis-koehler-400x400.png': `${AEM}/authors/dennis-koehler-400x400.png`,
};
