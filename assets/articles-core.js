/* TASK-ART 작성글모음 공용(2026-11-09, ART3 같은 날 밤: 글쓴이 줄·대표 그림 바로 불러오기·HTML 복사 구조화 데이터·그림 받기 이름 · ART4 2026-11-10: 'AI 작성' 표시 숨김·상품광고 표시·채울 자리 표시): 글 본문 안전하게 그리기 · [HTML 복사] · [서식 그대로 복사] · [그림 내려받기] · 게시 전 안내.
   작성글모음(/members/articles/)·내 정보 보관함(/members/me/)·관리자 화면이 같은 코드를 쓴다.
   본문은 생성기가 만든 HTML이지만 그대로 넣지 않고 허용한 태그·속성만 다시 만든다(그림은 우리 저장소 주소만).
   서식 그대로 복사: 네이버 블로그 편집기(스마트에디터 ONE)는 붙여넣은 HTML의 class·<style>을 버리고 일부 인라인 서식만 살리므로
   제목은 굵은 큰 글자, 표는 테두리 인라인, 그림은 공개 주소 <img>로 만든다(근거: 작업 폴더 evidence/research-naver-paste.md). */
(function () {
  'use strict';
  const STORE = 'https://ztypllzgjivutzorhayz.supabase.co/storage/v1/object/public/articles/';
  const TAGS = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'U', 'BR', 'HR', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'CAPTION', 'FIGURE', 'FIGCAPTION', 'IMG', 'A', 'SMALL', 'SPAN', 'MARK']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'LINK', 'META']);
  const ATTRS = { IMG: ['src', 'alt', 'width', 'height'], A: ['href'], TH: ['colspan', 'rowspan', 'scope'], TD: ['colspan', 'rowspan'], P: ['class'], SPAN: ['class'] };
  // 글 속 표시: warn = 금소법 경고문구(빨간 글자, 원문 그대로) · legal = 필수안내사항 · slot = 설계사가 채울 자리 · ai = (예전 글) AI 사용 표시 — ART4부터 보이지 않게 지움 · byline = 글쓴이·작성일·사실 확인일(ART3)
  // ART4: fill = 설계사가 채울 칸(심의필 번호·등록번호, 화면에서만 노란 칸) · pinfo = 상품광고 안내 문단 · ART5: 예금자보호 로고 자리·[확인 필요] 칸은 만들지 않음(있는 내용만)
  const MARKS = ['warn', 'legal', 'slot', 'ai', 'byline', 'fill', 'pinfo'];
  const AI_CAP = /\s*\(AI로 만든[^)]*\)\s*/g;   // 예전 글 캡션 끝의 'AI로 만든 그림' 표시
  const safeHref = v => { try { const u = new URL(v, location.href); return /^https?:$/.test(u.protocol) ? u.href : null; } catch (_) { return null; } };
  const safeImg = v => typeof v === 'string' && v.startsWith(STORE) && !/[\s"'<>]/.test(v) ? v : null;

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : String(v));
    });
    kids.flat().forEach(k => { if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k))); });
    return e;
  }

  // 허용한 것만 다시 만든 본문(DocumentFragment)
  function sanitize(html) {
    const doc = new DOMParser().parseFromString('<!doctype html><body>' + String(html || ''), 'text/html');
    const out = document.createDocumentFragment();
    const walk = (src, dst) => {
      src.childNodes.forEach(n => {
        if (n.nodeType === 3) { dst.append(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1 || DROP.has(n.tagName)) return;
        if (!TAGS.has(n.tagName)) { walk(n, dst); return; } // 모르는 태그는 글자만 살림
        const e = document.createElement(n.tagName.toLowerCase());
        (ATTRS[n.tagName] || []).forEach(a => {
          let v = n.getAttribute(a); if (v == null) return;
          if (a === 'href') v = safeHref(v);
          if (a === 'src') v = safeImg(v);
          if ((a === 'width' || a === 'height' || a === 'colspan' || a === 'rowspan') && !/^\d{1,4}$/.test(v)) v = null;
          if (a === 'scope' && !/^(row|col)$/.test(v)) v = null;
          if (a === 'class') v = MARKS.includes(String(v).trim()) ? String(v).trim() : null;
          if (v != null) e.setAttribute(a, a === 'alt' ? v.slice(0, 300) : v);
        });
        if (n.tagName === 'IMG' && !e.getAttribute('src')) return; // 우리 저장소가 아닌 그림은 버림
        if (n.tagName === 'A') { if (!e.getAttribute('href')) { walk(n, dst); return; } e.setAttribute('target', '_blank'); e.setAttribute('rel', 'noopener noreferrer'); }
        walk(n, e); dst.append(e);
      });
    };
    walk(doc.body, out);
    // ART4(대표 지시): 글·그림 위에 보이는 'AI 작성' 표시는 화면과 복사본 모두에서 뺀다(그림 파일 속 메타데이터 표시는 그대로)
    out.querySelectorAll('p.ai').forEach(p => p.remove());
    out.querySelectorAll('figcaption').forEach(c => { const t = c.textContent.replace(AI_CAP, ' ').trim(); if (t !== c.textContent) c.textContent = t; });
    return out;
  }
  function render(article) {
    const body = el('div', { class: 'art-body' });
    body.append(sanitize(article.body_html));
    body.querySelectorAll('img').forEach((img, i) => { img.loading = i ? 'lazy' : 'eager'; img.decoding = 'async'; if (!i) img.setAttribute('fetchpriority', 'high'); });   // ART3: 대표 그림은 바로(web.dev LCP)
    body.querySelectorAll('table').forEach(t => { const wrap = el('div', { class: 'art-table-wrap', tabindex: '0', role: 'region', 'aria-label': '표 · 좌우로 밀어 볼 수 있습니다' }); t.replaceWith(wrap); wrap.append(t); });
    // 필수안내사항 줄들을 상자 하나로
    body.querySelectorAll('p.legal').forEach(p => {
      const prev = p.previousElementSibling;
      if (prev && prev.classList.contains('art-legal')) { prev.append(p); return; }
      const box = el('div', { class: 'art-legal', role: 'note', 'aria-label': '필수안내사항' }); p.replaceWith(box); box.append(p);
    });
    return body;
  }

  // ── 복사용 HTML ──
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 홈페이지·워드프레스용: 뜻이 분명한 기본 태그 + 그림 주소(alt·크기·늦게 불러오기)
  function webHtml(article) {
    const frag = sanitize(article.body_html), lines = [`<h1>${esc(article.title)}</h1>`];
    let imgNo = 0;
    const ser = (n, depth) => {
      if (n.nodeType === 3) return esc(n.nodeValue);
      const t = n.tagName.toLowerCase(), kids = [...n.childNodes].map(c => ser(c, depth + 1)).join('');
      if (t === 'br') return '<br>';
      if (t === 'hr') return '<hr>';
      if (t === 'img') { const first = imgNo++ === 0; return `<img src="${esc(n.getAttribute('src'))}" alt="${esc(n.getAttribute('alt') || '')}"${n.getAttribute('width') ? ` width="${n.getAttribute('width')}" height="${n.getAttribute('height') || ''}"` : ''}${first ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async" style="max-width:100%;height:auto">`; }
      // 테마가 표를 꾸미지 않아도 보이게 테두리·여백만 인라인(워드프레스가 허용하는 속성)
      if (t === 'table') return `<table style="border-collapse:collapse;width:100%">${kids}</table>`;
      if (t === 'th' || t === 'td') return `<${t}${n.getAttribute('scope') ? ` scope="${esc(n.getAttribute('scope'))}"` : ''}${n.getAttribute('colspan') ? ` colspan="${n.getAttribute('colspan')}"` : ''} style="border:1px solid #cccccc;padding:8px;text-align:left${t === 'th' ? ';background-color:#f2f4f6' : ''}">${kids}</${t}>`;
      if (t === 'a') return `<a href="${esc(n.getAttribute('href'))}" target="_blank" rel="noopener">${kids}</a>`;
      if (t === 'p' && n.className === 'warn') return `<p style="color:#d0021b;font-weight:600">${kids}</p>`;
      if (t === 'p' && n.className === 'slot') return `<p style="background-color:#fff6d6;border:1px dashed #c9a227;padding:8px 10px">${kids}</p>`;
      if (t === 'p' && n.className === 'ai') return `<p><small>${kids}</small></p>`;
      if (t === 'p' && n.className === 'byline') return `<p style="font-size:14px;color:#555555">${kids}</p>`;
      const attrs = ['colspan', 'rowspan', 'scope'].filter(a => n.getAttribute(a)).map(a => ` ${a}="${esc(n.getAttribute(a))}"`).join('');
      return `<${t}${attrs}>${kids}</${t}>`;
    };
    let legal = [];
    const flush = () => { if (legal.length) { lines.push(`<div style="border:1px solid #999999;padding:12px 14px;font-size:13px;line-height:1.7;margin-top:16px">${legal.join('<br>\n')}</div>`); legal = []; } };
    [...frag.childNodes].forEach(n => {
      if (n.nodeType === 1 && n.tagName === 'P' && n.className === 'legal') { legal.push([...n.childNodes].map(c => ser(c, 1)).join('')); return; }
      flush(); const s = ser(n, 0).trim(); if (s) lines.push(s);
    });
    flush();
    const ld = jsonLd(article); if (ld) lines.push(ld);
    return lines.join('\n');
  }
  // ART3 구조화 데이터(구글 Article/BlogPosting 권장 속성). 붙여 넣는 곳이 지워도 글에는 영향 없음.
  // 글쓴이 이름(설계사 OOO)은 게시할 때 본인 이름으로, 게시일(datePublished)은 게시하는 날로 넣는다.
  function jsonLd(article) {
    const ims = (article.images || []).filter(i => i && safeImg(i.url));
    if (!ims.length) return '';
    const image = [...new Set([ims[0].og, ims[0].url].filter(u => u && safeImg(u)))];
    const d = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: String(article.title || '').slice(0, 110), description: String(article.summary || '').slice(0, 300), image, inLanguage: 'ko-KR', author: { '@type': 'Person', name: '설계사 OOO' } };
    return `<!-- 검색 노출용 정보(구조화 데이터): 게시할 때 "설계사 OOO"를 본인 이름으로 바꾸고, 원하면 "datePublished":"게시일(예: 2026-11-20)"을 더하세요. 지워져도 글에는 영향 없습니다. -->\n<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`;
  }
  // 네이버 블로그 편집기(스마트에디터 ONE)용 — 근거: evidence/research-naver-paste.md 7-1
  // 인라인 style만 · 문단 하나 = <p> 하나 · 글자 조각은 겹치지 않고 나란히(<b><span>) · 소제목은 굵은 24/19px 문단 ·
  // 목록은 '• '·'1) ' 글자 문단 · 표는 border="1"+칸마다 테두리 · 요약 상자는 1칸 표 · 그림은 단독 문단 + '▲ 설명' 줄 · 끝은 빈 문단
  const NV = { body: 16, small: 13, h2: 24, h3: 19, table: 15, warn: '#d0021b', color: '#222222', head: '#111111', link: '#0b57d0', cap: '#888888', line: '#cccccc', headBg: '#f2f4f6', boxBg: '#faf7ec', boxLine: '#e6d9a8' };
  const span = (text, size, color, extra) => `<span style="font-size:${size}px;color:${color};${extra || ''}">${esc(text)}</span>`;
  // 문장 안의 굵게·링크·형광펜을 '나란한 조각'으로 편다
  function runs(node, size, color, acc = [], st = {}) {
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) { if (n.nodeValue) acc.push({ t: n.nodeValue, ...st }); return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName.toLowerCase();
      if (t === 'br') { acc.push({ br: true }); return; }
      if (t === 'img' || t === 'table' || t === 'figure') return;
      const next = { ...st };
      if (t === 'strong' || t === 'b') next.b = true;
      if (t === 'mark') next.mark = true;
      if (t === 'small') next.small = true;
      if (t === 'a' && n.getAttribute('href')) next.href = n.getAttribute('href');
      runs(n, size, color, acc, next);
    });
    return acc;
  }
  function inline(node, size, color, prefix) {
    const list = runs(node, size, color);
    if (prefix) { if (list[0] && list[0].t != null && !list[0].b && !list[0].href) list[0] = { ...list[0], t: prefix + list[0].t }; else list.unshift({ t: prefix }); }
    return list.map(r => {
      if (r.br) return '<br>';
      const sz = r.small ? NV.small : size, col = r.href ? NV.link : color;
      let h = span(r.t, sz, col, r.mark ? 'background-color:#fff3b0;' : '');
      if (r.b) h = `<b>${h}</b>`;
      if (r.href) h = `<a href="${esc(r.href)}">${h}</a>`;
      return h;
    }).join('');
  }
  const P = html => `<p>${html}</p>`, BLANK = '<p><br></p>';
  function naverHtml(article) {
    const frag = sanitize(article.body_html), out = [];
    let legal = [];
    // 필수안내사항 줄들은 테두리 상자 하나(1칸 표)로 묶는다 — 네이버에서 테두리가 살아남는 형식
    const flushLegal = () => { if (!legal.length) return; out.push(BLANK, `<table border="1" cellpadding="12" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;border:1px solid #999999;"><tbody><tr><td style="border:1px solid #999999;padding:12px;">${legal.join('<br>')}</td></tr></tbody></table>`); legal = []; };
    const cell = (n, head) => `<td${head ? ` bgcolor="${NV.headBg}"` : ''} style="border:1px solid ${NV.line};padding:8px;${head ? `background-color:${NV.headBg};` : ''}"${n.getAttribute('colspan') ? ` colspan="${n.getAttribute('colspan')}"` : ''}>${head ? `<b>${inline(n, NV.table, NV.color)}</b>` : inline(n, NV.table, NV.color)}</td>`;
    const block = n => {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) out.push(P(span(n.nodeValue.trim(), NV.body, NV.color))); return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName.toLowerCase();
      if (t === 'p' && n.className === 'legal') { legal.push(inline(n, NV.small, '#444444')); return; }
      flushLegal();
      if (t === 'p' && n.className === 'warn') { out.push(P(`<b>${inline(n, NV.body, NV.warn)}</b>`)); return; }
      if (t === 'p' && n.className === 'slot') { out.push(P(span(n.textContent.trim(), NV.body, '#7a5a00', 'background-color:#fff3b0;'))); return; }
      if (t === 'p' && n.className === 'ai') { out.push(P(span(n.textContent.trim(), NV.small, '#666666'))); return; }
      if (t === 'p' && n.className === 'byline') { out.push(P(span(n.textContent.trim(), NV.small, '#555555'))); return; }
      if (t === 'p') { const h = inline(n, NV.body, NV.color); if (h.replace(/<[^>]+>/g, '').trim()) out.push(P(h)); return; }
      if (t === 'h2') { out.push(BLANK, P(`<b>${span(n.textContent.trim(), NV.h2, NV.head)}</b>`)); return; }
      if (t === 'h3' || t === 'h4') { out.push(P(`<b>${span(n.textContent.trim(), NV.h3, NV.head)}</b>`)); return; }
      if (t === 'ul' || t === 'ol') { let i = 0; n.querySelectorAll(':scope > li').forEach(li => { i++; out.push(P(inline(li, NV.body, NV.color, t === 'ol' ? `${i}) ` : '• '))); }); return; }
      if (t === 'blockquote' || t === 'aside') {
        const parts = [...n.children].length ? [...n.children].map(c => inline(c, NV.body, NV.color)).join('<br>') : inline(n, NV.body, NV.color);
        out.push(`<table border="1" cellpadding="12" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;border:1px solid ${NV.boxLine};"><tbody><tr><td bgcolor="${NV.boxBg}" style="border:1px solid ${NV.boxLine};padding:12px;background-color:${NV.boxBg};">${parts}</td></tr></tbody></table>`, BLANK); return;
      }
      if (t === 'table') {
        const rows = [...n.querySelectorAll('tr')].map(tr => `<tr>${[...tr.children].map(c => cell(c, c.tagName === 'TH' || !!c.closest('thead'))).join('')}</tr>`).join('\n');
        const cap = n.querySelector('caption');
        if (cap) out.push(P(`<b>${span(cap.textContent.trim(), NV.body, NV.head)}</b>`));
        out.push(`<table border="1" cellpadding="8" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;border:1px solid ${NV.line};"><tbody>\n${rows}\n</tbody></table>`, BLANK); return;
      }
      if (t === 'figure' || t === 'img') {
        const img = t === 'img' ? n : n.querySelector('img'), cap = t === 'figure' ? n.querySelector('figcaption') : null;
        if (img) out.push(P(`<img src="${esc(img.getAttribute('src'))}" alt="${esc(img.getAttribute('alt') || '')}">`));
        if (cap && cap.textContent.trim()) out.push(P(span('▲ ' + cap.textContent.trim(), NV.small, NV.cap)));
        out.push(BLANK); return;
      }
      if (t === 'hr') { out.push(BLANK); return; }
      if (t === 'small') { out.push(P(span(n.textContent.trim(), NV.small, '#666666'))); return; }
      n.childNodes.forEach(block); // 그 밖의 묶음은 안쪽만
    };
    frag.childNodes.forEach(block);
    flushLegal();
    out.push(BLANK);
    return out.join('\n');
  }
  // 글자만(붙여넣기 대체용): 줄 바꿈을 살린 순수 글
  function plainText(article) {
    const frag = sanitize(article.body_html), out = [article.title, ''];
    const block = new Set(['p', 'h2', 'h3', 'h4', 'li', 'blockquote', 'figcaption', 'caption', 'tr']);
    const walk = (n, acc) => {
      if (n.nodeType === 3) { acc.push(n.nodeValue); return; }
      const t = n.tagName.toLowerCase();
      if (t === 'img') return;
      if (t === 'br') { acc.push('\n'); return; }
      if (t === 'td' || t === 'th') { const s = []; n.childNodes.forEach(c => walk(c, s)); acc.push(s.join('').trim() + ' | '); return; }
      const s = []; n.childNodes.forEach(c => walk(c, s));
      let text = s.join('');
      if (t === 'li') text = '• ' + text.trim();
      if (t === 'h2' || t === 'h3') text = '\n' + text.trim();
      if (t === 'figcaption') text = '[사진] ' + text.trim();
      if (t === 'tr') text = '| ' + text.trim();
      acc.push(block.has(t) ? text.trim() + '\n' : text);
    };
    frag.childNodes.forEach(n => { const s = []; walk(n, s); const v = s.join('').replace(/\n{3,}/g, '\n\n'); if (v.trim()) out.push(v.trimEnd()); });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // ── 클립보드(근거: evidence/research-naver-paste.md 6·7-4) ──
  // 1순위: 누른 순간 동기로 execCommand('copy') + copy 이벤트에서 우리가 만든 text/html·text/plain을 넣기(카톡 안 브라우저·아이폰에서도 됨)
  // 2순위: 비동기 클립보드(ClipboardItem, 값은 Blob). 글을 아직 안 받았으면 Blob 약속(Promise)으로 넘겨 누른 순간에 쓰기 시작(사파리 규칙)
  function copyViaCopyEvent(html, text) {
    const ta = document.createElement('textarea');
    ta.value = text || ' '; ta.setAttribute('readonly', ''); ta.setAttribute('aria-hidden', 'true');
    Object.assign(ta.style, { position: 'fixed', left: '0', top: '0', width: '1px', height: '1px', opacity: '0.01', fontSize: '16px', border: '0', padding: '0', pointerEvents: 'none', zIndex: '-1' }); // 숨김(display:none)이면 아이폰에서 실패
    document.body.appendChild(ta);
    const onCopy = e => { if (!e.clipboardData) return; if (html) e.clipboardData.setData('text/html', html); e.clipboardData.setData('text/plain', text); e.preventDefault(); };
    document.addEventListener('copy', onCopy, true);
    const active = document.activeElement;
    ta.focus({ preventScroll: true }); ta.select(); try { ta.setSelectionRange(0, ta.value.length); } catch (_) {}
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    document.removeEventListener('copy', onCopy, true); ta.remove();
    if (active && active.focus) active.focus({ preventScroll: true });
    return ok;
  }
  function copyViaAsync(parts, rich) {
    if (!(window.isSecureContext && navigator.clipboard && window.ClipboardItem && navigator.clipboard.write)) return Promise.reject(new Error('no_clipboard'));
    const p = Promise.resolve(parts), item = { 'text/plain': p.then(x => new Blob([x.text], { type: 'text/plain' })) };
    if (rich) item['text/html'] = p.then(x => new Blob([x.html], { type: 'text/html' }));
    return navigator.clipboard.write([new ClipboardItem(item)]).then(() => 'clipboard.write');
  }
  // make(article) → {html?, text}. getArticle()이 글을 바로 주면 동기 복사, 약속을 주면 비동기 복사.
  function copyWith(getArticle, make, rich) {
    const v = getArticle();
    if (v && typeof v.then !== 'function') {
      const parts = make(v);
      if (copyViaCopyEvent(rich ? parts.html : null, parts.text)) return Promise.resolve('execCommand');
      return copyViaAsync(parts, rich);
    }
    const pending = Promise.resolve(v).then(make);
    return copyViaAsync(pending, rich).catch(e => pending.then(parts => { if (copyViaCopyEvent(rich ? parts.html : null, parts.text)) return 'execCommand'; throw e; }));
  }
  function fileBase(article) { return String(article.title || '글').replace(/[\\/:*?"<>|#%]/g, '').replace(/\s+/g, '_').slice(0, 40) || '글'; }
  const copyHtml = getArticle => copyWith(getArticle, a => ({ text: webHtml(a) + '\n' }), false);
  const copyRich = getArticle => copyWith(getArticle, a => ({ html: naverHtml(a), text: plainText(a) }), true);
  async function downloadImages(article, onStep) {
    const imgs = (article.images || []).filter(i => safeImg(i.url));
    let n = 0;
    for (const [i, img] of imgs.entries()) {
      if (onStep) onStep(i + 1, imgs.length);
      const r = await fetch(img.url, { mode: 'cors', credentials: 'omit' });
      if (!r.ok) throw new Error('image_' + r.status);
      const blob = await r.blob(), ext = /png/.test(blob.type) ? 'png' : /webp/.test(blob.type) ? 'webp' : 'jpg';
      const nm = String(img.name || '').replace(/[\\/:*?"<>|#%]/g, '').trim();   // ART3: 그림 내용을 뜻하는 이름(네이버는 사진 설명칸이 없어 파일 이름이 설명 역할)
      const url = URL.createObjectURL(blob), a = el('a', { href: url, download: nm ? `${i + 1}_${nm}.${ext}` : `${fileBase(article)}_그림${i + 1}.${ext}`, hidden: true });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); n++;
      await new Promise(res => setTimeout(res, 400)); // 여러 장을 연달아 받을 때 브라우저가 막지 않게
    }
    return n;
  }

  // 보관한 글 위에 붙이는 '게시 전 안내'(근거: 금소법·광고심의 자료, 심의기준-정리본.md). ART4: 업무광고·상품광고에 따라 다르게
  const isProduct = m => !!m && (m.ad === 'product' || m.ad_type === 'product');
  const PRODUCT_LABEL = '상품광고(협회 심의 필요)';
  function postingGuide(meta) {
    const P = isProduct(meta), pr = (meta && meta.product) || {};
    const common = [];   // 2026-11-12 이사님: 경험 칸·현장 이야기 안내 삭제(글에 더 이상 없음)
    const items = P ? [
      el('li', {}, el('b', {}, '이 글은 상품광고입니다. '), `${pr.insurer || '보험사'} 「${pr.name || '상품'}」 한 상품만 다룹니다. 팜스 광고심의에서 [상품광고] 탭으로 보험회사·상품명을 정확히 적어 신청하면 본사 → 보험사 심의(약 2개월, 진행 표시 '협회(보험사) 심사중')를 거칩니다. 상품요약서·약관(근거 자료)을 증빙 PDF로 함께 내세요.`),
      el('li', {}, el('b', {}, '노란 칸을 채우세요. '), `"설계사 OOO"·협회 등록번호는 본인 정보로, "${pr.review_no_slot || '보험사 준법감시필 제00000호'}"는 심의 신청 때 그대로 두었다가 승인 뒤 받은 번호·기간으로 바꿉니다.`),
      el('li', {}, el('b', {}, '예금자보호한도 로고는 직접 넣으세요. '), '2026년 9월부터 상품광고에는 예금자보호한도 로고를 함께 넣어야 합니다. 이 글에는 공식 파일이 없어 넣지 않았습니다(비슷하게 그린 그림도 쓰지 않음). 심의 신청 전에 예금보험공사 공식 로고 파일을 맨 아래 예금자보호 문구 옆에 넣으세요.'),
      el('li', {}, el('b', {}, '빨간 안내 문구와 맨 아래 필수안내사항은 본인에 맞게 수정해서 사용하세요. (있으면) 보험료·환급금 표는 그대로 두세요. '), `이 글은 ${pr.basis || '근거 자료'}${pr.basis_ym ? '(' + pr.basis_ym + ' 자료 기준)' : ''}에 실제로 있는 내용만 담았습니다. 자료에 없는 항목(보험료 예시 등)은 일부러 뺐으니 빈칸을 만들어 채우지 마세요. 상품이 개정되면 다시 심의를 받아야 합니다. 다른 보험사·다른 상품과 비교하는 문장을 넣으면 안 됩니다.`),
      ...common] : [
      ...common,
      el('li', {}, el('b', {}, '고친 뒤 광고심의를 받고 게시하세요. '), '블로그·홈페이지 글도 업무광고입니다. 팜스 광고심의(업무광고)로 신청하고, "참고한 자료"의 원문을 증빙으로 함께 내세요. 승인 뒤에는 고치지 말고 그대로 게시합니다.'),
      el('li', {}, el('b', {}, '보험사 이름·상품 이름은 넣지 마세요. '), '넣으면 상품광고가 되어 심의 기준이 달라집니다. 숫자·제도는 게시 시점 기준으로 한 번 더 확인하세요.'),
      el('li', {}, el('b', {}, '빨간 안내 문구와 맨 아래 필수안내사항은 본인에 맞게 수정해서 사용하세요. '), '"설계사 OOO"와 협회 등록번호는 본인 정보로 바꾸고, 심의필 번호·기간(제00000호, 0000.00.00)은 심의 신청 때는 그대로 두었다가 승인 뒤 받은 번호로 바꿉니다.')];
    return el('section', { class: 'art-guide', 'aria-labelledby': 'art-guide-title' }, el('h3', { id: 'art-guide-title' }, '게시 전에 꼭 확인하세요'), el('ol', {}, ...items));
  }
  // ART4 상품광고 표시(글 보기 맨 위) — 본문 밖이라 복사되지 않음
  function adNote(meta) {
    if (!isProduct(meta)) return null;
    const pr = meta.product || {};
    return el('div', { class: 'art-adnote', role: 'note', 'aria-label': PRODUCT_LABEL },
      el('strong', {}, PRODUCT_LABEL),
      el('p', {}, `${pr.insurer || ''} 「${pr.name || ''}」 한 상품만 다루는 상품광고입니다. 업무광고와 달리 본사 → 보험사 심의(약 2개월)를 받아야 게시할 수 있습니다.`),
      el('p', {}, '심의필 번호 넣는 자리: 글 맨 아래 노란 칸 ', el('mark', {}, pr.review_no_slot || '보험사 준법감시필 제00000호 (0000.00.00~0000.00.00)'), pr.basis ? ` · 근거 자료: ${pr.basis}` : '', pr.basis_ym ? ` · ${pr.basis_ym} 자료 기준(판매 중지 여부는 자료로 알 수 없음)` : ''));
  }
  function tagChips(tags) {
    const t = tags || {}, list = [t.insurance, t.format, t.length].filter(v => typeof v === 'string' && v);
    const items = (t.draft || t.revision?.is_draft ? [el('li', { class: 'is-draft' }, '최신 내용 반영 초안')] : []).concat(isProduct(t) ? [el('li', { class: 'is-product' }, PRODUCT_LABEL)] : [], list.map(v => el('li', {}, v)));
    return items.length ? el('ul', { class: 'art-tags', 'aria-label': '글 분류' }, ...items) : null;
  }
  // ART7: 저장된 검색어·시리즈만 보여 준다. 예전 글의 태그를 화면에서 임의로 만들어 넣지 않는다.
  function hashtags(meta) {
    const values = Array.isArray(meta?.hashtags) ? meta.hashtags : [];
    const tags = [...new Set(values.filter(v => typeof v === 'string' && /^#[가-힣A-Za-z0-9]{2,50}$/.test(v)))].slice(0, 10);
    return tags.length >= 5 ? tags : [];
  }
  function seriesLabel(meta) {
    const s = meta?.series;
    if (!s || typeof s.name !== 'string' || !s.name.trim() || !Number.isInteger(Number(s.number)) || Number(s.number) < 1) return '';
    return `${s.name} · ${Number(s.number)}편${Number(s.total) >= Number(s.number) ? ` / ${Number(s.total)}편` : ''}`;
  }
  function searchMeta(meta) {
    const label = seriesLabel(meta), tags = hashtags(meta);
    if (!label && !tags.length) return null;
    return el('div', { class: 'art-search-meta' },
      label ? el('p', { class: 'art-series' }, label) : null,
      tags.length ? el('p', { class: 'art-hashtags', 'aria-label': '해시태그' }, tags.join(' ')) : null);
  }
  const copyHashtags = getArticle => copyWith(getArticle, a => {
    const tags = hashtags(a.meta || a.tags);
    if (!tags.length) throw new Error('art_no_hashtags');
    return { text: tags.join(' ') };
  }, false);

  // ART7: 버튼은 요청만 대기열에 넣는다. 생성·심의·원문대조·새 초안 저장은 맥 생성기가 한다.
  // 기능 확인이 성공해야 활성화하므로 SQL 미적용 상태에서 요청을 성공했다고 표시하지 않는다.
  const refreshCapabilities = new WeakMap();
  function refreshError(e) {
    const code = `${e?.code || ''} ${e?.message || ''}`;
    if (/PGRST202|42883|function.*not.*exist|schema cache/i.test(code)) return '최신 내용 반영 기능은 준비 중입니다. 관리자에게 기능 설정을 확인해 달라고 알려 주세요.';
    if (/42501|art_forbidden|refresh_forbidden|401|JWT|stale_session/i.test(code)) return '요청 권한이나 로그인 상태를 확인할 수 없습니다. 다시 로그인한 뒤 확인해 주세요.';
    if (/art_not_found|refresh_source|P0002/i.test(code)) return '원래 글을 확인할 수 없습니다. 보관함을 새로 열어 주세요.';
    return '요청 상태를 확인하지 못했습니다. 연결을 확인하고 상태를 새로고침해 주세요.';
  }
  function refreshControls(sb, article, opts = {}) {
    const info = el('p', { class: 'art-lock-note' }, '원래 글은 그대로 두고, 같은 주제·검색어를 최신 자료로 다시 확인한 새 초안을 내 보관함에 추가합니다. 생성과 검사가 끝날 때까지 기다려 주세요. 새 초안도 광고심의 후 게시하세요.');
    const status = el('p', { class: 'art-status', role: 'status', 'aria-live': 'polite' }, '최신 내용 반영 기능을 확인하는 중…');
    const result = el('span', { class: 'art-refresh-result' });
    const request = el('button', { type: 'button', class: 'g-btn g-btn--ghost art-act', disabled: true }, '최신 내용 반영판 만들기');
    const reload = el('button', { type: 'button', class: 'g-btn g-btn--ghost art-act', disabled: true }, '요청 상태 새로고침');
    const box = el('section', { class: 'art-refresh', 'aria-label': '최신 내용 반영판 만들기' }, el('div', { class: 'art-row' }, request, reload, result), info, status);
    let current = null, requestKey = null, working = false;
    const valid = () => { if (opts.check) opts.check(); };
    const active = () => current && ['queued', 'processing'].includes(current.status);
    const uuid = () => {
      if (crypto.randomUUID) return crypto.randomUUID();
      const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
      return [...b].map((v, i) => ([4, 6, 8, 10].includes(i) ? '-' : '') + v.toString(16).padStart(2, '0')).join('');
    };
    const show = row => {
      current = row || null; result.replaceChildren();
      const messages = {
        queued: '요청을 접수했습니다. 맥 생성기가 처리할 차례를 기다리고 있습니다. 원래 글은 그대로 보관됩니다.',
        processing: '최신 자료를 확인하고 새 초안을 만드는 중입니다. 원래 글은 그대로 보관됩니다.',
        succeeded: '새 초안을 만들었습니다. 내용과 출처를 확인한 뒤 광고심의를 받고 게시하세요.',
        failed: '새 초안을 완성하지 못했습니다. 원래 글은 그대로 있습니다. 다시 요청할 수 있습니다.'
      };
      status.textContent = row ? messages[row.status] || '요청 상태를 확인해 주세요.' : '요청하면 대기열에 접수됩니다. 원래 글을 덮어쓰거나 게시하지 않습니다.';
      if (row?.status === 'succeeded' && /^[0-9a-f-]{36}$/i.test(row.result_article_id || '')) result.append(el('a', { href: '/members/articles/#a=' + row.result_article_id }, '새 초안 보기 →'));
      if (row && ['succeeded', 'failed'].includes(row.status)) requestKey = null;
      request.disabled = !!active();
    };
    async function load(force = false) {
      if (working) return;
      working = true; request.disabled = true; reload.disabled = true;
      try {
        if (opts.verify) await opts.verify(); valid();
        if (force) refreshCapabilities.delete(sb);
        if (!refreshCapabilities.has(sb)) refreshCapabilities.set(sb, sb.rpc('art_refresh_capabilities').then(r => {
          if (r.error) throw r.error;
          if (!r.data?.enabled || Number(r.data.version) < 7) throw new Error('art_refresh_function_not_exist');
          return r.data;
        }).catch(e => { refreshCapabilities.delete(sb); throw e; }));
        await refreshCapabilities.get(sb); valid();
        const r = await sb.rpc('art_refresh_status', { p_article_id: article.id }); valid();
        if (r.error) throw r.error;
        show(r.data);
      } catch (e) { request.disabled = true; status.textContent = refreshError(e); }
      finally { working = false; reload.disabled = false; }
    }
    request.addEventListener('click', async () => {
      if (working || active() || request.disabled) return;
      working = true; request.disabled = true; reload.disabled = true;
      status.textContent = '요청을 접수하는 중…';
      try {
        if (opts.verify) await opts.verify(); valid();
        if (!requestKey) requestKey = uuid();
        const r = await sb.rpc('art_request_refresh', { p_article_id: article.id, p_request_key: requestKey }); valid();
        if (r.error) throw r.error;
        if (!r.data?.id || !['queued', 'processing', 'succeeded', 'failed'].includes(r.data.status)) throw new Error('invalid_refresh_response');
        show(r.data);
      } catch (e) { status.textContent = refreshError(e) + ' 접수 여부를 모를 때는 상태 새로고침을 먼저 눌러 주세요.'; request.disabled = true; }
      finally { working = false; reload.disabled = false; }
    });
    reload.addEventListener('click', () => load(true));
    load();
    return box;
  }
  const kDate = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }); };
  const daysLeft = v => { const d = Date.parse(v); return Number.isNaN(d) ? null : Math.max(0, Math.ceil((d - Date.now()) / 86400000)); };

  // 버튼 묶음: [HTML 복사] [서식 그대로 복사] [그림 내려받기]. getArticle: 글을 돌려주는 함수(필요할 때 받아 옴)
  function actionButtons(getArticle, status, opts) {
    const o = opts || {}, locked = !!o.locked;
    const say = t => { if (status) status.textContent = t; };
    const mk = (label, title, fn) => el('button', { type: 'button', class: 'g-btn g-btn--ghost art-act', disabled: locked, title, onclick: async ev => {
      const b = ev.currentTarget; b.disabled = true;
      try { await fn(b); } catch (e) { console.debug('[art action]', e); say(e?.message === 'art_no_hashtags' ? '이 글에는 저장된 해시태그가 없습니다. 최신 내용 반영판을 만들면 새 초안에 해시태그가 포함됩니다.' : /image_/.test(e && e.message) ? '그림을 받지 못했습니다. 잠시 후 다시 눌러 주세요.' : '하지 못했습니다. 다시 눌러 주세요. 계속 안 되면 글을 직접 선택해 복사해 주세요.'); }
      finally { b.disabled = locked; }
    } }, label);
    const a = mk('HTML 복사', '홈페이지·워드프레스의 HTML(코드) 편집 칸에 붙여 넣는 형식', async () => { say('복사하는 중…'); await copyHtml(getArticle); say('HTML을 복사했습니다. 홈페이지의 HTML 편집 칸, 워드프레스는 \'사용자 정의 HTML\' 블록(또는 코드 편집기), 티스토리는 HTML 모드에 붙여 넣으세요. 그림 주소도 들어 있습니다.'); });
    const b = mk('서식 그대로 복사', '네이버 블로그 편집기에 그대로 붙여 넣는 형식', async () => { say('복사하는 중…'); await copyRich(getArticle); say('서식째 복사했습니다. 네이버 블로그 글쓰기 본문에 붙여 넣으세요(제목은 제목 칸에 따로). 그림이 안 들어오면 ▲ 설명 줄 위에 [그림 내려받기]로 받은 사진을 올려 주세요.'); });
    const c = mk('그림 내려받기', '글에 들어간 그림 파일을 모두 내려받기', async () => { const art = await Promise.resolve(getArticle()); const n = await downloadImages(art, (i, all) => say(`그림 ${i}/${all}장 내려받는 중…`)); say(n ? `그림 ${n}장을 내려받았습니다.` : '이 글에는 내려받을 그림이 없습니다.'); });
    const d = mk('해시태그 복사', '저장된 검색어형 해시태그 5~10개를 복사하기', async () => { await copyHashtags(getArticle); say('해시태그를 복사했습니다. 블로그의 태그 입력 칸에 붙여 넣으세요.'); });
    return el('div', { class: 'art-actions', role: 'group', 'aria-label': '글 가져가기' }, ...(o.hashtagsOnly ? [d] : o.copyOnly ? [a, b] : [a, b, c, d]));   // copyOnly: 작성글모음 글 안(2026-11-12 이사님: 그림 내려받기·해시태그 복사 삭제)
  }

  window.PA_ART_CORE = { STORE, el, sanitize, render, webHtml, naverHtml, plainText, copyHtml, copyRich, copyHashtags, hashtags, seriesLabel, searchMeta, refreshControls, downloadImages, postingGuide, adNote, isProduct, PRODUCT_LABEL, tagChips, actionButtons, kDate, daysLeft, fileBase };
})();
