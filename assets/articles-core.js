/* TASK-ART 작성글모음 공용(2026-11-09): 글 본문 안전하게 그리기 · [HTML 복사] · [서식 그대로 복사] · [그림 내려받기] · 게시 전 안내.
   작성글모음(/members/articles/)·내 정보 보관함(/members/me/)·관리자 화면이 같은 코드를 쓴다.
   본문은 생성기가 만든 HTML이지만 그대로 넣지 않고 허용한 태그·속성만 다시 만든다(그림은 우리 저장소 주소만).
   서식 그대로 복사: 네이버 블로그 편집기(스마트에디터 ONE)는 붙여넣은 HTML의 class·<style>을 버리고 일부 인라인 서식만 살리므로
   제목은 굵은 큰 글자, 표는 테두리 인라인, 그림은 공개 주소 <img>로 만든다(근거: 작업 폴더 evidence/research-naver-paste.md). */
(function () {
  'use strict';
  const STORE = 'https://ztypllzgjivutzorhayz.supabase.co/storage/v1/object/public/articles/';
  const TAGS = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'U', 'BR', 'HR', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'CAPTION', 'FIGURE', 'FIGCAPTION', 'IMG', 'A', 'SMALL', 'SPAN', 'MARK']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'LINK', 'META']);
  const ATTRS = { IMG: ['src', 'alt', 'width', 'height'], A: ['href'], TH: ['colspan', 'rowspan', 'scope'], TD: ['colspan', 'rowspan'] };
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
          if (v != null) e.setAttribute(a, a === 'alt' ? v.slice(0, 300) : v);
        });
        if (n.tagName === 'IMG' && !e.getAttribute('src')) return; // 우리 저장소가 아닌 그림은 버림
        if (n.tagName === 'A') { if (!e.getAttribute('href')) { walk(n, dst); return; } e.setAttribute('target', '_blank'); e.setAttribute('rel', 'noopener noreferrer'); }
        walk(n, e); dst.append(e);
      });
    };
    walk(doc.body, out);
    return out;
  }
  function render(article) {
    const body = el('div', { class: 'art-body' });
    body.append(sanitize(article.body_html));
    body.querySelectorAll('img').forEach(img => { img.loading = 'lazy'; img.decoding = 'async'; });
    body.querySelectorAll('table').forEach(t => { const wrap = el('div', { class: 'art-table-wrap', tabindex: '0', role: 'region', 'aria-label': '표 · 좌우로 밀어 볼 수 있습니다' }); t.replaceWith(wrap); wrap.append(t); });
    return body;
  }

  // ── 복사용 HTML ──
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 홈페이지·워드프레스용: 뜻이 분명한 기본 태그 + 그림 주소(alt·크기·늦게 불러오기)
  function webHtml(article) {
    const frag = sanitize(article.body_html), lines = [`<h1>${esc(article.title)}</h1>`];
    const ser = (n, depth) => {
      if (n.nodeType === 3) return esc(n.nodeValue);
      const t = n.tagName.toLowerCase(), kids = [...n.childNodes].map(c => ser(c, depth + 1)).join('');
      if (t === 'br') return '<br>';
      if (t === 'hr') return '<hr>';
      if (t === 'img') return `<img src="${esc(n.getAttribute('src'))}" alt="${esc(n.getAttribute('alt') || '')}"${n.getAttribute('width') ? ` width="${n.getAttribute('width')}" height="${n.getAttribute('height') || ''}"` : ''} loading="lazy" decoding="async" style="max-width:100%;height:auto">`;
      // 테마가 표를 꾸미지 않아도 보이게 테두리·여백만 인라인(워드프레스가 허용하는 속성)
      if (t === 'table') return `<table style="border-collapse:collapse;width:100%">${kids}</table>`;
      if (t === 'th' || t === 'td') return `<${t}${n.getAttribute('scope') ? ` scope="${esc(n.getAttribute('scope'))}"` : ''}${n.getAttribute('colspan') ? ` colspan="${n.getAttribute('colspan')}"` : ''} style="border:1px solid #cccccc;padding:8px;text-align:left${t === 'th' ? ';background-color:#f2f4f6' : ''}">${kids}</${t}>`;
      if (t === 'a') return `<a href="${esc(n.getAttribute('href'))}" target="_blank" rel="noopener">${kids}</a>`;
      const attrs = ['colspan', 'rowspan', 'scope'].filter(a => n.getAttribute(a)).map(a => ` ${a}="${esc(n.getAttribute(a))}"`).join('');
      return `<${t}${attrs}>${kids}</${t}>`;
    };
    [...frag.childNodes].forEach(n => { const s = ser(n, 0).trim(); if (s) lines.push(s); });
    return lines.join('\n');
  }
  // 네이버 블로그 편집기(스마트에디터 ONE)용 — 근거: evidence/research-naver-paste.md 7-1
  // 인라인 style만 · 문단 하나 = <p> 하나 · 글자 조각은 겹치지 않고 나란히(<b><span>) · 소제목은 굵은 24/19px 문단 ·
  // 목록은 '• '·'1) ' 글자 문단 · 표는 border="1"+칸마다 테두리 · 요약 상자는 1칸 표 · 그림은 단독 문단 + '▲ 설명' 줄 · 끝은 빈 문단
  const NV = { body: 16, small: 13, h2: 24, h3: 19, table: 15, color: '#222222', head: '#111111', link: '#0b57d0', cap: '#888888', line: '#cccccc', headBg: '#f2f4f6', boxBg: '#faf7ec', boxLine: '#e6d9a8' };
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
    const cell = (n, head) => `<td${head ? ` bgcolor="${NV.headBg}"` : ''} style="border:1px solid ${NV.line};padding:8px;${head ? `background-color:${NV.headBg};` : ''}"${n.getAttribute('colspan') ? ` colspan="${n.getAttribute('colspan')}"` : ''}>${head ? `<b>${inline(n, NV.table, NV.color)}</b>` : inline(n, NV.table, NV.color)}</td>`;
    const block = n => {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) out.push(P(span(n.nodeValue.trim(), NV.body, NV.color))); return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName.toLowerCase();
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
      const url = URL.createObjectURL(blob), a = el('a', { href: url, download: `${fileBase(article)}_그림${i + 1}.${ext}`, hidden: true });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); n++;
      await new Promise(res => setTimeout(res, 400)); // 여러 장을 연달아 받을 때 브라우저가 막지 않게
    }
    return n;
  }

  // 보관한 글 위에 붙이는 '게시 전 안내'(근거: 금소법·광고심의 자료, STANDARD-ART.md)
  function postingGuide() {
    return el('section', { class: 'art-guide', 'aria-labelledby': 'art-guide-title' },
      el('h3', { id: 'art-guide-title' }, '게시 전에 꼭 확인하세요'),
      el('ol', {},
        el('li', {}, el('b', {}, '본인 경험 한두 줄을 더하세요. '), '상담하며 실제로 겪은 일이나 고객이 자주 묻는 점을 한두 문장 넣으면 글이 더 믿음직하고, 다른 글과 겹치지 않습니다(고객 이름·연락처 등 개인정보는 넣지 마세요).'),
        el('li', {}, el('b', {}, '고친 뒤 광고심의를 받고 게시하세요. '), '블로그·홈페이지 글도 업무광고입니다. 회사 광고심의 절차로 심의를 받은 뒤, 받은 심의필 번호를 글 아래에 적어 게시하세요.'),
        el('li', {}, el('b', {}, '보험사 이름·상품 이름은 넣지 마세요. '), '넣으면 상품광고가 되어 심의 기준이 달라집니다. 숫자·제도는 게시 시점 기준으로 한 번 더 확인하세요.'),
        el('li', {}, el('b', {}, '글 아래 안내 문구는 지우지 마세요. '), '[대리점명·등록번호]·[심의필 번호] 자리는 본인 정보로 채우세요.')));
  }
  function tagChips(tags) {
    const t = tags || {}, list = [t.insurance, t.format, t.length].filter(v => typeof v === 'string' && v);
    return list.length ? el('ul', { class: 'art-tags', 'aria-label': '글 분류' }, ...list.map(v => el('li', {}, v))) : null;
  }
  const kDate = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }); };
  const daysLeft = v => { const d = Date.parse(v); return Number.isNaN(d) ? null : Math.max(0, Math.ceil((d - Date.now()) / 86400000)); };

  // 버튼 묶음: [HTML 복사] [서식 그대로 복사] [그림 내려받기]. getArticle: 글을 돌려주는 함수(필요할 때 받아 옴)
  function actionButtons(getArticle, status, opts) {
    const o = opts || {}, locked = !!o.locked;
    const say = t => { if (status) status.textContent = t; };
    const mk = (label, title, fn) => el('button', { type: 'button', class: 'g-btn g-btn--ghost art-act', disabled: locked, title, onclick: async ev => {
      const b = ev.currentTarget; b.disabled = true;
      try { await fn(b); } catch (e) { console.debug('[art action]', e); say(/image_/.test(e && e.message) ? '그림을 받지 못했습니다. 잠시 후 다시 눌러 주세요.' : '하지 못했습니다. 다시 눌러 주세요. 계속 안 되면 글을 직접 선택해 복사해 주세요.'); }
      finally { b.disabled = locked; }
    } }, label);
    const a = mk('HTML 복사', '홈페이지·워드프레스의 HTML(코드) 편집 칸에 붙여 넣는 형식', async () => { say('복사하는 중…'); await copyHtml(getArticle); say('HTML을 복사했습니다. 홈페이지의 HTML 편집 칸, 워드프레스는 \'사용자 정의 HTML\' 블록(또는 코드 편집기), 티스토리는 HTML 모드에 붙여 넣으세요. 그림 주소도 들어 있습니다.'); });
    const b = mk('서식 그대로 복사', '네이버 블로그 편집기에 그대로 붙여 넣는 형식', async () => { say('복사하는 중…'); await copyRich(getArticle); say('서식째 복사했습니다. 네이버 블로그 글쓰기 본문에 붙여 넣으세요(제목은 제목 칸에 따로). 그림이 안 들어오면 ▲ 설명 줄 위에 [그림 내려받기]로 받은 사진을 올려 주세요.'); });
    const c = mk('그림 내려받기', '글에 들어간 그림 파일을 모두 내려받기', async () => { const art = await Promise.resolve(getArticle()); const n = await downloadImages(art, (i, all) => say(`그림 ${i}/${all}장 내려받는 중…`)); say(n ? `그림 ${n}장을 내려받았습니다.` : '이 글에는 내려받을 그림이 없습니다.'); });
    return el('div', { class: 'art-actions', role: 'group', 'aria-label': '글 가져가기' }, a, b, c);
  }

  window.PA_ART_CORE = { STORE, el, sanitize, render, webHtml, naverHtml, plainText, copyHtml, copyRich, downloadImages, postingGuide, tagChips, actionButtons, kDate, daysLeft, fileBase };
})();
