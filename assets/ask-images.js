/* Render only explicit, source-bound assets returned by the authenticated Ask service. */
(() => {
  'use strict';
  const assetPath = /^\/assets\/ask-evidence\/[a-z0-9][a-z0-9_-]{0,159}\.(?:webp|png|jpe?g)$/i;

  function render(result) {
    if (!Array.isArray(result.images) || !Array.isArray(result.sources)) return null;
    const gallery = document.createElement('section');
    gallery.className = 'pa-ask-images';
    gallery.hidden = true;
    gallery.setAttribute('aria-label', '관련 이미지');
    const title = document.createElement('h4'); title.textContent = '관련 이미지';
    const grid = document.createElement('div'); grid.className = 'pa-ask-image-grid';
    gallery.append(title, grid);
    const seen = new Set();
    // The viewer is a child of the answer: navigating away or clearing it removes the image too.
    let viewer;
    function open(image, caption, trigger) {
      if (viewer?.open) return;
      const dialog = document.createElement('dialog'); dialog.className = 'pa-ask-image-dialog';
      dialog.setAttribute('aria-label', caption);
      const close = document.createElement('button'); close.type = 'button';
      close.className = 'pa-ask-image-close'; close.textContent = '닫기'; close.autofocus = true;
      const large = document.createElement('img'); large.src = image.src; large.alt = caption;
      const label = document.createElement('p'); label.textContent = caption;
      dialog.append(close, large, label);
      close.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
      });
      dialog.addEventListener('close', () => { dialog.remove(); if (trigger.isConnected) trigger.focus({ preventScroll: true }); }, { once: true });
      gallery.append(dialog); viewer = dialog; dialog.showModal();
    }

    for (const item of result.images.slice(0, 48)) {
      if (seen.size === 24) break;
      if (!item || !Number.isInteger(item.sourceIndex) || item.sourceIndex < 1 || !result.sources[item.sourceIndex - 1] ||
          typeof item.url !== 'string' || !assetPath.test(item.url) || seen.has(item.url)) continue;
      seen.add(item.url);
      const label = typeof item.caption === 'string' && item.caption.trim() ? item.caption.trim().slice(0, 140) : '근거 자료 ' + item.sourceIndex + ' 이미지';
      const caption = window.PA_ASK.maskResidentId(label);
      const button = document.createElement('button');
      button.className = 'pa-ask-image-tile'; button.type = 'button';
      button.setAttribute('aria-label', caption + ' 확대'); button.setAttribute('aria-haspopup', 'dialog');
      const image = document.createElement('img'); image.alt = caption; image.decoding = 'async';
      image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
      const text = document.createElement('span'); text.textContent = caption;
      image.addEventListener('error', () => { button.remove(); if (!grid.childElementCount) gallery.remove(); }, { once: true });
      button.addEventListener('click', () => { if (image.complete && image.naturalWidth) open(image, caption, button); });
      button.append(image, text); grid.append(button); image.src = item.url;
    }
    if (!grid.childElementCount) return null;
    gallery.hidden = false;
    return gallery;
  }
  window.PA_ASK_IMAGES = Object.freeze({ render });
})();
