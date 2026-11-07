/* 보험자료 게시글 검색(2026-11-07). 공개된 qa/_data/posts.json 안에서만 찾는다. 서버·외부 전송 없음. */
(function () {
  'use strict';
  const form = document.querySelector('[data-qa-search]');
  if (!form || !window.fetch) return;
  const input = form.querySelector('input');
  const section = document.querySelector('main section');
  const grid = section && section.querySelector('.qa-grid, .qa-empty');
  const top = section && section.querySelector('.qa-list-top p');
  const pager = document.querySelector('.qa-pager');
  const filters = document.querySelector('.qa-filters');
  if (!section || !grid || !top) return;
  form.hidden = false;
  const original = { html: grid.outerHTML, count: top.textContent };
  let posts = null, holder = grid;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plain = v => String(v || '').replace(/<[^>]+>/g, ' ');
  const norm = v => String(v || '').toLowerCase().replace(/\s+/g, '');
  const load = () => posts ? Promise.resolve(posts) : fetch('/qa/_data/posts.json', { cache: 'no-cache' }).then(r => r.json()).then(list => {
    posts = (Array.isArray(list) ? list : []).map(p => ({ p, text: norm([p.question, (p.summary3 || []).join(' '), (p.tags || []).join(' '), p.field, plain(p.body_html)].join(' ')), title: norm(p.question) }));
    return posts;
  });
  const swap = html => { const box = document.createElement('div'); box.innerHTML = html; const next = box.firstElementChild; holder.replaceWith(next); holder = next; };
  const card = p => `<article class="qa-card"><div class="qa-meta"><span class="qa-field">${esc(p.field)}</span>${p.audience_label ? `<span class="qa-field qa-reader">${esc(p.audience_label)}</span>` : ''}<time datetime="${esc(p.date)}">${esc(String(p.date).replace(/-/g, '.'))}</time></div><h2><a class="qa-card-link" href="/qa/${esc(p.date)}-${esc(p.slug)}/">${esc(p.question)}</a></h2><p class="qa-card-summary">${esc((p.summary3 || []).slice(0, 2).join(' '))}</p><div class="qa-card-bottom"><span>질문과 답변</span><span class="qa-card-arrow" aria-hidden="true">↗</span></div></article>`;
  const show = q => {
    const words = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean).map(norm);
    if (!words.length) { swap(original.html); top.textContent = original.count; if (pager) pager.hidden = false; if (filters) filters.hidden = false; return; }
    load().then(list => {
      const found = list.filter(x => words.every(w => x.text.includes(w)))
        .sort((a, b) => (words.filter(w => b.title.includes(w)).length - words.filter(w => a.title.includes(w)).length) || String(b.p.datePublished || b.p.date).localeCompare(String(a.p.datePublished || a.p.date)));
      top.textContent = `‘${q.trim()}’ 검색 결과 ${found.length}개`;
      swap(found.length ? '<div class="qa-grid">' + found.map(x => card(x.p)).join('') + '</div>' : '<p class="qa-empty">찾는 글이 없습니다. 다른 낱말로 검색해 보세요.</p>');
      if (pager) pager.hidden = true;
      if (filters) filters.hidden = true;
    }).catch(() => { top.textContent = '검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'; });
  };
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value;
    const url = new URL(location.href); url.pathname = '/qa/';
    if (location.pathname !== '/qa/') { location.href = '/qa/?q=' + encodeURIComponent(q); return; }
    if (q.trim()) url.searchParams.set('q', q.trim()); else url.searchParams.delete('q');
    history.replaceState(null, '', url);
    show(q);
  });
  input.addEventListener('search', () => { if (!input.value) form.requestSubmit(); });
  const start = new URLSearchParams(location.search).get('q');
  if (start) { input.value = start; show(start); }
})();
