/* The authenticated Ask service already returns sources. Only use reviewed local images. */
(() => {
  'use strict';
  // Versioned official blank forms. Provenance: assets/ask-evidence/README.md.
  const forms = new Map([
    ['169643557', '요양비 지급청구서 · 별지 제18호'],
    ['167381107', '요양비 지급청구서(산소치료) · 별지 제19호']
  ]);

  function formCitation(source) {
    if (typeof source?.url !== 'string') return null;
    let url;
    try { url = new URL(source.url); } catch { return null; }
    if (!['https://www.law.go.kr', 'https://law.go.kr'].includes(url.origin) || url.username || url.password ||
        !['/LSW/flDownload.do', '/flDownload.do'].includes(url.pathname)) return null;
    const ids = url.searchParams.getAll('flSeq'), classes = url.searchParams.getAll('bylClsCd');
    if (ids.length !== 1 || !forms.has(ids[0]) || classes.length > 1 || (classes.length && classes[0] !== '110202') ||
        [...url.searchParams.keys()].some(k => k !== 'flSeq' && k !== 'bylClsCd')) return null;
    const explicit = source.page == null ? '' : String(source.page).trim();
    const fragment = url.hash.match(/^#page=([12])$/);
    if ((explicit && !/^[12]$/.test(explicit)) || (url.hash && !fragment) || (explicit && fragment && fragment[1] !== explicit)) return null;
    const page = explicit || fragment?.[1];
    return { id: ids[0], pages: page ? [Number(page)] : [1, 2] };
  }

  function forSources(sources) {
    if (!Array.isArray(sources)) return [];
    const items = [], seen = new Set();
    for (const [i, source] of sources.entries()) {
      const citation = formCitation(source);
      if (!citation) continue;
      for (const page of citation.pages) {
        const url = `/assets/ask-evidence/nhis-form-${citation.id}-p${page}.webp`;
        if (seen.has(url)) continue;
        seen.add(url);
        items.push({ url, sourceIndex: i + 1, caption: `${forms.get(citation.id)} · ${page === 1 ? '앞쪽' : '뒤쪽'} (근거 ${i + 1})` });
      }
    }
    return items;
  }

  function render(result) {
    const items = forSources(result?.sources);
    if (!items.length) return null;
    const gallery = document.createElement('section');
    gallery.className = 'pa-ask-images';
    gallery.hidden = true;
    gallery.setAttribute('aria-label', '관련 이미지');
    const title = document.createElement('h4'); title.textContent = '관련 이미지';
    const grid = document.createElement('div'); grid.className = 'pa-ask-image-grid';
    gallery.append(title, grid);
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

    for (const item of items) {
      const caption = item.caption;
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
  window.PA_ASK_IMAGES = Object.freeze({ render, forSources });
})();
